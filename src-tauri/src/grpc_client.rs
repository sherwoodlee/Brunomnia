use crate::models::{
    GrpcCallInput, GrpcCallOutput, GrpcMethodInfo, GrpcSchemaInput, GrpcSchemaOutput,
    GrpcServiceInfo, KeyValue, TransportConfig,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, MessageDescriptor};
use prost_types::{FileDescriptorProto, FileDescriptorSet};
use std::{collections::HashSet, fs, time::Instant};
use tonic::{
    codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder},
    metadata::{Ascii, MetadataKey, MetadataValue},
    transport::{Channel, Endpoint, Identity},
    Request, Status,
};

pub async fn load_schema(input: GrpcSchemaInput) -> Result<GrpcSchemaOutput, String> {
    let (pool, bytes) = if input.source == "proto" {
        compile_proto(&input.proto_text)?
    } else {
        reflect_schema(&input.endpoint, &input.metadata, &input.transport).await?
    };
    Ok(schema_output(&pool, &bytes))
}

pub async fn call(input: GrpcCallInput) -> Result<GrpcCallOutput, String> {
    let descriptor_bytes = STANDARD
        .decode(&input.descriptor_set_base64)
        .map_err(|error| format!("Invalid descriptor set: {error}"))?;
    let pool = DescriptorPool::decode(descriptor_bytes.as_slice())
        .map_err(|error| format!("Unable to decode descriptors: {error}"))?;
    let service = pool
        .get_service_by_name(&input.service)
        .ok_or_else(|| format!("gRPC service '{}' was not found.", input.service))?;
    let method = service
        .methods()
        .find(|method| method.name() == input.method || method.full_name() == input.method)
        .ok_or_else(|| format!("gRPC method '{}' was not found.", input.method))?;
    let messages = deserialize_messages(
        &input.messages_json,
        method.input(),
        method.is_client_streaming(),
    )?;
    let channel = connect_channel(&input.endpoint, &input.transport).await?;
    let mut client = tonic::client::Grpc::new(channel);
    client
        .ready()
        .await
        .map_err(|error| format!("gRPC service is not ready: {error}"))?;
    let path = http::uri::PathAndQuery::from_maybe_shared(format!(
        "/{}/{}",
        service.full_name(),
        method.name()
    ))
    .map_err(|error| format!("Invalid gRPC method path: {error}"))?;
    let codec = DynamicCodec::new(method.output());
    let started = Instant::now();

    let response_messages = match (method.is_client_streaming(), method.is_server_streaming()) {
        (false, false) => {
            let message = messages
                .into_iter()
                .next()
                .ok_or_else(|| "A unary gRPC call requires one input message.".to_string())?;
            let mut request = Request::new(message);
            apply_metadata(&mut request, &input.metadata)?;
            let response = client
                .unary(request, path, codec)
                .await
                .map_err(format_status)?;
            vec![dynamic_to_json(response.into_inner())?]
        }
        (false, true) => {
            let message = messages.into_iter().next().ok_or_else(|| {
                "A server-streaming gRPC call requires one input message.".to_string()
            })?;
            let mut request = Request::new(message);
            apply_metadata(&mut request, &input.metadata)?;
            let response = client
                .server_streaming(request, path, codec)
                .await
                .map_err(format_status)?;
            collect_stream(response.into_inner(), input.transport.timeout_ms).await?
        }
        (true, false) => {
            let mut request = Request::new(tokio_stream::iter(messages));
            apply_metadata(&mut request, &input.metadata)?;
            let response = client
                .client_streaming(request, path, codec)
                .await
                .map_err(format_status)?;
            vec![dynamic_to_json(response.into_inner())?]
        }
        (true, true) => {
            let mut request = Request::new(tokio_stream::iter(messages));
            apply_metadata(&mut request, &input.metadata)?;
            let response = client
                .streaming(request, path, codec)
                .await
                .map_err(format_status)?;
            collect_stream(response.into_inner(), input.transport.timeout_ms).await?
        }
    };

    Ok(GrpcCallOutput {
        status: "OK".into(),
        call_type: call_type(method.is_client_streaming(), method.is_server_streaming()),
        messages: response_messages,
        duration_ms: started.elapsed().as_millis(),
    })
}

async fn collect_stream(
    mut stream: tonic::Streaming<DynamicMessage>,
    timeout_ms: u64,
) -> Result<Vec<serde_json::Value>, String> {
    let mut messages = Vec::new();
    let deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(timeout_ms.clamp(100, 600_000));
    while messages.len() < 100 {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err("The gRPC stream exceeded the request timeout.".into());
        }
        match tokio::time::timeout(remaining, stream.message()).await {
            Ok(Ok(Some(message))) => messages.push(dynamic_to_json(message)?),
            Ok(Ok(None)) => break,
            Ok(Err(status)) => return Err(format_status(status)),
            Err(_) => return Err("The gRPC stream exceeded the request timeout.".into()),
        }
    }
    Ok(messages)
}

fn deserialize_messages(
    input: &str,
    descriptor: MessageDescriptor,
    streaming: bool,
) -> Result<Vec<DynamicMessage>, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("Invalid gRPC JSON input: {error}"))?;
    let values = if streaming {
        value
            .as_array()
            .cloned()
            .ok_or_else(|| "Client-streaming input must be a JSON array.".to_string())?
    } else {
        vec![value]
    };
    values
        .into_iter()
        .map(|value| {
            let bytes = serde_json::to_vec(&value).map_err(|error| error.to_string())?;
            let mut deserializer = serde_json::Deserializer::from_slice(&bytes);
            DynamicMessage::deserialize(descriptor.clone(), &mut deserializer)
                .map_err(|error| format!("gRPC input does not match the message schema: {error}"))
        })
        .collect()
}

fn dynamic_to_json(message: DynamicMessage) -> Result<serde_json::Value, String> {
    serde_json::to_value(message)
        .map_err(|error| format!("Unable to serialize gRPC response: {error}"))
}

fn apply_metadata<T>(request: &mut Request<T>, metadata: &[KeyValue]) -> Result<(), String> {
    for item in metadata.iter().filter(|item| item.enabled) {
        let key = item
            .name
            .parse::<MetadataKey<Ascii>>()
            .map_err(|error| format!("Invalid gRPC metadata key: {error}"))?;
        let value = item
            .value
            .parse::<MetadataValue<Ascii>>()
            .map_err(|error| format!("Invalid gRPC metadata value: {error}"))?;
        request.metadata_mut().insert(key, value);
    }
    Ok(())
}

async fn connect_channel(endpoint: &str, transport: &TransportConfig) -> Result<Channel, String> {
    let mut builder = Endpoint::from_shared(endpoint.to_string())
        .map_err(|error| format!("Invalid gRPC endpoint: {error}"))?
        .connect_timeout(std::time::Duration::from_millis(
            transport.timeout_ms.clamp(100, 600_000),
        ))
        .timeout(std::time::Duration::from_millis(
            transport.timeout_ms.clamp(100, 600_000),
        ));
    if !transport.client_certificate_pem.trim().is_empty()
        || !transport.client_key_pem.trim().is_empty()
    {
        if transport.client_certificate_pem.trim().is_empty()
            || transport.client_key_pem.trim().is_empty()
        {
            return Err("A client certificate and private key must be supplied together.".into());
        }
        let tls = tonic::transport::ClientTlsConfig::new().identity(Identity::from_pem(
            transport.client_certificate_pem.clone(),
            transport.client_key_pem.clone(),
        ));
        builder = builder
            .tls_config(tls)
            .map_err(|error| format!("Invalid gRPC TLS configuration: {error}"))?;
    }
    builder
        .connect()
        .await
        .map_err(|error| format!("gRPC connection failed: {error}"))
}

async fn reflect_schema(
    endpoint: &str,
    metadata: &[KeyValue],
    transport: &TransportConfig,
) -> Result<(DescriptorPool, Vec<u8>), String> {
    use tonic_reflection::pb::v1::{
        server_reflection_client::ServerReflectionClient,
        server_reflection_request::MessageRequest, server_reflection_response::MessageResponse,
        ServerReflectionRequest,
    };

    let channel = connect_channel(endpoint, transport).await?;
    let mut client = ServerReflectionClient::new(channel.clone());
    let list_request = ServerReflectionRequest {
        host: String::new(),
        message_request: Some(MessageRequest::ListServices(String::new())),
    };
    let mut request = Request::new(tokio_stream::iter([list_request]));
    apply_metadata(&mut request, metadata)?;
    let mut responses = client
        .server_reflection_info(request)
        .await
        .map_err(format_status)?
        .into_inner();
    let response = responses
        .message()
        .await
        .map_err(format_status)?
        .ok_or_else(|| "The gRPC reflection server returned no services.".to_string())?;
    let services = match response.message_response {
        Some(MessageResponse::ListServicesResponse(list)) => list
            .service
            .into_iter()
            .map(|service| service.name)
            .filter(|name| !name.starts_with("grpc.reflection."))
            .collect::<Vec<_>>(),
        Some(MessageResponse::ErrorResponse(error)) => {
            return Err(format!(
                "gRPC reflection error {}: {}",
                error.error_code, error.error_message
            ));
        }
        _ => return Err("The gRPC reflection server returned an unexpected response.".into()),
    };

    let mut descriptor_bytes = Vec::new();
    let mut seen = HashSet::new();
    for service in services {
        let request = ServerReflectionRequest {
            host: String::new(),
            message_request: Some(MessageRequest::FileContainingSymbol(service)),
        };
        let mut request = Request::new(tokio_stream::iter([request]));
        apply_metadata(&mut request, metadata)?;
        let mut response_stream = ServerReflectionClient::new(channel.clone())
            .server_reflection_info(request)
            .await
            .map_err(format_status)?
            .into_inner();
        if let Some(response) = response_stream.message().await.map_err(format_status)? {
            if let Some(MessageResponse::FileDescriptorResponse(files)) = response.message_response
            {
                for bytes in files.file_descriptor_proto {
                    if seen.insert(bytes.clone()) {
                        descriptor_bytes.push(bytes);
                    }
                }
            }
        }
    }
    if descriptor_bytes.is_empty() {
        return Err("The gRPC reflection server returned no descriptors.".into());
    }
    let files = descriptor_bytes
        .into_iter()
        .map(|bytes| {
            FileDescriptorProto::decode(bytes.as_slice()).map_err(|error| error.to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    let descriptor_set = FileDescriptorSet { file: files };
    let encoded = descriptor_set.encode_to_vec();
    let pool = DescriptorPool::from_file_descriptor_set(descriptor_set)
        .map_err(|error| format!("Invalid reflected descriptor set: {error}"))?;
    Ok((pool, encoded))
}

fn compile_proto(proto_text: &str) -> Result<(DescriptorPool, Vec<u8>), String> {
    if proto_text.trim().is_empty() {
        return Err("Paste or import a .proto definition first.".into());
    }
    let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
    let proto_path = directory.path().join("schema.proto");
    fs::write(&proto_path, proto_text).map_err(|error| error.to_string())?;
    let mut compiler = protox::Compiler::new([directory.path()])
        .map_err(|error| format!("Unable to initialize the proto compiler: {error}"))?;
    compiler.include_imports(true).include_source_info(true);
    compiler
        .open_file("schema.proto")
        .map_err(|error| format!("Invalid proto definition: {error}"))?;
    Ok((
        compiler.descriptor_pool(),
        compiler.encode_file_descriptor_set(),
    ))
}

fn schema_output(pool: &DescriptorPool, descriptor_bytes: &[u8]) -> GrpcSchemaOutput {
    GrpcSchemaOutput {
        services: pool
            .services()
            .filter(|service| !service.full_name().starts_with("grpc.reflection."))
            .map(|service| GrpcServiceInfo {
                name: service.name().to_string(),
                full_name: service.full_name().to_string(),
                methods: service
                    .methods()
                    .map(|method| GrpcMethodInfo {
                        name: method.name().to_string(),
                        full_name: method.full_name().to_string(),
                        client_streaming: method.is_client_streaming(),
                        server_streaming: method.is_server_streaming(),
                        input_type: method.input().full_name().to_string(),
                        output_type: method.output().full_name().to_string(),
                    })
                    .collect(),
            })
            .collect(),
        descriptor_set_base64: STANDARD.encode(descriptor_bytes),
    }
}

fn call_type(client_streaming: bool, server_streaming: bool) -> String {
    match (client_streaming, server_streaming) {
        (false, false) => "unary",
        (true, false) => "client-streaming",
        (false, true) => "server-streaming",
        (true, true) => "bidirectional-streaming",
    }
    .into()
}

fn format_status(status: Status) -> String {
    format!("gRPC {}: {}", status.code(), status.message())
}

#[derive(Clone)]
struct DynamicCodec {
    output: MessageDescriptor,
}

impl DynamicCodec {
    fn new(output: MessageDescriptor) -> Self {
        Self { output }
    }
}

impl Codec for DynamicCodec {
    type Encode = DynamicMessage;
    type Decode = DynamicMessage;
    type Encoder = DynamicEncoder;
    type Decoder = DynamicDecoder;

    fn encoder(&mut self) -> Self::Encoder {
        DynamicEncoder
    }

    fn decoder(&mut self) -> Self::Decoder {
        DynamicDecoder {
            output: self.output.clone(),
        }
    }
}

struct DynamicEncoder;

impl Encoder for DynamicEncoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn encode(
        &mut self,
        item: Self::Item,
        destination: &mut EncodeBuf<'_>,
    ) -> Result<(), Self::Error> {
        item.encode(destination)
            .map_err(|error| Status::internal(error.to_string()))
    }
}

struct DynamicDecoder {
    output: MessageDescriptor,
}

impl Decoder for DynamicDecoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn decode(&mut self, source: &mut DecodeBuf<'_>) -> Result<Option<Self::Item>, Self::Error> {
        DynamicMessage::decode(self.output.clone(), source)
            .map(Some)
            .map_err(|error| Status::internal(error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PROTO: &str = r#"
        syntax = "proto3";
        package brunomnia.test;
        service Greeter {
          rpc SayHello (HelloRequest) returns (HelloReply);
          rpc WatchHello (HelloRequest) returns (stream HelloReply);
        }
        message HelloRequest { string name = 1; }
        message HelloReply { string message = 1; }
    "#;

    #[test]
    fn compiles_proto_and_describes_streaming_methods() {
        let (pool, bytes) = compile_proto(TEST_PROTO).expect("proto compiles");
        let output = schema_output(&pool, &bytes);
        assert_eq!(output.services[0].full_name, "brunomnia.test.Greeter");
        assert!(!output.services[0].methods[0].server_streaming);
        assert!(output.services[0].methods[1].server_streaming);
        assert!(!output.descriptor_set_base64.is_empty());
    }

    #[test]
    fn deserializes_dynamic_json_input() {
        let (pool, _) = compile_proto(TEST_PROTO).expect("proto compiles");
        let descriptor = pool
            .get_message_by_name("brunomnia.test.HelloRequest")
            .expect("message exists");
        let messages = deserialize_messages(r#"{"name":"Ada"}"#, descriptor, false)
            .expect("JSON maps to proto");
        assert_eq!(messages.len(), 1);
    }
}

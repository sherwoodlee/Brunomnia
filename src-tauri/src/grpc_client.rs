use crate::models::{
    GrpcCallInput, GrpcCallOutput, GrpcMethodInfo, GrpcProtoFileInput, GrpcSchemaInput,
    GrpcSchemaOutput, GrpcServiceInfo, KeyValue, TransportConfig,
};
use crate::{http_client::identity_enabled, streaming::AcceptInvalidServerCertificate};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, MessageDescriptor};
use prost_types::{FileDescriptorProto, FileDescriptorSet};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path},
    sync::Arc,
    time::Instant,
};
use tonic::{
    codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder},
    metadata::{Ascii, MetadataKey, MetadataValue},
    transport::{Channel, ClientTlsConfig, Endpoint, Identity},
    Request, Status,
};

pub async fn load_schema(input: GrpcSchemaInput) -> Result<GrpcSchemaOutput, String> {
    let (pool, bytes) = if input.source == "proto" {
        compile_proto(
            &input.proto_text,
            &input.proto_files,
            &input.proto_entry_path,
        )?
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
    let deadline = (timeout_ms > 0)
        .then(|| tokio::time::Instant::now() + std::time::Duration::from_millis(timeout_ms));
    while messages.len() < 100 {
        let next = if let Some(deadline) = deadline {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                return Err("The gRPC stream exceeded the request timeout.".into());
            }
            tokio::time::timeout(remaining, stream.message())
                .await
                .map_err(|_| "The gRPC stream exceeded the request timeout.".to_string())?
        } else {
            stream.message().await
        };
        match next {
            Ok(Some(message)) => messages.push(dynamic_to_json(message)?),
            Ok(None) => break,
            Err(status) => return Err(format_status(status)),
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

fn tonic_endpoint(endpoint: &str) -> Result<(String, bool), String> {
    let url =
        url::Url::parse(endpoint).map_err(|error| format!("Invalid gRPC endpoint: {error}"))?;
    let (scheme, secure) = match url.scheme() {
        "grpc" | "http" => ("http", false),
        "grpcs" | "https" => ("https", true),
        scheme => return Err(format!("Unsupported gRPC endpoint scheme: {scheme}")),
    };
    if url.host_str().is_none() {
        return Err("The gRPC endpoint requires a hostname.".into());
    }
    let normalized = if url.scheme() == scheme {
        url.to_string()
    } else {
        let (_, remainder) = endpoint
            .split_once("://")
            .ok_or_else(|| "The gRPC endpoint requires an authority.".to_string())?;
        url::Url::parse(&format!("{scheme}://{remainder}"))
            .map_err(|error| format!("Invalid gRPC endpoint: {error}"))?
            .to_string()
    };
    Ok((normalized, secure))
}

async fn connect_channel(endpoint: &str, transport: &TransportConfig) -> Result<Channel, String> {
    let (tonic_endpoint, secure) = tonic_endpoint(endpoint)?;
    let mut builder = Endpoint::from_shared(tonic_endpoint)
        .map_err(|error| format!("Invalid gRPC endpoint: {error}"))?;
    if transport.timeout_ms > 0 {
        let timeout = std::time::Duration::from_millis(transport.timeout_ms);
        builder = builder.connect_timeout(timeout).timeout(timeout);
    }
    if secure {
        let has_certificate = !transport.client_certificate_pem.trim().is_empty();
        let has_key = !transport.client_key_pem.trim().is_empty();
        if has_certificate != has_key {
            return Err("A client certificate and private key must be supplied together.".into());
        }
        let use_identity = has_certificate && identity_enabled(transport, Some(endpoint));
        if !transport.validate_certificates || use_identity {
            let mut tls = ClientTlsConfig::new();
            if transport.timeout_ms > 0 {
                tls = tls.timeout(std::time::Duration::from_millis(transport.timeout_ms));
            }
            if use_identity {
                tls = tls.identity(Identity::from_pem(
                    transport.client_certificate_pem.clone(),
                    transport.client_key_pem.clone(),
                ));
            }
            builder = if transport.validate_certificates {
                builder.tls_config(tls.with_enabled_roots())
            } else {
                builder.tls_config_with_verifier(tls, Arc::new(AcceptInvalidServerCertificate))
            }
            .map_err(|error| format!("Invalid gRPC TLS configuration: {error}"))?;
        }
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

const MAX_PROTO_FILES: usize = 500;
const MAX_PROTO_FILE_BYTES: usize = 1_048_576;
const MAX_PROTO_TOTAL_BYTES: usize = 10_485_760;
const MAX_PROTO_PATH_CHARS: usize = 512;

fn normalize_proto_path(value: &str) -> Result<String, String> {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.as_bytes().get(1) == Some(&b':')
    {
        return Err("Proto paths must be relative.".into());
    }
    let mut segments = Vec::new();
    for component in Path::new(&normalized).components() {
        match component {
            Component::Normal(segment) => segments.push(
                segment
                    .to_str()
                    .ok_or_else(|| "Proto paths must be valid UTF-8.".to_string())?,
            ),
            Component::CurDir => {}
            _ => return Err("Proto paths cannot traverse parent folders.".into()),
        }
    }
    let path = segments.join("/");
    if path.is_empty() || path.chars().count() > MAX_PROTO_PATH_CHARS {
        return Err(format!(
            "Proto paths must contain 1 to {MAX_PROTO_PATH_CHARS} characters."
        ));
    }
    if !path.to_ascii_lowercase().ends_with(".proto") {
        return Err("Only .proto files can be compiled.".into());
    }
    Ok(path)
}

fn compile_proto(
    proto_text: &str,
    proto_files: &[GrpcProtoFileInput],
    proto_entry_path: &str,
) -> Result<(DescriptorPool, Vec<u8>), String> {
    if proto_files.is_empty() && proto_text.trim().is_empty() {
        return Err("Paste or import a .proto definition first.".into());
    }
    if proto_files.len() > MAX_PROTO_FILES {
        return Err(format!(
            "Proto trees cannot exceed {MAX_PROTO_FILES} files."
        ));
    }
    let fallback;
    let source_files = if proto_files.is_empty() {
        fallback = vec![GrpcProtoFileInput {
            path: "schema.proto".into(),
            text: proto_text.into(),
        }];
        fallback.as_slice()
    } else {
        proto_files
    };
    let mut files = Vec::with_capacity(source_files.len());
    let mut paths = HashSet::with_capacity(source_files.len());
    let mut total_bytes = 0usize;
    for file in source_files {
        let path = normalize_proto_path(&file.path)?;
        if file.text.len() > MAX_PROTO_FILE_BYTES {
            return Err(format!("Proto file '{path}' exceeds the 1 MiB limit."));
        }
        total_bytes = total_bytes
            .checked_add(file.text.len())
            .ok_or_else(|| "Proto tree size overflowed.".to_string())?;
        if total_bytes > MAX_PROTO_TOTAL_BYTES {
            return Err("Proto trees cannot exceed 10 MiB.".into());
        }
        if !paths.insert(path.to_lowercase()) {
            return Err(format!("Proto file path '{path}' is duplicated."));
        }
        files.push((path, file.text.as_str()));
    }
    let entry = if proto_entry_path.trim().is_empty() {
        files
            .iter()
            .min_by_key(|(path, text)| (!text.contains("service "), path.len(), path.as_str()))
            .map(|(path, _)| path.clone())
            .ok_or_else(|| "Paste or import a .proto definition first.".to_string())?
    } else {
        normalize_proto_path(proto_entry_path)?
    };
    if !paths.contains(&entry.to_lowercase()) {
        return Err(format!("Proto entry file '{entry}' was not imported."));
    }
    let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
    for (path, text) in files {
        let proto_path = directory.path().join(&path);
        if let Some(parent) = proto_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(proto_path, text).map_err(|error| error.to_string())?;
    }
    let mut compiler = protox::Compiler::new([directory.path()])
        .map_err(|error| format!("Unable to initialize the proto compiler: {error}"))?;
    compiler.include_imports(true).include_source_info(true);
    compiler
        .open_file(&entry)
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
    use rustls::{RootCertStore, ServerConfig};
    use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};

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
    const TLS_CA_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/ca.cert.pem");
    const TLS_SERVER_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/server.cert.pem");
    const TLS_SERVER_KEY: &str = include_str!("../tests/fixtures/tls/server.key.pem");
    const TLS_CLIENT_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/client.cert.pem");
    const TLS_CLIENT_KEY: &str = include_str!("../tests/fixtures/tls/client.key.pem");

    fn test_tls_server_config(require_client_identity: bool) -> ServerConfig {
        let certificates = CertificateDer::pem_slice_iter(TLS_SERVER_CERTIFICATE.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let key = PrivateKeyDer::from_pem_slice(TLS_SERVER_KEY.as_bytes()).unwrap();
        let builder = ServerConfig::builder();
        let mut config = if require_client_identity {
            let mut roots = RootCertStore::empty();
            let authorities = CertificateDer::pem_slice_iter(TLS_CA_CERTIFICATE.as_bytes())
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            let (added, _) = roots.add_parsable_certificates(authorities);
            assert_eq!(added, 1);
            let verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(roots))
                .build()
                .unwrap();
            builder
                .with_client_cert_verifier(verifier)
                .with_single_cert(certificates, key)
                .unwrap()
        } else {
            builder
                .with_no_client_auth()
                .with_single_cert(certificates, key)
                .unwrap()
        };
        config.alpn_protocols = vec![b"h2".to_vec()];
        config
    }

    #[test]
    fn compiles_proto_and_describes_streaming_methods() {
        let (pool, bytes) = compile_proto(TEST_PROTO, &[], "").expect("proto compiles");
        let output = schema_output(&pool, &bytes);
        assert_eq!(output.services[0].full_name, "brunomnia.test.Greeter");
        assert!(!output.services[0].methods[0].server_streaming);
        assert!(output.services[0].methods[1].server_streaming);
        assert!(!output.descriptor_set_base64.is_empty());
    }

    #[test]
    fn compiles_imported_multi_file_proto_tree() {
        let files = vec![
            GrpcProtoFileInput {
                path: "types/messages.proto".into(),
                text: r#"
                    syntax = "proto3";
                    package brunomnia.tree;
                    message HelloRequest { string name = 1; }
                    message HelloReply { string message = 1; }
                "#
                .into(),
            },
            GrpcProtoFileInput {
                path: "services/greeter.proto".into(),
                text: r#"
                    syntax = "proto3";
                    package brunomnia.tree;
                    import "types/messages.proto";
                    service Greeter { rpc SayHello (HelloRequest) returns (HelloReply); }
                "#
                .into(),
            },
        ];
        let (pool, bytes) =
            compile_proto("", &files, "services/greeter.proto").expect("proto tree compiles");
        let output = schema_output(&pool, &bytes);
        assert_eq!(output.services[0].full_name, "brunomnia.tree.Greeter");
        assert!(pool
            .get_message_by_name("brunomnia.tree.HelloRequest")
            .is_some());
        assert_eq!(pool.files().count(), 2);
    }

    #[test]
    fn rejects_unsafe_or_duplicate_proto_paths() {
        let unsafe_file = GrpcProtoFileInput {
            path: "../escape.proto".into(),
            text: TEST_PROTO.into(),
        };
        assert!(compile_proto("", &[unsafe_file], "../escape.proto").is_err());
        let duplicate = vec![
            GrpcProtoFileInput {
                path: "schema.proto".into(),
                text: TEST_PROTO.into(),
            },
            GrpcProtoFileInput {
                path: "SCHEMA.proto".into(),
                text: TEST_PROTO.into(),
            },
        ];
        assert!(compile_proto("", &duplicate, "schema.proto")
            .unwrap_err()
            .contains("duplicated"));
    }

    #[test]
    fn deserializes_dynamic_json_input() {
        let (pool, _) = compile_proto(TEST_PROTO, &[], "").expect("proto compiles");
        let descriptor = pool
            .get_message_by_name("brunomnia.test.HelloRequest")
            .expect("message exists");
        let messages = deserialize_messages(r#"{"name":"Ada"}"#, descriptor, false)
            .expect("JSON maps to proto");
        assert_eq!(messages.len(), 1);
    }

    #[test]
    fn normalizes_grpc_endpoint_schemes_for_tonic() {
        assert_eq!(
            tonic_endpoint("grpc://api.example.test:50051/orders?tenant=one").unwrap(),
            (
                "http://api.example.test:50051/orders?tenant=one".into(),
                false
            )
        );
        assert_eq!(
            tonic_endpoint("grpcs://api.example.test").unwrap(),
            ("https://api.example.test/".into(), true)
        );
        assert!(tonic_endpoint("ws://api.example.test").is_err());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn applies_grpc_validation_and_domain_scoped_client_identity() {
        use tokio::net::TcpListener;
        use tokio_rustls::TlsAcceptor;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let plain_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(false)));
        let mutual_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(true)));
        let server = tokio::spawn(async move {
            let (strict_stream, _) = listener.accept().await.unwrap();
            assert!(plain_acceptor.accept(strict_stream).await.is_err());

            let (unmatched_stream, _) = listener.accept().await.unwrap();
            assert!(mutual_acceptor.accept(unmatched_stream).await.is_err());

            let (matched_stream, _) = listener.accept().await.unwrap();
            assert!(mutual_acceptor.accept(matched_stream).await.is_ok());
        });

        let endpoint = format!("https://127.0.0.1:{}", address.port());
        let _ = connect_channel(
            &endpoint,
            &TransportConfig {
                timeout_ms: 1_000,
                ..Default::default()
            },
        )
        .await;
        let _ = connect_channel(
            &endpoint,
            &TransportConfig {
                timeout_ms: 1_000,
                validate_certificates: false,
                client_certificate_pem: TLS_CLIENT_CERTIFICATE.into(),
                client_key_pem: TLS_CLIENT_KEY.into(),
                client_certificate_domains: "localhost".into(),
                ..Default::default()
            },
        )
        .await;
        let _ = connect_channel(
            &endpoint,
            &TransportConfig {
                timeout_ms: 1_000,
                validate_certificates: false,
                client_certificate_pem: TLS_CLIENT_CERTIFICATE.into(),
                client_key_pem: TLS_CLIENT_KEY.into(),
                client_certificate_domains: "127.0.0.1".into(),
                ..Default::default()
            },
        )
        .await;
        server.await.unwrap();
    }
}

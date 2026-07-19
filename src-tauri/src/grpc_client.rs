use crate::models::{
    GrpcCallInput, GrpcCallOutput, GrpcMethodInfo, GrpcProtoFileInput, GrpcSchemaInput,
    GrpcSchemaOutput, GrpcServiceInfo, GrpcSessionStartInput, GrpcSessionStartOutput, KeyValue,
    StreamEvent, TransportConfig,
};
use crate::{
    client_identity::{effective_client_identity_pem, validate_certificate_material},
    streaming::AcceptInvalidServerCertificate,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, MessageDescriptor, MethodDescriptor};
use prost_types::{FileDescriptorProto, FileDescriptorSet};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Component, Path},
    sync::Arc,
    time::Instant,
};
use tauri::ipc::Channel as IpcChannel;
use tokio::sync::{mpsc, Mutex};
use tokio_stream::wrappers::UnboundedReceiverStream;
use tonic::{
    codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder},
    metadata::{Ascii, KeyAndValueRef, MetadataKey, MetadataMap, MetadataValue},
    transport::{Certificate, Channel, ClientTlsConfig, Endpoint, Identity},
    Request, Status,
};
use uuid::Uuid;

const MAX_GRPC_DESCRIPTOR_BYTES: usize = 10_485_760;
const MAX_GRPC_MESSAGE_BYTES: usize = 1_048_576;
const MAX_GRPC_SESSIONS: usize = 100;
const GRPC_SESSION_COMMAND_CAPACITY: usize = 256;
const MAX_GRPC_STATUS_METADATA_ENTRIES: usize = 500;
const MAX_GRPC_STATUS_METADATA_VALUE_BYTES: usize = 65_536;

#[derive(Clone, Default)]
pub struct GrpcSessionState {
    sessions: Arc<Mutex<HashMap<String, GrpcSessionHandle>>>,
}

#[derive(Clone)]
struct GrpcSessionHandle {
    token: Uuid,
    sender: mpsc::Sender<GrpcSessionCommand>,
    input: MessageDescriptor,
    client_streaming: bool,
    committed: bool,
}

enum GrpcSessionCommand {
    Send {
        message: DynamicMessage,
        text: String,
    },
    Commit,
    Cancel,
}

struct GrpcMethodSelection {
    method: MethodDescriptor,
    path: http::uri::PathAndQuery,
}

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

fn select_method(input: &GrpcCallInput) -> Result<GrpcMethodSelection, String> {
    let descriptor_bytes = STANDARD
        .decode(&input.descriptor_set_base64)
        .map_err(|error| format!("Invalid descriptor set: {error}"))?;
    if descriptor_bytes.len() > MAX_GRPC_DESCRIPTOR_BYTES {
        return Err("The gRPC descriptor set exceeds 10 MiB.".into());
    }
    let pool = DescriptorPool::decode(descriptor_bytes.as_slice())
        .map_err(|error| format!("Unable to decode descriptors: {error}"))?;
    let service = pool
        .get_service_by_name(&input.service)
        .ok_or_else(|| format!("gRPC service '{}' was not found.", input.service))?;
    let method = service
        .methods()
        .find(|method| method.name() == input.method || method.full_name() == input.method)
        .ok_or_else(|| format!("gRPC method '{}' was not found.", input.method))?;
    let path = http::uri::PathAndQuery::from_maybe_shared(format!(
        "/{}/{}",
        service.full_name(),
        method.name()
    ))
    .map_err(|error| format!("Invalid gRPC method path: {error}"))?;
    Ok(GrpcMethodSelection { method, path })
}

fn deserialize_session_message(
    input: &str,
    descriptor: MessageDescriptor,
) -> Result<(DynamicMessage, String), String> {
    if input.len() > MAX_GRPC_MESSAGE_BYTES {
        return Err("gRPC messages cannot exceed 1 MiB.".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("Invalid gRPC JSON input: {error}"))?;
    let bytes = serde_json::to_vec(&value).map_err(|error| error.to_string())?;
    let mut deserializer = serde_json::Deserializer::from_slice(&bytes);
    let message = DynamicMessage::deserialize(descriptor, &mut deserializer)
        .map_err(|error| format!("gRPC input does not match the message schema: {error}"))?;
    let text = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
    Ok((message, text))
}

fn send_session_event(channel: &IpcChannel<StreamEvent>, event: StreamEvent) {
    let _ = channel.send(event);
}

fn merge_status_metadata(target: &mut BTreeMap<String, Vec<String>>, metadata: &MetadataMap) {
    let remaining = MAX_GRPC_STATUS_METADATA_ENTRIES
        .saturating_sub(target.values().map(Vec::len).sum::<usize>());
    for entry in metadata.iter().take(remaining) {
        let (key, encoded_value) = match entry {
            KeyAndValueRef::Ascii(key, value) => (key.as_str(), value.as_encoded_bytes()),
            KeyAndValueRef::Binary(key, value) => (key.as_str(), value.as_encoded_bytes()),
        };
        let value = String::from_utf8_lossy(
            &encoded_value[..encoded_value
                .len()
                .min(MAX_GRPC_STATUS_METADATA_VALUE_BYTES)],
        )
        .into_owned();
        target.entry(key.to_string()).or_default().push(value);
    }
}

fn grpc_code_name(code: tonic::Code) -> &'static str {
    match code {
        tonic::Code::Ok => "OK",
        tonic::Code::Cancelled => "CANCELLED",
        tonic::Code::Unknown => "UNKNOWN",
        tonic::Code::InvalidArgument => "INVALID_ARGUMENT",
        tonic::Code::DeadlineExceeded => "DEADLINE_EXCEEDED",
        tonic::Code::NotFound => "NOT_FOUND",
        tonic::Code::AlreadyExists => "ALREADY_EXISTS",
        tonic::Code::PermissionDenied => "PERMISSION_DENIED",
        tonic::Code::ResourceExhausted => "RESOURCE_EXHAUSTED",
        tonic::Code::FailedPrecondition => "FAILED_PRECONDITION",
        tonic::Code::Aborted => "ABORTED",
        tonic::Code::OutOfRange => "OUT_OF_RANGE",
        tonic::Code::Unimplemented => "UNIMPLEMENTED",
        tonic::Code::Internal => "INTERNAL",
        tonic::Code::Unavailable => "UNAVAILABLE",
        tonic::Code::DataLoss => "DATA_LOSS",
        tonic::Code::Unauthenticated => "UNAUTHENTICATED",
    }
}

fn session_status_error(
    status: Status,
    channel: &IpcChannel<StreamEvent>,
    session_id: &str,
) -> String {
    let mut metadata = BTreeMap::new();
    merge_status_metadata(&mut metadata, status.metadata());
    send_session_event(
        channel,
        StreamEvent::grpc_status(
            session_id,
            status.code() as i32,
            grpc_code_name(status.code()),
            status.message(),
            metadata,
        ),
    );
    format_status(status)
}

fn send_cancelled_status(channel: &IpcChannel<StreamEvent>, session_id: &str) {
    send_session_event(
        channel,
        StreamEvent::system(session_id, "cancel", "Call cancelled"),
    );
    send_session_event(
        channel,
        StreamEvent::grpc_status(
            session_id,
            tonic::Code::Cancelled as i32,
            grpc_code_name(tonic::Code::Cancelled),
            "Call cancelled",
            BTreeMap::new(),
        ),
    );
}

fn send_response_message(
    channel: &IpcChannel<StreamEvent>,
    session_id: &str,
    message: DynamicMessage,
) -> Result<(), String> {
    let value = dynamic_to_json(message)?;
    let text = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
    send_session_event(channel, StreamEvent::incoming(session_id, "message", text));
    Ok(())
}

enum GrpcCommandAction {
    Continue,
    Cancel,
}

fn apply_stream_command(
    command: GrpcSessionCommand,
    request_sender: &mut Option<mpsc::UnboundedSender<DynamicMessage>>,
    channel: &IpcChannel<StreamEvent>,
    session_id: &str,
) -> Result<GrpcCommandAction, String> {
    match command {
        GrpcSessionCommand::Send { message, text } => {
            let sender = request_sender
                .as_ref()
                .ok_or_else(|| "The gRPC request stream is already committed.".to_string())?;
            sender
                .send(message)
                .map_err(|_| "The gRPC request stream has ended.".to_string())?;
            send_session_event(channel, StreamEvent::outgoing(session_id, "message", text));
            Ok(GrpcCommandAction::Continue)
        }
        GrpcSessionCommand::Commit => {
            request_sender.take();
            send_session_event(
                channel,
                StreamEvent::system(session_id, "commit", "Request stream committed"),
            );
            Ok(GrpcCommandAction::Continue)
        }
        GrpcSessionCommand::Cancel => {
            send_cancelled_status(channel, session_id);
            Ok(GrpcCommandAction::Cancel)
        }
    }
}

async fn run_session(
    mut client: tonic::client::Grpc<Channel>,
    selection: GrpcMethodSelection,
    initial_message: Option<(DynamicMessage, String)>,
    metadata: Vec<KeyValue>,
    mut commands: mpsc::Receiver<GrpcSessionCommand>,
    on_event: &IpcChannel<StreamEvent>,
    session_id: &str,
) -> Result<(), String> {
    let method = selection.method;
    let path = selection.path;
    let codec = DynamicCodec::new(method.output());
    let mut status_metadata = BTreeMap::new();
    match (method.is_client_streaming(), method.is_server_streaming()) {
        (false, false) => {
            let (message, text) = initial_message
                .ok_or_else(|| "A unary gRPC call requires one input message.".to_string())?;
            send_session_event(on_event, StreamEvent::outgoing(session_id, "message", text));
            let mut request = Request::new(message);
            apply_metadata(&mut request, &metadata)?;
            let call = client.unary(request, path, codec);
            tokio::pin!(call);
            let response = tokio::select! {
                response = &mut call => response.map_err(|status| session_status_error(status, on_event, session_id))?,
                command = commands.recv() => match command {
                    Some(GrpcSessionCommand::Cancel) | None => {
                        send_cancelled_status(on_event, session_id);
                        return Ok(());
                    }
                    Some(_) => return Err("Unary gRPC calls do not accept stream commands.".into()),
                }
            };
            merge_status_metadata(&mut status_metadata, response.metadata());
            send_response_message(on_event, session_id, response.into_inner())?;
        }
        (false, true) => {
            let (message, text) = initial_message.ok_or_else(|| {
                "A server-streaming gRPC call requires one input message.".to_string()
            })?;
            send_session_event(on_event, StreamEvent::outgoing(session_id, "message", text));
            let mut request = Request::new(message);
            apply_metadata(&mut request, &metadata)?;
            let call = client.server_streaming(request, path, codec);
            tokio::pin!(call);
            let response = tokio::select! {
                response = &mut call => response.map_err(|status| session_status_error(status, on_event, session_id))?,
                command = commands.recv() => match command {
                    Some(GrpcSessionCommand::Cancel) | None => {
                        send_cancelled_status(on_event, session_id);
                        return Ok(());
                    }
                    Some(_) => return Err("Server-streaming gRPC calls do not accept request-stream commands.".into()),
                }
            };
            merge_status_metadata(&mut status_metadata, response.metadata());
            let mut stream = response.into_inner();
            loop {
                tokio::select! {
                    message = stream.message() => match message.map_err(|status| session_status_error(status, on_event, session_id))? {
                        Some(message) => send_response_message(on_event, session_id, message)?,
                        None => break,
                    },
                    command = commands.recv() => match command {
                        Some(GrpcSessionCommand::Cancel) | None => {
                            send_cancelled_status(on_event, session_id);
                            return Ok(());
                        }
                        Some(_) => return Err("Server-streaming gRPC calls do not accept request-stream commands.".into()),
                    }
                }
            }
            if let Some(trailers) = stream
                .trailers()
                .await
                .map_err(|status| session_status_error(status, on_event, session_id))?
            {
                merge_status_metadata(&mut status_metadata, &trailers);
            }
        }
        (true, false) => {
            let (request_sender, request_receiver) = mpsc::unbounded_channel();
            let mut request_sender = Some(request_sender);
            let mut request = Request::new(UnboundedReceiverStream::new(request_receiver));
            apply_metadata(&mut request, &metadata)?;
            let call = client.client_streaming(request, path, codec);
            tokio::pin!(call);
            let response = loop {
                tokio::select! {
                    response = &mut call => break response.map_err(|status| session_status_error(status, on_event, session_id))?,
                    command = commands.recv() => match command {
                        Some(command) => if matches!(apply_stream_command(command, &mut request_sender, on_event, session_id)?, GrpcCommandAction::Cancel) { return Ok(()); },
                        None => {
                            send_cancelled_status(on_event, session_id);
                            return Ok(());
                        }
                    }
                }
            };
            merge_status_metadata(&mut status_metadata, response.metadata());
            send_response_message(on_event, session_id, response.into_inner())?;
        }
        (true, true) => {
            let (request_sender, request_receiver) = mpsc::unbounded_channel();
            let mut request_sender = Some(request_sender);
            let mut request = Request::new(UnboundedReceiverStream::new(request_receiver));
            apply_metadata(&mut request, &metadata)?;
            let call = client.streaming(request, path, codec);
            tokio::pin!(call);
            let response = loop {
                tokio::select! {
                    response = &mut call => break response.map_err(|status| session_status_error(status, on_event, session_id))?,
                    command = commands.recv() => match command {
                        Some(command) => if matches!(apply_stream_command(command, &mut request_sender, on_event, session_id)?, GrpcCommandAction::Cancel) { return Ok(()); },
                        None => {
                            send_cancelled_status(on_event, session_id);
                            return Ok(());
                        }
                    }
                }
            };
            merge_status_metadata(&mut status_metadata, response.metadata());
            let mut stream = response.into_inner();
            loop {
                tokio::select! {
                    message = stream.message() => match message.map_err(|status| session_status_error(status, on_event, session_id))? {
                        Some(message) => send_response_message(on_event, session_id, message)?,
                        None => break,
                    },
                    command = commands.recv() => match command {
                        Some(command) => if matches!(apply_stream_command(command, &mut request_sender, on_event, session_id)?, GrpcCommandAction::Cancel) { return Ok(()); },
                        None => {
                            send_cancelled_status(on_event, session_id);
                            return Ok(());
                        }
                    }
                }
            }
            if let Some(trailers) = stream
                .trailers()
                .await
                .map_err(|status| session_status_error(status, on_event, session_id))?
            {
                merge_status_metadata(&mut status_metadata, &trailers);
            }
        }
    }
    send_session_event(
        on_event,
        StreamEvent::grpc_status(session_id, 0, "OK", "OK", status_metadata),
    );
    Ok(())
}

pub async fn start_session(
    input: GrpcSessionStartInput,
    on_event: IpcChannel<StreamEvent>,
    state: GrpcSessionState,
) -> Result<GrpcSessionStartOutput, String> {
    let session_id = input.session_id.trim().to_string();
    if session_id.is_empty() || session_id.len() > 256 {
        return Err("gRPC session IDs must contain 1 to 256 characters.".into());
    }
    {
        let sessions = state.sessions.lock().await;
        if sessions.contains_key(&session_id) {
            return Err("This gRPC session is already active.".into());
        }
        if sessions.len() >= MAX_GRPC_SESSIONS {
            return Err(format!(
                "No more than {MAX_GRPC_SESSIONS} gRPC sessions can be active."
            ));
        }
    }

    let selection = select_method(&input.call)?;
    let client_streaming = selection.method.is_client_streaming();
    let server_streaming = selection.method.is_server_streaming();
    let initial_message = if client_streaming {
        None
    } else {
        Some(deserialize_session_message(
            &input.call.messages_json,
            selection.method.input(),
        )?)
    };
    let started = Instant::now();
    let channel = connect_channel(&input.call.endpoint, &input.call.transport).await?;
    let mut client = tonic::client::Grpc::new(channel);
    client
        .ready()
        .await
        .map_err(|error| format!("gRPC service is not ready: {error}"))?;

    let (sender, receiver) = mpsc::channel(GRPC_SESSION_COMMAND_CAPACITY);
    let token = Uuid::new_v4();
    {
        let mut sessions = state.sessions.lock().await;
        if sessions.contains_key(&session_id) {
            return Err("This gRPC session is already active.".into());
        }
        if sessions.len() >= MAX_GRPC_SESSIONS {
            return Err(format!(
                "No more than {MAX_GRPC_SESSIONS} gRPC sessions can be active."
            ));
        }
        sessions.insert(
            session_id.clone(),
            GrpcSessionHandle {
                token,
                sender,
                input: selection.method.input(),
                client_streaming,
                committed: false,
            },
        );
    }

    let call_type = call_type(client_streaming, server_streaming);
    send_session_event(
        &on_event,
        StreamEvent::system(&session_id, "start", format!("{call_type} call started")),
    );
    let sessions = state.sessions.clone();
    let task_session_id = session_id.clone();
    let metadata = input.call.metadata;
    tokio::spawn(async move {
        if let Err(error) = run_session(
            client,
            selection,
            initial_message,
            metadata,
            receiver,
            &on_event,
            &task_session_id,
        )
        .await
        {
            send_session_event(
                &on_event,
                StreamEvent::system(&task_session_id, "error", error),
            );
        }
        send_session_event(
            &on_event,
            StreamEvent::system(&task_session_id, "end", "Call ended"),
        );
        let mut sessions = sessions.lock().await;
        if sessions
            .get(&task_session_id)
            .is_some_and(|handle| handle.token == token)
        {
            sessions.remove(&task_session_id);
        }
    });

    Ok(GrpcSessionStartOutput {
        session_id,
        call_type,
        duration_ms: started.elapsed().as_millis(),
    })
}

pub async fn send_session_message(
    session_id: String,
    message_json: String,
    state: GrpcSessionState,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let handle = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Start the gRPC call before sending a message.".to_string())?;
    if !handle.client_streaming {
        return Err("This gRPC method does not accept a request stream.".into());
    }
    if handle.committed {
        return Err("The gRPC request stream is already committed.".into());
    }
    let (message, text) = deserialize_session_message(&message_json, handle.input.clone())?;
    handle
        .sender
        .try_send(GrpcSessionCommand::Send { message, text })
        .map_err(|error| format!("Unable to queue the gRPC message: {error}"))
}

pub async fn commit_session(session_id: String, state: GrpcSessionState) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let handle = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "The gRPC call is not active.".to_string())?;
    if !handle.client_streaming {
        return Err("This gRPC method does not have a request stream to commit.".into());
    }
    if handle.committed {
        return Err("The gRPC request stream is already committed.".into());
    }
    handle
        .sender
        .try_send(GrpcSessionCommand::Commit)
        .map_err(|error| format!("Unable to commit the gRPC request stream: {error}"))?;
    handle.committed = true;
    Ok(())
}

pub async fn cancel_session(session_id: String, state: GrpcSessionState) -> Result<(), String> {
    let handle = state
        .sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "The gRPC call is not active.".to_string())?;
    handle
        .sender
        .try_send(GrpcSessionCommand::Cancel)
        .map_err(|error| format!("Unable to cancel the gRPC call: {error}"))
}

pub async fn close_all_sessions(state: GrpcSessionState) {
    let handles = state
        .sessions
        .lock()
        .await
        .drain()
        .map(|(_, handle)| handle)
        .collect::<Vec<_>>();
    for handle in handles {
        let _ = handle.sender.try_send(GrpcSessionCommand::Cancel);
    }
}

pub async fn call(input: GrpcCallInput) -> Result<GrpcCallOutput, String> {
    let selection = select_method(&input)?;
    let method = selection.method;
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
    let path = selection.path;
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
    validate_certificate_material(transport)?;
    let (tonic_endpoint, secure) = tonic_endpoint(endpoint)?;
    let mut builder = Endpoint::from_shared(tonic_endpoint)
        .map_err(|error| format!("Invalid gRPC endpoint: {error}"))?;
    if transport.timeout_ms > 0 {
        let timeout = std::time::Duration::from_millis(transport.timeout_ms);
        builder = builder.connect_timeout(timeout).timeout(timeout);
    }
    if secure {
        let identity = effective_client_identity_pem(transport, Some(endpoint))?;
        if !transport.validate_certificates
            || identity.is_some()
            || !transport.ca_certificate_pem.trim().is_empty()
        {
            let mut tls = ClientTlsConfig::new();
            if transport.timeout_ms > 0 {
                tls = tls.timeout(std::time::Duration::from_millis(transport.timeout_ms));
            }
            if let Some(identity) = identity {
                tls = tls.identity(Identity::from_pem(
                    identity.certificate_pem,
                    identity.private_key_pem,
                ));
            }
            if transport.validate_certificates && !transport.ca_certificate_pem.trim().is_empty() {
                tls =
                    tls.ca_certificate(Certificate::from_pem(transport.ca_certificate_pem.clone()));
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
    use std::{convert::Infallible, sync::Mutex as StdMutex, task::Poll};
    use tauri::ipc::InvokeResponseBody;
    use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};
    use tokio_stream::wrappers::{ReceiverStream, TcpListenerStream};
    use tonic::{
        body::Body,
        codegen::{BoxFuture, Service, StdError},
        server::{ClientStreamingService, NamedService, StreamingService},
        transport::Server,
        Response, Streaming,
    };

    const TEST_PROTO: &str = r#"
        syntax = "proto3";
        package brunomnia.test;
        service Greeter {
          rpc SayHello (HelloRequest) returns (HelloReply);
          rpc WatchHello (HelloRequest) returns (stream HelloReply);
          rpc CollectHello (stream HelloRequest) returns (HelloReply);
          rpc ChatHello (stream HelloRequest) returns (stream HelloReply);
          rpc RejectHello (HelloRequest) returns (HelloReply);
        }
        message HelloRequest { string name = 1; }
        message HelloReply { string message = 1; }
    "#;
    const TLS_CA_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/ca.cert.pem");
    const TLS_SERVER_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/server.cert.pem");
    const TLS_SERVER_KEY: &str = include_str!("../tests/fixtures/tls/server.key.pem");
    const TLS_CLIENT_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/client.cert.pem");
    const TLS_CLIENT_KEY: &str = include_str!("../tests/fixtures/tls/client.key.pem");

    #[derive(Clone)]
    struct LifecycleTestServer {
        request: MessageDescriptor,
        reply: MessageDescriptor,
    }

    struct CollectHelloService(MessageDescriptor);

    impl ClientStreamingService<DynamicMessage> for CollectHelloService {
        type Response = DynamicMessage;
        type Future = BoxFuture<Response<Self::Response>, Status>;

        fn call(&mut self, request: Request<Streaming<DynamicMessage>>) -> Self::Future {
            let reply = self.0.clone();
            Box::pin(async move {
                let mut stream = request.into_inner();
                let mut count = 0usize;
                while stream.message().await?.is_some() {
                    count += 1;
                }
                let (message, _) = deserialize_session_message(
                    &serde_json::json!({ "message": format!("received {count}") }).to_string(),
                    reply,
                )
                .map_err(Status::internal)?;
                let mut response = Response::new(message);
                response
                    .metadata_mut()
                    .insert("x-received-count", MetadataValue::from_static("2"));
                Ok(response)
            })
        }
    }

    struct RejectHelloService;

    impl tonic::server::UnaryService<DynamicMessage> for RejectHelloService {
        type Response = DynamicMessage;
        type Future = BoxFuture<Response<Self::Response>, Status>;

        fn call(&mut self, _request: Request<DynamicMessage>) -> Self::Future {
            Box::pin(async move {
                let mut status = Status::invalid_argument("name is required");
                status
                    .metadata_mut()
                    .insert("x-error-id", MetadataValue::from_static("reject-1"));
                Err(status)
            })
        }
    }

    struct ChatHelloService(MessageDescriptor);

    impl StreamingService<DynamicMessage> for ChatHelloService {
        type Response = DynamicMessage;
        type ResponseStream = ReceiverStream<Result<DynamicMessage, Status>>;
        type Future = BoxFuture<Response<Self::ResponseStream>, Status>;

        fn call(&mut self, request: Request<Streaming<DynamicMessage>>) -> Self::Future {
            let reply = self.0.clone();
            Box::pin(async move {
                let mut stream = request.into_inner();
                let (sender, receiver) = mpsc::channel(8);
                tokio::spawn(async move {
                    while let Ok(Some(message)) = stream.message().await {
                        let value = match dynamic_to_json(message) {
                            Ok(value) => value,
                            Err(error) => {
                                let _ = sender.send(Err(Status::internal(error))).await;
                                break;
                            }
                        };
                        let name = value
                            .get("name")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or_default();
                        let response = deserialize_session_message(
                            &serde_json::json!({ "message": format!("echo {name}") }).to_string(),
                            reply.clone(),
                        )
                        .map(|(message, _)| message)
                        .map_err(Status::internal);
                        if sender.send(response).await.is_err() {
                            break;
                        }
                    }
                });
                Ok(Response::new(ReceiverStream::new(receiver)))
            })
        }
    }

    impl<B> Service<http::Request<B>> for LifecycleTestServer
    where
        B: tonic::codegen::Body + Send + 'static,
        B::Error: Into<StdError> + Send + 'static,
    {
        type Response = http::Response<Body>;
        type Error = Infallible;
        type Future = BoxFuture<Self::Response, Self::Error>;

        fn poll_ready(
            &mut self,
            _context: &mut std::task::Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn call(&mut self, request: http::Request<B>) -> Self::Future {
            match request.uri().path() {
                "/brunomnia.test.Greeter/CollectHello" => {
                    let method = CollectHelloService(self.reply.clone());
                    let codec = DynamicCodec::new(self.request.clone());
                    Box::pin(async move {
                        let response = tonic::server::Grpc::new(codec)
                            .client_streaming(method, request)
                            .await;
                        Ok(response)
                    })
                }
                "/brunomnia.test.Greeter/ChatHello" => {
                    let method = ChatHelloService(self.reply.clone());
                    let codec = DynamicCodec::new(self.request.clone());
                    Box::pin(async move {
                        let response = tonic::server::Grpc::new(codec)
                            .streaming(method, request)
                            .await;
                        Ok(response)
                    })
                }
                "/brunomnia.test.Greeter/RejectHello" => {
                    let method = RejectHelloService;
                    let codec = DynamicCodec::new(self.request.clone());
                    Box::pin(async move {
                        let response = tonic::server::Grpc::new(codec).unary(method, request).await;
                        Ok(response)
                    })
                }
                _ => Box::pin(async move {
                    let mut response = http::Response::new(Body::default());
                    response.headers_mut().insert(
                        Status::GRPC_STATUS,
                        (tonic::Code::Unimplemented as i32).into(),
                    );
                    response.headers_mut().insert(
                        http::header::CONTENT_TYPE,
                        tonic::metadata::GRPC_CONTENT_TYPE,
                    );
                    Ok(response)
                }),
            }
        }
    }

    impl NamedService for LifecycleTestServer {
        const NAME: &'static str = "brunomnia.test.Greeter";
    }

    fn recording_channel(events: Arc<StdMutex<Vec<serde_json::Value>>>) -> IpcChannel<StreamEvent> {
        IpcChannel::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                events.lock().unwrap().push(serde_json::from_str(&json)?);
            }
            Ok(())
        })
    }

    async fn wait_for_events(
        events: &Arc<StdMutex<Vec<serde_json::Value>>>,
        kind: &str,
        count: usize,
    ) {
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            loop {
                let found = events
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|event| {
                        event.get("kind").and_then(serde_json::Value::as_str) == Some(kind)
                    })
                    .count();
                if found >= count {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("gRPC lifecycle events arrive");
    }

    async fn start_lifecycle_server(
        pool: &DescriptorPool,
    ) -> (std::net::SocketAddr, oneshot::Sender<()>, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let service = LifecycleTestServer {
            request: pool
                .get_message_by_name("brunomnia.test.HelloRequest")
                .unwrap(),
            reply: pool
                .get_message_by_name("brunomnia.test.HelloReply")
                .unwrap(),
        };
        let (shutdown, shutdown_receiver) = oneshot::channel();
        let task = tokio::spawn(async move {
            Server::builder()
                .add_service(service)
                .serve_with_incoming_shutdown(TcpListenerStream::new(listener), async move {
                    let _ = shutdown_receiver.await;
                })
                .await
                .unwrap();
        });
        (address, shutdown, task)
    }

    fn lifecycle_input(
        endpoint: &str,
        descriptor_bytes: &[u8],
        session_id: &str,
        method: &str,
    ) -> GrpcSessionStartInput {
        GrpcSessionStartInput {
            session_id: session_id.into(),
            call: GrpcCallInput {
                endpoint: endpoint.into(),
                service: "brunomnia.test.Greeter".into(),
                method: method.into(),
                descriptor_set_base64: STANDARD.encode(descriptor_bytes),
                messages_json: "{}".into(),
                metadata: vec![],
                transport: TransportConfig {
                    timeout_ms: 5_000,
                    ..Default::default()
                },
            },
        }
    }

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn runs_client_streaming_and_bidirectional_session_lifecycles() {
        let (pool, descriptor_bytes) = compile_proto(TEST_PROTO, &[], "").unwrap();
        let (address, shutdown, server) = start_lifecycle_server(&pool).await;
        let endpoint = format!("http://{address}");
        let state = GrpcSessionState::default();

        let client_events = Arc::new(StdMutex::new(Vec::new()));
        let output = start_session(
            lifecycle_input(
                &endpoint,
                &descriptor_bytes,
                "client-stream",
                "CollectHello",
            ),
            recording_channel(client_events.clone()),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.call_type, "client-streaming");
        send_session_message(
            "client-stream".into(),
            r#"{"name":"Ada"}"#.into(),
            state.clone(),
        )
        .await
        .unwrap();
        send_session_message(
            "client-stream".into(),
            r#"{"name":"Grace"}"#.into(),
            state.clone(),
        )
        .await
        .unwrap();
        commit_session("client-stream".into(), state.clone())
            .await
            .unwrap();
        wait_for_events(&client_events, "end", 1).await;
        {
            let client_events = client_events.lock().unwrap();
            assert_eq!(
                client_events
                    .iter()
                    .filter(
                        |event| event.get("direction").and_then(serde_json::Value::as_str)
                            == Some("outgoing"),
                    )
                    .count(),
                2
            );
            assert!(client_events.iter().any(|event| event
                .get("text")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|text| text.contains("received 2"))));
            assert!(client_events.iter().any(|event| {
                event.get("statusCode").and_then(serde_json::Value::as_i64) == Some(0)
                    && event
                        .pointer("/metadata/x-received-count/0")
                        .and_then(serde_json::Value::as_str)
                        == Some("2")
            }));
        }

        let bidi_events = Arc::new(StdMutex::new(Vec::new()));
        let output = start_session(
            lifecycle_input(&endpoint, &descriptor_bytes, "bidi-stream", "ChatHello"),
            recording_channel(bidi_events.clone()),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.call_type, "bidirectional-streaming");
        send_session_message(
            "bidi-stream".into(),
            r#"{"name":"Lin"}"#.into(),
            state.clone(),
        )
        .await
        .unwrap();
        send_session_message(
            "bidi-stream".into(),
            r#"{"name":"Margaret"}"#.into(),
            state.clone(),
        )
        .await
        .unwrap();
        wait_for_events(&bidi_events, "message", 4).await;
        commit_session("bidi-stream".into(), state.clone())
            .await
            .unwrap();
        wait_for_events(&bidi_events, "end", 1).await;
        {
            let bidi_events = bidi_events.lock().unwrap();
            assert!(bidi_events.iter().any(|event| event
                .get("text")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|text| text.contains("echo Lin"))));
            assert!(bidi_events.iter().any(|event| event
                .get("text")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|text| text.contains("echo Margaret"))));
        }

        let cancel_events = Arc::new(StdMutex::new(Vec::new()));
        start_session(
            lifecycle_input(&endpoint, &descriptor_bytes, "cancel-stream", "ChatHello"),
            recording_channel(cancel_events.clone()),
            state.clone(),
        )
        .await
        .unwrap();
        cancel_session("cancel-stream".into(), state.clone())
            .await
            .unwrap();
        wait_for_events(&cancel_events, "cancel", 1).await;
        wait_for_events(&cancel_events, "status", 1).await;
        wait_for_events(&cancel_events, "end", 1).await;
        assert!(cancel_events.lock().unwrap().iter().any(|event| {
            event.get("statusCode").and_then(serde_json::Value::as_i64) == Some(1)
                && event.get("statusName").and_then(serde_json::Value::as_str) == Some("CANCELLED")
        }));

        let error_events = Arc::new(StdMutex::new(Vec::new()));
        start_session(
            lifecycle_input(&endpoint, &descriptor_bytes, "error-status", "RejectHello"),
            recording_channel(error_events.clone()),
            state.clone(),
        )
        .await
        .unwrap();
        wait_for_events(&error_events, "status", 1).await;
        wait_for_events(&error_events, "error", 1).await;
        wait_for_events(&error_events, "end", 1).await;
        {
            let error_events = error_events.lock().unwrap();
            assert!(error_events.iter().any(|event| {
                event.get("statusCode").and_then(serde_json::Value::as_i64) == Some(3)
                    && event.get("statusName").and_then(serde_json::Value::as_str)
                        == Some("INVALID_ARGUMENT")
                    && event
                        .get("statusDetails")
                        .and_then(serde_json::Value::as_str)
                        == Some("name is required")
                    && event
                        .pointer("/metadata/x-error-id/0")
                        .and_then(serde_json::Value::as_str)
                        == Some("reject-1")
            }));
        }

        let _ = shutdown.send(());
        server.await.unwrap();
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

            let (pfx_stream, _) = listener.accept().await.unwrap();
            assert!(mutual_acceptor.accept(pfx_stream).await.is_ok());

            let (trusted_stream, _) = listener.accept().await.unwrap();
            assert!(plain_acceptor.accept(trusted_stream).await.is_ok());
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
        let _ = connect_channel(
            &endpoint,
            &TransportConfig {
                timeout_ms: 1_000,
                validate_certificates: false,
                client_certificate_pfx_base64: crate::client_identity::test_pfx_base64(
                    "grpc-secret",
                    false,
                ),
                client_certificate_passphrase: "grpc-secret".into(),
                ..Default::default()
            },
        )
        .await;
        let _ = connect_channel(
            &endpoint,
            &TransportConfig {
                timeout_ms: 1_000,
                ca_certificate_pem: TLS_CA_CERTIFICATE.into(),
                ..Default::default()
            },
        )
        .await;
        server.await.unwrap();
    }
}

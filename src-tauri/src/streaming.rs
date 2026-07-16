use crate::{
    http_client::build_client,
    models::{StreamConnectInput, StreamEvent},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use std::{collections::HashMap, sync::Arc};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};

enum WebSocketCommand {
    Text(String),
    Binary(Vec<u8>),
    Close,
}

fn websocket_command(kind: &str, message: String) -> Result<WebSocketCommand, String> {
    if kind == "binary" {
        return STANDARD
            .decode(message.trim())
            .map(WebSocketCommand::Binary)
            .map_err(|error| format!("Binary WebSocket frames must be base64: {error}"));
    }
    Ok(WebSocketCommand::Text(message))
}

#[derive(Clone, Default)]
pub struct StreamingState {
    websocket_sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<WebSocketCommand>>>>,
    sse_sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<()>>>>,
}

pub async fn connect_websocket(
    input: StreamConnectInput,
    on_event: Channel<StreamEvent>,
    state: StreamingState,
) -> Result<(), String> {
    if state
        .websocket_sessions
        .lock()
        .await
        .contains_key(&input.session_id)
    {
        return Err("This WebSocket session is already connected.".into());
    }

    let mut request = input
        .url
        .as_str()
        .into_client_request()
        .map_err(|error| format!("Invalid WebSocket URL: {error}"))?;
    for header in input.headers.into_iter().filter(|header| header.enabled) {
        let name = header
            .name
            .parse::<http::HeaderName>()
            .map_err(|error| format!("Invalid WebSocket header name: {error}"))?;
        let value = header
            .value
            .parse::<http::HeaderValue>()
            .map_err(|error| format!("Invalid WebSocket header value: {error}"))?;
        request.headers_mut().insert(name, value);
    }

    let (socket, response) = connect_async(request)
        .await
        .map_err(|error| format!("WebSocket connection failed: {error}"))?;
    let (sender, mut receiver) = mpsc::unbounded_channel();
    state
        .websocket_sessions
        .lock()
        .await
        .insert(input.session_id.clone(), sender);

    let session_id = input.session_id.clone();
    let sessions = state.websocket_sessions.clone();
    let _ = on_event.send(StreamEvent::system(
        &session_id,
        "open",
        format!("Connected · HTTP {}", response.status()),
    ));

    tokio::spawn(async move {
        let mut socket = socket;
        loop {
            tokio::select! {
                command = receiver.recv() => {
                    match command {
                        Some(WebSocketCommand::Text(text)) => {
                            match socket.send(Message::Text(text.clone().into())).await {
                                Ok(()) => { let _ = on_event.send(StreamEvent::outgoing(&session_id, "text", text)); }
                                Err(error) => {
                                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                                    break;
                                }
                            }
                        }
                        Some(WebSocketCommand::Binary(bytes)) => {
                            let encoded = STANDARD.encode(&bytes);
                            match socket.send(Message::Binary(bytes.clone().into())).await {
                                Ok(()) => { let _ = on_event.send(StreamEvent::outgoing(&session_id, "binary", encoded)); }
                                Err(error) => {
                                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                                    break;
                                }
                            }
                        }
                        Some(WebSocketCommand::Close) | None => {
                            let _ = socket.close(None).await;
                            break;
                        }
                    }
                }
                message = socket.next() => {
                    match message {
                        Some(Ok(Message::Text(text))) => {
                            let _ = on_event.send(StreamEvent::incoming(&session_id, "text", text.to_string()));
                        }
                        Some(Ok(Message::Binary(bytes))) => {
                            let _ = on_event.send(StreamEvent::incoming(
                                &session_id,
                                "binary",
                                STANDARD.encode(&bytes),
                            ));
                        }
                        Some(Ok(Message::Ping(_))) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "ping", "Ping received"));
                        }
                        Some(Ok(Message::Pong(_))) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "pong", "Pong received"));
                        }
                        Some(Ok(Message::Close(frame))) => {
                            let reason = frame.map(|frame| frame.reason.to_string()).unwrap_or_else(|| "Remote peer closed the connection".into());
                            let _ = on_event.send(StreamEvent::system(&session_id, "close", reason));
                            break;
                        }
                        Some(Ok(Message::Frame(_))) => {}
                        Some(Err(error)) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                            break;
                        }
                        None => break,
                    }
                }
            }
        }
        sessions.lock().await.remove(&session_id);
        let _ = on_event.send(StreamEvent::system(&session_id, "closed", "Disconnected"));
    });
    Ok(())
}

pub async fn send_websocket_message(
    session_id: String,
    message: String,
    kind: String,
    state: StreamingState,
) -> Result<(), String> {
    let sender = state
        .websocket_sessions
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Connect the WebSocket before sending a message.".to_string())?;
    let command = websocket_command(&kind, message)?;
    sender
        .send(command)
        .map_err(|_| "The WebSocket session has ended.".to_string())
}

pub async fn disconnect_websocket(session_id: String, state: StreamingState) -> Result<(), String> {
    let sender = state
        .websocket_sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "The WebSocket is not connected.".to_string())?;
    sender
        .send(WebSocketCommand::Close)
        .map_err(|_| "The WebSocket session has already ended.".to_string())
}

pub async fn connect_sse(
    input: StreamConnectInput,
    on_event: Channel<StreamEvent>,
    state: StreamingState,
) -> Result<(), String> {
    if state
        .sse_sessions
        .lock()
        .await
        .contains_key(&input.session_id)
    {
        return Err("This SSE stream is already connected.".into());
    }

    let client = build_client(&input.transport, Some(&input.url))?;
    let mut request = client.get(&input.url).header("Accept", "text/event-stream");
    for header in input.headers.into_iter().filter(|header| header.enabled) {
        request = request.header(&header.name, &header.value);
    }
    let response = request
        .send()
        .await
        .map_err(|error| format!("SSE connection failed: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("SSE server returned HTTP {status}."));
    }

    let (cancel, mut cancel_receiver) = mpsc::unbounded_channel();
    state
        .sse_sessions
        .lock()
        .await
        .insert(input.session_id.clone(), cancel);
    let session_id = input.session_id.clone();
    let sessions = state.sse_sessions.clone();
    let _ = on_event.send(StreamEvent::system(
        &session_id,
        "open",
        format!("Listening · HTTP {status}"),
    ));

    tokio::spawn(async move {
        let mut bytes = response.bytes_stream();
        let mut parser = SseParser::default();
        loop {
            tokio::select! {
                _ = cancel_receiver.recv() => break,
                chunk = bytes.next() => {
                    match chunk {
                        Some(Ok(chunk)) => {
                            for event in parser.push(&chunk) {
                                let _ = on_event.send(StreamEvent::incoming(&session_id, &event.event, event.data));
                            }
                        }
                        Some(Err(error)) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                            break;
                        }
                        None => break,
                    }
                }
            }
        }
        sessions.lock().await.remove(&session_id);
        let _ = on_event.send(StreamEvent::system(
            &session_id,
            "closed",
            "Event stream closed",
        ));
    });
    Ok(())
}

pub async fn disconnect_sse(session_id: String, state: StreamingState) -> Result<(), String> {
    let sender = state
        .sse_sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "The SSE stream is not connected.".to_string())?;
    sender
        .send(())
        .map_err(|_| "The SSE stream has already ended.".to_string())
}

#[derive(Debug, PartialEq)]
struct ParsedSseEvent {
    event: String,
    data: String,
}

#[derive(Default)]
struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    fn push(&mut self, chunk: &[u8]) -> Vec<ParsedSseEvent> {
        self.buffer.extend_from_slice(chunk);
        let mut events = Vec::new();
        while let Some((boundary, separator_length)) = find_event_boundary(&self.buffer) {
            let event_bytes = self.buffer.drain(..boundary).collect::<Vec<_>>();
            self.buffer.drain(..separator_length);
            if let Some(event) = parse_sse_event(&String::from_utf8_lossy(&event_bytes)) {
                events.push(event);
            }
        }
        events
    }
}

fn find_event_boundary(buffer: &[u8]) -> Option<(usize, usize)> {
    buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2))
        .or_else(|| {
            buffer
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|index| (index, 4))
        })
}

fn parse_sse_event(block: &str) -> Option<ParsedSseEvent> {
    let mut event = "message".to_string();
    let mut data = Vec::new();
    for line in block.lines() {
        if line.starts_with(':') {
            continue;
        }
        let (name, raw_value) = line.split_once(':').unwrap_or((line, ""));
        let value = raw_value.strip_prefix(' ').unwrap_or(raw_value);
        match name {
            "event" => event = value.to_string(),
            "data" => data.push(value.to_string()),
            _ => {}
        }
    }
    (!data.is_empty()).then(|| ParsedSseEvent {
        event,
        data: data.join("\n"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_binary_websocket_composition() {
        match websocket_command("binary", "AAEC/w==".into()).unwrap() {
            WebSocketCommand::Binary(bytes) => assert_eq!(bytes, vec![0, 1, 2, 255]),
            _ => panic!("expected a binary command"),
        }
        assert!(websocket_command("binary", "not base64".into()).is_err());
    }

    #[test]
    fn parses_chunked_multiline_events_and_comments() {
        let mut parser = SseParser::default();
        assert!(parser.push(b": keepalive\nevent: upd").is_empty());
        let events = parser.push(b"ate\ndata: first\ndata: second\n\n");
        assert_eq!(
            events,
            vec![ParsedSseEvent {
                event: "update".into(),
                data: "first\nsecond".into(),
            }]
        );
    }

    #[test]
    fn supports_crlf_event_boundaries() {
        let mut parser = SseParser::default();
        assert_eq!(
            parser.push(b"data: hello\r\n\r\n"),
            vec![ParsedSseEvent {
                event: "message".into(),
                data: "hello".into(),
            }]
        );
    }
}

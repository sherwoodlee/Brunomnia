use crate::{
    http_client::{self, flatten_headers, HttpCancellationState},
    models::{HttpHeaderOutput, HttpRequestInput, HttpResponseOutput, KeyValue},
};
use futures_util::StreamExt;
use reqwest::{
    header::{CONTENT_TYPE, SET_COOKIE},
    Response, StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex as StdMutex,
    },
    time::{Duration, Instant},
};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, Mutex};

const MAX_ACTIVE_STREAMS: usize = 100;
const MAX_SESSION_KEY_BYTES: usize = 8_192;
const MAX_SSE_EVENT_BYTES: usize = 4 * 1_024 * 1_024;
const MAX_POST_BODY_BYTES: usize = 8 * 1_024 * 1_024;
const MAX_POST_MESSAGES: usize = 1_000;
const MAX_EVENT_ID_BYTES: usize = 8_192;
const MAX_SESSION_ID_BYTES: usize = 4_096;
const MAX_RECONNECTS: u32 = 2;
const INITIAL_RECONNECT_DELAY_MS: u64 = 1_000;
const MAX_RECONNECT_DELAY_MS: u64 = 30_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpHttpRequestInput {
    request: HttpRequestInput,
    #[serde(default)]
    request_id: String,
    session_key: String,
    #[serde(default)]
    start_get_stream: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpHttpEvent {
    direction: String,
    method: String,
    detail: String,
    timestamp: String,
}

type SharedEventChannel = Arc<StdMutex<Channel<McpHttpEvent>>>;

struct SessionEntry {
    identity: u64,
    last_used: u64,
    cancel: mpsc::UnboundedSender<()>,
    channel: SharedEventChannel,
}

#[derive(Default)]
struct SessionRegistry {
    active: HashMap<String, SessionEntry>,
}

#[derive(Clone, Default)]
pub struct McpHttpSessionState {
    registry: Arc<Mutex<SessionRegistry>>,
    generation: Arc<AtomicU64>,
}

impl McpHttpSessionState {
    async fn update_channel(&self, session_key: &str, channel: Channel<McpHttpEvent>) {
        let mut registry = self.registry.lock().await;
        let shared = registry.active.get_mut(session_key).map(|entry| {
            entry.last_used = self.generation.fetch_add(1, Ordering::Relaxed) + 1;
            Arc::clone(&entry.channel)
        });
        drop(registry);
        if let Some(shared) = shared {
            if let Ok(mut current) = shared.lock() {
                *current = channel;
            }
        }
    }

    async fn start(
        &self,
        session_key: String,
        request: HttpRequestInput,
        channel: Channel<McpHttpEvent>,
    ) -> Result<(), String> {
        validate_session_key(&session_key)?;
        let identity = self.generation.fetch_add(1, Ordering::Relaxed) + 1;
        let (cancel, cancel_receiver) = mpsc::unbounded_channel();
        let shared_channel = Arc::new(StdMutex::new(channel));
        let (replaced, evicted) = {
            let mut registry = self.registry.lock().await;
            let evicted = (!registry.active.contains_key(&session_key)
                && registry.active.len() >= MAX_ACTIVE_STREAMS)
                .then(|| {
                    registry
                        .active
                        .iter()
                        .min_by_key(|(_, entry)| entry.last_used)
                        .map(|(key, _)| key.clone())
                })
                .flatten()
                .and_then(|key| registry.active.remove(&key));
            let replaced = registry.active.insert(
                session_key.clone(),
                SessionEntry {
                    identity,
                    last_used: identity,
                    cancel,
                    channel: Arc::clone(&shared_channel),
                },
            );
            (replaced, evicted)
        };
        if let Some(replaced) = replaced {
            let _ = replaced.cancel.send(());
        }
        if let Some(evicted) = evicted {
            let _ = evicted.cancel.send(());
        }
        let state = self.clone();
        tokio::spawn(async move {
            run_get_stream(request, cancel_receiver, &shared_channel).await;
            let mut registry = state.registry.lock().await;
            if registry
                .active
                .get(&session_key)
                .is_some_and(|entry| entry.identity == identity)
            {
                registry.active.remove(&session_key);
            }
        });
        Ok(())
    }

    pub async fn close(&self, session_key: &str) -> bool {
        if validate_session_key(session_key).is_err() {
            return false;
        }
        self.registry
            .lock()
            .await
            .active
            .remove(session_key)
            .is_some_and(|entry| entry.cancel.send(()).is_ok())
    }

    #[cfg(test)]
    async fn contains(&self, session_key: &str) -> bool {
        self.registry.lock().await.active.contains_key(session_key)
    }
}

fn validate_session_key(session_key: &str) -> Result<(), String> {
    if session_key.is_empty()
        || session_key.len() > MAX_SESSION_KEY_BYTES
        || session_key.contains('\0')
    {
        return Err("The MCP HTTP session identity exceeds its safety limit.".into());
    }
    Ok(())
}

fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn emit_system(channel: &SharedEventChannel, detail: impl Into<String>) {
    emit_event(
        channel,
        McpHttpEvent {
            direction: "server".into(),
            method: "MCP Streamable HTTP".into(),
            detail: detail.into(),
            timestamp: timestamp(),
        },
    );
}

fn emit_message(channel: &SharedEventChannel, message: &Value) {
    let method = message
        .as_object()
        .and_then(|object| object.get("method"))
        .and_then(Value::as_str)
        .unwrap_or("message")
        .to_string();
    emit_event(
        channel,
        McpHttpEvent {
            direction: "server".into(),
            method,
            detail: serde_json::to_string(message).unwrap_or_else(|_| "null".into()),
            timestamp: timestamp(),
        },
    );
}

fn emit_event(channel: &SharedEventChannel, event: McpHttpEvent) {
    if let Ok(channel) = channel.lock() {
        let _ = channel.send(event);
    }
}

#[derive(Debug)]
struct ResponseMetadata {
    status: StatusCode,
    status_text: String,
    headers: std::collections::BTreeMap<String, String>,
    header_lines: Vec<HttpHeaderOutput>,
    set_cookies: Vec<String>,
    http_version: String,
    effective_url: String,
}

impl ResponseMetadata {
    fn from_response(response: &Response) -> Self {
        Self {
            status: response.status(),
            status_text: response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown")
                .to_string(),
            headers: flatten_headers(response.headers()),
            header_lines: response
                .headers()
                .iter()
                .map(|(name, value)| HttpHeaderOutput {
                    name: name.to_string(),
                    value: value.to_str().unwrap_or("<binary header>").to_string(),
                })
                .collect(),
            set_cookies: response
                .headers()
                .get_all(SET_COOKIE)
                .iter()
                .filter_map(|value| value.to_str().ok())
                .map(str::to_string)
                .collect(),
            http_version: format!("{:?}", response.version()),
            effective_url: response.url().to_string(),
        }
    }

    fn output(self, body: Vec<u8>, started: Instant) -> HttpResponseOutput {
        let size_bytes = body.len();
        HttpResponseOutput {
            status: self.status.as_u16(),
            status_text: self.status_text,
            headers: self.headers,
            header_lines: self.header_lines,
            body: String::from_utf8_lossy(&body).into_owned(),
            body_base64: None,
            duration_ms: started.elapsed().as_millis(),
            size_bytes,
            set_cookies: self.set_cookies,
            http_version: self.http_version,
            effective_url: self.effective_url,
            redirects: Vec::new(),
            redirects_truncated: false,
        }
    }
}

async fn open_response(request: &HttpRequestInput) -> Result<Response, String> {
    let opening = http_client::send_streaming(request);
    let result = if request.transport.timeout_ms == 0 {
        opening.await
    } else {
        tokio::time::timeout(Duration::from_millis(request.transport.timeout_ms), opening)
            .await
            .map_err(|_| "MCP HTTP response headers timed out.".to_string())?
    };
    result.map_err(|error| error.to_string())
}

fn is_event_stream(response: &Response) -> bool {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(';')
                .next()
                .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("text/event-stream"))
        })
}

async fn read_bounded_body(response: Response, limit: usize) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Unable to read the MCP HTTP body: {error}"))?;
        if body.len().saturating_add(chunk.len()) > limit {
            return Err(format!(
                "The MCP HTTP response exceeded its {} byte safety limit.",
                limit
            ));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

async fn read_bounded_body_with_timeout(
    response: Response,
    request: &HttpRequestInput,
) -> Result<Vec<u8>, String> {
    let reading = read_bounded_body(response, MAX_POST_BODY_BYTES);
    if request.transport.timeout_ms == 0 {
        reading.await
    } else {
        tokio::time::timeout(Duration::from_millis(request.transport.timeout_ms), reading)
            .await
            .map_err(|_| "MCP HTTP response body timed out.".to_string())?
    }
}

#[derive(Debug)]
struct ParsedSseEvent {
    data: String,
    id: Option<String>,
    retry_ms: Option<u64>,
}

#[derive(Default)]
struct BoundedSseParser {
    buffer: Vec<u8>,
}

impl BoundedSseParser {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<ParsedSseEvent>, String> {
        if self.buffer.len().saturating_add(chunk.len()) > MAX_SSE_EVENT_BYTES {
            return Err(format!(
                "An MCP SSE event exceeded its {MAX_SSE_EVENT_BYTES} byte safety limit."
            ));
        }
        self.buffer.extend_from_slice(chunk);
        let mut events = Vec::new();
        while let Some((boundary, separator_length)) = find_event_boundary(&self.buffer) {
            let event = self.buffer.drain(..boundary).collect::<Vec<_>>();
            self.buffer.drain(..separator_length);
            if let Some(event) = parse_sse_event(&String::from_utf8_lossy(&event))? {
                events.push(event);
            }
        }
        Ok(events)
    }
}

fn find_event_boundary(buffer: &[u8]) -> Option<(usize, usize)> {
    let line_feed = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    let carriage_return = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    match (line_feed, carriage_return) {
        (Some(left), Some(right)) => Some(if left.0 <= right.0 { left } else { right }),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn parse_sse_event(block: &str) -> Result<Option<ParsedSseEvent>, String> {
    let mut data = Vec::new();
    let mut id = None;
    let mut retry_ms = None;
    for line in block.lines() {
        if line.starts_with(':') {
            continue;
        }
        let (name, raw_value) = line.split_once(':').unwrap_or((line, ""));
        let value = raw_value.strip_prefix(' ').unwrap_or(raw_value);
        match name {
            "data" => data.push(value.to_string()),
            "id" if !value.contains('\0') => {
                if value.len() > MAX_EVENT_ID_BYTES {
                    return Err("The MCP SSE event ID exceeded its safety limit.".into());
                }
                id = Some(value.to_string());
            }
            "retry" => retry_ms = value.parse::<u64>().ok(),
            _ => {}
        }
    }
    Ok(
        (!data.is_empty() || id.is_some() || retry_ms.is_some()).then(|| ParsedSseEvent {
            data: data.join("\n"),
            id,
            retry_ms,
        }),
    )
}

fn parse_json_messages(body: &[u8]) -> Result<Vec<Value>, String> {
    let source = std::str::from_utf8(body)
        .map_err(|_| "The MCP server returned a non-UTF-8 JSON response.".to_string())?;
    let parsed: Value = serde_json::from_str(source)
        .map_err(|error| format!("The MCP server returned invalid JSON: {error}"))?;
    let messages = match parsed {
        Value::Array(messages) => messages,
        message => vec![message],
    };
    if messages.len() > MAX_POST_MESSAGES {
        return Err("The MCP JSON response exceeded its message-count safety limit.".into());
    }
    Ok(messages)
}

struct PostProgress {
    messages: Vec<Value>,
    last_event_id: String,
    reconnect_delay_ms: u64,
    total_message_bytes: usize,
}

impl Default for PostProgress {
    fn default() -> Self {
        Self {
            messages: Vec::new(),
            last_event_id: String::new(),
            reconnect_delay_ms: INITIAL_RECONNECT_DELAY_MS,
            total_message_bytes: 0,
        }
    }
}

impl PostProgress {
    fn apply(
        &mut self,
        event: ParsedSseEvent,
        request_id: &str,
        channel: &SharedEventChannel,
    ) -> Result<bool, String> {
        if let Some(id) = event.id {
            self.last_event_id = id;
        }
        if let Some(delay) = event.retry_ms {
            self.reconnect_delay_ms = delay.clamp(10, MAX_RECONNECT_DELAY_MS);
        }
        if event.data.is_empty() || event.data == "[DONE]" {
            return Ok(false);
        }
        self.total_message_bytes = self.total_message_bytes.saturating_add(event.data.len());
        if self.total_message_bytes > MAX_POST_BODY_BYTES
            || self.messages.len() >= MAX_POST_MESSAGES
        {
            return Err("The MCP POST stream exceeded its cumulative safety limit.".into());
        }
        let message: Value = serde_json::from_str(&event.data)
            .map_err(|error| format!("The MCP SSE event contained invalid JSON: {error}"))?;
        if message.get("id").is_some() && message.get("method").and_then(Value::as_str).is_some() {
            emit_message(channel, &message);
        }
        let matched = message
            .as_object()
            .and_then(|object| object.get("id"))
            .and_then(Value::as_str)
            .is_some_and(|id| id == request_id);
        self.messages.push(message);
        Ok(matched)
    }
}

async fn consume_post_stream(
    response: Response,
    request_id: &str,
    progress: &mut PostProgress,
    channel: &SharedEventChannel,
) -> Result<bool, String> {
    let mut parser = BoundedSseParser::default();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("The MCP POST stream failed: {error}"))?;
        for event in parser.push(&chunk)? {
            if progress.apply(event, request_id, channel)? {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn replace_header(headers: &mut Vec<KeyValue>, name: &str, value: Option<&str>) {
    headers.retain(|header| !header.name.eq_ignore_ascii_case(name));
    if let Some(value) = value.filter(|value| !value.is_empty()) {
        headers.push(KeyValue {
            name: name.to_string(),
            value: value.to_string(),
            enabled: true,
        });
    }
}

fn get_request(
    source: &HttpRequestInput,
    session_id: Option<&str>,
    last_event_id: Option<&str>,
) -> HttpRequestInput {
    let mut request = source.clone();
    request.method = "GET".into();
    request.body_mode = "none".into();
    request.body.clear();
    request.form_body.clear();
    request.multipart_body.clear();
    request.binary_body = None;
    replace_header(&mut request.headers, "Content-Type", None);
    replace_header(&mut request.headers, "Content-Length", None);
    replace_header(&mut request.headers, "Accept", Some("text/event-stream"));
    if let Some(session_id) = session_id {
        replace_header(
            &mut request.headers,
            "Mcp-Session-Id",
            (!session_id.is_empty()).then_some(session_id),
        );
    }
    replace_header(
        &mut request.headers,
        "Last-Event-ID",
        last_event_id.filter(|value| !value.is_empty()),
    );
    request
}

fn response_session_id(response: &Response) -> Result<Option<String>, String> {
    let Some((_, value)) = response
        .headers()
        .iter()
        .find(|(name, _)| name.as_str().eq_ignore_ascii_case("mcp-session-id"))
    else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| "The MCP server returned a non-text session identity.".to_string())?;
    if value.len() > MAX_SESSION_ID_BYTES
        || value
            .chars()
            .any(|character| matches!(character, '\0' | '\r' | '\n'))
    {
        return Err("The MCP server returned an invalid or oversized session identity.".into());
    }
    Ok(Some(value.to_string()))
}

fn next_reconnect_delay(delay: u64) -> u64 {
    delay
        .saturating_mul(3)
        .div_ceil(2)
        .min(MAX_RECONNECT_DELAY_MS)
}

async fn sleep_for_reconnect(delay_ms: u64) {
    tokio::time::sleep(Duration::from_millis(delay_ms)).await;
}

async fn execute(
    input: McpHttpRequestInput,
    on_event: Channel<McpHttpEvent>,
    sessions: McpHttpSessionState,
) -> Result<HttpResponseOutput, String> {
    validate_session_key(&input.session_key)?;
    sessions
        .update_channel(&input.session_key, on_event.clone())
        .await;
    let post_channel = Arc::new(StdMutex::new(on_event.clone()));
    let started = Instant::now();
    let response = open_response(&input.request).await?;
    let metadata = ResponseMetadata::from_response(&response);
    let status = response.status();
    let session_id = response_session_id(&response)?;
    if !status.is_success() {
        let body = read_bounded_body_with_timeout(response, &input.request).await?;
        return Ok(metadata.output(body, started));
    }
    if input.request_id.is_empty() {
        if input.start_get_stream {
            let request = get_request(&input.request, session_id.as_deref(), None);
            sessions.start(input.session_key, request, on_event).await?;
        }
        return Ok(metadata.output(Vec::new(), started));
    }
    if !is_event_stream(&response) {
        let body = read_bounded_body_with_timeout(response, &input.request).await?;
        let messages = parse_json_messages(&body)?;
        let has_match = messages.iter().any(|message| {
            message
                .as_object()
                .and_then(|object| object.get("id"))
                .and_then(Value::as_str)
                .is_some_and(|id| id == input.request_id)
        });
        if !has_match {
            return Err("The MCP server did not return the matching JSON-RPC response.".into());
        }
        return Ok(metadata.output(body, started));
    }

    let mut progress = PostProgress::default();
    let mut matched =
        consume_post_stream(response, &input.request_id, &mut progress, &post_channel).await?;
    let mut reconnects = 0;
    let mut last_reconnect_error = String::new();
    while !matched {
        if progress.last_event_id.is_empty() {
            return Err(
                "The MCP POST stream ended before its matching response and supplied no resumable event ID."
                    .into(),
            );
        }
        if reconnects >= MAX_RECONNECTS {
            let detail = if last_reconnect_error.is_empty() {
                String::new()
            } else {
                format!(" Last failure: {last_reconnect_error}")
            };
            return Err(format!(
                "The MCP POST stream ended before its matching response after {MAX_RECONNECTS} reconnect attempts.{detail}"
            ));
        }
        reconnects += 1;
        sleep_for_reconnect(progress.reconnect_delay_ms).await;
        let resumed_request = get_request(
            &input.request,
            session_id.as_deref(),
            Some(&progress.last_event_id),
        );
        let resumed = match open_response(&resumed_request).await {
            Ok(response) => response,
            Err(error) => {
                last_reconnect_error = error;
                progress.reconnect_delay_ms = next_reconnect_delay(progress.reconnect_delay_ms);
                continue;
            }
        };
        if !resumed.status().is_success() {
            last_reconnect_error = format!("The resume stream returned HTTP {}.", resumed.status());
            progress.reconnect_delay_ms = next_reconnect_delay(progress.reconnect_delay_ms);
            continue;
        }
        if !is_event_stream(&resumed) {
            return Err("The MCP POST resume response was not an SSE stream.".into());
        }
        matched =
            consume_post_stream(resumed, &input.request_id, &mut progress, &post_channel).await?;
        last_reconnect_error.clear();
        progress.reconnect_delay_ms = next_reconnect_delay(progress.reconnect_delay_ms);
    }
    let body = serde_json::to_vec(&progress.messages)
        .map_err(|error| format!("Unable to encode MCP stream messages: {error}"))?;
    Ok(metadata.output(body, started))
}

async fn run_get_stream(
    request: HttpRequestInput,
    mut cancel: mpsc::UnboundedReceiver<()>,
    channel: &SharedEventChannel,
) {
    let mut reconnects = 0;
    let mut reconnect_delay_ms = INITIAL_RECONNECT_DELAY_MS;
    let mut last_event_id = String::new();
    loop {
        let next_request = get_request(
            &request,
            None,
            (!last_event_id.is_empty()).then_some(last_event_id.as_str()),
        );
        let response = tokio::select! {
            _ = cancel.recv() => return,
            response = open_response(&next_request) => response,
        };
        let response = match response {
            Ok(response) if response.status() == StatusCode::METHOD_NOT_ALLOWED => {
                emit_system(
                    channel,
                    "The server declined the optional MCP GET event stream with HTTP 405.",
                );
                return;
            }
            Ok(response) if !response.status().is_success() => {
                emit_system(
                    channel,
                    format!(
                        "The MCP GET event stream returned HTTP {}.",
                        response.status()
                    ),
                );
                None
            }
            Ok(response) if !is_event_stream(&response) => {
                emit_system(channel, "The MCP GET response was not an SSE stream.");
                None
            }
            Ok(response) => {
                emit_system(
                    channel,
                    format!(
                        "MCP GET event stream connected · HTTP {}.",
                        response.status()
                    ),
                );
                Some(response)
            }
            Err(error) => {
                emit_system(channel, format!("MCP GET event stream failed: {error}"));
                None
            }
        };
        if let Some(response) = response {
            let mut stream = response.bytes_stream();
            let mut parser = BoundedSseParser::default();
            loop {
                let chunk = tokio::select! {
                    _ = cancel.recv() => return,
                    chunk = stream.next() => chunk,
                };
                match chunk {
                    Some(Ok(chunk)) => match parser.push(&chunk) {
                        Ok(events) => {
                            for event in events {
                                if let Some(id) = event.id {
                                    last_event_id = id;
                                }
                                if let Some(delay) = event.retry_ms {
                                    reconnect_delay_ms = delay.clamp(10, MAX_RECONNECT_DELAY_MS);
                                }
                                if !event.data.is_empty() && event.data != "[DONE]" {
                                    match serde_json::from_str::<Value>(&event.data) {
                                        Ok(message) => emit_message(channel, &message),
                                        Err(error) => emit_system(
                                            channel,
                                            format!(
                                                "The MCP GET SSE event contained invalid JSON: {error}"
                                            ),
                                        ),
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            emit_system(channel, error);
                            break;
                        }
                    },
                    Some(Err(error)) => {
                        emit_system(channel, format!("The MCP GET stream failed: {error}"));
                        break;
                    }
                    None => break,
                }
            }
        }
        if reconnects >= MAX_RECONNECTS {
            emit_system(
                channel,
                format!(
                    "The MCP GET event stream stopped after {MAX_RECONNECTS} reconnect attempts."
                ),
            );
            return;
        }
        reconnects += 1;
        emit_system(
            channel,
            format!(
                "MCP GET event stream reconnect {reconnects}/{MAX_RECONNECTS} in {reconnect_delay_ms} ms."
            ),
        );
        tokio::select! {
            _ = cancel.recv() => return,
            _ = sleep_for_reconnect(reconnect_delay_ms) => {}
        }
        reconnect_delay_ms = next_reconnect_delay(reconnect_delay_ms);
    }
}

pub async fn send_cancellable(
    input: McpHttpRequestInput,
    cancellation_id: Option<String>,
    on_event: Channel<McpHttpEvent>,
    cancellations: &HttpCancellationState,
    sessions: McpHttpSessionState,
) -> Result<HttpResponseOutput, String> {
    let Some(cancellation_id) = cancellation_id.filter(|value| !value.is_empty()) else {
        return execute(input, on_event, sessions).await;
    };
    let Some(cancellation) = cancellations.register(cancellation_id.clone()) else {
        return Err("MCP HTTP request canceled.".into());
    };
    let result = tokio::select! {
        result = execute(input, on_event, sessions) => result,
        _ = cancellation => Err("MCP HTTP request canceled.".into()),
    };
    cancellations.finish(&cancellation_id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{NativeAuthConfig, TransportConfig};
    use serde_json::json;
    use std::{collections::BTreeMap, sync::mpsc as std_mpsc};
    use tauri::ipc::InvokeResponseBody;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::{TcpListener, TcpStream},
        sync::oneshot,
    };

    struct TestRequest {
        method: String,
        headers: BTreeMap<String, String>,
        body: String,
    }

    async fn read_request(stream: &mut TcpStream) -> TestRequest {
        let mut bytes = Vec::new();
        let header_end = loop {
            let mut chunk = [0_u8; 4_096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "connection closed before request headers");
            bytes.extend_from_slice(&chunk[..read]);
            if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                break index + 4;
            }
            assert!(bytes.len() <= 64 * 1_024);
        };
        let head = String::from_utf8(bytes[..header_end].to_vec()).unwrap();
        let mut lines = head.lines();
        let request_line = lines.next().unwrap();
        let method = request_line.split_whitespace().next().unwrap().to_string();
        let headers = lines
            .filter_map(|line| line.split_once(':'))
            .map(|(name, value)| (name.to_ascii_lowercase(), value.trim().to_string()))
            .collect::<BTreeMap<_, _>>();
        let content_length = headers
            .get("content-length")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or_default();
        while bytes.len() < header_end + content_length {
            let mut chunk = [0_u8; 4_096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "connection closed before request body");
            bytes.extend_from_slice(&chunk[..read]);
        }
        TestRequest {
            method,
            headers,
            body: String::from_utf8_lossy(&bytes[header_end..header_end + content_length])
                .into_owned(),
        }
    }

    async fn write_response(
        stream: &mut TcpStream,
        status: &str,
        content_type: &str,
        body: &str,
        keep_open: bool,
    ) {
        let framing = if keep_open {
            "connection: keep-alive\r\n".to_string()
        } else {
            format!("content-length: {}\r\nconnection: close\r\n", body.len())
        };
        let response =
            format!("HTTP/1.1 {status}\r\ncontent-type: {content_type}\r\n{framing}\r\n{body}");
        stream.write_all(response.as_bytes()).await.unwrap();
        stream.flush().await.unwrap();
        if !keep_open {
            stream.shutdown().await.unwrap();
        }
    }

    fn request(url: String, id: &str) -> HttpRequestInput {
        HttpRequestInput {
            method: "POST".into(),
            url,
            headers: vec![
                KeyValue {
                    name: "Content-Type".into(),
                    value: "application/json".into(),
                    enabled: true,
                },
                KeyValue {
                    name: "Accept".into(),
                    value: "application/json, text/event-stream".into(),
                    enabled: true,
                },
            ],
            body_mode: "json".into(),
            body: json!({ "jsonrpc": "2.0", "id": id, "method": "tools/list" }).to_string(),
            form_body: Vec::new(),
            multipart_body: Vec::new(),
            binary_body: None,
            auth: NativeAuthConfig::default(),
            transport: TransportConfig {
                follow_redirects: false,
                timeout_ms: 2_000,
                ..Default::default()
            },
        }
    }

    fn discard_channel() -> Channel<McpHttpEvent> {
        Channel::new(|body| {
            if let InvokeResponseBody::Json(json) = body {
                let _: Value = serde_json::from_str(&json)?;
            }
            Ok(())
        })
    }

    fn recording_channel() -> (Channel<McpHttpEvent>, std_mpsc::Receiver<Value>) {
        let (sender, receiver) = std_mpsc::channel();
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                sender.send(serde_json::from_str::<Value>(&json)?).unwrap();
            }
            Ok(())
        });
        (channel, receiver)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn returns_matching_post_result_before_the_sse_connection_closes() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (release_sender, release_receiver) = oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let request = read_request(&mut stream).await;
            assert_eq!(request.method, "POST");
            assert!(request.body.contains("tools/list"));
            write_response(
                &mut stream,
                "200 OK",
                "text/event-stream",
                "id: result-1\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"request-1\",\"result\":{\"tools\":[]}}\n\n",
                true,
            )
            .await;
            let no_reconnect = tokio::time::timeout(Duration::from_millis(250), listener.accept())
                .await
                .is_err();
            let _ = release_receiver.await;
            no_reconnect
        });

        let output = tokio::time::timeout(
            Duration::from_millis(500),
            send_cancellable(
                McpHttpRequestInput {
                    request: request(format!("http://{address}/mcp"), "request-1"),
                    request_id: "request-1".into(),
                    session_key: "project/request".into(),
                    start_get_stream: false,
                },
                None,
                discard_channel(),
                &HttpCancellationState::default(),
                McpHttpSessionState::default(),
            ),
        )
        .await
        .expect("matching response should not wait for EOF")
        .unwrap();
        assert_eq!(output.status, 200);
        let messages: Vec<Value> = serde_json::from_str(&output.body).unwrap();
        assert_eq!(messages.last().unwrap()["id"], "request-1");
        let _ = release_sender.send(());
        assert!(
            server.await.unwrap(),
            "POST stream reconnected after its result"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn emits_server_requests_before_the_matching_post_result() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (release_sender, release_receiver) = oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut stream).await.method, "POST");
            stream
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\nconnection: keep-alive\r\n\r\n")
                .await
                .unwrap();
            stream
                .write_all(b"data: {\"jsonrpc\":\"2.0\",\"id\":\"sample-1\",\"method\":\"sampling/createMessage\",\"params\":{\"messages\":[]}}\n\n")
                .await
                .unwrap();
            stream.flush().await.unwrap();
            release_receiver.await.unwrap();
            stream
                .write_all(b"data: {\"jsonrpc\":\"2.0\",\"id\":\"request-live\",\"result\":{\"tools\":[]}}\n\n")
                .await
                .unwrap();
            stream.flush().await.unwrap();
        });

        let (channel, events) = recording_channel();
        let pending = tokio::spawn(async move {
            send_cancellable(
                McpHttpRequestInput {
                    request: request(format!("http://{address}/mcp"), "request-live"),
                    request_id: "request-live".into(),
                    session_key: "project/live-request".into(),
                    start_get_stream: false,
                },
                None,
                channel,
                &HttpCancellationState::default(),
                McpHttpSessionState::default(),
            )
            .await
        });
        let event = events
            .recv_timeout(Duration::from_secs(2))
            .expect("live MCP server request");
        assert_eq!(event["method"], "sampling/createMessage");
        assert!(event["detail"].as_str().unwrap().contains("sample-1"));
        release_sender.send(()).unwrap();
        let output = pending.await.unwrap().unwrap();
        let messages: Vec<Value> = serde_json::from_str(&output.body).unwrap();
        assert_eq!(messages[0]["id"], "sample-1");
        assert_eq!(messages[1]["id"], "request-live");
        server.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn resumes_a_primed_post_stream_with_last_event_id() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut initial, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut initial).await.method, "POST");
            write_response(
                &mut initial,
                "200 OK",
                "text/event-stream",
                "id: cursor-1\nretry: 10\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/progress\"}\n\n",
                false,
            )
            .await;

            let (mut resumed, _) = listener.accept().await.unwrap();
            let resumed_request = read_request(&mut resumed).await;
            assert_eq!(resumed_request.method, "GET");
            assert_eq!(
                resumed_request
                    .headers
                    .get("last-event-id")
                    .map(String::as_str),
                Some("cursor-1")
            );
            write_response(
                &mut resumed,
                "200 OK",
                "text/event-stream",
                "id: cursor-2\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"request-2\",\"result\":{\"tools\":[{\"name\":\"search\"}]}}\n\n",
                false,
            )
            .await;
        });

        let output = send_cancellable(
            McpHttpRequestInput {
                request: request(format!("http://{address}/mcp"), "request-2"),
                request_id: "request-2".into(),
                session_key: "project/resume".into(),
                start_get_stream: false,
            },
            None,
            discard_channel(),
            &HttpCancellationState::default(),
            McpHttpSessionState::default(),
        )
        .await
        .unwrap();
        let messages: Vec<Value> = serde_json::from_str(&output.body).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["method"], "notifications/progress");
        assert_eq!(messages[1]["result"]["tools"][0]["name"], "search");
        server.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn stops_primed_post_resume_after_two_failed_attempts() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut initial, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut initial).await.method, "POST");
            write_response(
                &mut initial,
                "200 OK",
                "text/event-stream",
                "id: cursor-failed\nretry: 10\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/progress\"}\n\n",
                false,
            )
            .await;
            for _ in 0..2 {
                let (mut resumed, _) = listener.accept().await.unwrap();
                let resumed_request = read_request(&mut resumed).await;
                assert_eq!(resumed_request.method, "GET");
                assert_eq!(
                    resumed_request
                        .headers
                        .get("last-event-id")
                        .map(String::as_str),
                    Some("cursor-failed")
                );
                write_response(
                    &mut resumed,
                    "500 Internal Server Error",
                    "text/plain",
                    "failed",
                    false,
                )
                .await;
            }
            tokio::time::timeout(Duration::from_millis(150), listener.accept())
                .await
                .is_err()
        });

        let error = send_cancellable(
            McpHttpRequestInput {
                request: request(format!("http://{address}/mcp"), "request-failed"),
                request_id: "request-failed".into(),
                session_key: "project/resume-failed".into(),
                start_get_stream: false,
            },
            None,
            discard_channel(),
            &HttpCancellationState::default(),
            McpHttpSessionState::default(),
        )
        .await
        .unwrap_err();
        assert!(error.contains("after 2 reconnect attempts"));
        assert!(
            server.await.unwrap(),
            "POST resume exceeded its retry ceiling"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn reconnects_optional_get_twice_with_server_retry_and_last_event_id() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut notification, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut notification).await.method, "POST");
            write_response(
                &mut notification,
                "202 Accepted",
                "application/json",
                "",
                false,
            )
            .await;

            let (mut initial_get, _) = listener.accept().await.unwrap();
            let initial_request = read_request(&mut initial_get).await;
            assert_eq!(initial_request.method, "GET");
            assert!(!initial_request.headers.contains_key("last-event-id"));
            write_response(
                &mut initial_get,
                "200 OK",
                "text/event-stream",
                "id: event-1\nretry: 10\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/tools/list_changed\"}\n\n",
                false,
            )
            .await;

            for _ in 0..2 {
                let (mut retry, _) = listener.accept().await.unwrap();
                let retry_request = read_request(&mut retry).await;
                assert_eq!(retry_request.method, "GET");
                assert_eq!(
                    retry_request
                        .headers
                        .get("last-event-id")
                        .map(String::as_str),
                    Some("event-1")
                );
                write_response(
                    &mut retry,
                    "500 Internal Server Error",
                    "text/plain",
                    "failed",
                    false,
                )
                .await;
            }
            tokio::time::timeout(Duration::from_millis(150), listener.accept())
                .await
                .is_err()
        });

        let state = McpHttpSessionState::default();
        let (channel, events) = recording_channel();
        let mut notification = request(format!("http://{address}/mcp"), "ignored");
        notification.body = json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        })
        .to_string();
        let output = send_cancellable(
            McpHttpRequestInput {
                request: notification,
                request_id: String::new(),
                session_key: "project/get-reconnect".into(),
                start_get_stream: true,
            },
            None,
            channel,
            &HttpCancellationState::default(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 202);
        let mut recorded = Vec::new();
        while !recorded.iter().any(|event: &Value| {
            event["detail"]
                .as_str()
                .is_some_and(|detail| detail.contains("stopped after 2 reconnect"))
        }) {
            recorded.push(
                events
                    .recv_timeout(Duration::from_secs(2))
                    .expect("GET stream event"),
            );
        }
        assert!(recorded
            .iter()
            .any(|event| { event["method"] == "notifications/tools/list_changed" }));
        assert!(recorded.iter().any(|event| {
            event["detail"]
                .as_str()
                .is_some_and(|detail| detail.contains("in 10 ms"))
        }));
        for _ in 0..20 {
            if !state.contains("project/get-reconnect").await {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert!(!state.contains("project/get-reconnect").await);
        assert!(
            server.await.unwrap(),
            "GET stream exceeded its retry ceiling"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn accepts_optional_get_405_and_cancels_a_pending_post() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (pending_started, pending_ready) = oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut notification, _) = listener.accept().await.unwrap();
            read_request(&mut notification).await;
            write_response(
                &mut notification,
                "202 Accepted",
                "application/json",
                "",
                false,
            )
            .await;
            let (mut get, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut get).await.method, "GET");
            write_response(&mut get, "405 Method Not Allowed", "text/plain", "", false).await;
            let (mut pending, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut pending).await.method, "POST");
            write_response(&mut pending, "200 OK", "text/event-stream", "", true).await;
            let _ = pending_started.send(());
            tokio::time::sleep(Duration::from_millis(250)).await;
        });

        let state = McpHttpSessionState::default();
        let (channel, events) = recording_channel();
        let mut notification = request(format!("http://{address}/mcp"), "ignored");
        notification.body =
            json!({ "jsonrpc": "2.0", "method": "notifications/initialized", "params": {} })
                .to_string();
        send_cancellable(
            McpHttpRequestInput {
                request: notification,
                request_id: String::new(),
                session_key: "project/get-405".into(),
                start_get_stream: true,
            },
            None,
            channel,
            &HttpCancellationState::default(),
            state.clone(),
        )
        .await
        .unwrap();
        let get_event = events.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(get_event["detail"].as_str().unwrap().contains("HTTP 405"));

        let cancellations = HttpCancellationState::default();
        let pending = send_cancellable(
            McpHttpRequestInput {
                request: request(format!("http://{address}/mcp"), "request-cancel"),
                request_id: "request-cancel".into(),
                session_key: "project/get-405".into(),
                start_get_stream: false,
            },
            Some("cancel-request".into()),
            discard_channel(),
            &cancellations,
            state.clone(),
        );
        tokio::pin!(pending);
        tokio::select! {
            _ = pending_ready => {}
            result = &mut pending => panic!("pending POST ended before cancellation: {result:?}"),
        }
        assert!(cancellations.cancel("cancel-request"));
        assert_eq!(pending.await.unwrap_err(), "MCP HTTP request canceled.");
        assert!(!state.close("project/get-405").await);
        server.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn explicitly_closes_a_long_lived_get_stream() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (get_started, get_ready) = oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut notification, _) = listener.accept().await.unwrap();
            read_request(&mut notification).await;
            write_response(
                &mut notification,
                "202 Accepted",
                "application/json",
                "",
                false,
            )
            .await;
            let (mut get, _) = listener.accept().await.unwrap();
            assert_eq!(read_request(&mut get).await.method, "GET");
            write_response(&mut get, "200 OK", "text/event-stream", "", true).await;
            let _ = get_started.send(());
            let mut byte = [0_u8; 1];
            tokio::time::timeout(Duration::from_secs(2), get.read(&mut byte))
                .await
                .expect("GET connection should close")
                .unwrap()
        });

        let state = McpHttpSessionState::default();
        let mut notification = request(format!("http://{address}/mcp"), "ignored");
        notification.body =
            json!({ "jsonrpc": "2.0", "method": "notifications/initialized", "params": {} })
                .to_string();
        send_cancellable(
            McpHttpRequestInput {
                request: notification,
                request_id: String::new(),
                session_key: "project/get-close".into(),
                start_get_stream: true,
            },
            None,
            discard_channel(),
            &HttpCancellationState::default(),
            state.clone(),
        )
        .await
        .unwrap();
        get_ready.await.unwrap();
        assert!(state.contains("project/get-close").await);
        assert!(state.close("project/get-close").await);
        assert_eq!(server.await.unwrap(), 0);
    }
}

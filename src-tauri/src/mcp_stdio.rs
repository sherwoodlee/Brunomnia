use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader, BufWriter, Read, Write},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, TryRecvError},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

const MAX_MESSAGE_BYTES: usize = 10_000_000;
const MAX_STREAM_BYTES: usize = 20_000_000;
const MAX_ARGUMENTS: usize = 100;
const MAX_ARGUMENT_BYTES: usize = 8_192;
const MAX_ENVIRONMENT_VARIABLES: usize = 100;
const MAX_ENVIRONMENT_NAME_BYTES: usize = 512;
const MAX_ENVIRONMENT_VALUE_BYTES: usize = 32_768;
const MAX_ENVIRONMENT_BYTES: usize = 1_000_000;
const MAX_CANCELLATION_ID_BYTES: usize = 512;
const MAX_CANCELLATION_IDS: usize = 1_024;
const MAX_SESSION_KEY_BYTES: usize = 512;
const MAX_SESSIONS: usize = 100;
const CANCELLATION_POLL: Duration = Duration::from_millis(50);

#[derive(Clone, Default)]
pub struct McpStdioCancellationState {
    registry: Arc<Mutex<McpStdioCancellationRegistry>>,
}

#[derive(Default)]
struct McpStdioCancellationRegistry {
    active: HashMap<String, Arc<AtomicBool>>,
    pending: HashSet<String>,
}

#[derive(Clone, Default)]
pub struct McpStdioSessionState {
    sessions: Arc<Mutex<HashMap<String, McpStdioSessionEntry>>>,
}

#[derive(Clone)]
struct McpStdioSessionEntry {
    fingerprint: String,
    session: Arc<Mutex<McpStdioSession>>,
}

struct McpStdioSession {
    child: std::process::Child,
    writer: BufWriter<std::process::ChildStdin>,
    stdout_receiver: Receiver<Result<Vec<u8>, String>>,
    stderr_receiver: Receiver<Result<Vec<u8>, String>>,
    stdout_reader: Option<thread::JoinHandle<()>>,
    stderr_reader: Option<thread::JoinHandle<()>>,
    next_id: u64,
}

impl McpStdioCancellationState {
    pub fn cancel(&self, cancellation_id: &str) -> bool {
        if cancellation_id.is_empty()
            || cancellation_id.contains('\0')
            || cancellation_id.len() > MAX_CANCELLATION_ID_BYTES
        {
            return false;
        }
        let mut registry = self
            .registry
            .lock()
            .expect("MCP STDIO cancellation state lock poisoned");
        if let Some(cancelled) = registry.active.get(cancellation_id) {
            cancelled.store(true, Ordering::Release);
            return true;
        }
        if registry.pending.len() >= MAX_CANCELLATION_IDS {
            registry.pending.clear();
        }
        registry.pending.insert(cancellation_id.to_string());
        false
    }

    fn register(&self, cancellation_id: &str) -> Option<Arc<AtomicBool>> {
        let mut registry = self
            .registry
            .lock()
            .expect("MCP STDIO cancellation state lock poisoned");
        if registry.pending.remove(cancellation_id) {
            return None;
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        registry
            .active
            .insert(cancellation_id.to_string(), cancelled.clone());
        Some(cancelled)
    }

    fn finish(&self, cancellation_id: &str) {
        let mut registry = self
            .registry
            .lock()
            .expect("MCP STDIO cancellation state lock poisoned");
        registry.active.remove(cancellation_id);
        registry.pending.remove(cancellation_id);
    }

    pub fn call(&self, input: McpStdioInput) -> Result<McpStdioOutput, String> {
        let cancellation_id = input.cancellation_id.clone();
        if cancellation_id.len() > MAX_CANCELLATION_ID_BYTES {
            return Err("The MCP STDIO cancellation identity exceeds its safety limit.".into());
        }
        if cancellation_id.is_empty() {
            return call(input);
        }
        let Some(cancelled) = self.register(&cancellation_id) else {
            return Err("MCP STDIO request canceled.".into());
        };
        let result = call_cancellable(input, cancelled.as_ref());
        self.finish(&cancellation_id);
        result
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStdioInput {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: Vec<McpStdioEnvironmentVariable>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
    #[serde(default)]
    pub roots: Vec<String>,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub cancellation_id: String,
    #[serde(default)]
    pub session_key: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStdioEnvironmentVariable {
    pub name: String,
    pub value: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStdioOutput {
    pub result: Value,
    pub events: Vec<Value>,
    pub stderr: String,
}

fn default_timeout() -> u64 {
    30_000
}

fn session_fingerprint(input: &McpStdioInput) -> Result<String, String> {
    serde_json::to_string(&(input.command.trim(), &input.args, &input.env))
        .map_err(|error| format!("Unable to encode MCP STDIO session configuration: {error}"))
}

fn spawn_child(input: &McpStdioInput) -> Result<std::process::Child, String> {
    let mut command = Command::new(input.command.trim());
    command
        .args(&input.args)
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = std::env::var_os("PATH") {
        command.env("PATH", path);
    }
    command.envs(
        input
            .env
            .iter()
            .map(|variable| (&variable.name, &variable.value)),
    );
    command
        .spawn()
        .map_err(|error| format!("Unable to start the MCP STDIO server: {error}"))
}

fn persistent_result_is_reusable(result: &Result<McpStdioOutput, String>) -> bool {
    match result {
        Ok(_) => true,
        Err(error) => {
            error == "MCP STDIO request canceled."
                || error.starts_with("The MCP server returned an error:")
        }
    }
}

fn spawn_line_reader(
    stream: impl Read + Send + 'static,
    limit: usize,
    label: &'static str,
) -> (Receiver<Result<Vec<u8>, String>>, thread::JoinHandle<()>) {
    let (sender, receiver) = mpsc::channel();
    let reader = thread::spawn(move || {
        let mut reader = BufReader::new(stream.take((limit + 1) as u64));
        loop {
            let mut line = Vec::new();
            match reader.read_until(b'\n', &mut line) {
                Ok(0) => {
                    if reader.get_ref().limit() == 0 {
                        let _ = sender.send(Err(format!(
                            "MCP {label} exceeded its cumulative session safety limit."
                        )));
                    }
                    break;
                }
                Ok(_) => {
                    while line
                        .last()
                        .is_some_and(|byte| matches!(*byte, b'\n' | b'\r'))
                    {
                        line.pop();
                    }
                    if !line.is_empty() && sender.send(Ok(line)).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(format!("Unable to read MCP {label}: {error}")));
                    break;
                }
            }
        }
    });
    (receiver, reader)
}

impl McpStdioSession {
    fn open(input: &McpStdioInput, cancelled: &AtomicBool) -> Result<Self, String> {
        if cancelled.load(Ordering::Acquire) {
            return Err("MCP STDIO request canceled.".into());
        }
        let timeout = Duration::from_millis(input.timeout_ms.clamp(1_000, 120_000));
        let deadline = Instant::now() + timeout;
        let mut child = spawn_child(input)?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Unable to open the MCP STDIO input stream.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Unable to open the MCP STDIO output stream.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Unable to open the MCP STDERR stream.".to_string())?;
        let (stdout_receiver, stdout_reader) =
            spawn_line_reader(stdout, MAX_STREAM_BYTES, "STDIO output");
        let (stderr_receiver, stderr_reader) =
            spawn_line_reader(stderr, MAX_MESSAGE_BYTES, "STDERR output");
        let mut session = Self {
            child,
            writer: BufWriter::new(stdin),
            stdout_receiver,
            stderr_receiver,
            stdout_reader: Some(stdout_reader),
            stderr_reader: Some(stderr_reader),
            next_id: 2,
        };
        send(
            &mut session.writer,
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": { "roots": { "listChanged": false } },
                    "clientInfo": { "name": "Brunomnia", "version": env!("CARGO_PKG_VERSION") }
                }
            }),
        )?;
        let mut events = Vec::new();
        wait_for_response(
            1,
            &session.stdout_receiver,
            &mut session.writer,
            &input.roots,
            deadline,
            &mut events,
            cancelled,
        )?;
        send(
            &mut session.writer,
            &json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )?;
        Ok(session)
    }

    fn execute(
        &mut self,
        input: McpStdioInput,
        cancelled: &AtomicBool,
    ) -> Result<McpStdioOutput, String> {
        if cancelled.load(Ordering::Acquire) {
            return Err("MCP STDIO request canceled.".into());
        }
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or_else(|| "The MCP STDIO request identity space is exhausted.".to_string())?;
        let deadline =
            Instant::now() + Duration::from_millis(input.timeout_ms.clamp(1_000, 120_000));
        let mut events = Vec::new();
        let mut stderr = self.drain_stderr()?;
        send(
            &mut self.writer,
            &json!({ "jsonrpc": "2.0", "id": id, "method": input.method, "params": input.params }),
        )?;
        let result = wait_for_response(
            id,
            &self.stdout_receiver,
            &mut self.writer,
            &input.roots,
            deadline,
            &mut events,
            cancelled,
        )?;
        let trailing_stderr = self.drain_stderr()?;
        if !trailing_stderr.is_empty() {
            if !stderr.is_empty() {
                stderr.push('\n');
            }
            stderr.push_str(&trailing_stderr);
        }
        Ok(McpStdioOutput {
            result,
            events,
            stderr,
        })
    }

    fn drain_stderr(&self) -> Result<String, String> {
        let mut bytes = Vec::new();
        loop {
            match self.stderr_receiver.try_recv() {
                Ok(Ok(line)) => {
                    if !bytes.is_empty() {
                        bytes.push(b'\n');
                    }
                    bytes.extend(line);
                    if bytes.len() > MAX_MESSAGE_BYTES {
                        return Err("MCP STDERR exceeded the 10 MB safety limit.".into());
                    }
                }
                Ok(Err(error)) => return Err(error),
                Err(TryRecvError::Empty | TryRecvError::Disconnected) => break,
            }
        }
        Ok(String::from_utf8_lossy(&bytes).trim().to_string())
    }

    fn close(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.stdout_reader.take() {
            let _ = reader.join();
        }
        if let Some(reader) = self.stderr_reader.take() {
            let _ = reader.join();
        }
    }
}

impl Drop for McpStdioSession {
    fn drop(&mut self) {
        self.close();
    }
}

impl McpStdioSessionState {
    pub fn call(
        &self,
        input: McpStdioInput,
        cancellations: &McpStdioCancellationState,
    ) -> Result<McpStdioOutput, String> {
        validate(&input)?;
        if input.session_key.is_empty() {
            return cancellations.call(input);
        }
        let cancellation_id = input.cancellation_id.clone();
        let cancelled = if cancellation_id.is_empty() {
            Arc::new(AtomicBool::new(false))
        } else {
            let Some(cancelled) = cancellations.register(&cancellation_id) else {
                return Err("MCP STDIO request canceled.".into());
            };
            cancelled
        };
        let result = self.call_registered(input, cancelled.as_ref());
        if !cancellation_id.is_empty() {
            cancellations.finish(&cancellation_id);
        }
        result
    }

    fn call_registered(
        &self,
        input: McpStdioInput,
        cancelled: &AtomicBool,
    ) -> Result<McpStdioOutput, String> {
        let session = self.session_for(&input, cancelled)?;
        let result;
        let process_error;
        let reusable;
        {
            let mut session_guard = session
                .lock()
                .map_err(|_| "MCP STDIO session lock poisoned.".to_string())?;
            result = session_guard.execute(input.clone(), cancelled);
            process_error = match session_guard.child.try_wait() {
                Ok(status) => {
                    reusable = status.is_none() && persistent_result_is_reusable(&result);
                    None
                }
                Err(error) => {
                    reusable = false;
                    Some(format!("Unable to inspect the MCP STDIO process: {error}"))
                }
            };
        }
        if !reusable {
            self.remove_if_same(&input.session_key, &session);
        }
        process_error.map_or(result, Err)
    }

    fn session_for(
        &self,
        input: &McpStdioInput,
        cancelled: &AtomicBool,
    ) -> Result<Arc<Mutex<McpStdioSession>>, String> {
        let fingerprint = session_fingerprint(input)?;
        let previous = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "MCP STDIO session registry lock poisoned.".to_string())?;
            match sessions.get(&input.session_key) {
                Some(entry) if entry.fingerprint == fingerprint => {
                    return Ok(entry.session.clone())
                }
                Some(_) => sessions
                    .remove(&input.session_key)
                    .map(|entry| entry.session),
                None if sessions.len() >= MAX_SESSIONS => {
                    return Err(format!(
                        "MCP STDIO has reached its {MAX_SESSIONS}-session safety limit. Disconnect an inactive client before connecting another."
                    ))
                }
                None => None,
            }
        };
        if let Some(previous) = previous {
            previous
                .lock()
                .map_err(|_| "MCP STDIO session lock poisoned.".to_string())?
                .close();
        }
        let session = Arc::new(Mutex::new(McpStdioSession::open(input, cancelled)?));
        let (active, replaced) = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "MCP STDIO session registry lock poisoned.".to_string())?;
            if let Some(existing) = sessions.get(&input.session_key) {
                if existing.fingerprint == fingerprint {
                    (existing.session.clone(), Some(session))
                } else {
                    let replaced = sessions
                        .insert(
                            input.session_key.clone(),
                            McpStdioSessionEntry {
                                fingerprint,
                                session: session.clone(),
                            },
                        )
                        .map(|entry| entry.session);
                    (session, replaced)
                }
            } else {
                if sessions.len() >= MAX_SESSIONS {
                    return Err(format!(
                        "MCP STDIO has reached its {MAX_SESSIONS}-session safety limit. Disconnect an inactive client before connecting another."
                    ));
                }
                sessions.insert(
                    input.session_key.clone(),
                    McpStdioSessionEntry {
                        fingerprint,
                        session: session.clone(),
                    },
                );
                (session, None)
            }
        };
        if let Some(replaced) = replaced {
            replaced
                .lock()
                .map_err(|_| "MCP STDIO session lock poisoned.".to_string())?
                .close();
        }
        Ok(active)
    }

    fn remove_if_same(&self, session_key: &str, session: &Arc<Mutex<McpStdioSession>>) {
        if let Ok(mut sessions) = self.sessions.lock() {
            if sessions
                .get(session_key)
                .is_some_and(|candidate| Arc::ptr_eq(&candidate.session, session))
            {
                sessions.remove(session_key);
            }
        }
    }

    pub fn close(&self, session_key: &str) -> bool {
        if session_key.is_empty()
            || session_key.contains('\0')
            || session_key.len() > MAX_SESSION_KEY_BYTES
        {
            return false;
        }
        let session = self
            .sessions
            .lock()
            .ok()
            .and_then(|mut sessions| sessions.remove(session_key))
            .map(|entry| entry.session);
        let Some(session) = session else {
            return false;
        };
        if let Ok(mut session) = session.lock() {
            session.close();
        }
        true
    }

    pub fn contains(&self, session_key: &str) -> bool {
        if session_key.is_empty()
            || session_key.contains('\0')
            || session_key.len() > MAX_SESSION_KEY_BYTES
        {
            return false;
        }
        self.sessions
            .lock()
            .is_ok_and(|sessions| sessions.contains_key(session_key))
    }
}

fn validate(input: &McpStdioInput) -> Result<(), String> {
    if input.command.trim().is_empty()
        || input.command.contains('\0')
        || input.command.len() > MAX_ARGUMENT_BYTES
    {
        return Err("Enter a valid MCP server executable.".into());
    }
    if input.args.len() > MAX_ARGUMENTS
        || input
            .args
            .iter()
            .any(|argument| argument.contains('\0') || argument.len() > MAX_ARGUMENT_BYTES)
    {
        return Err("The MCP STDIO argument list exceeds its safety limit.".into());
    }
    if input.env.len() > MAX_ENVIRONMENT_VARIABLES
        || input.env.iter().any(|variable| {
            variable.name.is_empty()
                || variable.name.contains(['\0', '='])
                || variable.name.len() > MAX_ENVIRONMENT_NAME_BYTES
                || variable.value.contains('\0')
                || variable.value.len() > MAX_ENVIRONMENT_VALUE_BYTES
        })
        || input
            .env
            .iter()
            .map(|variable| variable.name.len() + variable.value.len())
            .sum::<usize>()
            > MAX_ENVIRONMENT_BYTES
    {
        return Err("The MCP STDIO environment exceeds its safety limit.".into());
    }
    if !matches!(
        input.method.as_str(),
        "tools/list"
            | "prompts/list"
            | "resources/list"
            | "resources/templates/list"
            | "tools/call"
            | "prompts/get"
            | "resources/read"
            | "ping"
    ) {
        return Err("The requested MCP method is not supported by this client boundary.".into());
    }
    if serde_json::to_vec(&input.params)
        .map_err(|error| format!("Unable to encode MCP parameters: {error}"))?
        .len()
        > 1_000_000
    {
        return Err("MCP parameters exceed the 1 MB safety limit.".into());
    }
    if input.cancellation_id.contains('\0')
        || input.cancellation_id.len() > MAX_CANCELLATION_ID_BYTES
    {
        return Err("The MCP STDIO cancellation identity exceeds its safety limit.".into());
    }
    if input.session_key.contains('\0') || input.session_key.len() > MAX_SESSION_KEY_BYTES {
        return Err("The MCP STDIO session identity exceeds its safety limit.".into());
    }
    Ok(())
}

fn send(writer: &mut BufWriter<impl Write>, value: &Value) -> Result<(), String> {
    serde_json::to_writer(&mut *writer, value)
        .map_err(|error| format!("Unable to encode an MCP STDIO message: {error}"))?;
    writer
        .write_all(b"\n")
        .and_then(|_| writer.flush())
        .map_err(|error| format!("Unable to send an MCP STDIO message: {error}"))
}

fn server_request_response(value: &Value, roots: &[String]) -> Option<Value> {
    let id = value.get("id")?.clone();
    let method = value.get("method")?.as_str()?;
    if method == "roots/list" {
        return Some(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": { "roots": roots.iter().map(|uri| json!({ "uri": uri, "name": uri })).collect::<Vec<_>>() }
        }));
    }
    Some(json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": -32601, "message": format!("Brunomnia requires interactive approval UI before handling {method}.") }
    }))
}

fn wait_for_response(
    id: u64,
    receiver: &Receiver<Result<Vec<u8>, String>>,
    writer: &mut BufWriter<impl Write>,
    roots: &[String],
    deadline: Instant,
    events: &mut Vec<Value>,
    cancelled: &AtomicBool,
) -> Result<Value, String> {
    loop {
        if cancelled.load(Ordering::Acquire) {
            let _ = send(
                writer,
                &json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/cancelled",
                    "params": { "requestId": id, "reason": "Canceled by user." }
                }),
            );
            return Err("MCP STDIO request canceled.".into());
        }
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| "The MCP STDIO request exceeded its time limit.".to_string())?;
        let bytes = match receiver.recv_timeout(remaining.min(CANCELLATION_POLL)) {
            Ok(result) => result?,
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => {
                return Err("The MCP STDIO server closed before returning a response.".into())
            }
        };
        if bytes.len() > MAX_MESSAGE_BYTES {
            return Err("An MCP STDIO message exceeded the 10 MB safety limit.".into());
        }
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|error| format!("The MCP STDIO server returned invalid JSON: {error}"))?;
        if let Some(response) = server_request_response(&value, roots) {
            events.push(value);
            send(writer, &response)?;
            continue;
        }
        if value.get("id").and_then(Value::as_u64) == Some(id) {
            if let Some(error) = value.get("error") {
                return Err(format!("The MCP server returned an error: {error}"));
            }
            return value
                .get("result")
                .cloned()
                .ok_or_else(|| "The MCP response has no result.".to_string());
        }
        events.push(value);
        if events.len() > 1_000 {
            return Err("The MCP STDIO server emitted too many events before responding.".into());
        }
    }
}

pub fn call(input: McpStdioInput) -> Result<McpStdioOutput, String> {
    call_cancellable(input, &AtomicBool::new(false))
}

fn call_cancellable(
    input: McpStdioInput,
    cancelled: &AtomicBool,
) -> Result<McpStdioOutput, String> {
    validate(&input)?;
    if cancelled.load(Ordering::Acquire) {
        return Err("MCP STDIO request canceled.".into());
    }
    let timeout = Duration::from_millis(input.timeout_ms.clamp(1_000, 120_000));
    let deadline = Instant::now() + timeout;
    let mut child = spawn_child(&input)?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Unable to open the MCP STDIO input stream.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to open the MCP STDIO output stream.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to open the MCP STDERR stream.".to_string())?;
    let (sender, receiver) = mpsc::sync_channel::<Result<Vec<u8>, String>>(128);
    let stdout_reader = thread::spawn(move || {
        let mut reader = BufReader::new(stdout.take((MAX_STREAM_BYTES + 1) as u64));
        loop {
            let mut line = Vec::new();
            match reader.read_until(b'\n', &mut line) {
                Ok(0) => break,
                Ok(_) => {
                    while line
                        .last()
                        .is_some_and(|byte| matches!(*byte, b'\n' | b'\r'))
                    {
                        line.pop();
                    }
                    if !line.is_empty() && sender.send(Ok(line)).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(format!("Unable to read MCP STDIO output: {error}")));
                    break;
                }
            }
        }
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr
            .take((MAX_MESSAGE_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let result: Result<(Value, Vec<Value>), String> = (|| {
        let mut writer = BufWriter::new(stdin);
        let mut events = Vec::new();
        send(
            &mut writer,
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": { "roots": { "listChanged": false } },
                    "clientInfo": { "name": "Brunomnia", "version": env!("CARGO_PKG_VERSION") }
                }
            }),
        )?;
        let _initialized = wait_for_response(
            1,
            &receiver,
            &mut writer,
            &input.roots,
            deadline,
            &mut events,
            cancelled,
        )?;
        send(
            &mut writer,
            &json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )?;
        send(
            &mut writer,
            &json!({ "jsonrpc": "2.0", "id": 2, "method": input.method, "params": input.params }),
        )?;
        let result = wait_for_response(
            2,
            &receiver,
            &mut writer,
            &input.roots,
            deadline,
            &mut events,
            cancelled,
        )?;
        drop(writer);
        Ok((result, events))
    })();
    let _ = child.kill();
    let _ = child.wait();
    drop(receiver);
    let _ = stdout_reader.join();
    let stderr = stderr_reader
        .join()
        .map_err(|_| "The MCP STDERR reader failed.".to_string())?
        .map_err(|error| format!("Unable to read MCP STDERR: {error}"))?;
    if stderr.len() > MAX_MESSAGE_BYTES {
        return Err("MCP STDERR exceeded the 10 MB safety limit.".into());
    }
    let (result, events) = result?;
    Ok(McpStdioOutput {
        result,
        events,
        stderr: String::from_utf8_lossy(&stderr).trim().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_methods_and_oversized_arguments() {
        let mut input = McpStdioInput {
            command: "server".into(),
            args: vec![],
            env: vec![],
            method: "initialize".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 30_000,
            cancellation_id: String::new(),
            session_key: String::new(),
        };
        assert!(validate(&input).unwrap_err().contains("not supported"));
        input.method = "tools/list".into();
        input.args = vec!["x".to_string(); MAX_ARGUMENTS + 1];
        assert!(validate(&input).unwrap_err().contains("safety limit"));
        input.args.clear();
        input.env = vec![McpStdioEnvironmentVariable {
            name: "INVALID=NAME".into(),
            value: String::new(),
        }];
        assert!(validate(&input).unwrap_err().contains("environment"));
        input.env.clear();
        input.cancellation_id = "x".repeat(MAX_CANCELLATION_ID_BYTES + 1);
        assert!(validate(&input)
            .unwrap_err()
            .contains("cancellation identity"));
    }

    #[test]
    fn answers_roots_and_refuses_unreviewed_server_requests() {
        let roots = vec!["file:///project".to_string()];
        let response = server_request_response(
            &json!({ "jsonrpc": "2.0", "id": "roots", "method": "roots/list" }),
            &roots,
        )
        .unwrap();
        assert_eq!(response["result"]["roots"][0]["uri"], "file:///project");
        let sampling = server_request_response(
            &json!({ "jsonrpc": "2.0", "id": 9, "method": "sampling/createMessage" }),
            &roots,
        )
        .unwrap();
        assert_eq!(sampling["error"]["code"], -32601);
        assert!(sampling["error"]["message"]
            .as_str()
            .unwrap()
            .contains("interactive approval"));
    }

    #[test]
    fn cancellation_state_handles_pending_and_active_calls() {
        let state = McpStdioCancellationState::default();
        assert!(!state.cancel("pending"));
        assert!(state.register("pending").is_none());

        let active = state.register("active").unwrap();
        assert!(state.cancel("active"));
        assert!(active.load(Ordering::Acquire));
        state.finish("active");
    }

    #[test]
    fn wait_for_response_observes_cancellation() {
        let (_sender, receiver) = mpsc::sync_channel(1);
        let mut writer = BufWriter::new(Vec::new());
        let mut events = Vec::new();
        let cancelled = AtomicBool::new(true);
        assert!(wait_for_response(
            1,
            &receiver,
            &mut writer,
            &[],
            Instant::now() + Duration::from_secs(1),
            &mut events,
            &cancelled,
        )
        .unwrap_err()
        .contains("canceled"));
        assert!(String::from_utf8_lossy(writer.get_ref()).contains("notifications/cancelled"));
    }

    #[cfg(unix)]
    #[test]
    fn cancellation_terminates_a_live_stdio_process() {
        use std::{fs, os::unix::fs::PermissionsExt};

        let temporary = tempfile::tempdir().unwrap();
        let server = temporary.path().join("mcp-cancel-server.sh");
        fs::write(
            &server,
            r#"#!/bin/sh
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{}}}' ;;
    *'"id":2'*) while :; do :; done ;;
  esac
done
"#,
        )
        .unwrap();
        fs::set_permissions(&server, fs::Permissions::from_mode(0o700)).unwrap();
        let state = McpStdioCancellationState::default();
        let worker_state = state.clone();
        let input = McpStdioInput {
            command: server.to_string_lossy().into_owned(),
            args: vec![],
            env: vec![],
            method: "tools/list".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 30_000,
            cancellation_id: "live-cancel".into(),
            session_key: String::new(),
        };
        let (sender, receiver) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let _ = sender.send(worker_state.call(input));
        });
        for _ in 0..100 {
            if state
                .registry
                .lock()
                .unwrap()
                .active
                .contains_key("live-cancel")
            {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert!(state.cancel("live-cancel"));
        assert!(receiver
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap_err()
            .contains("canceled"));
    }

    #[cfg(unix)]
    #[test]
    fn persistent_session_reuses_and_restarts_one_process() {
        use std::{fs, os::unix::fs::PermissionsExt};

        let temporary = tempfile::tempdir().unwrap();
        let server = temporary.path().join("mcp-persistent-server.sh");
        let starts = temporary.path().join("starts.log");
        fs::write(
            &server,
            r#"#!/bin/sh
printf 'start:%s:%s:%s\n' "${BRUNOMNIA_TEST_VALUE-unset}" "${HOME-unset}" "${PATH:+path}" >> "$1"
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{}}}' ;;
    *'"method":"tools/list"'*)
      id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[]}}\n' "$id"
      ;;
  esac
done
"#,
        )
        .unwrap();
        fs::set_permissions(&server, fs::Permissions::from_mode(0o700)).unwrap();
        let sessions = McpStdioSessionState::default();
        let cancellations = McpStdioCancellationState::default();
        let input = McpStdioInput {
            command: server.to_string_lossy().into_owned(),
            args: vec![starts.to_string_lossy().into_owned()],
            env: vec![McpStdioEnvironmentVariable {
                name: "BRUNOMNIA_TEST_VALUE".into(),
                value: "one".into(),
            }],
            method: "tools/list".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 3_000,
            cancellation_id: String::new(),
            session_key: "persistent".into(),
        };

        assert_eq!(
            sessions.call(input.clone(), &cancellations).unwrap().result["tools"],
            json!([])
        );
        assert_eq!(
            sessions.call(input.clone(), &cancellations).unwrap().result["tools"],
            json!([])
        );
        assert_eq!(
            fs::read_to_string(&starts).unwrap(),
            "start:one:unset:path\n"
        );
        let mut changed = input.clone();
        changed.env[0].value = "two".into();
        assert_eq!(
            sessions
                .call(changed.clone(), &cancellations)
                .unwrap()
                .result["tools"],
            json!([])
        );
        assert_eq!(fs::read_to_string(&starts).unwrap().lines().count(), 2);
        assert!(sessions.close("persistent"));
        assert_eq!(
            sessions.call(changed, &cancellations).unwrap().result["tools"],
            json!([])
        );
        assert_eq!(fs::read_to_string(&starts).unwrap().lines().count(), 3);
        assert!(sessions.close("persistent"));
    }

    #[cfg(unix)]
    #[test]
    fn persistent_cancellation_keeps_the_process_available() {
        use std::{fs, os::unix::fs::PermissionsExt};

        let temporary = tempfile::tempdir().unwrap();
        let server = temporary.path().join("mcp-persistent-cancel-server.sh");
        let markers = temporary.path().join("markers.log");
        fs::write(
            &server,
            r#"#!/bin/sh
printf '%s\n' start >> "$1"
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{}}}' ;;
    *'"id":2'*) printf '%s\n' pending >> "$1" ;;
    *'"method":"notifications/cancelled"'*) printf '%s\n' canceled >> "$1" ;;
    *'"id":3'*) printf '%s\n' '{"jsonrpc":"2.0","id":3,"result":{"tools":[]}}' ;;
  esac
done
"#,
        )
        .unwrap();
        fs::set_permissions(&server, fs::Permissions::from_mode(0o700)).unwrap();
        let sessions = McpStdioSessionState::default();
        let cancellations = McpStdioCancellationState::default();
        let input = McpStdioInput {
            command: server.to_string_lossy().into_owned(),
            args: vec![markers.to_string_lossy().into_owned()],
            env: vec![],
            method: "tools/list".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 5_000,
            cancellation_id: "persistent-cancel".into(),
            session_key: "persistent-cancel-session".into(),
        };
        let worker_sessions = sessions.clone();
        let worker_cancellations = cancellations.clone();
        let (sender, receiver) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let _ = sender.send(worker_sessions.call(input, &worker_cancellations));
        });
        for _ in 0..200 {
            if fs::read_to_string(&markers)
                .unwrap_or_default()
                .contains("pending")
            {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert!(cancellations.cancel("persistent-cancel"));
        assert!(receiver
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap_err()
            .contains("canceled"));

        let resumed = McpStdioInput {
            command: server.to_string_lossy().into_owned(),
            args: vec![markers.to_string_lossy().into_owned()],
            env: vec![],
            method: "tools/list".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 3_000,
            cancellation_id: String::new(),
            session_key: "persistent-cancel-session".into(),
        };
        assert_eq!(
            sessions.call(resumed, &cancellations).unwrap().result["tools"],
            json!([])
        );
        let markers = fs::read_to_string(&markers).unwrap();
        assert_eq!(markers.lines().filter(|line| *line == "start").count(), 1);
        assert!(markers.contains("canceled"));
        assert!(sessions.close("persistent-cancel-session"));
    }

    #[cfg(unix)]
    #[test]
    fn persistent_session_restarts_after_a_fatal_protocol_error() {
        use std::{fs, os::unix::fs::PermissionsExt};

        let temporary = tempfile::tempdir().unwrap();
        let server = temporary.path().join("mcp-persistent-recovery-server.sh");
        let starts = temporary.path().join("starts.log");
        fs::write(
            &server,
            r#"#!/bin/sh
printf '%s\n' start >> "$1"
start_count=$(wc -l < "$1" | tr -d ' ')
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{}}}' ;;
    *'"method":"tools/list"'*)
      if [ "$start_count" = "1" ]; then
        printf '%s\n' 'not-json'
      else
        id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
        printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[]}}\n' "$id"
      fi
      ;;
  esac
done
"#,
        )
        .unwrap();
        fs::set_permissions(&server, fs::Permissions::from_mode(0o700)).unwrap();
        let sessions = McpStdioSessionState::default();
        let cancellations = McpStdioCancellationState::default();
        let input = McpStdioInput {
            command: server.to_string_lossy().into_owned(),
            args: vec![starts.to_string_lossy().into_owned()],
            env: vec![],
            method: "tools/list".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 3_000,
            cancellation_id: String::new(),
            session_key: "persistent-recovery".into(),
        };

        assert!(sessions
            .call(input.clone(), &cancellations)
            .unwrap_err()
            .contains("invalid JSON"));
        assert_eq!(
            sessions.call(input, &cancellations).unwrap().result["tools"],
            json!([])
        );
        assert_eq!(fs::read_to_string(&starts).unwrap().lines().count(), 2);
        assert!(sessions.close("persistent-recovery"));
    }
}

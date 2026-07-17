use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, BufWriter, Read, Write},
    process::{Command, Stdio},
    sync::mpsc::{self, Receiver, RecvTimeoutError},
    thread,
    time::{Duration, Instant},
};

const MAX_MESSAGE_BYTES: usize = 10_000_000;
const MAX_STREAM_BYTES: usize = 20_000_000;
const MAX_ARGUMENTS: usize = 100;
const MAX_ARGUMENT_BYTES: usize = 8_192;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStdioInput {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
    #[serde(default)]
    pub roots: Vec<String>,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
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
) -> Result<Value, String> {
    loop {
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| "The MCP STDIO request exceeded its time limit.".to_string())?;
        let bytes = match receiver.recv_timeout(remaining) {
            Ok(result) => result?,
            Err(RecvTimeoutError::Timeout) => {
                return Err("The MCP STDIO request exceeded its time limit.".into())
            }
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
    validate(&input)?;
    let timeout = Duration::from_millis(input.timeout_ms.clamp(1_000, 120_000));
    let deadline = Instant::now() + timeout;
    let mut child = Command::new(input.command.trim())
        .args(&input.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start the MCP STDIO server: {error}"))?;
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
            method: "initialize".into(),
            params: json!({}),
            roots: vec![],
            timeout_ms: 30_000,
        };
        assert!(validate(&input).unwrap_err().contains("not supported"));
        input.method = "tools/list".into();
        input.args = vec!["x".to_string(); MAX_ARGUMENTS + 1];
        assert!(validate(&input).unwrap_err().contains("safety limit"));
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
}

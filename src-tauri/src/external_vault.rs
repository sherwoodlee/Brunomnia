use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    io::Read,
    process::{Command, Output, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_OUTPUT_BYTES: usize = 10_000_000;
const MAX_CACHE_BYTES: usize = 20_000_000;
const MAX_CACHE_ENTRIES: usize = 256;

#[derive(Clone, Default)]
pub struct ExternalSecretCache(Arc<Mutex<HashMap<String, (Instant, String)>>>);

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalSecretInput {
    pub provider: String,
    pub reference: String,
    #[serde(default)]
    pub scope: String,
    #[serde(default)]
    pub field: String,
    #[serde(default)]
    pub version: String,
    #[serde(default = "default_cache_seconds")]
    pub cache_seconds: u64,
}

fn default_cache_seconds() -> u64 {
    1_800
}

fn command_output(mut command: Command, provider: &str) -> Result<Output, String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("Unable to start the {provider} CLI: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("Unable to capture the {provider} CLI output."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("Unable to capture the {provider} CLI errors."))?;
    let stdout_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take((MAX_OUTPUT_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr
            .take((MAX_OUTPUT_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let started = Instant::now();
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Unable to inspect the {provider} CLI: {error}"))?
        {
            let stdout = stdout_reader
                .join()
                .map_err(|_| format!("The {provider} output reader failed."))?
                .map_err(|error| format!("Unable to read the {provider} CLI output: {error}"))?;
            let stderr = stderr_reader
                .join()
                .map_err(|_| format!("The {provider} error reader failed."))?
                .map_err(|error| format!("Unable to read the {provider} CLI errors: {error}"))?;
            return Ok(Output {
                status,
                stdout,
                stderr,
            });
        }
        if started.elapsed() >= COMMAND_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err(format!("The {provider} CLI exceeded the 30 second limit."));
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn require_value(value: &str, label: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("Enter an external vault {label}."));
    }
    if value.starts_with('-') || value.contains('\0') {
        return Err(format!("The external vault {label} is invalid."));
    }
    Ok(value.into())
}

fn optional_value(value: &str, label: &str) -> Result<String, String> {
    if value.trim().is_empty() {
        Ok(String::new())
    } else {
        require_value(value, label)
    }
}

fn text(output: Output, provider: &str) -> Result<String, String> {
    if output.stdout.len() > MAX_OUTPUT_BYTES || output.stderr.len() > MAX_OUTPUT_BYTES {
        return Err(format!(
            "The {provider} CLI output exceeded the 10 MB safety limit."
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.status.success() {
        if stdout.is_empty() {
            Err(format!("The {provider} CLI returned an empty secret."))
        } else {
            Ok(stdout)
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!(
            "The {provider} CLI failed: {}",
            if stderr.is_empty() { stdout } else { stderr }
        ))
    }
}

fn aws_value(output: Output) -> Result<String, String> {
    let source = text(output, "AWS")?;
    let value: Value = serde_json::from_str(&source)
        .map_err(|error| format!("AWS returned invalid secret JSON: {error}"))?;
    if let Some(secret) = value.get("SecretString").and_then(Value::as_str) {
        return Ok(secret.into());
    }
    if let Some(secret) = value.get("SecretBinary").and_then(Value::as_str) {
        let bytes = BASE64
            .decode(secret)
            .map_err(|_| "AWS returned invalid base64 secret bytes.".to_string())?;
        return String::from_utf8(bytes)
            .map_err(|_| "AWS returned a binary secret that is not UTF-8 text.".to_string());
    }
    Err("AWS did not return SecretString or SecretBinary.".into())
}

fn hashicorp_value(output: Output, field: &str) -> Result<String, String> {
    let source = text(output, "HashiCorp Vault")?;
    let value: Value = serde_json::from_str(&source)
        .map_err(|error| format!("HashiCorp Vault returned invalid JSON: {error}"))?;
    let data = value
        .pointer("/data/data")
        .or_else(|| value.pointer("/data"))
        .and_then(Value::as_object)
        .ok_or_else(|| "HashiCorp Vault response has no secret data object.".to_string())?;
    let field = if field.trim().is_empty() {
        "value"
    } else {
        field.trim()
    };
    let secret = data
        .get(field)
        .ok_or_else(|| format!("HashiCorp Vault response has no '{field}' field."))?;
    Ok(secret
        .as_str()
        .map(str::to_string)
        .unwrap_or_else(|| secret.to_string()))
}

fn fetch(input: &ExternalSecretInput) -> Result<String, String> {
    let reference = require_value(&input.reference, "secret reference")?;
    let scope = optional_value(&input.scope, "scope")?;
    let version = optional_value(&input.version, "version")?;
    let field = optional_value(&input.field, "field")?;
    match input.provider.trim().to_ascii_lowercase().as_str() {
        "aws" => {
            let mut command = Command::new("aws");
            command.args([
                "secretsmanager",
                "get-secret-value",
                "--secret-id",
                &reference,
                "--output",
                "json",
            ]);
            if !scope.is_empty() {
                command.args(["--region", &scope]);
            }
            if !version.is_empty() {
                command.args(["--version-stage", &version]);
            }
            aws_value(command_output(command, "AWS")?)
        }
        "gcp" => {
            let version = if version.is_empty() {
                "latest"
            } else {
                &version
            };
            let mut command = Command::new("gcloud");
            command.args([
                "secrets",
                "versions",
                "access",
                version,
                &format!("--secret={reference}"),
            ]);
            if !scope.is_empty() {
                command.arg(format!("--project={scope}"));
            }
            text(command_output(command, "GCP")?, "GCP")
        }
        "azure" => {
            let vault = require_value(&scope, "Azure vault name")?;
            let mut command = Command::new("az");
            command.args([
                "keyvault",
                "secret",
                "show",
                "--vault-name",
                &vault,
                "--name",
                &reference,
            ]);
            if !version.is_empty() {
                command.args(["--version", &version]);
            }
            command.args(["--query", "value", "--output", "tsv"]);
            text(command_output(command, "Azure")?, "Azure")
        }
        "hashicorp" => {
            let mut command = Command::new("vault");
            command.args(["kv", "get", "-format=json", &reference]);
            hashicorp_value(command_output(command, "HashiCorp Vault")?, &field)
        }
        _ => Err("Choose AWS, GCP, Azure, or HashiCorp as the external vault provider.".into()),
    }
}

impl ExternalSecretCache {
    pub fn resolve(&self, input: ExternalSecretInput) -> Result<String, String> {
        let cache_seconds = input.cache_seconds.min(3_600);
        let cache_key = format!(
            "{}\n{}\n{}\n{}\n{}",
            input.provider.trim().to_ascii_lowercase(),
            input.reference.trim(),
            input.scope.trim(),
            input.field.trim(),
            input.version.trim()
        );
        if cache_seconds > 0 {
            let cache = self
                .0
                .lock()
                .map_err(|_| "External secret cache is unavailable.".to_string())?;
            if let Some((stored_at, value)) = cache.get(&cache_key) {
                if stored_at.elapsed() < Duration::from_secs(cache_seconds) {
                    return Ok(value.clone());
                }
            }
        }
        let value = fetch(&input)?;
        if cache_seconds > 0 && value.len() <= MAX_CACHE_BYTES {
            let mut cache = self
                .0
                .lock()
                .map_err(|_| "External secret cache is unavailable.".to_string())?;
            cache.retain(|_, (stored_at, _)| stored_at.elapsed() < Duration::from_secs(3_600));
            while cache.len() >= MAX_CACHE_ENTRIES
                || cache.values().map(|(_, value)| value.len()).sum::<usize>() + value.len()
                    > MAX_CACHE_BYTES
            {
                let Some(oldest) = cache
                    .iter()
                    .min_by_key(|(_, (stored_at, _))| *stored_at)
                    .map(|(key, _)| key.clone())
                else {
                    break;
                };
                cache.remove(&oldest);
            }
            cache.insert(cache_key, (Instant::now(), value.clone()));
        }
        Ok(value)
    }

    pub fn clear(&self) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|_| "External secret cache is unavailable.".to_string())?
            .clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn success(source: &str) -> Output {
        #[cfg(unix)]
        {
            use std::os::unix::process::ExitStatusExt;
            Output {
                status: std::process::ExitStatus::from_raw(0),
                stdout: source.as_bytes().to_vec(),
                stderr: vec![],
            }
        }
        #[cfg(not(unix))]
        {
            panic!("Output fixture currently targets Unix test hosts")
        }
    }

    #[test]
    fn parses_aws_string_and_hashicorp_v2_secret_values() {
        assert_eq!(
            aws_value(success(r#"{"SecretString":"aws-secret"}"#)).unwrap(),
            "aws-secret"
        );
        assert_eq!(
            hashicorp_value(
                success(r#"{"data":{"data":{"token":"vault-secret"}}}"#),
                "token"
            )
            .unwrap(),
            "vault-secret"
        );
    }
}

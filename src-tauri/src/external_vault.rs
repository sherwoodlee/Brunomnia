use crate::external_credential_store::{self, ExternalCredential, ExternalCredentialRecord};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::blocking::{Client, Response};
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
const HCP_AUTH_URL: &str = "https://auth.idp.hashicorp.com/oauth2/token";
const HCP_API_URL: &str = "https://api.cloud.hashicorp.com";

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
    #[serde(default)]
    pub credential_id: String,
    #[serde(default)]
    pub app_name: String,
    #[serde(default = "default_cache_seconds")]
    pub cache_seconds: u64,
}

fn selected_credential(
    input: &ExternalSecretInput,
) -> Result<Option<ExternalCredentialRecord>, String> {
    let credential_id = input.credential_id.trim();
    if credential_id.is_empty() {
        return Ok(None);
    }
    let credential = external_credential_store::load()?
        .into_iter()
        .find(|credential| credential.id == credential_id)
        .ok_or_else(|| "The selected external credential no longer exists.".to_string())?;
    if credential.provider != input.provider.trim().to_ascii_lowercase() {
        return Err("The selected external credential belongs to another provider.".into());
    }
    Ok(Some(credential))
}

fn apply_aws_credential(
    command: &mut Command,
    credential: &ExternalCredential,
) -> Result<String, String> {
    match credential {
        ExternalCredential::AwsTemporary {
            access_key_id,
            secret_access_key,
            session_token,
            region,
        } => {
            command.env("AWS_ACCESS_KEY_ID", access_key_id);
            command.env("AWS_SECRET_ACCESS_KEY", secret_access_key);
            command.env("AWS_SESSION_TOKEN", session_token);
            Ok(region.clone())
        }
        ExternalCredential::AwsFile {
            section,
            file_path,
            region,
            ..
        } => {
            command.args(["--profile", section]);
            if !file_path.is_empty() {
                command.env("AWS_SHARED_CREDENTIALS_FILE", file_path);
            }
            Ok(region.clone())
        }
        ExternalCredential::AwsSso {
            section,
            file_path,
            config_file_path,
            region,
            ..
        } => {
            command.args(["--profile", section]);
            if !file_path.is_empty() {
                command.env("AWS_SHARED_CREDENTIALS_FILE", file_path);
            }
            if !config_file_path.is_empty() {
                command.env("AWS_CONFIG_FILE", config_file_path);
            }
            Ok(region.clone())
        }
        _ => Err("The selected external credential is not an AWS profile.".into()),
    }
}

fn apply_gcp_credential(
    command: &mut Command,
    credential: &ExternalCredential,
) -> Result<(), String> {
    match credential {
        ExternalCredential::GcpServiceAccount {
            service_account_key_file_path,
        } => {
            command.env(
                "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
                service_account_key_file_path,
            );
            Ok(())
        }
        _ => Err("The selected external credential is not a GCP profile.".into()),
    }
}

fn hashicorp_credential_token(
    credential: &ExternalCredential,
) -> Result<(String, String, String), String> {
    match credential {
        ExternalCredential::HashicorpToken {
            server_address,
            access_token,
            namespace,
            ..
        } => Ok((
            server_address.clone(),
            access_token.clone(),
            namespace.clone(),
        )),
        ExternalCredential::HashicorpAppRole {
            server_address,
            role_id,
            secret_id,
            namespace,
            ..
        } => {
            let mut login = Command::new("vault");
            login.args([
                "write",
                "-field=token",
                "auth/approle/login",
                &format!("role_id={role_id}"),
                &format!("secret_id={secret_id}"),
            ]);
            login.env("VAULT_ADDR", server_address);
            if !namespace.is_empty() {
                login.env("VAULT_NAMESPACE", namespace);
            }
            let token = text(
                command_output(login, "HashiCorp Vault AppRole")?,
                "HashiCorp Vault AppRole",
            )?;
            Ok((server_address.clone(), token, namespace.clone()))
        }
        ExternalCredential::HcpVaultSecrets { .. } => {
            Err("The selected HCP Vault Secrets profile requires HCP secret coordinates.".into())
        }
        _ => Err("The selected external credential is not a HashiCorp profile.".into()),
    }
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

fn http_client(provider: &str) -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(COMMAND_TIMEOUT)
        .build()
        .map_err(|error| format!("Unable to initialize the {provider} HTTPS client: {error}"))
}

fn http_text(mut response: Response, provider: &str) -> Result<String, String> {
    let status = response.status();
    let mut bytes = Vec::new();
    response
        .by_ref()
        .take((MAX_OUTPUT_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read the {provider} HTTPS response: {error}"))?;
    if bytes.len() > MAX_OUTPUT_BYTES {
        return Err(format!(
            "The {provider} HTTPS response exceeded the 10 MB safety limit."
        ));
    }
    let body = String::from_utf8(bytes)
        .map_err(|_| format!("The {provider} HTTPS response was not UTF-8 text."))?;
    if status.is_success() {
        if body.trim().is_empty() {
            Err(format!("The {provider} HTTPS response was empty."))
        } else {
            Ok(body)
        }
    } else {
        let detail = body.trim().chars().take(4_096).collect::<String>();
        Err(format!(
            "The {provider} HTTPS request failed with {status}: {}",
            if detail.is_empty() {
                "no response details"
            } else {
                &detail
            }
        ))
    }
}

fn http_json(response: Response, provider: &str) -> Result<Value, String> {
    let source = http_text(response, provider)?;
    serde_json::from_str(&source)
        .map_err(|error| format!("{provider} returned invalid JSON: {error}"))
}

fn hcp_secret_url(
    organization_id: &str,
    project_id: &str,
    app_name: &str,
    secret_name: &str,
    version: &str,
) -> Result<url::Url, String> {
    let mut url = url::Url::parse(HCP_API_URL)
        .map_err(|error| format!("Unable to initialize the HCP Vault Secrets URL: {error}"))?;
    let mut segments = url
        .path_segments_mut()
        .map_err(|_| "Unable to construct the HCP Vault Secrets URL.".to_string())?;
    segments.extend([
        "secrets",
        "2023-11-28",
        "organizations",
        organization_id,
        "projects",
        project_id,
        "apps",
        app_name,
        "secrets",
        secret_name,
    ]);
    if version.is_empty() {
        segments.pop().push(&format!("{secret_name}:open"));
    } else {
        segments.extend(["versions", &format!("{version}:open")]);
    }
    drop(segments);
    Ok(url)
}

fn hcp_vault_secrets_value(
    credential: &ExternalCredential,
    organization_id: &str,
    project_id: &str,
    app_name: &str,
    secret_name: &str,
    version: &str,
) -> Result<String, String> {
    let ExternalCredential::HcpVaultSecrets {
        client_id,
        client_secret,
    } = credential
    else {
        return Err("The selected external credential is not an HCP Vault Secrets profile.".into());
    };
    let client = http_client("HCP Vault Secrets")?;
    let token = http_json(
        client
            .post(HCP_AUTH_URL)
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("grant_type", "client_credentials"),
                ("audience", "https://api.hashicorp.cloud"),
            ])
            .send()
            .map_err(|error| format!("Unable to authenticate with HCP Vault Secrets: {error}"))?,
        "HCP Vault Secrets authentication",
    )?
    .get("access_token")
    .and_then(Value::as_str)
    .filter(|value| !value.is_empty())
    .ok_or_else(|| "HCP Vault Secrets authentication returned no access token.".to_string())?
    .to_string();

    let url = hcp_secret_url(organization_id, project_id, app_name, secret_name, version)?;
    let value =
        http_json(
            client.get(url).bearer_auth(token).send().map_err(|error| {
                format!("Unable to retrieve the HCP Vault Secrets value: {error}")
            })?,
            "HCP Vault Secrets",
        )?;
    value
        .pointer("/secret/static_version/value")
        .or_else(|| value.pointer("/static_version/value"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "HCP Vault Secrets returned no static secret value.".to_string())
}

fn azure_key_vault_value(
    credential: &ExternalCredential,
    secret_identifier: &str,
) -> Result<String, String> {
    let ExternalCredential::AzureOauth {
        expires_on,
        access_token,
        ..
    } = credential
    else {
        return Err("The selected external credential is not an Azure OAuth profile.".into());
    };
    let expires_on = chrono::DateTime::parse_from_rfc3339(expires_on)
        .map_err(|_| "The selected Azure OAuth profile has an invalid expiry.".to_string())?;
    if expires_on <= chrono::Utc::now() {
        return Err("The selected Azure OAuth profile has expired. Re-authenticate and save a fresh access token.".into());
    }
    let mut url = url::Url::parse(secret_identifier)
        .map_err(|_| "Enter the full HTTPS Azure Key Vault secret identifier.".to_string())?;
    if url.scheme() != "https" {
        return Err("Azure Key Vault secret identifiers must use HTTPS.".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Azure Key Vault secret identifiers require a host.".to_string())?
        .to_ascii_lowercase();
    let allowed = [
        ".vault.azure.net",
        ".vault.azure.cn",
        ".vault.usgovcloudapi.net",
        ".vault.microsoftazure.de",
    ];
    if !allowed.iter().any(|suffix| host.ends_with(suffix)) {
        return Err(
            "Azure OAuth tokens may only be sent to an Azure Key Vault service host.".into(),
        );
    }
    if !url.path().split('/').any(|segment| segment == "secrets") {
        return Err(
            "Enter an Azure Key Vault secret identifier containing the /secrets/ path.".into(),
        );
    }
    if !url.query_pairs().any(|(name, _)| name == "api-version") {
        url.query_pairs_mut().append_pair("api-version", "7.4");
    }
    let value = http_json(
        http_client("Azure Key Vault")?
            .get(url)
            .bearer_auth(access_token)
            .send()
            .map_err(|error| format!("Unable to retrieve the Azure Key Vault secret: {error}"))?,
        "Azure Key Vault",
    )?;
    value
        .get("value")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Azure Key Vault returned no secret value.".to_string())
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
    let credential = selected_credential(input)?;
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
            let profile_region = credential
                .as_ref()
                .map(|credential| apply_aws_credential(&mut command, &credential.credentials))
                .transpose()?
                .unwrap_or_default();
            let region = if scope.is_empty() {
                &profile_region
            } else {
                &scope
            };
            if !region.is_empty() {
                command.args(["--region", region]);
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
            if let Some(credential) = &credential {
                apply_gcp_credential(&mut command, &credential.credentials)?;
            }
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
            if let Some(credential) = &credential {
                return azure_key_vault_value(&credential.credentials, &reference);
            }
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
            if let Some(credential) = &credential {
                if matches!(
                    credential.credentials,
                    ExternalCredential::HcpVaultSecrets { .. }
                ) {
                    let organization_id = require_value(&scope, "HCP organization ID")?;
                    let project_id = require_value(&field, "HCP project ID")?;
                    let app_name = require_value(&input.app_name, "HCP app name")?;
                    return hcp_vault_secrets_value(
                        &credential.credentials,
                        &organization_id,
                        &project_id,
                        &app_name,
                        &reference,
                        &version,
                    );
                }
            }
            let mut command = Command::new("vault");
            if let Some(credential) = &credential {
                let (server_address, token, namespace) =
                    hashicorp_credential_token(&credential.credentials)?;
                command.env("VAULT_ADDR", server_address);
                command.env("VAULT_TOKEN", token);
                if !namespace.is_empty() {
                    command.env("VAULT_NAMESPACE", namespace);
                }
            }
            command.args(["kv", "get", "-format=json", &reference]);
            hashicorp_value(command_output(command, "HashiCorp Vault")?, &field)
        }
        _ => Err("Choose AWS, GCP, Azure, or HashiCorp as the external vault provider.".into()),
    }
}

impl ExternalSecretCache {
    pub fn resolve(&self, input: ExternalSecretInput) -> Result<String, String> {
        let cache_seconds = input.cache_seconds.min(3_600);
        let cache_key = external_secret_cache_key(&input);
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

fn external_secret_cache_key(input: &ExternalSecretInput) -> String {
    format!(
        "{}\n{}\n{}\n{}\n{}\n{}\n{}",
        input.provider.trim().to_ascii_lowercase(),
        input.reference.trim(),
        input.scope.trim(),
        input.field.trim(),
        input.version.trim(),
        input.credential_id.trim(),
        input.app_name.trim()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::external_credential_store::{ExternalCredential, ExternalCredentialRecord};

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

    #[test]
    fn applies_selected_profiles_without_putting_secrets_in_arguments() {
        let _serial = external_credential_store::test_serial_guard();
        external_credential_store::save(vec![ExternalCredentialRecord {
            id: "aws-profile".into(),
            name: "AWS profile".into(),
            provider: "aws".into(),
            credentials: ExternalCredential::AwsTemporary {
                access_key_id: "access-id".into(),
                secret_access_key: "secret-key".into(),
                session_token: "session-token".into(),
                region: "us-west-2".into(),
            },
        }])
        .unwrap();
        let input = ExternalSecretInput {
            provider: "aws".into(),
            reference: "orders".into(),
            scope: String::new(),
            field: String::new(),
            version: String::new(),
            credential_id: "aws-profile".into(),
            app_name: String::new(),
            cache_seconds: 0,
        };
        let selected = selected_credential(&input).unwrap().unwrap();
        let mut command = Command::new("aws");
        let region = apply_aws_credential(&mut command, &selected.credentials).unwrap();
        assert_eq!(region, "us-west-2");
        let arguments = command
            .get_args()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert!(!arguments
            .iter()
            .any(|argument| argument.contains("secret-key")));
        let environment = command
            .get_envs()
            .map(|(name, value)| {
                (
                    name.to_string_lossy().into_owned(),
                    value.unwrap().to_string_lossy().into_owned(),
                )
            })
            .collect::<HashMap<_, _>>();
        assert_eq!(environment["AWS_ACCESS_KEY_ID"], "access-id");
        assert_eq!(environment["AWS_SECRET_ACCESS_KEY"], "secret-key");
        assert_eq!(environment["AWS_SESSION_TOKEN"], "session-token");

        let mut wrong_provider = input;
        wrong_provider.provider = "gcp".into();
        assert!(selected_credential(&wrong_provider)
            .unwrap_err()
            .contains("another provider"));
    }

    #[test]
    fn keeps_profile_and_hcp_app_coordinates_in_cache_identity() {
        let input = ExternalSecretInput {
            provider: "hashicorp".into(),
            reference: "orders".into(),
            scope: "organization".into(),
            field: "project".into(),
            version: "3".into(),
            credential_id: "production".into(),
            app_name: "checkout".into(),
            cache_seconds: 1_800,
        };
        let key = external_secret_cache_key(&input);
        assert_ne!(
            key,
            external_secret_cache_key(&ExternalSecretInput {
                credential_id: "staging".into(),
                ..input.clone()
            })
        );
        assert_ne!(
            key,
            external_secret_cache_key(&ExternalSecretInput {
                app_name: "billing".into(),
                ..input
            })
        );
    }

    #[test]
    fn builds_encoded_hcp_latest_and_versioned_secret_urls() {
        assert_eq!(
            hcp_secret_url("org", "project", "checkout app", "orders/key", "")
                .unwrap()
                .as_str(),
            "https://api.cloud.hashicorp.com/secrets/2023-11-28/organizations/org/projects/project/apps/checkout%20app/secrets/orders%2Fkey:open"
        );
        assert_eq!(
            hcp_secret_url("org", "project", "checkout", "orders", "7")
                .unwrap()
                .as_str(),
            "https://api.cloud.hashicorp.com/secrets/2023-11-28/organizations/org/projects/project/apps/checkout/secrets/orders/versions/7:open"
        );
    }
}

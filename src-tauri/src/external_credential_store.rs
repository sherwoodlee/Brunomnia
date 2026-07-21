use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[cfg(all(not(test), target_os = "macos"))]
const KEYCHAIN_SERVICE: &str = "dev.brunomnia.desktop.external-vault-credentials";
#[cfg(all(not(test), target_os = "macos"))]
const KEYCHAIN_ACCOUNT: &str = "profiles-v1";
#[cfg(all(not(test), target_os = "macos"))]
const ITEM_NOT_FOUND: i32 = -25_300;
const MAX_RECORDS: usize = 100;
const MAX_STORE_BYTES: usize = 250_000;
const MAX_ID_BYTES: usize = 128;
const MAX_NAME_CHARS: usize = 200;
const MAX_VALUE_BYTES: usize = 32_768;
static KEYCHAIN_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExternalCredentialRecord {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub credentials: ExternalCredential,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum ExternalCredential {
    AwsTemporary {
        access_key_id: String,
        secret_access_key: String,
        session_token: String,
        region: String,
    },
    AwsFile {
        section: String,
        file_path: String,
        enable_cache: bool,
        region: String,
    },
    AwsSso {
        section: String,
        file_path: String,
        config_file_path: String,
        enable_cache: bool,
        region: String,
    },
    GcpServiceAccount {
        service_account_key_file_path: String,
    },
    HashicorpToken {
        system_type: String,
        server_address: String,
        access_token: String,
        namespace: String,
    },
    HashicorpAppRole {
        system_type: String,
        server_address: String,
        role_id: String,
        secret_id: String,
        namespace: String,
    },
    HcpVaultSecrets {
        client_id: String,
        client_secret: String,
    },
    AzureOauth {
        expires_on: String,
        unique_id: String,
        username: String,
        access_token: String,
    },
}

fn supported() -> bool {
    cfg!(target_os = "macos") || cfg!(test)
}

fn validate_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > MAX_ID_BYTES
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(
            "External credential IDs may contain only letters, numbers, hyphens, and underscores."
                .into(),
        );
    }
    Ok(())
}

fn required(value: &str, label: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("Enter the external credential {label}."));
    }
    if value.len() > MAX_VALUE_BYTES || value.contains('\0') {
        return Err(format!(
            "The external credential {label} is invalid or too large."
        ));
    }
    Ok(())
}

fn optional(value: &str, label: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Ok(())
    } else {
        required(value, label)
    }
}

fn validate_path(value: &str, label: &str, optional_path: bool) -> Result<(), String> {
    if optional_path && value.trim().is_empty() {
        return Ok(());
    }
    required(value, label)?;
    if !std::path::Path::new(value.trim()).is_absolute() {
        return Err(format!(
            "The external credential {label} must be an absolute path."
        ));
    }
    Ok(())
}

impl ExternalCredential {
    fn provider(&self) -> &'static str {
        match self {
            Self::AwsTemporary { .. } | Self::AwsFile { .. } | Self::AwsSso { .. } => "aws",
            Self::GcpServiceAccount { .. } => "gcp",
            Self::HashicorpToken { .. }
            | Self::HashicorpAppRole { .. }
            | Self::HcpVaultSecrets { .. } => "hashicorp",
            Self::AzureOauth { .. } => "azure",
        }
    }

    fn validate(&self) -> Result<(), String> {
        match self {
            Self::AwsTemporary {
                access_key_id,
                secret_access_key,
                session_token,
                region,
            } => {
                required(access_key_id, "AWS access key ID")?;
                required(secret_access_key, "AWS secret access key")?;
                required(session_token, "AWS session token")?;
                required(region, "AWS region")
            }
            Self::AwsFile {
                section,
                file_path,
                region,
                ..
            } => {
                required(section, "AWS section name")?;
                validate_path(file_path, "AWS credential file path", true)?;
                required(region, "AWS region")
            }
            Self::AwsSso {
                section,
                file_path,
                config_file_path,
                region,
                ..
            } => {
                required(section, "AWS profile name")?;
                validate_path(file_path, "AWS credential file path", true)?;
                validate_path(config_file_path, "AWS config file path", true)?;
                required(region, "AWS region")
            }
            Self::GcpServiceAccount {
                service_account_key_file_path,
            } => validate_path(
                service_account_key_file_path,
                "GCP service-account key file path",
                false,
            ),
            Self::HashicorpToken {
                system_type,
                server_address,
                access_token,
                namespace,
            } => {
                validate_hashicorp_system(system_type)?;
                validate_url(server_address, "HashiCorp server address")?;
                required(access_token, "HashiCorp authentication token")?;
                optional(namespace, "HashiCorp namespace")
            }
            Self::HashicorpAppRole {
                system_type,
                server_address,
                role_id,
                secret_id,
                namespace,
            } => {
                validate_hashicorp_system(system_type)?;
                validate_url(server_address, "HashiCorp server address")?;
                required(role_id, "HashiCorp role ID")?;
                required(secret_id, "HashiCorp secret ID")?;
                optional(namespace, "HashiCorp namespace")
            }
            Self::HcpVaultSecrets {
                client_id,
                client_secret,
            } => {
                required(client_id, "HCP client ID")?;
                required(client_secret, "HCP client secret")
            }
            Self::AzureOauth {
                expires_on,
                unique_id,
                username,
                access_token,
            } => {
                required(expires_on, "Azure expiry")?;
                chrono::DateTime::parse_from_rfc3339(expires_on).map_err(|_| {
                    "The external credential Azure expiry must be RFC 3339.".to_string()
                })?;
                required(unique_id, "Azure account ID")?;
                required(username, "Azure username")?;
                required(access_token, "Azure access token")
            }
        }
    }
}

fn validate_hashicorp_system(value: &str) -> Result<(), String> {
    if matches!(value, "onPrem" | "cloudVaultDedicated") {
        Ok(())
    } else {
        Err("HashiCorp system type must be onPrem or cloudVaultDedicated.".into())
    }
}

fn validate_url(value: &str, label: &str) -> Result<(), String> {
    required(value, label)?;
    let url = url::Url::parse(value.trim())
        .map_err(|_| format!("The external credential {label} is not a valid URL."))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(format!(
            "The external credential {label} must be an HTTP(S) URL."
        ));
    }
    Ok(())
}

fn normalize(
    records: Vec<ExternalCredentialRecord>,
) -> Result<Vec<ExternalCredentialRecord>, String> {
    if records.len() > MAX_RECORDS {
        return Err(format!(
            "At most {MAX_RECORDS} external credentials can be stored."
        ));
    }
    let mut ids = std::collections::HashSet::new();
    let mut names = std::collections::HashSet::new();
    for record in &records {
        validate_id(&record.id)?;
        let name = record.name.trim();
        if name.is_empty() || name.chars().count() > MAX_NAME_CHARS {
            return Err("External credential names must contain 1–200 characters.".into());
        }
        if record.provider != record.credentials.provider() {
            return Err("External credential provider and configuration type do not match.".into());
        }
        record.credentials.validate()?;
        if !ids.insert(record.id.to_ascii_lowercase()) {
            return Err("External credential IDs must be unique, ignoring case.".into());
        }
        if !names.insert((record.provider.clone(), name.to_ascii_lowercase())) {
            return Err(
                "External credential names must be unique per provider, ignoring case.".into(),
            );
        }
    }
    Ok(records)
}

#[cfg(test)]
fn test_store() -> &'static Mutex<Option<Vec<u8>>> {
    use std::sync::OnceLock;
    static STORE: OnceLock<Mutex<Option<Vec<u8>>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(None))
}

#[cfg(test)]
pub(crate) fn test_serial_guard() -> std::sync::MutexGuard<'static, ()> {
    use std::sync::OnceLock;
    static SERIAL: OnceLock<Mutex<()>> = OnceLock::new();
    SERIAL
        .get_or_init(|| Mutex::new(()))
        .lock()
        .expect("external credential test serial lock")
}

#[cfg(test)]
fn read_secret() -> Result<Option<Vec<u8>>, String> {
    Ok(test_store()
        .lock()
        .map_err(|_| "The external credential test Keychain is unavailable.".to_string())?
        .clone())
}

#[cfg(test)]
fn write_secret(value: &[u8]) -> Result<(), String> {
    *test_store()
        .lock()
        .map_err(|_| "The external credential test Keychain is unavailable.".to_string())? =
        Some(value.to_vec());
    Ok(())
}

#[cfg(test)]
fn delete_secret() -> Result<(), String> {
    *test_store()
        .lock()
        .map_err(|_| "The external credential test Keychain is unavailable.".to_string())? = None;
    Ok(())
}

#[cfg(all(not(test), target_os = "macos"))]
fn read_secret() -> Result<Option<Vec<u8>>, String> {
    use security_framework::passwords::get_generic_password;
    match get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT) {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(None),
        Err(error) => Err(format!(
            "External credentials could not be read from macOS Keychain: {error}"
        )),
    }
}

#[cfg(all(not(test), target_os = "macos"))]
fn write_secret(value: &[u8]) -> Result<(), String> {
    use security_framework::passwords::set_generic_password;
    set_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, value).map_err(|error| {
        format!("External credentials could not be saved in macOS Keychain: {error}")
    })
}

#[cfg(all(not(test), target_os = "macos"))]
fn delete_secret() -> Result<(), String> {
    use security_framework::passwords::delete_generic_password;
    match delete_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(()),
        Err(error) => Err(format!(
            "External credentials could not be removed from macOS Keychain: {error}"
        )),
    }
}

#[cfg(all(not(test), not(target_os = "macos")))]
fn read_secret() -> Result<Option<Vec<u8>>, String> {
    Err("Protected external credential profiles require macOS Keychain.".into())
}

#[cfg(all(not(test), not(target_os = "macos")))]
fn write_secret(_value: &[u8]) -> Result<(), String> {
    Err("Protected external credential profiles require macOS Keychain.".into())
}

#[cfg(all(not(test), not(target_os = "macos")))]
fn delete_secret() -> Result<(), String> {
    Ok(())
}

pub fn load() -> Result<Vec<ExternalCredentialRecord>, String> {
    if !supported() {
        return Err("Protected external credential profiles require macOS Keychain.".into());
    }
    let _guard = KEYCHAIN_LOCK
        .lock()
        .map_err(|_| "The external credential Keychain lock is unavailable.".to_string())?;
    let Some(bytes) = read_secret()? else {
        return Ok(Vec::new());
    };
    if bytes.len() > MAX_STORE_BYTES {
        return Err("The external credential store exceeds the 250 KB safety limit.".into());
    }
    let records = serde_json::from_slice(&bytes)
        .map_err(|_| "The external credential store is malformed.".to_string())?;
    normalize(records)
}

pub fn save(
    records: Vec<ExternalCredentialRecord>,
) -> Result<Vec<ExternalCredentialRecord>, String> {
    if !supported() {
        return Err("Protected external credential profiles require macOS Keychain.".into());
    }
    let records = normalize(records)?;
    let bytes = serde_json::to_vec(&records).map_err(|error| error.to_string())?;
    if bytes.len() > MAX_STORE_BYTES {
        return Err("The external credential store exceeds the 250 KB safety limit.".into());
    }
    let _guard = KEYCHAIN_LOCK
        .lock()
        .map_err(|_| "The external credential Keychain lock is unavailable.".to_string())?;
    if records.is_empty() {
        delete_secret()?;
    } else {
        write_secret(&bytes)?;
    }
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn aws() -> ExternalCredentialRecord {
        ExternalCredentialRecord {
            id: "aws-one".into(),
            name: "Production AWS".into(),
            provider: "aws".into(),
            credentials: ExternalCredential::AwsTemporary {
                access_key_id: "AKIAEXAMPLE".into(),
                secret_access_key: "never-store-plaintext".into(),
                session_token: "session-secret".into(),
                region: "us-west-2".into(),
            },
        }
    }

    #[test]
    fn round_trips_exact_provider_profiles_inside_the_test_keychain() {
        let _serial = test_serial_guard();
        save(Vec::new()).unwrap();
        let records = vec![
            aws(),
            ExternalCredentialRecord {
                id: "gcp-one".into(),
                name: "Production GCP".into(),
                provider: "gcp".into(),
                credentials: ExternalCredential::GcpServiceAccount {
                    service_account_key_file_path: "/tmp/service-account.json".into(),
                },
            },
            ExternalCredentialRecord {
                id: "vault-one".into(),
                name: "On-prem Vault".into(),
                provider: "hashicorp".into(),
                credentials: ExternalCredential::HashicorpAppRole {
                    system_type: "onPrem".into(),
                    server_address: "https://vault.example".into(),
                    role_id: "role".into(),
                    secret_id: "secret".into(),
                    namespace: String::new(),
                },
            },
        ];
        assert_eq!(save(records.clone()).unwrap(), records);
        assert_eq!(load().unwrap(), records);
        let stored = test_store().lock().unwrap().clone().unwrap();
        assert!(String::from_utf8(stored)
            .unwrap()
            .contains("never-store-plaintext"));
        save(Vec::new()).unwrap();
        assert!(load().unwrap().is_empty());
    }

    #[test]
    fn rejects_provider_mismatches_duplicates_relative_paths_and_invalid_urls() {
        let _serial = test_serial_guard();
        let mut mismatch = aws();
        mismatch.provider = "gcp".into();
        assert!(save(vec![mismatch]).unwrap_err().contains("do not match"));
        assert!(save(vec![aws(), aws()]).unwrap_err().contains("unique"));

        let mut relative = aws();
        relative.credentials = ExternalCredential::GcpServiceAccount {
            service_account_key_file_path: "relative.json".into(),
        };
        relative.provider = "gcp".into();
        assert!(save(vec![relative]).unwrap_err().contains("absolute path"));

        let mut invalid_url = aws();
        invalid_url.provider = "hashicorp".into();
        invalid_url.credentials = ExternalCredential::HashicorpToken {
            system_type: "onPrem".into(),
            server_address: "file:///tmp/vault".into(),
            access_token: "token".into(),
            namespace: String::new(),
        };
        assert!(save(vec![invalid_url]).unwrap_err().contains("HTTP(S)"));
    }
}

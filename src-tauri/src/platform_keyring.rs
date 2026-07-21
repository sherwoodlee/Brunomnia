use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ring::digest::{digest, SHA256};
use serde::{Deserialize, Serialize};

const MANIFEST_VERSION: u8 = 1;
const CHUNK_BYTES: usize = 1_200;
const MAX_CHUNKS: usize = 4_096;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChunkManifest {
    version: u8,
    generation: String,
    chunks: usize,
    bytes: usize,
    sha256: String,
}

#[cfg(not(test))]
fn credential(service: &str, account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, account)
        .map_err(|error| format!("The operating-system credential entry is invalid: {error}"))
}

fn manifest_account(account: &str) -> String {
    format!("{account}:manifest")
}

fn chunk_account(account: &str, generation: &str, index: usize) -> String {
    format!("{account}:chunk:{generation}:{index}")
}

#[cfg(not(test))]
fn read_password(service: &str, account: &str) -> Result<Option<String>, String> {
    match credential(service, account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "The operating-system credential store could not read '{service}': {error}"
        )),
    }
}

#[cfg(not(test))]
fn write_password(service: &str, account: &str, value: &str) -> Result<(), String> {
    credential(service, account)?
        .set_password(value)
        .map_err(|error| {
            format!("The operating-system credential store could not save '{service}': {error}")
        })
}

#[cfg(not(test))]
fn delete_password(service: &str, account: &str) -> Result<(), String> {
    match credential(service, account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "The operating-system credential store could not remove '{service}': {error}"
        )),
    }
}

#[cfg(test)]
fn test_store() -> &'static std::sync::Mutex<std::collections::HashMap<(String, String), String>> {
    use std::{
        collections::HashMap,
        sync::{Mutex, OnceLock},
    };
    static STORE: OnceLock<Mutex<HashMap<(String, String), String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(test)]
fn read_password(service: &str, account: &str) -> Result<Option<String>, String> {
    Ok(test_store()
        .lock()
        .map_err(|_| "The test credential store is unavailable.".to_string())?
        .get(&(service.to_string(), account.to_string()))
        .cloned())
}

#[cfg(test)]
fn write_password(service: &str, account: &str, value: &str) -> Result<(), String> {
    test_store()
        .lock()
        .map_err(|_| "The test credential store is unavailable.".to_string())?
        .insert(
            (service.to_string(), account.to_string()),
            value.to_string(),
        );
    Ok(())
}

#[cfg(test)]
fn delete_password(service: &str, account: &str) -> Result<(), String> {
    test_store()
        .lock()
        .map_err(|_| "The test credential store is unavailable.".to_string())?
        .remove(&(service.to_string(), account.to_string()));
    Ok(())
}

fn parse_manifest(value: &str, max_bytes: usize) -> Result<ChunkManifest, String> {
    let manifest: ChunkManifest = serde_json::from_str(value)
        .map_err(|_| "The operating-system credential manifest is malformed.".to_string())?;
    if manifest.version != MANIFEST_VERSION
        || manifest.generation.is_empty()
        || manifest.generation.len() > 64
        || !manifest
            .generation
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        || manifest.chunks == 0
        || manifest.chunks > MAX_CHUNKS
        || manifest.bytes > max_bytes
        || manifest.sha256.len() != 44
    {
        return Err("The operating-system credential manifest is invalid.".into());
    }
    Ok(manifest)
}

fn current_manifest(
    service: &str,
    account: &str,
    max_bytes: usize,
) -> Result<Option<ChunkManifest>, String> {
    read_password(service, &manifest_account(account))?
        .map(|value| parse_manifest(&value, max_bytes))
        .transpose()
}

fn delete_chunks(service: &str, account: &str, manifest: &ChunkManifest) -> Result<(), String> {
    let mut first_error = None;
    for index in 0..manifest.chunks {
        if let Err(error) = delete_password(
            service,
            &chunk_account(account, &manifest.generation, index),
        ) {
            if first_error.is_none() {
                first_error = Some(error);
            }
        }
    }
    first_error.map_or(Ok(()), Err)
}

pub fn read(service: &str, account: &str, max_bytes: usize) -> Result<Option<Vec<u8>>, String> {
    let Some(manifest) = current_manifest(service, account, max_bytes)? else {
        return Ok(None);
    };
    let mut value = Vec::with_capacity(manifest.bytes);
    for index in 0..manifest.chunks {
        let encoded = read_password(
            service,
            &chunk_account(account, &manifest.generation, index),
        )?
        .ok_or_else(|| "An operating-system credential chunk is missing.".to_string())?;
        let chunk = BASE64
            .decode(encoded)
            .map_err(|_| "An operating-system credential chunk is malformed.".to_string())?;
        if chunk.len() > CHUNK_BYTES || value.len().saturating_add(chunk.len()) > max_bytes {
            return Err("The operating-system credential value exceeds its safety limit.".into());
        }
        value.extend_from_slice(&chunk);
    }
    let checksum = BASE64.encode(digest(&SHA256, &value).as_ref());
    if value.len() != manifest.bytes || checksum != manifest.sha256 {
        return Err("The operating-system credential value failed its integrity check.".into());
    }
    Ok(Some(value))
}

pub fn write(service: &str, account: &str, value: &[u8], max_bytes: usize) -> Result<(), String> {
    if value.is_empty() || value.len() > max_bytes {
        return Err("The operating-system credential value is empty or too large.".into());
    }
    let previous = current_manifest(service, account, max_bytes)?;
    let generation = uuid::Uuid::new_v4().to_string();
    let chunks = value.len().div_ceil(CHUNK_BYTES);
    if chunks == 0 || chunks > MAX_CHUNKS {
        return Err("The operating-system credential value requires too many chunks.".into());
    }
    let manifest = ChunkManifest {
        version: MANIFEST_VERSION,
        generation: generation.clone(),
        chunks,
        bytes: value.len(),
        sha256: BASE64.encode(digest(&SHA256, value).as_ref()),
    };
    for (index, chunk) in value.chunks(CHUNK_BYTES).enumerate() {
        if let Err(error) = write_password(
            service,
            &chunk_account(account, &generation, index),
            &BASE64.encode(chunk),
        ) {
            let _ = delete_chunks(service, account, &manifest);
            return Err(error);
        }
    }
    let encoded_manifest = serde_json::to_string(&manifest).map_err(|error| error.to_string())?;
    if let Err(error) = write_password(service, &manifest_account(account), &encoded_manifest) {
        let _ = delete_chunks(service, account, &manifest);
        return Err(error);
    }
    if let Some(previous) = previous {
        let _ = delete_chunks(service, account, &previous);
    }
    Ok(())
}

pub fn delete(service: &str, account: &str, max_bytes: usize) -> Result<(), String> {
    let manifest = current_manifest(service, account, max_bytes)?;
    delete_password(service, &manifest_account(account))?;
    if let Some(manifest) = manifest {
        delete_chunks(service, account, &manifest)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_replaces_and_deletes_large_chunked_values() {
        let service = format!("test-service-{}", uuid::Uuid::new_v4());
        let account = "profile";
        let first = vec![42_u8; 250_000];
        write(&service, account, &first, 250_000).unwrap();
        assert_eq!(read(&service, account, 250_000).unwrap(), Some(first));
        let second = vec![7_u8; 4_096];
        write(&service, account, &second, 250_000).unwrap();
        assert_eq!(read(&service, account, 250_000).unwrap(), Some(second));
        delete(&service, account, 250_000).unwrap();
        assert_eq!(read(&service, account, 250_000).unwrap(), None);
    }

    #[test]
    fn rejects_missing_or_modified_chunks() {
        let service = format!("test-service-{}", uuid::Uuid::new_v4());
        let account = "profile";
        write(&service, account, b"protected-value", 1_000).unwrap();
        let manifest = current_manifest(&service, account, 1_000).unwrap().unwrap();
        write_password(
            &service,
            &chunk_account(account, &manifest.generation, 0),
            &BASE64.encode(b"modified"),
        )
        .unwrap();
        assert!(read(&service, account, 1_000)
            .unwrap_err()
            .contains("integrity"));
    }
}

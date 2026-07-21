use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use ring::{
    aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM},
    pbkdf2,
    rand::{SecureRandom, SystemRandom},
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    num::NonZeroU32,
    path::{Path, PathBuf},
};
use uuid::Uuid;

const ENVELOPE_VERSION: u32 = 1;
const PBKDF2_ITERATIONS: u32 = 210_000;
const MIN_PASSPHRASE_BYTES: usize = 12;
const MAX_ENVELOPE_BYTES: u64 = 50_000_000;
const VAULT_AAD: &[u8] = b"brunomnia.local-vault.v1";
const SYNC_AAD: &[u8] = b"brunomnia.encrypted-sync.v1";
const ENVIRONMENT_SECRET_NAME_PREFIX: &str = "__brunomnia_environment__:";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub id: String,
    pub name: String,
    pub value: String,
    pub updated_at: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub owner_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncryptedEnvelope {
    version: u32,
    kind: String,
    iterations: u32,
    salt_base64: String,
    nonce_base64: String,
    ciphertext_base64: String,
    updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureFileStatus {
    pub exists: bool,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSaveInput {
    pub passphrase: String,
    pub entries: Vec<VaultEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPayload {
    pub revision: u64,
    pub actor: String,
    pub saved_at: String,
    pub workspace: Value,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushInput {
    pub path: String,
    pub passphrase: String,
    pub actor: String,
    pub base_revision: u64,
    pub force: bool,
    pub workspace: Value,
}

fn validate_passphrase(passphrase: &str) -> Result<(), String> {
    if passphrase.len() < MIN_PASSPHRASE_BYTES {
        return Err(format!(
            "Use an encryption passphrase with at least {MIN_PASSPHRASE_BYTES} bytes."
        ));
    }
    Ok(())
}

fn decode<const N: usize>(value: &str, label: &str) -> Result<[u8; N], String> {
    let decoded = BASE64
        .decode(value)
        .map_err(|_| format!("The encrypted {label} is invalid."))?;
    decoded
        .try_into()
        .map_err(|_| format!("The encrypted {label} has the wrong length."))
}

fn derive_key(passphrase: &str, salt: &[u8], iterations: u32) -> Result<[u8; 32], String> {
    let iterations = NonZeroU32::new(iterations)
        .ok_or_else(|| "The encrypted file has invalid key iterations.".to_string())?;
    let mut key = [0_u8; 32];
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        salt,
        passphrase.as_bytes(),
        &mut key,
    );
    Ok(key)
}

fn encrypt<T: Serialize>(
    value: &T,
    passphrase: &str,
    kind: &str,
    aad: &[u8],
) -> Result<EncryptedEnvelope, String> {
    validate_passphrase(passphrase)?;
    let random = SystemRandom::new();
    let mut salt = [0_u8; 16];
    let mut nonce_bytes = [0_u8; 12];
    random
        .fill(&mut salt)
        .map_err(|_| "Unable to generate an encryption salt.".to_string())?;
    random
        .fill(&mut nonce_bytes)
        .map_err(|_| "Unable to generate an encryption nonce.".to_string())?;
    let key_bytes = derive_key(passphrase, &salt, PBKDF2_ITERATIONS)?;
    let unbound = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|_| "Unable to initialize vault encryption.".to_string())?;
    let key = LessSafeKey::new(unbound);
    let mut ciphertext = serde_json::to_vec(value)
        .map_err(|error| format!("Unable to encode secure data: {error}"))?;
    key.seal_in_place_append_tag(
        Nonce::assume_unique_for_key(nonce_bytes),
        Aad::from(aad),
        &mut ciphertext,
    )
    .map_err(|_| "Unable to encrypt secure data.".to_string())?;
    Ok(EncryptedEnvelope {
        version: ENVELOPE_VERSION,
        kind: kind.into(),
        iterations: PBKDF2_ITERATIONS,
        salt_base64: BASE64.encode(salt),
        nonce_base64: BASE64.encode(nonce_bytes),
        ciphertext_base64: BASE64.encode(ciphertext),
        updated_at: Utc::now().to_rfc3339(),
    })
}

fn decrypt<T: DeserializeOwned>(
    envelope: &EncryptedEnvelope,
    passphrase: &str,
    kind: &str,
    aad: &[u8],
) -> Result<T, String> {
    validate_passphrase(passphrase)?;
    if envelope.version != ENVELOPE_VERSION || envelope.kind != kind {
        return Err("This encrypted file is not a supported Brunomnia secure envelope.".into());
    }
    if !(100_000..=2_000_000).contains(&envelope.iterations) {
        return Err(
            "The encrypted file uses an unsafe or unsupported key-derivation count.".into(),
        );
    }
    let salt = decode::<16>(&envelope.salt_base64, "salt")?;
    let nonce = decode::<12>(&envelope.nonce_base64, "nonce")?;
    let mut ciphertext = BASE64
        .decode(&envelope.ciphertext_base64)
        .map_err(|_| "The encrypted ciphertext is invalid.".to_string())?;
    let key_bytes = derive_key(passphrase, &salt, envelope.iterations)?;
    let unbound = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|_| "Unable to initialize vault decryption.".to_string())?;
    let key = LessSafeKey::new(unbound);
    let plaintext = key
        .open_in_place(
            Nonce::assume_unique_for_key(nonce),
            Aad::from(aad),
            &mut ciphertext,
        )
        .map_err(|_| {
            "The passphrase is incorrect or the encrypted file was modified.".to_string()
        })?;
    serde_json::from_slice(plaintext)
        .map_err(|error| format!("The decrypted secure data is invalid: {error}"))
}

fn read_envelope(path: &Path) -> Result<EncryptedEnvelope, String> {
    let link_metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect encrypted file: {error}"))?;
    if link_metadata.file_type().is_symlink() || !link_metadata.is_file() {
        return Err("Encrypted storage must be a regular file, not a symlink.".into());
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    let file = options
        .open(path)
        .map_err(|error| format!("Unable to open encrypted file: {error}"))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("Unable to inspect opened encrypted file: {error}"))?;
    if !metadata.is_file() {
        return Err("Encrypted storage must be a regular file, not a symlink.".into());
    }
    if metadata.len() > MAX_ENVELOPE_BYTES {
        return Err("The encrypted file exceeds the 50 MB safety limit.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_ENVELOPE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read encrypted file: {error}"))?;
    if bytes.len() as u64 > MAX_ENVELOPE_BYTES {
        return Err("The encrypted file exceeds the 50 MB safety limit.".into());
    }
    let source = String::from_utf8(bytes)
        .map_err(|_| "The encrypted file envelope is not UTF-8 text.".to_string())?;
    serde_json::from_str(&source)
        .map_err(|error| format!("The encrypted file envelope is invalid: {error}"))
}

fn write_private(path: &Path, envelope: &EncryptedEnvelope) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The encrypted file path has no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Unable to create encrypted storage folder: {error}"))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| format!("Unable to open encrypted storage folder: {error}"))?;
    let target = parent.join(
        path.file_name()
            .ok_or_else(|| "Choose a complete encrypted file path.".to_string())?,
    );
    if let Ok(metadata) = fs::symlink_metadata(&target) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("Encrypted storage must be a regular file, not a symlink.".into());
        }
    }
    let temporary = parent.join(format!(".brunomnia-secure-{}.tmp", Uuid::new_v4()));
    let data = serde_json::to_vec_pretty(envelope)
        .map_err(|error| format!("Unable to encode encrypted envelope: {error}"))?;
    let result = (|| {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|error| format!("Unable to create encrypted temporary file: {error}"))?;
        file.write_all(&data)
            .map_err(|error| format!("Unable to write encrypted temporary file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Unable to flush encrypted temporary file: {error}"))?;
        fs::rename(&temporary, &target)
            .map_err(|error| format!("Unable to replace encrypted file: {error}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub fn vault_status(path: &Path) -> Result<SecureFileStatus, String> {
    if !path.exists() {
        return Ok(SecureFileStatus {
            exists: false,
            updated_at: String::new(),
        });
    }
    let envelope = read_envelope(path)?;
    if envelope.kind != "vault" {
        return Err("The local vault path contains another encrypted file type.".into());
    }
    Ok(SecureFileStatus {
        exists: true,
        updated_at: envelope.updated_at,
    })
}

pub fn vault_unlock(path: &Path, passphrase: String) -> Result<Vec<VaultEntry>, String> {
    let envelope = read_envelope(path)?;
    decrypt(&envelope, &passphrase, "vault", VAULT_AAD)
}

pub fn vault_save(path: &Path, input: VaultSaveInput) -> Result<SecureFileStatus, String> {
    for entry in &input.entries {
        match entry.kind.as_str() {
            "" if entry.owner_id.is_empty()
                && !entry.name.starts_with(ENVIRONMENT_SECRET_NAME_PREFIX) => {}
            "environment"
                if !entry.owner_id.is_empty()
                    && entry.owner_id.len() <= 500
                    && entry.name
                        == format!("{ENVIRONMENT_SECRET_NAME_PREFIX}{}", entry.owner_id) => {}
            "" => return Err("Ordinary vault entries cannot carry an owner ID.".into()),
            "environment" => {
                return Err(
                    "Environment vault entries require a bounded owner and canonical name.".into(),
                )
            }
            _ => return Err("The vault entry kind is unsupported.".into()),
        }
    }
    let mut names = input
        .entries
        .iter()
        .map(|entry| entry.name.trim().to_ascii_lowercase())
        .collect::<Vec<_>>();
    if names.iter().any(String::is_empty) {
        return Err("Every vault entry needs a name.".into());
    }
    names.sort();
    if names.windows(2).any(|pair| pair[0] == pair[1]) {
        return Err("Vault entry names must be unique, ignoring case.".into());
    }
    let envelope = encrypt(&input.entries, &input.passphrase, "vault", VAULT_AAD)?;
    write_private(path, &envelope)?;
    Ok(SecureFileStatus {
        exists: true,
        updated_at: envelope.updated_at,
    })
}

pub fn vault_reset(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect local vault: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("The local vault path is not a regular file.".into());
    }
    fs::remove_file(path).map_err(|error| format!("Unable to reset local vault: {error}"))
}

fn sync_path(value: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value.trim());
    if path.as_os_str().is_empty() || path.file_name().is_none() {
        return Err("Choose a complete encrypted sync file path.".into());
    }
    Ok(path)
}

pub fn sync_status(path: String) -> Result<SecureFileStatus, String> {
    let path = sync_path(&path)?;
    if !path.exists() {
        return Ok(SecureFileStatus {
            exists: false,
            updated_at: String::new(),
        });
    }
    let envelope = read_envelope(&path)?;
    if envelope.kind != "sync" {
        return Err("The sync path contains another encrypted file type.".into());
    }
    Ok(SecureFileStatus {
        exists: true,
        updated_at: envelope.updated_at,
    })
}

pub fn sync_pull(path: String, passphrase: String) -> Result<SyncPayload, String> {
    let envelope = read_envelope(&sync_path(&path)?)?;
    decrypt(&envelope, &passphrase, "sync", SYNC_AAD)
}

pub fn sync_push(input: SyncPushInput) -> Result<SyncPayload, String> {
    let path = sync_path(&input.path)?;
    let current = if path.exists() {
        Some(sync_pull(input.path.clone(), input.passphrase.clone())?)
    } else {
        None
    };
    if let Some(remote) = &current {
        if !input.force && remote.revision != input.base_revision {
            return Err(format!(
                "Encrypted sync conflict: remote revision {} does not match local base {}. Pull first or explicitly force a new revision.",
                remote.revision, input.base_revision
            ));
        }
    }
    let payload = SyncPayload {
        revision: current.map_or(1, |remote| remote.revision.saturating_add(1)),
        actor: input.actor.trim().to_string(),
        saved_at: Utc::now().to_rfc3339(),
        workspace: input.workspace,
    };
    let envelope = encrypt(&payload, &input.passphrase, "sync", SYNC_AAD)?;
    write_private(&path, &envelope)?;
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_vault_entries_without_plaintext_and_rejects_wrong_passphrases() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("vault.json");
        let entries = vec![VaultEntry {
            id: "secret-one".into(),
            name: "api_token".into(),
            value: "never-write-this-plaintext".into(),
            updated_at: Utc::now().to_rfc3339(),
            kind: String::new(),
            owner_id: String::new(),
        }];
        vault_save(
            &path,
            VaultSaveInput {
                passphrase: "correct horse battery staple".into(),
                entries: entries.clone(),
            },
        )
        .unwrap();
        let source = fs::read_to_string(&path).unwrap();
        assert!(!source.contains("never-write-this-plaintext"));
        assert_eq!(
            vault_unlock(&path, "correct horse battery staple".into()).unwrap(),
            entries
        );
        assert!(vault_unlock(&path, "this is the wrong passphrase".into()).is_err());
    }

    #[test]
    fn validates_and_encrypts_environment_owned_vault_entries() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("environment-vault.json");
        let entry = VaultEntry {
            id: "environment-secret-one".into(),
            name: "__brunomnia_environment__:private-row".into(),
            value: "never-write-environment-plaintext".into(),
            updated_at: Utc::now().to_rfc3339(),
            kind: "environment".into(),
            owner_id: "private-row".into(),
        };
        vault_save(
            &path,
            VaultSaveInput {
                passphrase: "correct horse battery staple".into(),
                entries: vec![entry.clone()],
            },
        )
        .unwrap();
        assert!(!fs::read_to_string(&path)
            .unwrap()
            .contains("never-write-environment-plaintext"));
        assert_eq!(
            vault_unlock(&path, "correct horse battery staple".into()).unwrap(),
            vec![entry.clone()]
        );
        let mut invalid = entry;
        invalid.name = "not-canonical".into();
        assert!(vault_save(
            &path,
            VaultSaveInput {
                passphrase: "correct horse battery staple".into(),
                entries: vec![invalid],
            },
        )
        .unwrap_err()
        .contains("canonical"));
    }

    #[test]
    fn detects_encrypted_sync_revision_conflicts_before_overwrite() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("team-sync.json");
        let first = sync_push(SyncPushInput {
            path: path.to_string_lossy().into_owned(),
            passphrase: "shared passphrase for testing".into(),
            actor: "Avery".into(),
            base_revision: 0,
            force: false,
            workspace: serde_json::json!({"name":"One"}),
        })
        .unwrap();
        assert_eq!(first.revision, 1);
        let conflict = sync_push(SyncPushInput {
            path: path.to_string_lossy().into_owned(),
            passphrase: "shared passphrase for testing".into(),
            actor: "Blake".into(),
            base_revision: 0,
            force: false,
            workspace: serde_json::json!({"name":"Two"}),
        })
        .unwrap_err();
        assert!(conflict.contains("remote revision 1"));
        let pulled = sync_pull(
            path.to_string_lossy().into_owned(),
            "shared passphrase for testing".into(),
        )
        .unwrap();
        assert_eq!(pulled.workspace["name"], "One");
    }
}

use crate::platform_keyring;
use base64::{
    engine::general_purpose::{STANDARD as BASE64, URL_SAFE_NO_PAD},
    Engine,
};
use chrono::Utc;
use ring::{
    aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM},
    digest::{digest, SHA256},
    hkdf, pbkdf2,
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
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret};

const ENVELOPE_VERSION: u32 = 1;
const PBKDF2_ITERATIONS: u32 = 210_000;
const MIN_PASSPHRASE_BYTES: usize = 12;
const MAX_ENVELOPE_BYTES: u64 = 50_000_000;
const VAULT_AAD: &[u8] = b"brunomnia.local-vault.v1";
const SYNC_AAD: &[u8] = b"brunomnia.encrypted-sync.v1";
const SYNC_RECIPIENT_AAD: &[u8] = b"brunomnia.encrypted-sync.v2";
const SYNC_KEY_WRAP_AAD: &[u8] = b"brunomnia.encrypted-sync.key-wrap.v1";
const SYNC_IDENTITY_SERVICE: &str = "com.brunomnia.sync-identity";
const SYNC_IDENTITY_ACCOUNT: &str = "default";
const MAX_SYNC_IDENTITY_BYTES: usize = 4_096;
const MAX_SYNC_RECIPIENTS: usize = 100;
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SyncRecipient {
    pub id: String,
    pub label: String,
    pub public_key_base64: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncIdentity {
    pub recipient: SyncRecipient,
    pub invite_code: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFileStatus {
    pub exists: bool,
    pub updated_at: String,
    pub encryption_mode: String,
    pub recipients: Vec<SyncRecipient>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredSyncIdentity {
    version: u8,
    label: String,
    private_key_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SyncRecipientInvite {
    version: u8,
    label: String,
    public_key_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WrappedSyncKey {
    id: String,
    label: String,
    public_key_base64: String,
    ephemeral_public_key_base64: String,
    nonce_base64: String,
    wrapped_key_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecipientSyncEnvelope {
    version: u32,
    kind: String,
    nonce_base64: String,
    ciphertext_base64: String,
    updated_at: String,
    recipients: Vec<WrappedSyncKey>,
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
    #[serde(default = "empty_sync_repository")]
    pub repository: Value,
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
    #[serde(default = "empty_sync_repository")]
    pub repository: Value,
    #[serde(default)]
    pub recipient_encryption: bool,
    #[serde(default)]
    pub recipients: Vec<SyncRecipient>,
}

fn empty_sync_repository() -> Value {
    serde_json::json!({ "version": 1, "activeBranches": {}, "branches": [], "commits": [] })
}

struct SyncKeyLength;

impl hkdf::KeyType for SyncKeyLength {
    fn len(&self) -> usize {
        32
    }
}

fn sync_recipient_id(public_key: &[u8; 32]) -> String {
    let fingerprint = digest(&SHA256, public_key);
    format!(
        "recipient-{}",
        URL_SAFE_NO_PAD.encode(&fingerprint.as_ref()[..16])
    )
}

fn validate_sync_recipient(recipient: &SyncRecipient) -> Result<SyncRecipient, String> {
    if recipient.public_key_base64.len() > 128 {
        return Err("The encrypted-sync recipient public key is too large.".into());
    }
    let public_key = decode::<32>(&recipient.public_key_base64, "recipient public key")?;
    let label = recipient.label.trim();
    if label.is_empty() || label.chars().count() > 200 || label.chars().any(char::is_control) {
        return Err("Each encrypted-sync recipient needs a label of 1 to 200 characters.".into());
    }
    let id = sync_recipient_id(&public_key);
    if !recipient.id.is_empty() && recipient.id != id {
        return Err(
            "The encrypted-sync recipient fingerprint does not match its public key.".into(),
        );
    }
    Ok(SyncRecipient {
        id,
        label: label.to_string(),
        public_key_base64: BASE64.encode(public_key),
    })
}

fn validate_sync_recipients(recipients: &[SyncRecipient]) -> Result<Vec<SyncRecipient>, String> {
    if recipients.is_empty() || recipients.len() > MAX_SYNC_RECIPIENTS {
        return Err(format!(
            "Recipient encryption requires 1 to {MAX_SYNC_RECIPIENTS} recipients."
        ));
    }
    let mut validated = recipients
        .iter()
        .map(validate_sync_recipient)
        .collect::<Result<Vec<_>, _>>()?;
    validated.sort_by(|left, right| left.id.cmp(&right.id));
    if validated.windows(2).any(|pair| pair[0].id == pair[1].id) {
        return Err("Encrypted-sync recipient public keys must be unique.".into());
    }
    Ok(validated)
}

fn stored_sync_identity() -> Result<Option<(StoredSyncIdentity, StaticSecret)>, String> {
    let Some(bytes) = platform_keyring::read(
        SYNC_IDENTITY_SERVICE,
        SYNC_IDENTITY_ACCOUNT,
        MAX_SYNC_IDENTITY_BYTES,
    )?
    else {
        return Ok(None);
    };
    let identity: StoredSyncIdentity = serde_json::from_slice(&bytes)
        .map_err(|_| "The saved encrypted-sync identity is malformed.".to_string())?;
    if identity.version != 1
        || identity.label.chars().count() > 200
        || identity.label.chars().any(char::is_control)
        || identity.private_key_base64.len() > 128
    {
        return Err("The saved encrypted-sync identity is invalid.".into());
    }
    let private_key = decode::<32>(&identity.private_key_base64, "sync identity private key")?;
    Ok(Some((identity, StaticSecret::from(private_key))))
}

fn sync_identity_from_parts(
    identity: &StoredSyncIdentity,
    secret: &StaticSecret,
) -> Result<SyncIdentity, String> {
    let public_key = X25519PublicKey::from(secret).to_bytes();
    let recipient = SyncRecipient {
        id: sync_recipient_id(&public_key),
        label: if identity.label.trim().is_empty() {
            "Local collaborator".into()
        } else {
            identity.label.trim().to_string()
        },
        public_key_base64: BASE64.encode(public_key),
    };
    let invite = SyncRecipientInvite {
        version: 1,
        label: recipient.label.clone(),
        public_key_base64: recipient.public_key_base64.clone(),
    };
    let source = serde_json::to_vec(&invite)
        .map_err(|error| format!("Unable to encode encrypted-sync invitation: {error}"))?;
    Ok(SyncIdentity {
        recipient,
        invite_code: format!(
            "brunomnia-sync-recipient-v1:{}",
            URL_SAFE_NO_PAD.encode(source)
        ),
    })
}

pub fn sync_identity(label: String) -> Result<SyncIdentity, String> {
    let label = label.trim();
    if label.chars().count() > 200 || label.chars().any(char::is_control) {
        return Err("The encrypted-sync identity label is too long.".into());
    }
    let (mut identity, secret) = match stored_sync_identity()? {
        Some(current) => current,
        None => {
            let random = SystemRandom::new();
            let mut private_key = [0_u8; 32];
            random
                .fill(&mut private_key)
                .map_err(|_| "Unable to generate an encrypted-sync identity.".to_string())?;
            let secret = StaticSecret::from(private_key);
            (
                StoredSyncIdentity {
                    version: 1,
                    label: if label.is_empty() {
                        "Local collaborator".into()
                    } else {
                        label.to_string()
                    },
                    private_key_base64: BASE64.encode(private_key),
                },
                secret,
            )
        }
    };
    if !label.is_empty() {
        identity.label = label.to_string();
    }
    let encoded = serde_json::to_vec(&identity)
        .map_err(|error| format!("Unable to encode encrypted-sync identity: {error}"))?;
    platform_keyring::write(
        SYNC_IDENTITY_SERVICE,
        SYNC_IDENTITY_ACCOUNT,
        &encoded,
        MAX_SYNC_IDENTITY_BYTES,
    )?;
    sync_identity_from_parts(&identity, &secret)
}

pub fn sync_recipient_from_invite(invite_code: String) -> Result<SyncRecipient, String> {
    let encoded = invite_code
        .trim()
        .strip_prefix("brunomnia-sync-recipient-v1:")
        .ok_or_else(|| {
            "The encrypted-sync recipient invitation has an unsupported format.".to_string()
        })?;
    if encoded.len() > 4_096 {
        return Err("The encrypted-sync recipient invitation is too large.".into());
    }
    let source = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| "The encrypted-sync recipient invitation is malformed.".to_string())?;
    if source.len() > 2_048 {
        return Err("The encrypted-sync recipient invitation is too large.".into());
    }
    let invite: SyncRecipientInvite = serde_json::from_slice(&source)
        .map_err(|_| "The encrypted-sync recipient invitation is malformed.".to_string())?;
    if invite.version != 1 {
        return Err("The encrypted-sync recipient invitation has an unsupported version.".into());
    }
    validate_sync_recipient(&SyncRecipient {
        id: String::new(),
        label: invite.label,
        public_key_base64: invite.public_key_base64,
    })
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

fn derive_sync_wrap_key(
    shared_secret: &[u8; 32],
    ephemeral_public_key: &[u8; 32],
    recipient_public_key: &[u8; 32],
) -> Result<[u8; 32], String> {
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, SYNC_KEY_WRAP_AAD);
    let key_material = salt.extract(shared_secret);
    let info = [
        ephemeral_public_key.as_slice(),
        recipient_public_key.as_slice(),
    ];
    let key = key_material
        .expand(&info, SyncKeyLength)
        .map_err(|_| "Unable to derive an encrypted-sync recipient key.".to_string())?;
    let mut output = [0_u8; 32];
    key.fill(&mut output)
        .map_err(|_| "Unable to derive an encrypted-sync recipient key.".to_string())?;
    Ok(output)
}

fn encrypt_with_key(
    plaintext: &[u8],
    key_bytes: &[u8; 32],
    aad: &[u8],
) -> Result<([u8; 12], Vec<u8>), String> {
    let random = SystemRandom::new();
    let mut nonce_bytes = [0_u8; 12];
    random
        .fill(&mut nonce_bytes)
        .map_err(|_| "Unable to generate an encryption nonce.".to_string())?;
    let unbound = UnboundKey::new(&AES_256_GCM, key_bytes)
        .map_err(|_| "Unable to initialize encrypted-sync encryption.".to_string())?;
    let key = LessSafeKey::new(unbound);
    let mut ciphertext = plaintext.to_vec();
    key.seal_in_place_append_tag(
        Nonce::assume_unique_for_key(nonce_bytes),
        Aad::from(aad),
        &mut ciphertext,
    )
    .map_err(|_| "Unable to encrypt sync data.".to_string())?;
    Ok((nonce_bytes, ciphertext))
}

fn decrypt_with_key<'a>(
    ciphertext: &'a mut [u8],
    key_bytes: &[u8; 32],
    nonce_bytes: [u8; 12],
    aad: &[u8],
) -> Result<&'a [u8], String> {
    let unbound = UnboundKey::new(&AES_256_GCM, key_bytes)
        .map_err(|_| "Unable to initialize encrypted-sync decryption.".to_string())?;
    LessSafeKey::new(unbound)
        .open_in_place(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::from(aad),
            ciphertext,
        )
        .map(|plaintext| &*plaintext)
        .map_err(|_| {
            "The encrypted sync file was modified or this device is not a recipient.".into()
        })
}

fn encrypt_for_recipients<T: Serialize>(
    value: &T,
    recipients: &[SyncRecipient],
) -> Result<RecipientSyncEnvelope, String> {
    let recipients = validate_sync_recipients(recipients)?;
    let random = SystemRandom::new();
    let mut content_key = [0_u8; 32];
    random
        .fill(&mut content_key)
        .map_err(|_| "Unable to generate an encrypted-sync content key.".to_string())?;
    let mut wrapped_recipients = Vec::with_capacity(recipients.len());
    for recipient in &recipients {
        let recipient_public_bytes =
            decode::<32>(&recipient.public_key_base64, "recipient public key")?;
        let recipient_public = X25519PublicKey::from(recipient_public_bytes);
        let mut ephemeral_private_bytes = [0_u8; 32];
        random
            .fill(&mut ephemeral_private_bytes)
            .map_err(|_| "Unable to generate an encrypted-sync wrapping key.".to_string())?;
        let ephemeral_private = StaticSecret::from(ephemeral_private_bytes);
        let ephemeral_public = X25519PublicKey::from(&ephemeral_private).to_bytes();
        let shared_secret = ephemeral_private.diffie_hellman(&recipient_public);
        if !shared_secret.was_contributory() {
            return Err("An encrypted-sync recipient public key is unsafe.".into());
        }
        let mut wrap_key = derive_sync_wrap_key(
            shared_secret.as_bytes(),
            &ephemeral_public,
            &recipient_public_bytes,
        )?;
        let wrap_aad = [SYNC_KEY_WRAP_AAD, recipient.id.as_bytes()].concat();
        let (wrap_nonce, wrapped_key) = encrypt_with_key(&content_key, &wrap_key, &wrap_aad)?;
        wrap_key.fill(0);
        wrapped_recipients.push(WrappedSyncKey {
            id: recipient.id.clone(),
            label: recipient.label.clone(),
            public_key_base64: recipient.public_key_base64.clone(),
            ephemeral_public_key_base64: BASE64.encode(ephemeral_public),
            nonce_base64: BASE64.encode(wrap_nonce),
            wrapped_key_base64: BASE64.encode(wrapped_key),
        });
    }
    let plaintext = serde_json::to_vec(value)
        .map_err(|error| format!("Unable to encode secure data: {error}"))?;
    let content_aad = sync_recipient_content_aad(&recipients)?;
    let (nonce, ciphertext) = encrypt_with_key(&plaintext, &content_key, &content_aad)?;
    content_key.fill(0);
    Ok(RecipientSyncEnvelope {
        version: 2,
        kind: "sync".into(),
        nonce_base64: BASE64.encode(nonce),
        ciphertext_base64: BASE64.encode(ciphertext),
        updated_at: Utc::now().to_rfc3339(),
        recipients: wrapped_recipients,
    })
}

fn sync_recipient_content_aad(recipients: &[SyncRecipient]) -> Result<Vec<u8>, String> {
    let recipients = validate_sync_recipients(recipients)?;
    let encoded = serde_json::to_vec(&recipients)
        .map_err(|error| format!("Unable to authenticate encrypted-sync recipients: {error}"))?;
    let mut aad = SYNC_RECIPIENT_AAD.to_vec();
    aad.extend_from_slice(&encoded);
    Ok(aad)
}

fn decrypt_recipient_sync<T: DeserializeOwned>(
    envelope: &RecipientSyncEnvelope,
) -> Result<T, String> {
    if envelope.version != 2
        || envelope.kind != "sync"
        || envelope.recipients.is_empty()
        || envelope.recipients.len() > MAX_SYNC_RECIPIENTS
    {
        return Err("This encrypted file is not a supported recipient sync envelope.".into());
    }
    let Some((stored_identity, private_key)) = stored_sync_identity()? else {
        return Err(
            "This device has no operating-system-protected encrypted-sync identity.".into(),
        );
    };
    let identity = sync_identity_from_parts(&stored_identity, &private_key)?;
    let wrapped = envelope
        .recipients
        .iter()
        .find(|recipient| {
            recipient.id == identity.recipient.id
                && recipient.public_key_base64 == identity.recipient.public_key_base64
        })
        .ok_or_else(|| {
            "This device is not an active recipient of the encrypted sync file.".to_string()
        })?;
    let validated = validate_sync_recipient(&SyncRecipient {
        id: wrapped.id.clone(),
        label: wrapped.label.clone(),
        public_key_base64: wrapped.public_key_base64.clone(),
    })?;
    if validated.id != identity.recipient.id {
        return Err("The encrypted-sync recipient metadata is inconsistent.".into());
    }
    let recipient_public = decode::<32>(
        &identity.recipient.public_key_base64,
        "recipient public key",
    )?;
    let ephemeral_public =
        decode::<32>(&wrapped.ephemeral_public_key_base64, "ephemeral public key")?;
    let shared_secret = private_key.diffie_hellman(&X25519PublicKey::from(ephemeral_public));
    if !shared_secret.was_contributory() {
        return Err("The encrypted-sync wrapping key is unsafe.".into());
    }
    let mut wrap_key = derive_sync_wrap_key(
        shared_secret.as_bytes(),
        &ephemeral_public,
        &recipient_public,
    )?;
    let wrap_nonce = decode::<12>(&wrapped.nonce_base64, "wrapped-key nonce")?;
    let mut wrapped_key = BASE64
        .decode(&wrapped.wrapped_key_base64)
        .map_err(|_| "The encrypted wrapped key is invalid.".to_string())?;
    let wrap_aad = [SYNC_KEY_WRAP_AAD, wrapped.id.as_bytes()].concat();
    let content_key = decrypt_with_key(&mut wrapped_key, &wrap_key, wrap_nonce, &wrap_aad)?;
    let mut content_key: [u8; 32] = content_key
        .try_into()
        .map_err(|_| "The encrypted content key has the wrong length.".to_string())?;
    wrap_key.fill(0);
    let nonce = decode::<12>(&envelope.nonce_base64, "sync nonce")?;
    let mut ciphertext = BASE64
        .decode(&envelope.ciphertext_base64)
        .map_err(|_| "The encrypted sync ciphertext is invalid.".to_string())?;
    let content_aad = sync_recipient_content_aad(
        &envelope
            .recipients
            .iter()
            .map(|recipient| SyncRecipient {
                id: recipient.id.clone(),
                label: recipient.label.clone(),
                public_key_base64: recipient.public_key_base64.clone(),
            })
            .collect::<Vec<_>>(),
    )?;
    let plaintext = decrypt_with_key(&mut ciphertext, &content_key, nonce, &content_aad)?;
    content_key.fill(0);
    serde_json::from_slice(plaintext)
        .map_err(|error| format!("The decrypted sync data is invalid: {error}"))
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

fn read_secure_file<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
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

fn read_envelope(path: &Path) -> Result<EncryptedEnvelope, String> {
    read_secure_file(path)
}

fn write_private<T: Serialize>(path: &Path, envelope: &T) -> Result<(), String> {
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

pub fn sync_status(path: String) -> Result<SyncFileStatus, String> {
    let path = sync_path(&path)?;
    if !path.exists() {
        return Ok(SyncFileStatus {
            exists: false,
            updated_at: String::new(),
            encryption_mode: "none".into(),
            recipients: Vec::new(),
        });
    }
    let value: Value = read_secure_file(&path)?;
    match value.get("version").and_then(Value::as_u64) {
        Some(1) => {
            let envelope: EncryptedEnvelope = serde_json::from_value(value)
                .map_err(|_| "The passphrase sync envelope is invalid.".to_string())?;
            if envelope.kind != "sync" {
                return Err("The sync path contains another encrypted file type.".into());
            }
            Ok(SyncFileStatus {
                exists: true,
                updated_at: envelope.updated_at,
                encryption_mode: "passphrase".into(),
                recipients: Vec::new(),
            })
        }
        Some(2) => {
            let envelope: RecipientSyncEnvelope = serde_json::from_value(value)
                .map_err(|_| "The recipient sync envelope is invalid.".to_string())?;
            if envelope.kind != "sync" {
                return Err("The sync path contains another encrypted file type.".into());
            }
            let recipients = validate_sync_recipients(
                &envelope
                    .recipients
                    .iter()
                    .map(|recipient| SyncRecipient {
                        id: recipient.id.clone(),
                        label: recipient.label.clone(),
                        public_key_base64: recipient.public_key_base64.clone(),
                    })
                    .collect::<Vec<_>>(),
            )?;
            Ok(SyncFileStatus {
                exists: true,
                updated_at: envelope.updated_at,
                encryption_mode: "recipients".into(),
                recipients,
            })
        }
        _ => Err("This encrypted sync file uses an unsupported envelope version.".into()),
    }
}

pub fn sync_pull(path: String, passphrase: String) -> Result<SyncPayload, String> {
    let value: Value = read_secure_file(&sync_path(&path)?)?;
    match value.get("version").and_then(Value::as_u64) {
        Some(1) => {
            let envelope: EncryptedEnvelope = serde_json::from_value(value)
                .map_err(|_| "The passphrase sync envelope is invalid.".to_string())?;
            decrypt(&envelope, &passphrase, "sync", SYNC_AAD)
        }
        Some(2) => {
            let envelope: RecipientSyncEnvelope = serde_json::from_value(value)
                .map_err(|_| "The recipient sync envelope is invalid.".to_string())?;
            decrypt_recipient_sync(&envelope)
        }
        _ => Err("This encrypted sync file uses an unsupported envelope version.".into()),
    }
}

pub fn sync_push(input: SyncPushInput) -> Result<SyncPayload, String> {
    let path = sync_path(&input.path)?;
    let current_status = if path.exists() {
        Some(sync_status(input.path.clone())?)
    } else {
        None
    };
    if current_status
        .as_ref()
        .is_some_and(|status| status.encryption_mode == "recipients")
        && !input.recipient_encryption
    {
        return Err(
            "Recipient-encrypted sync files cannot be downgraded to a shared passphrase.".into(),
        );
    }
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
        repository: input.repository,
    };
    if input.recipient_encryption {
        let recipients = validate_sync_recipients(&input.recipients)?;
        let local_identity = sync_identity(String::new())?;
        if !recipients
            .iter()
            .any(|recipient| recipient.id == local_identity.recipient.id)
        {
            return Err(
                "Keep this device in the recipient list before rotating the sync key.".into(),
            );
        }
        let envelope = encrypt_for_recipients(&payload, &recipients)?;
        write_private(&path, &envelope)?;
    } else {
        let envelope = encrypt(&payload, &input.passphrase, "sync", SYNC_AAD)?;
        write_private(&path, &envelope)?;
    }
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
            repository: serde_json::json!({"version":1,"activeBranches":{"collection:orders":"main"},"branches":[],"commits":[]}),
            recipient_encryption: false,
            recipients: Vec::new(),
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
            repository: empty_sync_repository(),
            recipient_encryption: false,
            recipients: Vec::new(),
        })
        .unwrap_err();
        assert!(conflict.contains("remote revision 1"));
        let pulled = sync_pull(
            path.to_string_lossy().into_owned(),
            "shared passphrase for testing".into(),
        )
        .unwrap();
        assert_eq!(pulled.workspace["name"], "One");
        assert_eq!(
            pulled.repository["activeBranches"]["collection:orders"],
            "main"
        );
    }

    #[test]
    fn rotates_recipient_keys_and_revokes_removed_public_keys() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("recipient-sync.json");
        platform_keyring::delete(
            SYNC_IDENTITY_SERVICE,
            SYNC_IDENTITY_ACCOUNT,
            MAX_SYNC_IDENTITY_BYTES,
        )
        .unwrap();
        let identity = sync_identity("Avery's Mac".into()).unwrap();
        assert_eq!(
            sync_recipient_from_invite(identity.invite_code.clone()).unwrap(),
            identity.recipient
        );
        let first = sync_push(SyncPushInput {
            path: path.to_string_lossy().into_owned(),
            passphrase: String::new(),
            actor: "Avery".into(),
            base_revision: 0,
            force: false,
            workspace: serde_json::json!({"name":"Recipient encrypted"}),
            repository: empty_sync_repository(),
            recipient_encryption: true,
            recipients: vec![identity.recipient.clone()],
        })
        .unwrap();
        assert_eq!(first.revision, 1);
        let source = fs::read_to_string(&path).unwrap();
        assert!(!source.contains("Recipient encrypted"));
        let status = sync_status(path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(status.encryption_mode, "recipients");
        assert_eq!(status.recipients, vec![identity.recipient.clone()]);
        assert_eq!(
            sync_pull(path.to_string_lossy().into_owned(), String::new())
                .unwrap()
                .workspace["name"],
            "Recipient encrypted"
        );
        let original_envelope = fs::read_to_string(&path).unwrap();
        let mut modified_envelope: Value = serde_json::from_str(&original_envelope).unwrap();
        modified_envelope["recipients"][0]["label"] = Value::String("Mallory".into());
        fs::write(
            &path,
            serde_json::to_vec_pretty(&modified_envelope).unwrap(),
        )
        .unwrap();
        assert!(
            sync_pull(path.to_string_lossy().into_owned(), String::new())
                .unwrap_err()
                .contains("modified")
        );
        fs::write(&path, original_envelope).unwrap();

        let other_secret = StaticSecret::from([7_u8; 32]);
        let other_public = X25519PublicKey::from(&other_secret).to_bytes();
        let other = SyncRecipient {
            id: sync_recipient_id(&other_public),
            label: "Blake's PC".into(),
            public_key_base64: BASE64.encode(other_public),
        };
        sync_push(SyncPushInput {
            path: path.to_string_lossy().into_owned(),
            passphrase: String::new(),
            actor: "Avery".into(),
            base_revision: 1,
            force: false,
            workspace: serde_json::json!({"name":"Two recipients"}),
            repository: empty_sync_repository(),
            recipient_encryption: true,
            recipients: vec![identity.recipient.clone(), other],
        })
        .unwrap();
        assert_eq!(
            sync_status(path.to_string_lossy().into_owned())
                .unwrap()
                .recipients
                .len(),
            2
        );
        sync_push(SyncPushInput {
            path: path.to_string_lossy().into_owned(),
            passphrase: String::new(),
            actor: "Avery".into(),
            base_revision: 2,
            force: false,
            workspace: serde_json::json!({"name":"Rotated after revocation"}),
            repository: empty_sync_repository(),
            recipient_encryption: true,
            recipients: vec![identity.recipient.clone()],
        })
        .unwrap();
        assert_eq!(
            sync_status(path.to_string_lossy().into_owned())
                .unwrap()
                .recipients,
            vec![identity.recipient]
        );
        platform_keyring::delete(
            SYNC_IDENTITY_SERVICE,
            SYNC_IDENTITY_ACCOUNT,
            MAX_SYNC_IDENTITY_BYTES,
        )
        .unwrap();
    }
}

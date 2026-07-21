#[cfg(not(test))]
use crate::platform_keyring;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ring::{
    aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM},
    rand::{SecureRandom, SystemRandom},
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
#[cfg(not(test))]
use std::sync::OnceLock;
use std::{collections::HashMap, sync::Mutex};

const ENVELOPE_FIELD: &str = "protectedRuntimeCredentials";
const ENVELOPE_VERSION: u8 = 1;
const PAYLOAD_VERSION: u8 = 1;
const ALGORITHM: &str = "AES-256-GCM";
const KEY_PROVIDER: &str = "OS credential store";
const LEGACY_KEY_PROVIDER: &str = "macOS Keychain";
#[cfg(not(test))]
const KEYCHAIN_SERVICE: &str = "dev.brunomnia.desktop.runtime-credentials";
#[cfg(not(test))]
const KEYCHAIN_ACCOUNT: &str = "workspace-master-key-v1";
const MASTER_KEY_BYTES: usize = 32;
const NONCE_BYTES: usize = 12;
const TAG_BYTES: usize = 16;
const MAX_PAYLOAD_BYTES: usize = 5_000_000;
const MAX_ENCODED_CIPHERTEXT_BYTES: usize = 7_000_000;
#[cfg(not(test))]
static KEYCHAIN_LOCK: Mutex<()> = Mutex::new(());
#[cfg(not(test))]
static MASTER_KEY_CACHE: OnceLock<[u8; MASTER_KEY_BYTES]> = OnceLock::new();
#[cfg(test)]
static TEST_MASTER_KEY: Mutex<Option<[u8; MASTER_KEY_BYTES]>> = Mutex::new(None);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CredentialEnvelope {
    version: u8,
    algorithm: String,
    key_provider: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OAuthRuntime {
    collection_id: String,
    owner_type: String,
    owner_id: String,
    code: String,
    code_verifier: String,
    access_token: String,
    identity_token: String,
    refresh_token: String,
    expires_at: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct McpOAuthRuntime {
    client_id: String,
    access_token: String,
    refresh_token: String,
    identity_token: String,
    expires_at: u64,
    registered_client_id: String,
    registered_client_secret: String,
    registered_client_id_issued_at: u64,
    registered_client_secret_expires_at: u64,
    registered_token_endpoint_auth_method: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GitRuntime {
    credential_id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    provider: String,
    #[serde(default)]
    username: String,
    token: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RuntimeCredentialPayload {
    version: u8,
    oauth: Vec<OAuthRuntime>,
    mcp_oauth: Vec<McpOAuthRuntime>,
    #[serde(default)]
    git: Vec<GitRuntime>,
}

fn string_field(value: &Map<String, Value>, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn timestamp_field(value: &Map<String, Value>, key: &str) -> u64 {
    value
        .get(key)
        .and_then(|value| {
            value.as_u64().or_else(|| {
                value
                    .as_f64()
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .map(|value| value.trunc() as u64)
            })
        })
        .unwrap_or_default()
}

fn set_string(value: &mut Map<String, Value>, key: &str, field: String) {
    value.insert(key.into(), Value::String(field));
}

fn set_timestamp(value: &mut Map<String, Value>, key: &str, field: u64) {
    value.insert(key.into(), Value::from(field));
}

fn extract_auth_runtime(
    auth: &mut Map<String, Value>,
    collection_id: &str,
    owner_type: &str,
    owner_id: &str,
) -> Option<OAuthRuntime> {
    let runtime = OAuthRuntime {
        collection_id: collection_id.into(),
        owner_type: owner_type.into(),
        owner_id: owner_id.into(),
        code: string_field(auth, "code"),
        code_verifier: string_field(auth, "codeVerifier"),
        access_token: string_field(auth, "accessToken"),
        identity_token: string_field(auth, "identityToken"),
        refresh_token: string_field(auth, "refreshToken"),
        expires_at: timestamp_field(auth, "expiresAt"),
    };
    for key in [
        "code",
        "codeVerifier",
        "accessToken",
        "identityToken",
        "refreshToken",
    ] {
        set_string(auth, key, String::new());
    }
    set_timestamp(auth, "expiresAt", 0);
    (!runtime.code.is_empty()
        || !runtime.code_verifier.is_empty()
        || !runtime.access_token.is_empty()
        || !runtime.identity_token.is_empty()
        || !runtime.refresh_token.is_empty()
        || runtime.expires_at > 0)
        .then_some(runtime)
}

fn extract_mcp_runtime(client: &mut Map<String, Value>) -> Option<McpOAuthRuntime> {
    let oauth = client.get("authType").and_then(Value::as_str) == Some("oauth2");
    let runtime = McpOAuthRuntime {
        client_id: string_field(client, "id"),
        access_token: if oauth {
            string_field(client, "token")
        } else {
            String::new()
        },
        refresh_token: string_field(client, "oauthRefreshToken"),
        identity_token: string_field(client, "oauthIdentityToken"),
        expires_at: timestamp_field(client, "oauthExpiresAt"),
        registered_client_id: string_field(client, "oauthRegisteredClientId"),
        registered_client_secret: string_field(client, "oauthRegisteredClientSecret"),
        registered_client_id_issued_at: timestamp_field(client, "oauthRegisteredClientIdIssuedAt"),
        registered_client_secret_expires_at: timestamp_field(
            client,
            "oauthRegisteredClientSecretExpiresAt",
        ),
        registered_token_endpoint_auth_method: string_field(
            client,
            "oauthRegisteredTokenEndpointAuthMethod",
        ),
    };
    if oauth {
        set_string(client, "token", String::new());
    }
    for key in [
        "oauthRefreshToken",
        "oauthIdentityToken",
        "oauthRegisteredClientId",
        "oauthRegisteredClientSecret",
    ] {
        set_string(client, key, String::new());
    }
    for key in [
        "oauthExpiresAt",
        "oauthRegisteredClientIdIssuedAt",
        "oauthRegisteredClientSecretExpiresAt",
    ] {
        set_timestamp(client, key, 0);
    }
    set_string(
        client,
        "oauthRegisteredTokenEndpointAuthMethod",
        "none".into(),
    );
    (!runtime.access_token.is_empty()
        || !runtime.refresh_token.is_empty()
        || !runtime.identity_token.is_empty()
        || runtime.expires_at > 0
        || !runtime.registered_client_id.is_empty()
        || !runtime.registered_client_secret.is_empty()
        || runtime.registered_client_id_issued_at > 0
        || runtime.registered_client_secret_expires_at > 0
        || !matches!(
            runtime.registered_token_endpoint_auth_method.as_str(),
            "" | "none"
        ))
    .then_some(runtime)
}

fn extract_runtime_credentials(workspace: &mut Value) -> RuntimeCredentialPayload {
    let mut payload = RuntimeCredentialPayload {
        version: PAYLOAD_VERSION,
        ..RuntimeCredentialPayload::default()
    };
    let Some(workspace) = workspace.as_object_mut() else {
        return payload;
    };
    workspace.remove(ENVELOPE_FIELD);
    if let Some(collections) = workspace
        .get_mut("collections")
        .and_then(Value::as_array_mut)
    {
        for collection in collections {
            let Some(collection) = collection.as_object_mut() else {
                continue;
            };
            let collection_id = string_field(collection, "id");
            if let Some(requests) = collection.get_mut("requests").and_then(Value::as_array_mut) {
                for request in requests {
                    let Some(request) = request.as_object_mut() else {
                        continue;
                    };
                    let owner_id = string_field(request, "id");
                    if let Some(runtime) = request
                        .get_mut("auth")
                        .and_then(Value::as_object_mut)
                        .and_then(|auth| {
                            extract_auth_runtime(auth, &collection_id, "request", &owner_id)
                        })
                    {
                        payload.oauth.push(runtime);
                    }
                }
            }
            if let Some(folders) = collection.get_mut("folders").and_then(Value::as_array_mut) {
                for folder in folders {
                    let Some(folder) = folder.as_object_mut() else {
                        continue;
                    };
                    let owner_id = string_field(folder, "id");
                    if let Some(runtime) = folder
                        .get_mut("auth")
                        .and_then(Value::as_object_mut)
                        .and_then(|auth| {
                            extract_auth_runtime(auth, &collection_id, "folder", &owner_id)
                        })
                    {
                        payload.oauth.push(runtime);
                    }
                }
            }
        }
    }
    if let Some(clients) = workspace
        .get_mut("mcpClients")
        .and_then(Value::as_array_mut)
    {
        for client in clients {
            if let Some(runtime) = client.as_object_mut().and_then(extract_mcp_runtime) {
                payload.mcp_oauth.push(runtime);
            }
        }
    }
    if let Some(credentials) = workspace
        .get_mut("project")
        .and_then(Value::as_object_mut)
        .and_then(|project| project.get_mut("gitCredentials"))
        .and_then(Value::as_array_mut)
    {
        for credential in credentials {
            let Some(credential) = credential.as_object_mut() else {
                continue;
            };
            let runtime = GitRuntime {
                credential_id: string_field(credential, "id"),
                name: string_field(credential, "name"),
                provider: string_field(credential, "provider"),
                username: string_field(credential, "username"),
                token: string_field(credential, "token"),
            };
            if !runtime.credential_id.is_empty() && !runtime.token.is_empty() {
                set_string(credential, "name", String::new());
                set_string(credential, "provider", String::new());
                set_string(credential, "username", String::new());
                set_string(credential, "token", String::new());
                payload.git.push(runtime);
            }
        }
    }
    payload
}

fn hydrate_auth_runtime(auth: &mut Map<String, Value>, runtime: OAuthRuntime) {
    if auth.get("type").and_then(Value::as_str) != Some("oauth2") {
        return;
    }
    set_string(auth, "code", runtime.code);
    set_string(auth, "codeVerifier", runtime.code_verifier);
    set_string(auth, "accessToken", runtime.access_token);
    set_string(auth, "identityToken", runtime.identity_token);
    set_string(auth, "refreshToken", runtime.refresh_token);
    set_timestamp(auth, "expiresAt", runtime.expires_at);
}

fn hydrate_mcp_runtime(client: &mut Map<String, Value>, runtime: McpOAuthRuntime) {
    if client.get("authType").and_then(Value::as_str) != Some("oauth2") {
        return;
    }
    set_string(client, "token", runtime.access_token);
    set_string(client, "oauthRefreshToken", runtime.refresh_token);
    set_string(client, "oauthIdentityToken", runtime.identity_token);
    set_timestamp(client, "oauthExpiresAt", runtime.expires_at);
    set_string(
        client,
        "oauthRegisteredClientId",
        runtime.registered_client_id,
    );
    set_string(
        client,
        "oauthRegisteredClientSecret",
        runtime.registered_client_secret,
    );
    set_timestamp(
        client,
        "oauthRegisteredClientIdIssuedAt",
        runtime.registered_client_id_issued_at,
    );
    set_timestamp(
        client,
        "oauthRegisteredClientSecretExpiresAt",
        runtime.registered_client_secret_expires_at,
    );
    set_string(
        client,
        "oauthRegisteredTokenEndpointAuthMethod",
        runtime.registered_token_endpoint_auth_method,
    );
}

fn hydrate_runtime_credentials(workspace: &mut Value, payload: RuntimeCredentialPayload) {
    let Some(workspace) = workspace.as_object_mut() else {
        return;
    };
    let mut oauth = payload
        .oauth
        .into_iter()
        .map(|runtime| {
            (
                (
                    runtime.collection_id.clone(),
                    runtime.owner_type.clone(),
                    runtime.owner_id.clone(),
                ),
                runtime,
            )
        })
        .collect::<HashMap<_, _>>();
    if let Some(collections) = workspace
        .get_mut("collections")
        .and_then(Value::as_array_mut)
    {
        for collection in collections {
            let Some(collection) = collection.as_object_mut() else {
                continue;
            };
            let collection_id = string_field(collection, "id");
            for (owner_type, key) in [("request", "requests"), ("folder", "folders")] {
                let Some(owners) = collection.get_mut(key).and_then(Value::as_array_mut) else {
                    continue;
                };
                for owner in owners {
                    let Some(owner) = owner.as_object_mut() else {
                        continue;
                    };
                    let owner_id = string_field(owner, "id");
                    let Some(runtime) =
                        oauth.remove(&(collection_id.clone(), owner_type.into(), owner_id))
                    else {
                        continue;
                    };
                    if let Some(auth) = owner.get_mut("auth").and_then(Value::as_object_mut) {
                        hydrate_auth_runtime(auth, runtime);
                    }
                }
            }
        }
    }
    let mut mcp = payload
        .mcp_oauth
        .into_iter()
        .map(|runtime| (runtime.client_id.clone(), runtime))
        .collect::<HashMap<_, _>>();
    if let Some(clients) = workspace
        .get_mut("mcpClients")
        .and_then(Value::as_array_mut)
    {
        for client in clients {
            let Some(client) = client.as_object_mut() else {
                continue;
            };
            if let Some(runtime) = mcp.remove(&string_field(client, "id")) {
                hydrate_mcp_runtime(client, runtime);
            }
        }
    }
    let mut git = payload
        .git
        .into_iter()
        .map(|runtime| (runtime.credential_id.clone(), runtime))
        .collect::<HashMap<_, _>>();
    if let Some(credentials) = workspace
        .get_mut("project")
        .and_then(Value::as_object_mut)
        .and_then(|project| project.get_mut("gitCredentials"))
        .and_then(Value::as_array_mut)
    {
        for credential in credentials {
            let Some(credential) = credential.as_object_mut() else {
                continue;
            };
            if let Some(runtime) = git.remove(&string_field(credential, "id")) {
                set_string(credential, "name", runtime.name);
                set_string(credential, "provider", runtime.provider);
                set_string(credential, "username", runtime.username);
                set_string(credential, "token", runtime.token);
            }
        }
    }
}

fn associated_data(workspace_id: &str) -> Vec<u8> {
    format!("brunomnia-runtime-credentials-v1\0{workspace_id}").into_bytes()
}

fn encrypt_payload(
    workspace_id: &str,
    payload: &RuntimeCredentialPayload,
    key: &[u8; MASTER_KEY_BYTES],
) -> Result<CredentialEnvelope, String> {
    let mut plaintext = serde_json::to_vec(payload).map_err(|error| error.to_string())?;
    if plaintext.len() > MAX_PAYLOAD_BYTES {
        return Err("Runtime credentials exceed the protected storage limit.".into());
    }
    let mut nonce_bytes = [0_u8; NONCE_BYTES];
    SystemRandom::new().fill(&mut nonce_bytes).map_err(|_| {
        "The operating system could not generate credential randomness.".to_string()
    })?;
    let key = LessSafeKey::new(
        UnboundKey::new(&AES_256_GCM, key)
            .map_err(|_| "The runtime credential key is invalid.".to_string())?,
    );
    key.seal_in_place_append_tag(
        Nonce::assume_unique_for_key(nonce_bytes),
        Aad::from(associated_data(workspace_id)),
        &mut plaintext,
    )
    .map_err(|_| "Runtime credentials could not be encrypted.".to_string())?;
    Ok(CredentialEnvelope {
        version: ENVELOPE_VERSION,
        algorithm: ALGORITHM.into(),
        key_provider: KEY_PROVIDER.into(),
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(plaintext),
    })
}

fn decrypt_payload(
    workspace_id: &str,
    envelope: CredentialEnvelope,
    key: &[u8; MASTER_KEY_BYTES],
) -> Result<RuntimeCredentialPayload, String> {
    if envelope.version != ENVELOPE_VERSION
        || envelope.algorithm != ALGORITHM
        || !matches!(
            envelope.key_provider.as_str(),
            KEY_PROVIDER | LEGACY_KEY_PROVIDER
        )
        || envelope.nonce.len() > 64
        || envelope.ciphertext.len() > MAX_ENCODED_CIPHERTEXT_BYTES
    {
        return Err("The protected runtime credential envelope is unsupported or invalid.".into());
    }
    let nonce = BASE64
        .decode(envelope.nonce)
        .map_err(|_| "The protected runtime credential nonce is invalid.".to_string())?;
    let nonce: [u8; NONCE_BYTES] = nonce
        .try_into()
        .map_err(|_| "The protected runtime credential nonce is invalid.".to_string())?;
    let mut ciphertext = BASE64
        .decode(envelope.ciphertext)
        .map_err(|_| "The protected runtime credential payload is invalid.".to_string())?;
    if ciphertext.len() < TAG_BYTES || ciphertext.len() > MAX_PAYLOAD_BYTES + TAG_BYTES {
        return Err("The protected runtime credential payload is invalid.".into());
    }
    let key = LessSafeKey::new(
        UnboundKey::new(&AES_256_GCM, key)
            .map_err(|_| "The runtime credential key is invalid.".to_string())?,
    );
    let plaintext = key
        .open_in_place(
            Nonce::assume_unique_for_key(nonce),
            Aad::from(associated_data(workspace_id)),
            &mut ciphertext,
        )
        .map_err(|_| {
            "Protected runtime credentials could not be authenticated with this device key."
                .to_string()
        })?;
    let payload: RuntimeCredentialPayload = serde_json::from_slice(plaintext)
        .map_err(|_| "The authenticated runtime credential payload is malformed.".to_string())?;
    if payload.version != PAYLOAD_VERSION {
        return Err("The protected runtime credential payload version is unsupported.".into());
    }
    Ok(payload)
}

#[cfg(test)]
pub(crate) fn set_test_master_key(key: [u8; MASTER_KEY_BYTES]) {
    *TEST_MASTER_KEY.lock().unwrap() = Some(key);
}

#[cfg(test)]
fn test_master_key() -> Option<[u8; MASTER_KEY_BYTES]> {
    *TEST_MASTER_KEY.lock().unwrap()
}

#[cfg(test)]
fn master_key() -> Result<[u8; MASTER_KEY_BYTES], String> {
    test_master_key().ok_or_else(|| "The runtime credential test key is unavailable.".into())
}

#[cfg(all(not(test), target_os = "macos"))]
fn legacy_master_key() -> Result<Option<Vec<u8>>, String> {
    use security_framework::passwords::get_generic_password;
    const ITEM_NOT_FOUND: i32 = -25_300;
    match get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT) {
        Ok(key) => Ok(Some(key)),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(None),
        Err(error) => Err(format!(
            "The legacy runtime credential key could not be read from macOS Keychain: {error}"
        )),
    }
}

#[cfg(all(not(test), target_os = "macos"))]
fn delete_legacy_master_key() -> Result<(), String> {
    use security_framework::passwords::delete_generic_password;
    const ITEM_NOT_FOUND: i32 = -25_300;
    match delete_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(()),
        Err(error) => Err(format!(
            "The legacy runtime credential key could not be removed from macOS Keychain: {error}"
        )),
    }
}

#[cfg(not(test))]
fn master_key() -> Result<[u8; MASTER_KEY_BYTES], String> {
    if let Some(key) = MASTER_KEY_CACHE.get() {
        return Ok(*key);
    }
    let _guard = KEYCHAIN_LOCK
        .lock()
        .map_err(|_| "The runtime credential-store lock is unavailable.".to_string())?;
    if let Some(key) = MASTER_KEY_CACHE.get() {
        return Ok(*key);
    }
    let stored = platform_keyring::read(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, MASTER_KEY_BYTES)?;
    #[cfg(target_os = "macos")]
    let stored = if stored.is_none() {
        if let Some(legacy) = legacy_master_key()? {
            platform_keyring::write(
                KEYCHAIN_SERVICE,
                KEYCHAIN_ACCOUNT,
                &legacy,
                MASTER_KEY_BYTES,
            )?;
            delete_legacy_master_key()?;
            Some(legacy)
        } else {
            None
        }
    } else {
        stored
    };
    let key = if let Some(stored) = stored {
        stored.try_into().map_err(|_| {
            "The operating-system runtime credential key has an invalid length.".to_string()
        })?
    } else {
        let mut key = [0_u8; MASTER_KEY_BYTES];
        SystemRandom::new().fill(&mut key).map_err(|_| {
            "The operating system could not generate a runtime credential key.".to_string()
        })?;
        platform_keyring::write(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, &key, MASTER_KEY_BYTES)?;
        key
    };
    let _ = MASTER_KEY_CACHE.set(key);
    Ok(key)
}

pub fn is_protected(workspace: &Value) -> bool {
    workspace.get(ENVELOPE_FIELD).is_some()
}

pub fn needs_protection(workspace: &Value) -> bool {
    let mut workspace = workspace.clone();
    let payload = extract_runtime_credentials(&mut workspace);
    !payload.oauth.is_empty() || !payload.mcp_oauth.is_empty() || !payload.git.is_empty()
}

#[cfg(test)]
fn protect_with_key(
    workspace_id: &str,
    workspace: &Value,
    key: &[u8; MASTER_KEY_BYTES],
) -> Result<Value, String> {
    let mut protected = workspace.clone();
    let payload = extract_runtime_credentials(&mut protected);
    if payload.oauth.is_empty() && payload.mcp_oauth.is_empty() && payload.git.is_empty() {
        return Ok(protected);
    }
    let envelope = encrypt_payload(workspace_id, &payload, key)?;
    protected
        .as_object_mut()
        .ok_or_else(|| "The project workspace must be an object.".to_string())?
        .insert(
            ENVELOPE_FIELD.into(),
            serde_json::to_value(envelope).map_err(|error| error.to_string())?,
        );
    Ok(protected)
}

fn unprotect_with_key(
    workspace_id: &str,
    workspace: &Value,
    key: &[u8; MASTER_KEY_BYTES],
) -> Result<Value, String> {
    let mut unprotected = workspace.clone();
    let envelope = unprotected
        .as_object_mut()
        .and_then(|workspace| workspace.remove(ENVELOPE_FIELD));
    let Some(envelope) = envelope else {
        return Ok(unprotected);
    };
    let envelope: CredentialEnvelope = serde_json::from_value(envelope)
        .map_err(|_| "The protected runtime credential envelope is malformed.".to_string())?;
    let payload = decrypt_payload(workspace_id, envelope, key)?;
    hydrate_runtime_credentials(&mut unprotected, payload);
    Ok(unprotected)
}

pub fn protect(workspace_id: &str, workspace: &Value) -> Result<Value, String> {
    let mut protected = workspace.clone();
    let payload = extract_runtime_credentials(&mut protected);
    if payload.oauth.is_empty() && payload.mcp_oauth.is_empty() && payload.git.is_empty() {
        return Ok(protected);
    }
    let envelope = encrypt_payload(workspace_id, &payload, &master_key()?)?;
    protected
        .as_object_mut()
        .ok_or_else(|| "The project workspace must be an object.".to_string())?
        .insert(
            ENVELOPE_FIELD.into(),
            serde_json::to_value(envelope).map_err(|error| error.to_string())?,
        );
    Ok(protected)
}

pub fn unprotect(workspace_id: &str, workspace: &Value) -> Result<Value, String> {
    if !is_protected(workspace) {
        return Ok(workspace.clone());
    }
    unprotect_with_key(workspace_id, workspace, &master_key()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workspace() -> Value {
        serde_json::json!({
            "format": "brunomnia",
            "version": 39,
            "name": "Protected",
            "collections": [{
                "id": "collection-one",
                "requests": [{
                    "id": "request-one",
                    "auth": {
                        "type": "oauth2",
                        "code": "authorization-code",
                        "codeVerifier": "pkce-verifier",
                        "accessToken": "request-access",
                        "identityToken": "request-identity",
                        "refreshToken": "request-refresh",
                        "expiresAt": 123,
                        "tokenPrefix": "Bearer"
                    }
                }],
                "folders": [{
                    "id": "folder-one",
                    "auth": {
                        "type": "oauth2",
                        "code": "",
                        "codeVerifier": "",
                        "accessToken": "folder-access",
                        "identityToken": "",
                        "refreshToken": "",
                        "expiresAt": 456
                    }
                }]
            }],
            "mcpClients": [{
                "id": "mcp-one",
                "authType": "oauth2",
                "token": "mcp-access",
                "oauthRefreshToken": "mcp-refresh",
                "oauthIdentityToken": "mcp-identity",
                "oauthExpiresAt": 789,
                "oauthTokenPrefix": "Bearer",
                "oauthRegisteredClientId": "registered-client",
                "oauthRegisteredClientSecret": "registered-secret",
                "oauthRegisteredClientIdIssuedAt": 111,
                "oauthRegisteredClientSecretExpiresAt": 222,
                "oauthRegisteredTokenEndpointAuthMethod": "client_secret_post"
            }],
            "project": {
                "gitCredentials": [{
                    "id": "github-one",
                    "name": "Work GitHub",
                    "provider": "github",
                    "username": "",
                    "token": "github-access"
                }]
            }
        })
    }

    #[test]
    fn protects_and_restores_request_folder_and_mcp_runtime_credentials() {
        let original = workspace();
        let protected =
            protect_with_key("workspace-one", &original, &[7; MASTER_KEY_BYTES]).unwrap();
        assert!(is_protected(&protected));
        assert_eq!(
            protected["collections"][0]["requests"][0]["auth"]["accessToken"],
            ""
        );
        assert_eq!(
            protected["collections"][0]["folders"][0]["auth"]["accessToken"],
            ""
        );
        assert_eq!(protected["mcpClients"][0]["token"], "");
        assert_eq!(protected["project"]["gitCredentials"][0]["token"], "");
        assert_eq!(protected["project"]["gitCredentials"][0]["provider"], "");
        assert_eq!(
            protected["mcpClients"][0]["oauthRegisteredClientSecret"],
            ""
        );
        let stored = serde_json::to_string(&protected).unwrap();
        for plaintext in [
            "authorization-code",
            "pkce-verifier",
            "request-access",
            "folder-access",
            "mcp-access",
            "registered-secret",
            "github-access",
            "Work GitHub",
        ] {
            assert!(!stored.contains(plaintext));
        }

        let restored =
            unprotect_with_key("workspace-one", &protected, &[7; MASTER_KEY_BYTES]).unwrap();
        assert_eq!(restored, original);
        assert!(!is_protected(&restored));
    }

    #[test]
    fn authenticates_workspace_identity_and_ciphertext() {
        let protected =
            protect_with_key("workspace-one", &workspace(), &[9; MASTER_KEY_BYTES]).unwrap();
        assert!(unprotect_with_key("workspace-two", &protected, &[9; MASTER_KEY_BYTES]).is_err());

        let mut tampered = protected;
        let ciphertext = tampered[ENVELOPE_FIELD]["ciphertext"]
            .as_str()
            .unwrap()
            .to_string();
        tampered[ENVELOPE_FIELD]["ciphertext"] = Value::String(format!("A{ciphertext}"));
        assert!(unprotect_with_key("workspace-one", &tampered, &[9; MASTER_KEY_BYTES]).is_err());
    }

    #[test]
    fn does_not_restore_credentials_after_owner_auth_changes() {
        let protected =
            protect_with_key("workspace-one", &workspace(), &[3; MASTER_KEY_BYTES]).unwrap();
        let mut changed = protected;
        changed["collections"][0]["requests"][0]["auth"]["type"] = "basic".into();
        changed["mcpClients"][0]["authType"] = "bearer".into();

        let restored =
            unprotect_with_key("workspace-one", &changed, &[3; MASTER_KEY_BYTES]).unwrap();
        assert_eq!(
            restored["collections"][0]["requests"][0]["auth"]["accessToken"],
            ""
        );
        assert_eq!(restored["mcpClients"][0]["token"], "");
    }

    #[test]
    fn leaves_workspaces_without_runtime_credentials_unwrapped() {
        let mut value = workspace();
        value["collections"][0]["requests"][0]["auth"]["code"] = "".into();
        value["collections"][0]["requests"][0]["auth"]["codeVerifier"] = "".into();
        value["collections"][0]["requests"][0]["auth"]["accessToken"] = "".into();
        value["collections"][0]["requests"][0]["auth"]["identityToken"] = "".into();
        value["collections"][0]["requests"][0]["auth"]["refreshToken"] = "".into();
        value["collections"][0]["requests"][0]["auth"]["expiresAt"] = 0.into();
        value["collections"][0]["folders"][0]["auth"]["accessToken"] = "".into();
        value["collections"][0]["folders"][0]["auth"]["expiresAt"] = 0.into();
        value["mcpClients"][0]["token"] = "".into();
        value["mcpClients"][0]["oauthRefreshToken"] = "".into();
        value["mcpClients"][0]["oauthIdentityToken"] = "".into();
        value["mcpClients"][0]["oauthExpiresAt"] = 0.into();
        value["mcpClients"][0]["oauthRegisteredClientId"] = "".into();
        value["mcpClients"][0]["oauthRegisteredClientSecret"] = "".into();
        value["mcpClients"][0]["oauthRegisteredClientIdIssuedAt"] = 0.into();
        value["mcpClients"][0]["oauthRegisteredClientSecretExpiresAt"] = 0.into();
        value["mcpClients"][0]["oauthRegisteredTokenEndpointAuthMethod"] = "none".into();
        value["project"]["gitCredentials"][0]["token"] = "".into();

        let protected = protect_with_key("workspace-one", &value, &[4; MASTER_KEY_BYTES]).unwrap();
        assert_eq!(protected, value);
        assert!(!is_protected(&protected));
    }
}

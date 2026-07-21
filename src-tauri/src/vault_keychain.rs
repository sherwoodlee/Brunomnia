#[cfg(not(test))]
use crate::platform_keyring;
use crate::{secure_store, workspace_store};
use serde::Serialize;
use std::{path::Path, sync::Mutex};

#[cfg(not(test))]
const KEYCHAIN_SERVICE: &str = "dev.brunomnia.desktop.local-vault-key";
const KEYCHAIN_ACCOUNT_PREFIX: &str = "workspace-v1:";
#[cfg(all(not(test), target_os = "macos"))]
const ITEM_NOT_FOUND: i32 = -25_300;
const MAX_SAVED_KEY_BYTES: usize = 4_096;
static KEYCHAIN_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultKeyStatus {
    pub supported: bool,
    pub retained: bool,
}

fn account(workspace_id: &str) -> Result<String, String> {
    workspace_store::validate_workspace_id(workspace_id)?;
    Ok(format!("{KEYCHAIN_ACCOUNT_PREFIX}{workspace_id}"))
}

fn supported() -> bool {
    cfg!(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux"
    )) || cfg!(test)
}

fn validate_saved_key(passphrase: &str) -> Result<(), String> {
    let length = passphrase.len();
    if length < 12 {
        return Err("Use an encryption passphrase with at least 12 bytes.".into());
    }
    if length > MAX_SAVED_KEY_BYTES {
        return Err("The local vault key exceeds the 4 KB credential-store limit.".into());
    }
    Ok(())
}

#[cfg(test)]
fn test_store() -> &'static Mutex<std::collections::HashMap<String, Vec<u8>>> {
    use std::{collections::HashMap, sync::OnceLock};
    static STORE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(test)]
fn read_secret(account: &str) -> Result<Option<Vec<u8>>, String> {
    Ok(test_store()
        .lock()
        .map_err(|_| "The local vault test Keychain is unavailable.".to_string())?
        .get(account)
        .cloned())
}

#[cfg(all(not(test), target_os = "macos"))]
fn read_legacy_secret(account: &str) -> Result<Option<Vec<u8>>, String> {
    use security_framework::passwords::get_generic_password;
    match get_generic_password(KEYCHAIN_SERVICE, account) {
        Ok(secret) => Ok(Some(secret)),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(None),
        Err(error) => Err(format!(
            "The local vault key could not be read from macOS Keychain: {error}"
        )),
    }
}

#[cfg(not(test))]
fn read_secret(account: &str) -> Result<Option<Vec<u8>>, String> {
    if let Some(secret) = platform_keyring::read(KEYCHAIN_SERVICE, account, MAX_SAVED_KEY_BYTES)? {
        return Ok(Some(secret));
    }
    #[cfg(target_os = "macos")]
    if let Some(secret) = read_legacy_secret(account)? {
        platform_keyring::write(KEYCHAIN_SERVICE, account, &secret, MAX_SAVED_KEY_BYTES)?;
        delete_legacy_secret(account)?;
        return Ok(Some(secret));
    }
    Ok(None)
}

#[cfg(test)]
fn write_secret(account: &str, secret: &[u8]) -> Result<(), String> {
    test_store()
        .lock()
        .map_err(|_| "The local vault test Keychain is unavailable.".to_string())?
        .insert(account.to_string(), secret.to_vec());
    Ok(())
}

#[cfg(all(not(test), target_os = "macos"))]
fn delete_legacy_secret(account: &str) -> Result<(), String> {
    use security_framework::passwords::delete_generic_password;
    match delete_generic_password(KEYCHAIN_SERVICE, account) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(()),
        Err(error) => Err(format!(
            "The legacy local vault key could not be removed from macOS Keychain: {error}"
        )),
    }
}

#[cfg(not(test))]
fn write_secret(account: &str, secret: &[u8]) -> Result<(), String> {
    platform_keyring::write(KEYCHAIN_SERVICE, account, secret, MAX_SAVED_KEY_BYTES)?;
    #[cfg(target_os = "macos")]
    delete_legacy_secret(account)?;
    Ok(())
}

#[cfg(test)]
fn delete_secret(account: &str) -> Result<(), String> {
    test_store()
        .lock()
        .map_err(|_| "The local vault test Keychain is unavailable.".to_string())?
        .remove(account);
    Ok(())
}

#[cfg(not(test))]
fn delete_secret(account: &str) -> Result<(), String> {
    platform_keyring::delete(KEYCHAIN_SERVICE, account, MAX_SAVED_KEY_BYTES)?;
    #[cfg(target_os = "macos")]
    delete_legacy_secret(account)?;
    Ok(())
}

fn read_saved_key(workspace_id: &str) -> Result<Option<String>, String> {
    let account = account(workspace_id)?;
    if !supported() {
        return Ok(None);
    }
    let _guard = KEYCHAIN_LOCK
        .lock()
        .map_err(|_| "The local vault credential-store lock is unavailable.".to_string())?;
    let Some(secret) = read_secret(&account)? else {
        return Ok(None);
    };
    if secret.len() > MAX_SAVED_KEY_BYTES {
        return Err("The saved local vault key exceeds the 4 KB safety limit.".into());
    }
    String::from_utf8(secret)
        .map(Some)
        .map_err(|_| "The saved local vault key is not valid UTF-8 text.".to_string())
}

fn required_saved_key(workspace_id: &str) -> Result<String, String> {
    read_saved_key(workspace_id)?.ok_or_else(|| {
        "No encrypted local vault key is saved for this project. Enter the passphrase manually."
            .to_string()
    })
}

pub fn status(workspace_id: &str) -> Result<VaultKeyStatus, String> {
    account(workspace_id)?;
    if !supported() {
        return Ok(VaultKeyStatus {
            supported: false,
            retained: false,
        });
    }
    Ok(VaultKeyStatus {
        supported: true,
        retained: read_saved_key(workspace_id)?.is_some(),
    })
}

pub fn retain(
    workspace_id: &str,
    vault_path: &Path,
    passphrase: String,
) -> Result<VaultKeyStatus, String> {
    if !supported() {
        return Err("Saved local vault keys require an operating-system credential store.".into());
    }
    validate_saved_key(&passphrase)?;
    secure_store::vault_unlock(vault_path, passphrase.clone()).map_err(|_| {
        "The local vault key was not saved because it does not unlock this project's encrypted vault."
            .to_string()
    })?;
    let account = account(workspace_id)?;
    let _guard = KEYCHAIN_LOCK
        .lock()
        .map_err(|_| "The local vault credential-store lock is unavailable.".to_string())?;
    write_secret(&account, passphrase.as_bytes())?;
    Ok(VaultKeyStatus {
        supported: true,
        retained: true,
    })
}

pub fn forget(workspace_id: &str) -> Result<VaultKeyStatus, String> {
    let account = account(workspace_id)?;
    if supported() {
        let _guard = KEYCHAIN_LOCK
            .lock()
            .map_err(|_| "The local vault credential-store lock is unavailable.".to_string())?;
        delete_secret(&account)?;
    }
    Ok(VaultKeyStatus {
        supported: supported(),
        retained: false,
    })
}

fn stale_key_error(workspace_id: &str) -> String {
    match forget(workspace_id) {
        Ok(_) => "The saved local vault key no longer unlocks this project's encrypted vault. It was removed; enter the passphrase manually.".into(),
        Err(error) => format!("The saved local vault key no longer unlocks this project's encrypted vault, and the operating-system credential store could not remove it: {error}"),
    }
}

pub fn unlock_saved(
    workspace_id: &str,
    vault_path: &Path,
) -> Result<Vec<secure_store::VaultEntry>, String> {
    let passphrase = required_saved_key(workspace_id)?;
    secure_store::vault_unlock(vault_path, passphrase).map_err(|_| stale_key_error(workspace_id))
}

pub fn save_saved(
    workspace_id: &str,
    vault_path: &Path,
    entries: Vec<secure_store::VaultEntry>,
) -> Result<secure_store::SecureFileStatus, String> {
    let passphrase = required_saved_key(workspace_id)?;
    secure_store::vault_unlock(vault_path, passphrase.clone())
        .map_err(|_| stale_key_error(workspace_id))?;
    secure_store::vault_save(
        vault_path,
        secure_store::VaultSaveInput {
            passphrase,
            entries,
        },
    )
}

pub fn reset(workspace_id: &str, vault_path: &Path) -> Result<(), String> {
    account(workspace_id)?;
    if vault_path.exists() {
        secure_store::vault_status(vault_path)?;
    }
    forget(workspace_id)?;
    secure_store::vault_reset(vault_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use tempfile::tempdir;
    use uuid::Uuid;

    fn entry(value: &str) -> secure_store::VaultEntry {
        secure_store::VaultEntry {
            id: format!("secret-{}", Uuid::new_v4()),
            name: "api_token".into(),
            value: value.into(),
            updated_at: Utc::now().to_rfc3339(),
            kind: String::new(),
            owner_id: String::new(),
        }
    }

    fn create_vault(path: &Path, passphrase: &str, entries: Vec<secure_store::VaultEntry>) {
        secure_store::vault_save(
            path,
            secure_store::VaultSaveInput {
                passphrase: passphrase.into(),
                entries,
            },
        )
        .unwrap();
    }

    #[test]
    fn retains_workspace_scoped_keys_without_a_read_api() {
        let directory = tempdir().unwrap();
        let first_id = format!("workspace-{}", Uuid::new_v4());
        let second_id = format!("workspace-{}", Uuid::new_v4());
        let first_path = directory.path().join("first.json");
        let second_path = directory.path().join("second.json");
        let first_entries = vec![entry("first-secret")];
        let second_entries = vec![entry("second-secret")];
        create_vault(
            &first_path,
            "first workspace passphrase",
            first_entries.clone(),
        );
        create_vault(
            &second_path,
            "second workspace passphrase",
            second_entries.clone(),
        );

        assert!(!status(&first_id).unwrap().retained);
        assert!(
            retain(&first_id, &first_path, "first workspace passphrase".into())
                .unwrap()
                .retained
        );
        retain(
            &second_id,
            &second_path,
            "second workspace passphrase".into(),
        )
        .unwrap();
        assert_eq!(unlock_saved(&first_id, &first_path).unwrap(), first_entries);
        assert_eq!(
            unlock_saved(&second_id, &second_path).unwrap(),
            second_entries
        );

        let serialized = serde_json::to_string(&status(&first_id).unwrap()).unwrap();
        assert!(!serialized.contains("first workspace passphrase"));
        assert!(unlock_saved(&second_id, &first_path).is_err());
        assert!(!status(&second_id).unwrap().retained);
        assert!(status(&first_id).unwrap().retained);
    }

    #[test]
    fn saved_key_save_validates_the_current_vault_before_reencrypting() {
        let directory = tempdir().unwrap();
        let workspace_id = format!("workspace-{}", Uuid::new_v4());
        let path = directory.path().join("vault.json");
        create_vault(&path, "retained vault passphrase", vec![entry("old")]);
        retain(&workspace_id, &path, "retained vault passphrase".into()).unwrap();

        let next = vec![entry("new")];
        save_saved(&workspace_id, &path, next.clone()).unwrap();
        assert_eq!(
            secure_store::vault_unlock(&path, "retained vault passphrase".into()).unwrap(),
            next
        );

        create_vault(
            &path,
            "replacement vault passphrase",
            vec![entry("replacement")],
        );
        assert!(save_saved(&workspace_id, &path, vec![entry("blocked")])
            .unwrap_err()
            .contains("no longer unlocks"));
        assert!(!status(&workspace_id).unwrap().retained);
        assert_eq!(
            secure_store::vault_unlock(&path, "replacement vault passphrase".into()).unwrap()[0]
                .value,
            "replacement"
        );
    }

    #[test]
    fn reset_forgets_the_saved_key_and_rejects_unscoped_accounts() {
        let directory = tempdir().unwrap();
        let workspace_id = format!("workspace-{}", Uuid::new_v4());
        let path = directory.path().join("vault.json");
        create_vault(&path, "reset vault passphrase", vec![entry("secret")]);
        retain(&workspace_id, &path, "reset vault passphrase".into()).unwrap();

        reset(&workspace_id, &path).unwrap();
        assert!(!path.exists());
        assert!(!status(&workspace_id).unwrap().retained);
        assert!(status("../other-project").is_err());
    }
}

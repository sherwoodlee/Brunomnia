use crate::runtime_credentials;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeSet, fs, path::Path};

const STORE_SCOPE: &str = "global-git-provider-credentials-v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GitCredentialRecord {
    pub id: String,
    pub name: String,
    pub provider: String,
    #[serde(default)]
    pub username: String,
    pub token: String,
}

fn safe_field(value: &str, label: &str, limit: usize, required: bool) -> Result<String, String> {
    let value = value.trim();
    if required && value.is_empty() {
        return Err(format!("Enter the Git credential {label}."));
    }
    if value.len() > limit || value.chars().any(char::is_control) {
        return Err(format!("The Git credential {label} is invalid."));
    }
    Ok(value.to_string())
}

fn normalize(credentials: Vec<GitCredentialRecord>) -> Result<Vec<GitCredentialRecord>, String> {
    if credentials.len() > 100 {
        return Err("Git credential storage is limited to 100 entries.".into());
    }
    let mut ids = BTreeSet::new();
    credentials
        .into_iter()
        .map(|credential| {
            let id = safe_field(&credential.id, "identifier", 200, true)?;
            if !ids.insert(id.clone()) {
                return Err(format!("Git credential identifier '{id}' is duplicated."));
            }
            if !matches!(credential.provider.as_str(), "github" | "gitlab" | "custom") {
                return Err("Choose GitHub, GitLab, or custom Git credentials.".into());
            }
            let username = safe_field(
                &credential.username,
                "username",
                500,
                credential.provider == "custom",
            )?;
            Ok(GitCredentialRecord {
                id,
                name: safe_field(&credential.name, "name", 200, true)?,
                provider: credential.provider,
                username,
                token: safe_field(&credential.token, "token", 65_536, true)?,
            })
        })
        .collect()
}

fn workspace_value(credentials: &[GitCredentialRecord]) -> Result<Value, String> {
    Ok(serde_json::json!({
        "format": "brunomnia-git-credentials",
        "version": 1,
        "project": {
            "gitCredentials": serde_json::to_value(credentials).map_err(|error| error.to_string())?
        }
    }))
}

fn credentials_from_value(value: &Value) -> Result<Vec<GitCredentialRecord>, String> {
    let credentials = value
        .get("project")
        .and_then(|project| project.get("gitCredentials"))
        .cloned()
        .unwrap_or_else(|| Value::Array(vec![]));
    let credentials: Vec<GitCredentialRecord> = serde_json::from_value(credentials)
        .map_err(|_| "The Git credential store is malformed.".to_string())?;
    normalize(credentials)
}

fn write(path: &Path, credentials: &[GitCredentialRecord]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create Git credential storage: {error}"))?;
    }
    let protected = runtime_credentials::protect(STORE_SCOPE, &workspace_value(credentials)?)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(&protected).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Unable to write Git credential storage: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Unable to replace Git credential storage: {error}"))
}

pub fn load(path: &Path) -> Result<Vec<GitCredentialRecord>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let stored: Value = serde_json::from_slice(
        &fs::read(path)
            .map_err(|error| format!("Unable to read Git credential storage: {error}"))?,
    )
    .map_err(|_| "The Git credential store is not valid JSON.".to_string())?;
    let was_protected = runtime_credentials::is_protected(&stored);
    let credentials =
        credentials_from_value(&runtime_credentials::unprotect(STORE_SCOPE, &stored)?)?;
    if !was_protected && !credentials.is_empty() {
        write(path, &credentials)?;
    }
    Ok(credentials)
}

pub fn save(
    path: &Path,
    credentials: Vec<GitCredentialRecord>,
) -> Result<Vec<GitCredentialRecord>, String> {
    let credentials = normalize(credentials)?;
    write(path, &credentials)?;
    Ok(credentials)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn credential() -> GitCredentialRecord {
        GitCredentialRecord {
            id: "github-one".into(),
            name: "Work GitHub".into(),
            provider: "github".into(),
            username: String::new(),
            token: "github-secret".into(),
        }
    }

    #[test]
    fn encrypts_reusable_tokens_and_restores_records() {
        crate::runtime_credentials::set_test_master_key([42; 32]);
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("git-credentials.json");
        assert_eq!(save(&path, vec![credential()]).unwrap(), vec![credential()]);
        let stored = fs::read_to_string(&path).unwrap();
        assert!(!stored.contains("github-secret"));
        assert!(!stored.contains("Work GitHub"));
        assert!(!stored.contains("github\""));
        assert!(stored.contains("protectedRuntimeCredentials"));
        assert_eq!(load(&path).unwrap(), vec![credential()]);

        let mut tampered: Value = serde_json::from_str(&stored).unwrap();
        tampered["project"]["gitCredentials"][0]["provider"] = "custom".into();
        tampered["project"]["gitCredentials"][0]["username"] = "attacker".into();
        fs::write(&path, serde_json::to_vec_pretty(&tampered).unwrap()).unwrap();
        assert_eq!(load(&path).unwrap(), vec![credential()]);
    }

    #[test]
    fn rejects_duplicate_and_malformed_records() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("git-credentials.json");
        assert!(save(&path, vec![credential(), credential()])
            .unwrap_err()
            .contains("duplicated"));
        let mut custom = credential();
        custom.id = "custom-one".into();
        custom.provider = "custom".into();
        assert!(save(&path, vec![custom]).unwrap_err().contains("username"));
    }
}

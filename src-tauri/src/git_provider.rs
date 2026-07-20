use crate::project::GitCredentialInput;
use futures_util::StreamExt;
use reqwest::{header, redirect::Policy, Client, RequestBuilder, Response};
use serde::Serialize;
use serde_json::Value;
use std::{collections::BTreeSet, time::Duration};

const RESPONSE_LIMIT: usize = 2_000_000;
const PAGE_LIMIT: usize = 20;
const REPOSITORY_LIMIT: usize = 2_000;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitProviderValidationOutput {
    pub provider: String,
    pub account_login: String,
    pub account_name: String,
    pub emails: Vec<String>,
    pub can_discover_repositories: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitProviderRepository {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub web_url: String,
    pub default_branch: String,
    pub private: bool,
    pub can_push: bool,
}

fn token(input: &GitCredentialInput) -> Result<&str, String> {
    let token = input.token.trim();
    if token.is_empty() {
        return Err("Enter the provider access token.".into());
    }
    if token.len() > 65_536 || token.chars().any(char::is_control) {
        return Err("The provider access token is invalid.".into());
    }
    Ok(token)
}

fn client() -> Result<Client, String> {
    Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(30))
        .user_agent("Brunomnia/0.1 Git Sync")
        .build()
        .map_err(|error| format!("Unable to initialize Git provider access: {error}"))
}

fn provider_request(
    client: &Client,
    input: &GitCredentialInput,
    url: &str,
) -> Result<RequestBuilder, String> {
    match input.provider.as_str() {
        "github" => Ok(client
            .get(url)
            .header(header::AUTHORIZATION, format!("token {}", token(input)?))
            .header(header::ACCEPT, "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")),
        "gitlab" => Ok(client
            .get(url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token(input)?))),
        _ => Err("Automatic provider access supports GitHub and GitLab credentials. Custom and system credentials are validated against a repository URL.".into()),
    }
}

async fn response_json(response: Response, operation: &str) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!(
            "{operation} failed with HTTP {}.",
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > RESPONSE_LIMIT as u64)
    {
        return Err(format!("{operation} exceeded the 2 MB response limit."));
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("{operation} failed: {error}"))?;
        if bytes.len() + chunk.len() > RESPONSE_LIMIT {
            return Err(format!("{operation} exceeded the 2 MB response limit."));
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| format!("{operation} returned invalid JSON."))
}

async fn request_json(request: RequestBuilder, operation: &str) -> Result<Value, String> {
    let response = request
        .send()
        .await
        .map_err(|error| format!("{operation} failed: {error}"))?;
    response_json(response, operation).await
}

fn text(value: &Value, field: &str) -> String {
    value
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn github_repositories(value: &Value) -> Vec<GitProviderRepository> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter(|repository| {
            repository
                .get("permissions")
                .and_then(|permissions| permissions.get("pull"))
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .filter_map(|repository| {
            let clone_url = text(repository, "clone_url");
            if clone_url.is_empty() {
                return None;
            }
            Some(GitProviderRepository {
                id: repository
                    .get("id")
                    .map(|id| id.to_string().trim_matches('"').to_string())
                    .unwrap_or_else(|| clone_url.clone()),
                name: text(repository, "name"),
                full_name: text(repository, "full_name"),
                clone_url,
                web_url: text(repository, "html_url"),
                default_branch: text(repository, "default_branch"),
                private: repository
                    .get("private")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                can_push: repository
                    .get("permissions")
                    .and_then(|permissions| permissions.get("push"))
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
            })
        })
        .collect()
}

fn gitlab_access_level(repository: &Value) -> u64 {
    let permissions = repository.get("permissions").unwrap_or(&Value::Null);
    ["project_access", "group_access"]
        .into_iter()
        .filter_map(|field| {
            permissions
                .get(field)
                .and_then(|access| access.get("access_level"))
                .and_then(Value::as_u64)
        })
        .max()
        .unwrap_or_default()
}

fn gitlab_repositories(value: &Value) -> Vec<GitProviderRepository> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|repository| {
            let clone_url = text(repository, "http_url_to_repo");
            if clone_url.is_empty() {
                return None;
            }
            Some(GitProviderRepository {
                id: repository
                    .get("id")
                    .map(|id| id.to_string().trim_matches('"').to_string())
                    .unwrap_or_else(|| clone_url.clone()),
                name: text(repository, "name"),
                full_name: text(repository, "path_with_namespace"),
                clone_url,
                web_url: text(repository, "web_url"),
                default_branch: text(repository, "default_branch"),
                private: text(repository, "visibility") != "public",
                can_push: gitlab_access_level(repository) >= 30,
            })
        })
        .collect()
}

fn unique_emails(values: impl IntoIterator<Item = String>) -> Vec<String> {
    values
        .into_iter()
        .filter(|value| value.contains('@') && value.len() <= 500)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub async fn validate(input: GitCredentialInput) -> Result<GitProviderValidationOutput, String> {
    let client = client()?;
    match input.provider.as_str() {
        "github" => {
            let user = request_json(
                provider_request(&client, &input, "https://api.github.com/user")?,
                "GitHub credential validation",
            )
            .await?;
            let emails = match request_json(
                provider_request(&client, &input, "https://api.github.com/user/emails")?,
                "GitHub email discovery",
            )
            .await
            {
                Ok(value) => unique_emails(
                    value
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|email| email.get("email").and_then(Value::as_str))
                        .map(str::to_string),
                ),
                Err(_) => unique_emails([text(&user, "email")]),
            };
            Ok(GitProviderValidationOutput {
                provider: input.provider,
                account_login: text(&user, "login"),
                account_name: text(&user, "name"),
                emails,
                can_discover_repositories: true,
            })
        }
        "gitlab" => {
            let user = request_json(
                provider_request(&client, &input, "https://gitlab.com/api/v4/user")?,
                "GitLab credential validation",
            )
            .await?;
            let emails = unique_emails([
                text(&user, "email"),
                text(&user, "public_email"),
                text(&user, "commit_email"),
            ]);
            Ok(GitProviderValidationOutput {
                provider: input.provider,
                account_login: text(&user, "username"),
                account_name: text(&user, "name"),
                emails,
                can_discover_repositories: true,
            })
        }
        _ => Err("Automatic provider validation supports GitHub and GitLab credentials.".into()),
    }
}

pub async fn repositories(input: GitCredentialInput) -> Result<Vec<GitProviderRepository>, String> {
    let client = client()?;
    let mut repositories = Vec::new();
    for page in 1..=PAGE_LIMIT {
        let url = match input.provider.as_str() {
            "github" => format!(
                "https://api.github.com/user/repos?per_page=100&page={page}&sort=updated"
            ),
            "gitlab" => format!(
                "https://gitlab.com/api/v4/projects?membership=true&per_page=100&page={page}&order_by=last_activity_at&sort=desc"
            ),
            _ => return Err("Automatic repository discovery supports GitHub and GitLab credentials.".into()),
        };
        let value = request_json(
            provider_request(&client, &input, &url)?,
            if input.provider == "github" {
                "GitHub repository discovery"
            } else {
                "GitLab repository discovery"
            },
        )
        .await?;
        let page_repositories = if input.provider == "github" {
            github_repositories(&value)
        } else {
            gitlab_repositories(&value)
        };
        let raw_count = value.as_array().map(Vec::len).unwrap_or_default();
        repositories.extend(page_repositories);
        if repositories.len() > REPOSITORY_LIMIT {
            return Err(
                "Provider repository discovery exceeded the 2,000 repository limit.".into(),
            );
        }
        if raw_count < 100 {
            return Ok(repositories);
        }
    }
    Err("Provider repository discovery exceeded the 20-page limit.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_only_pullable_github_repositories() {
        let value = serde_json::json!([
            {"id": 1, "name": "orders", "full_name": "acme/orders", "clone_url": "https://github.com/acme/orders.git", "html_url": "https://github.com/acme/orders", "default_branch": "main", "private": true, "permissions": {"pull": true, "push": false}},
            {"id": 2, "name": "hidden", "clone_url": "https://github.com/acme/hidden.git", "permissions": {"pull": false}}
        ]);
        assert_eq!(
            github_repositories(&value),
            vec![GitProviderRepository {
                id: "1".into(),
                name: "orders".into(),
                full_name: "acme/orders".into(),
                clone_url: "https://github.com/acme/orders.git".into(),
                web_url: "https://github.com/acme/orders".into(),
                default_branch: "main".into(),
                private: true,
                can_push: false,
            }]
        );
    }

    #[test]
    fn maps_gitlab_membership_and_access_level() {
        let value = serde_json::json!([{
            "id": 7,
            "name": "billing",
            "path_with_namespace": "acme/billing",
            "http_url_to_repo": "https://gitlab.com/acme/billing.git",
            "web_url": "https://gitlab.com/acme/billing",
            "default_branch": "develop",
            "visibility": "internal",
            "permissions": {"group_access": {"access_level": 30}}
        }]);
        let repositories = gitlab_repositories(&value);
        assert_eq!(repositories.len(), 1);
        assert!(repositories[0].private);
        assert!(repositories[0].can_push);
    }
}

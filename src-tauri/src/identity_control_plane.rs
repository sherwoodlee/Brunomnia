use crate::{external_url, platform_keyring};
use axum::{
    body::{to_bytes, Body},
    extract::{OriginalUri, Query, State},
    http::{header, HeaderMap, Method, Request, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use base64::{
    engine::general_purpose::{STANDARD as BASE64, URL_SAFE_NO_PAD},
    Engine as _,
};
use chrono::{Duration as ChronoDuration, SecondsFormat, Utc};
use openidconnect::{
    core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata},
    reqwest, AccessTokenHash, AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl,
    Nonce, OAuth2TokenResponse, PkceCodeChallenge, RedirectUrl, Scope, TokenResponse,
};
use ring::{digest, rand::SecureRandom};
use saml_rs::{
    AcsEndpoint, AssertionSignaturePolicy, AudienceValidationPolicy, AuthnRequestSigningPolicy,
    BrowserInput, EntityId, FormField, IdpDescriptor, MessageSignaturePolicy, MetadataTrustPolicy,
    RelayStateParam, ReplayCache, ReplayKey, ReplayPolicy, Saml, SamlError, SamlValidationContext,
    SpConfig, SpValidationPolicy, SsoResponseBinding, StartSso,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    sync::{Arc, Mutex as StdMutex},
    time::{Duration, SystemTime},
};
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};
use url::Url;
use uuid::Uuid;

const SCIM_TOKEN_SERVICE: &str = "com.brunomnia.scim-token";
const OIDC_SECRET_SERVICE: &str = "com.brunomnia.oidc-client-secret";
const MAX_CREDENTIAL_BYTES: usize = 16_384;
const MAX_SCIM_BODY_BYTES: usize = 1_048_576;
const MAX_SCIM_LOGS: usize = 10_000;
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(300);
const SCIM_USER_SCHEMA: &str = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_GROUP_SCHEMA: &str = "urn:ietf:params:scim:schemas:core:2.0:Group";
const SCIM_LIST_SCHEMA: &str = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_ERROR_SCHEMA: &str = "urn:ietf:params:scim:api:messages:2.0:Error";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernanceMember {
    id: String,
    name: String,
    email: String,
    role: String,
    active: bool,
    source: String,
    #[serde(default)]
    external_id: String,
    #[serde(default)]
    team_ids: Vec<String>,
    #[serde(default)]
    last_authenticated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernanceTeam {
    id: String,
    name: String,
    #[serde(default)]
    external_id: String,
    source: String,
    #[serde(default)]
    member_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScimRequestLog {
    id: String,
    timestamp: String,
    method: String,
    path: String,
    status: u16,
    detail: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScimConfig {
    enabled: bool,
    bind_host: String,
    port: u16,
    #[serde(default)]
    public_base_url: String,
    #[serde(default)]
    token_id: String,
    #[serde(default)]
    issued_at: String,
    #[serde(default)]
    expires_at: String,
    #[serde(default = "manual_refresh")]
    refresh_mode: String,
    #[serde(default)]
    logs: Vec<ScimRequestLog>,
}

fn manual_refresh() -> String {
    "manual".into()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernanceConfig {
    current_member_id: String,
    members: Vec<GovernanceMember>,
    #[serde(default)]
    teams: Vec<GovernanceTeam>,
    #[serde(default)]
    resource_grants: Vec<Value>,
    organization: Value,
    sso: Value,
    scim: ScimConfig,
    policy: Value,
    #[serde(default)]
    audit: Vec<Value>,
}

struct RunningScimServer {
    shutdown: oneshot::Sender<()>,
    base_url: String,
    workspace_id: String,
}

#[derive(Default)]
struct IdentityRuntime {
    workspace_id: String,
    governance: Option<GovernanceConfig>,
    server: Option<RunningScimServer>,
}

#[derive(Clone, Default)]
pub struct IdentityControlPlaneState {
    runtime: Arc<Mutex<IdentityRuntime>>,
    replay: SamlReplayCache,
}

#[derive(Clone, Default)]
struct SamlReplayCache {
    seen: Arc<StdMutex<HashMap<String, SystemTime>>>,
}

impl ReplayCache for SamlReplayCache {
    fn check_and_store(&mut self, key: ReplayKey, expires_at: SystemTime) -> Result<(), SamlError> {
        let mut seen = self
            .seen
            .lock()
            .map_err(|_| SamlError::Invalid("The SAML replay cache is unavailable.".into()))?;
        let now = SystemTime::now();
        seen.retain(|_, expiry| *expiry > now);
        let cache_key = key.cache_key();
        if seen.contains_key(&cache_key) {
            return Err(SamlError::ReplayDetected { key: cache_key });
        }
        seen.insert(cache_key, expires_at);
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlPlaneSyncInput {
    workspace_id: String,
    governance: GovernanceConfig,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GovernanceUpdateEvent {
    workspace_id: String,
    governance: GovernanceConfig,
}

pub async fn sync(
    input: ControlPlaneSyncInput,
    state: IdentityControlPlaneState,
) -> Result<(), String> {
    validate_workspace_id(&input.workspace_id)?;
    let mut runtime = state.runtime.lock().await;
    if !runtime.workspace_id.is_empty() && runtime.workspace_id != input.workspace_id {
        if let Some(server) = runtime.server.take() {
            let _ = server.shutdown.send(());
        }
    }
    runtime.workspace_id = input.workspace_id;
    runtime.governance = Some(input.governance);
    Ok(())
}

fn validate_workspace_id(workspace_id: &str) -> Result<(), String> {
    if workspace_id.is_empty()
        || workspace_id.len() > 500
        || workspace_id.chars().any(char::is_control)
    {
        return Err("Workspace IDs must contain 1 to 500 printable characters.".into());
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredScimToken {
    version: u8,
    token_id: String,
    digest_base64: String,
    issued_at: String,
    expires_at: String,
    refresh_mode: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScimTokenIssue {
    token: String,
    token_id: String,
    issued_at: String,
    expires_at: String,
    refresh_mode: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScimTokenIssueInput {
    workspace_id: String,
    expires_days: Option<u32>,
    refresh_mode: String,
}

pub fn issue_scim_token(input: ScimTokenIssueInput) -> Result<ScimTokenIssue, String> {
    validate_workspace_id(&input.workspace_id)?;
    if let Some(days) = input.expires_days {
        if !matches!(days, 30 | 90 | 180 | 365 | 730) {
            return Err(
                "SCIM token expiry must be 30, 90, 180, 365, 730 days, or no expiry.".into(),
            );
        }
    }
    let refresh_mode = if input.refresh_mode == "oauth2" {
        "oauth2"
    } else {
        "manual"
    };
    let mut secret = [0_u8; 32];
    ring::rand::SystemRandom::new()
        .fill(&mut secret)
        .map_err(|_| "Unable to generate the SCIM connector token.".to_string())?;
    let token_id = Uuid::new_v4().to_string();
    let token = format!(
        "brunomnia_scim_{token_id}.{}",
        URL_SAFE_NO_PAD.encode(secret)
    );
    let issued_at = Utc::now();
    let expires_at = input
        .expires_days
        .map(|days| issued_at + ChronoDuration::days(i64::from(days)))
        .map(|value| value.to_rfc3339_opts(SecondsFormat::Secs, true))
        .unwrap_or_default();
    let stored = StoredScimToken {
        version: 1,
        token_id: token_id.clone(),
        digest_base64: BASE64.encode(digest::digest(&digest::SHA256, token.as_bytes()).as_ref()),
        issued_at: issued_at.to_rfc3339_opts(SecondsFormat::Secs, true),
        expires_at: expires_at.clone(),
        refresh_mode: refresh_mode.into(),
    };
    let encoded = serde_json::to_vec(&stored).map_err(|error| error.to_string())?;
    platform_keyring::write(
        SCIM_TOKEN_SERVICE,
        &input.workspace_id,
        &encoded,
        MAX_CREDENTIAL_BYTES,
    )?;
    Ok(ScimTokenIssue {
        token,
        token_id,
        issued_at: stored.issued_at,
        expires_at,
        refresh_mode: refresh_mode.into(),
    })
}

fn stored_scim_token(workspace_id: &str) -> Result<Option<StoredScimToken>, String> {
    platform_keyring::read(SCIM_TOKEN_SERVICE, workspace_id, MAX_CREDENTIAL_BYTES)?
        .map(|bytes| {
            let token: StoredScimToken = serde_json::from_slice(&bytes)
                .map_err(|_| "The saved SCIM token verifier is malformed.".to_string())?;
            if token.version != 1
                || token.token_id.is_empty()
                || token.digest_base64.len() != 44
                || !matches!(token.refresh_mode.as_str(), "manual" | "oauth2")
            {
                return Err("The saved SCIM token verifier is invalid.".into());
            }
            Ok(token)
        })
        .transpose()
}

fn save_stored_scim_token(workspace_id: &str, token: &StoredScimToken) -> Result<(), String> {
    let encoded = serde_json::to_vec(token).map_err(|error| error.to_string())?;
    platform_keyring::write(
        SCIM_TOKEN_SERVICE,
        workspace_id,
        &encoded,
        MAX_CREDENTIAL_BYTES,
    )
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    stored: bool,
}

pub fn scim_token_status(workspace_id: String) -> Result<CredentialStatus, String> {
    validate_workspace_id(&workspace_id)?;
    Ok(CredentialStatus {
        stored: stored_scim_token(&workspace_id)?.is_some(),
    })
}

pub fn clear_scim_token(workspace_id: String) -> Result<(), String> {
    validate_workspace_id(&workspace_id)?;
    platform_keyring::delete(SCIM_TOKEN_SERVICE, &workspace_id, MAX_CREDENTIAL_BYTES)
}

pub fn save_oidc_client_secret(workspace_id: String, secret: String) -> Result<(), String> {
    validate_workspace_id(&workspace_id)?;
    if secret.is_empty() {
        return platform_keyring::delete(OIDC_SECRET_SERVICE, &workspace_id, MAX_CREDENTIAL_BYTES);
    }
    if secret.len() > 8_192 {
        return Err("OIDC client secrets cannot exceed 8,192 bytes.".into());
    }
    platform_keyring::write(
        OIDC_SECRET_SERVICE,
        &workspace_id,
        secret.as_bytes(),
        MAX_CREDENTIAL_BYTES,
    )
}

pub fn oidc_client_secret_status(workspace_id: String) -> Result<CredentialStatus, String> {
    validate_workspace_id(&workspace_id)?;
    Ok(CredentialStatus {
        stored: platform_keyring::read(OIDC_SECRET_SERVICE, &workspace_id, MAX_CREDENTIAL_BYTES)?
            .is_some(),
    })
}

fn oidc_client_secret(workspace_id: &str) -> Result<Option<String>, String> {
    platform_keyring::read(OIDC_SECRET_SERVICE, workspace_id, MAX_CREDENTIAL_BYTES)?
        .map(|value| {
            String::from_utf8(value)
                .map_err(|_| "The saved OIDC client secret is not UTF-8.".to_string())
        })
        .transpose()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyDomainInput {
    domain: String,
    challenge: String,
}

pub async fn verify_domain(input: VerifyDomainInput) -> Result<String, String> {
    let domain = input
        .domain
        .trim()
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if domain.is_empty()
        || domain.len() > 253
        || input.challenge.is_empty()
        || input.challenge.len() > 500
        || domain == "localhost"
        || domain.parse::<IpAddr>().is_ok()
        || !domain.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                && !label.starts_with('-')
                && !label.ends_with('-')
        })
    {
        return Err("Enter a valid public DNS domain and verification challenge.".into());
    }
    let url = format!("https://{domain}/.well-known/brunomnia-domain-verification.txt");
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|error| format!("Unable to load the domain verification file: {error}"))?;
    if response.status() != reqwest::StatusCode::OK {
        return Err(format!(
            "The domain verification file returned HTTP {}.",
            response.status().as_u16()
        ));
    }
    let body = response.bytes().await.map_err(|error| error.to_string())?;
    if body.len() > 4_096 {
        return Err("The domain verification file exceeds 4,096 bytes.".into());
    }
    let body = std::str::from_utf8(&body)
        .map_err(|_| "The domain verification file must be UTF-8.".to_string())?;
    let expected = format!("brunomnia-domain-verification={}", input.challenge);
    if !body.lines().any(|line| line.trim() == expected) {
        return Err("The domain verification challenge did not match.".into());
    }
    Ok(Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true))
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticatedIdentity {
    subject: String,
    email: String,
    name: String,
    groups: Vec<String>,
    protocol: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OidcLoginInput {
    workspace_id: String,
    issuer: String,
    client_id: String,
    scopes: String,
    callback_port: u16,
}

#[derive(Clone, Debug, Deserialize)]
struct OidcCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Clone)]
struct OidcCallbackState {
    sender: Arc<Mutex<Option<oneshot::Sender<OidcCallbackQuery>>>>,
}

async fn oidc_callback(
    State(state): State<OidcCallbackState>,
    Query(query): Query<OidcCallbackQuery>,
) -> Html<&'static str> {
    if let Some(sender) = state.sender.lock().await.take() {
        let _ = sender.send(query);
    }
    Html("<!doctype html><meta charset=utf-8><title>Brunomnia SSO</title><p>Authentication received. Return to Brunomnia.</p>")
}

fn secret_matches(left: &str, right: &str) -> bool {
    digest::digest(&digest::SHA256, left.as_bytes()).as_ref()
        == digest::digest(&digest::SHA256, right.as_bytes()).as_ref()
}

pub async fn oidc_login(input: OidcLoginInput) -> Result<AuthenticatedIdentity, String> {
    validate_workspace_id(&input.workspace_id)?;
    if input.callback_port < 1_024 {
        return Err("OIDC callback ports must be between 1,024 and 65,535.".into());
    }
    let issuer = IssuerUrl::new(input.issuer.trim().to_string())
        .map_err(|error| format!("The OIDC issuer is invalid: {error}"))?;
    if issuer.url().scheme() != "https" {
        return Err("OIDC discovery requires an HTTPS issuer.".into());
    }
    let http_client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let provider = CoreProviderMetadata::discover_async(issuer, &http_client)
        .await
        .map_err(|error| format!("OIDC discovery failed: {error}"))?;
    let redirect_url = format!("http://127.0.0.1:{}/sso/oidc/callback", input.callback_port);
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", input.callback_port))
        .await
        .map_err(|error| format!("Unable to bind the OIDC callback: {error}"))?;
    let client = CoreClient::from_provider_metadata(
        provider,
        ClientId::new(input.client_id),
        oidc_client_secret(&input.workspace_id)?.map(ClientSecret::new),
    )
    .set_redirect_uri(
        RedirectUrl::new(redirect_url)
            .map_err(|error| format!("The OIDC callback URL is invalid: {error}"))?,
    );
    let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
    let mut request = client.authorize_url(
        CoreAuthenticationFlow::AuthorizationCode,
        CsrfToken::new_random,
        Nonce::new_random,
    );
    for scope in input.scopes.split_whitespace() {
        request = request.add_scope(Scope::new(scope.to_string()));
    }
    let (authorization_url, expected_state, nonce) = request.set_pkce_challenge(challenge).url();
    let (sender, receiver) = oneshot::channel();
    let callback_state = OidcCallbackState {
        sender: Arc::new(Mutex::new(Some(sender))),
    };
    let app = Router::new()
        .route("/sso/oidc/callback", get(oidc_callback))
        .with_state(callback_state);
    let server = tokio::spawn(async move { axum::serve(listener, app).await });
    external_url::open(authorization_url.as_str())?;
    let callback = tokio::time::timeout(CALLBACK_TIMEOUT, receiver)
        .await
        .map_err(|_| "OIDC login timed out after five minutes.".to_string())?
        .map_err(|_| "The OIDC callback closed unexpectedly.".to_string())?;
    server.abort();
    if let Some(error) = callback.error {
        return Err(format!(
            "OIDC login failed: {}",
            callback.error_description.unwrap_or(error)
        ));
    }
    let state = callback
        .state
        .ok_or_else(|| "The OIDC callback omitted state.".to_string())?;
    if !secret_matches(&state, expected_state.secret()) {
        return Err("The OIDC callback state did not match this login attempt.".into());
    }
    let code = callback
        .code
        .ok_or_else(|| "The OIDC callback omitted the authorization code.".to_string())?;
    let token = client
        .exchange_code(AuthorizationCode::new(code))
        .map_err(|error| format!("The OIDC token endpoint is unavailable: {error}"))?
        .set_pkce_verifier(verifier)
        .request_async(&http_client)
        .await
        .map_err(|error| format!("OIDC token exchange failed: {error}"))?;
    let id_token = token
        .id_token()
        .ok_or_else(|| "The OIDC provider did not return an ID token.".to_string())?;
    let verifier = client.id_token_verifier();
    let claims = id_token
        .claims(&verifier, &nonce)
        .map_err(|error| format!("OIDC ID-token validation failed: {error}"))?;
    if let Some(expected_hash) = claims.access_token_hash() {
        let actual_hash = AccessTokenHash::from_token(
            token.access_token(),
            id_token
                .signing_alg()
                .map_err(|error| format!("OIDC signing algorithm is invalid: {error}"))?,
            id_token
                .signing_key(&verifier)
                .map_err(|error| format!("OIDC signing key validation failed: {error}"))?,
        )
        .map_err(|error| format!("OIDC access-token hash validation failed: {error}"))?;
        if actual_hash != *expected_hash {
            return Err("The OIDC access-token hash did not match the ID token.".into());
        }
    }
    let email = claims
        .email()
        .map(|value| value.as_str().to_string())
        .ok_or_else(|| "The OIDC ID token did not include an email claim.".to_string())?;
    let name = claims
        .name()
        .and_then(|localized| localized.get(None))
        .map(|value| value.as_str().to_string())
        .or_else(|| {
            claims
                .preferred_username()
                .map(|value| value.as_str().to_string())
        })
        .unwrap_or_else(|| email.clone());
    Ok(AuthenticatedIdentity {
        subject: claims.subject().as_str().to_string(),
        email,
        name,
        groups: Vec::new(),
        protocol: "oidc".into(),
    })
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamlLoginInput {
    workspace_id: String,
    idp_entity_id: String,
    sign_in_url: String,
    certificate_pem: String,
    signature_mode: String,
    callback_port: u16,
}

#[derive(Clone)]
struct SamlCallbackState {
    sender: Arc<Mutex<Option<oneshot::Sender<Vec<FormField>>>>>,
}

async fn saml_callback(State(state): State<SamlCallbackState>, request: Request<Body>) -> Response {
    let body = match to_bytes(request.into_body(), MAX_SCIM_BODY_BYTES).await {
        Ok(body) => body,
        Err(_) => {
            return (StatusCode::PAYLOAD_TOO_LARGE, "SAML response too large").into_response()
        }
    };
    let fields = Url::parse(&format!(
        "http://localhost/?{}",
        String::from_utf8_lossy(&body)
    ))
    .map(|url| {
        url.query_pairs()
            .map(|(name, value)| FormField::new(name.into_owned(), value.into_owned()))
            .collect::<Vec<_>>()
    });
    let Ok(fields) = fields else {
        return (StatusCode::BAD_REQUEST, "Malformed SAML form").into_response();
    };
    if let Some(sender) = state.sender.lock().await.take() {
        let _ = sender.send(fields);
    }
    Html("<!doctype html><meta charset=utf-8><title>Brunomnia SSO</title><p>Authentication received. Return to Brunomnia.</p>").into_response()
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn certificate_body(pem: &str) -> Result<String, String> {
    let body = pem
        .lines()
        .filter(|line| !line.starts_with("-----"))
        .flat_map(|line| line.trim().chars())
        .collect::<String>();
    let der = BASE64
        .decode(&body)
        .map_err(|_| "The SAML signing certificate is not valid PEM.".to_string())?;
    if der.is_empty() || der.len() > 100_000 {
        return Err("The SAML signing certificate is empty or too large.".into());
    }
    Ok(BASE64.encode(der))
}

fn saml_attribute(session: &saml_rs::SsoSession, names: &[&str]) -> Option<String> {
    session
        .attributes()
        .as_slice()
        .iter()
        .find(|attribute| {
            names
                .iter()
                .any(|name| attribute.name().eq_ignore_ascii_case(name))
        })
        .and_then(|attribute| attribute.values().first())
        .map(|value| value.as_str().to_string())
}

pub async fn saml_login(
    input: SamlLoginInput,
    state: IdentityControlPlaneState,
) -> Result<AuthenticatedIdentity, String> {
    validate_workspace_id(&input.workspace_id)?;
    if input.callback_port < 1_024 {
        return Err("SAML callback ports must be between 1,024 and 65,535.".into());
    }
    let sign_in_url = Url::parse(input.sign_in_url.trim())
        .map_err(|error| format!("The SAML sign-in URL is invalid: {error}"))?;
    if sign_in_url.scheme() != "https" {
        return Err("SAML sign-in requires an HTTPS identity-provider URL.".into());
    }
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", input.callback_port))
        .await
        .map_err(|error| format!("Unable to bind the SAML callback: {error}"))?;
    let acs = format!("http://127.0.0.1:{}/sso/saml/acs", input.callback_port);
    let sp_entity_id = format!("urn:brunomnia:workspace:{}", input.workspace_id);
    let certificate = certificate_body(&input.certificate_pem)?;
    let metadata = format!(
        "<EntityDescriptor xmlns=\"urn:oasis:names:tc:SAML:2.0:metadata\" entityID=\"{}\"><IDPSSODescriptor protocolSupportEnumeration=\"urn:oasis:names:tc:SAML:2.0:protocol\"><KeyDescriptor use=\"signing\"><ds:KeyInfo xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\"><ds:X509Data><ds:X509Certificate>{}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></KeyDescriptor><SingleSignOnService Binding=\"urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect\" Location=\"{}\"/></IDPSSODescriptor></EntityDescriptor>",
        xml_escape(input.idp_entity_id.trim()),
        certificate,
        xml_escape(sign_in_url.as_str())
    );
    let mut validation = SpValidationPolicy::compatibility();
    validation.authn_requests = AuthnRequestSigningPolicy::DoNotSignForCompatibility;
    validation.audience = AudienceValidationPolicy::Validate;
    validation.assertions = if matches!(input.signature_mode.as_str(), "assertion" | "both") {
        AssertionSignaturePolicy::RequireSigned
    } else {
        AssertionSignaturePolicy::AllowUnsignedForCompatibility
    };
    validation.messages = if matches!(input.signature_mode.as_str(), "response" | "both") {
        MessageSignaturePolicy::RequireSigned
    } else {
        MessageSignaturePolicy::AllowUnsignedForCompatibility
    };
    let sp = Saml::sp(
        SpConfig::builder(
            EntityId::try_new(&sp_entity_id)
                .map_err(|error| format!("The SAML SP entity ID is invalid: {error}"))?,
        )
        .acs_endpoint(
            AcsEndpoint::post(&acs)
                .map_err(|error| format!("The SAML ACS URL is invalid: {error}"))?,
        )
        .validation(validation)
        .build()
        .map_err(|error| format!("The SAML SP configuration is invalid: {error}"))?,
    )
    .map_err(|error| format!("Unable to initialize the SAML service provider: {error}"))?;
    let idp_entity = EntityId::try_new(input.idp_entity_id.trim())
        .map_err(|error| format!("The SAML IdP entity ID is invalid: {error}"))?;
    let idp = IdpDescriptor::from_metadata_xml_for(
        idp_entity,
        &metadata,
        MetadataTrustPolicy::UnsignedForCompatibility,
    )
    .map_err(|error| format!("The SAML IdP metadata is invalid: {error}"))?;
    let relay = RelayStateParam::try_from_option(Some(Uuid::new_v4().to_string()))
        .map_err(|error| error.to_string())?;
    let started = sp
        .start_sso(
            &idp,
            StartSso::redirect()
                .response_binding(SsoResponseBinding::Post)
                .relay_state(relay),
        )
        .map_err(|error| format!("Unable to start SAML login: {error}"))?;
    let authorization_url = started
        .outbound
        .redirect_url()
        .map_err(|error| format!("Unable to create the SAML redirect: {error}"))?
        .to_string();
    let (sender, receiver) = oneshot::channel();
    let callback_state = SamlCallbackState {
        sender: Arc::new(Mutex::new(Some(sender))),
    };
    let app = Router::new()
        .route("/sso/saml/acs", axum::routing::post(saml_callback))
        .with_state(callback_state);
    let server = tokio::spawn(async move { axum::serve(listener, app).await });
    external_url::open(&authorization_url)?;
    let fields = tokio::time::timeout(CALLBACK_TIMEOUT, receiver)
        .await
        .map_err(|_| "SAML login timed out after five minutes.".to_string())?
        .map_err(|_| "The SAML callback closed unexpectedly.".to_string())?;
    server.abort();
    let mut replay = state.replay.clone();
    let session = sp
        .finish_sso(
            &idp,
            &started.pending,
            BrowserInput::<saml_rs::SsoResponse>::post(fields),
            SamlValidationContext::new(SystemTime::now(), ReplayPolicy::RequireCache(&mut replay))
                .with_replay_retention(Duration::from_secs(600)),
        )
        .map_err(|error| format!("SAML response validation failed: {error}"))?;
    let name_id = session.name_id().value().to_string();
    let email = saml_attribute(
        &session,
        &[
            "email",
            "mail",
            "emailAddress",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        ],
    )
    .or_else(|| name_id.contains('@').then(|| name_id.clone()))
    .ok_or_else(|| "The SAML assertion did not include an email address.".to_string())?;
    let name = saml_attribute(
        &session,
        &[
            "name",
            "displayName",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
        ],
    )
    .unwrap_or_else(|| email.clone());
    let groups = session
        .attributes()
        .as_slice()
        .iter()
        .filter(|attribute| {
            attribute.name().eq_ignore_ascii_case("groups")
                || attribute.name().eq_ignore_ascii_case("group")
                || attribute.name().ends_with("/claims/groups")
        })
        .flat_map(|attribute| {
            attribute
                .values()
                .iter()
                .map(|value| value.as_str().to_string())
        })
        .take(1_000)
        .collect();
    Ok(AuthenticatedIdentity {
        subject: name_id,
        email,
        name,
        groups,
        protocol: "saml".into(),
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScimServerStatus {
    running: bool,
    base_url: String,
    workspace_id: String,
}

#[derive(Clone)]
struct ScimRouteState {
    control_plane: IdentityControlPlaneState,
    app: AppHandle,
    workspace_id: String,
    token: Arc<Mutex<StoredScimToken>>,
}

pub async fn start_scim_server(
    app: AppHandle,
    state: IdentityControlPlaneState,
) -> Result<ScimServerStatus, String> {
    let mut runtime = state.runtime.lock().await;
    let workspace_id = runtime.workspace_id.clone();
    validate_workspace_id(&workspace_id)?;
    let governance = runtime
        .governance
        .as_ref()
        .ok_or_else(|| "Synchronize governance before starting SCIM.".to_string())?;
    if !governance.scim.enabled {
        return Err("Enable SCIM before starting the connector.".into());
    }
    if let Some(server) = runtime.server.as_ref() {
        return Ok(ScimServerStatus {
            running: true,
            base_url: server.base_url.clone(),
            workspace_id: server.workspace_id.clone(),
        });
    }
    let token = stored_scim_token(&workspace_id)?
        .ok_or_else(|| "Generate a SCIM connector token first.".to_string())?;
    if token.token_id != governance.scim.token_id {
        return Err("The OS-protected SCIM token does not match this workspace configuration. Refresh the token.".into());
    }
    if !token.expires_at.is_empty()
        && chrono::DateTime::parse_from_rfc3339(&token.expires_at)
            .map(|expiry| expiry <= Utc::now())
            .unwrap_or(true)
    {
        return Err("The SCIM connector token has expired.".into());
    }
    let host = match governance.scim.bind_host.as_str() {
        "127.0.0.1" | "0.0.0.0" | "::1" | "::" => governance.scim.bind_host.clone(),
        _ => {
            return Err(
                "SCIM bind hosts must be loopback or an explicit all-interface address.".into(),
            )
        }
    };
    let listener = tokio::net::TcpListener::bind((host.as_str(), governance.scim.port))
        .await
        .map_err(|error| format!("Unable to bind the SCIM connector: {error}"))?;
    let address = listener.local_addr().map_err(|error| error.to_string())?;
    let base_url = if address.is_ipv6() {
        format!("http://[{}]:{}/scim/v2", address.ip(), address.port())
    } else {
        format!("http://{}:{}/scim/v2", address.ip(), address.port())
    };
    let route_state = ScimRouteState {
        control_plane: state.clone(),
        app,
        workspace_id: workspace_id.clone(),
        token: Arc::new(Mutex::new(token)),
    };
    let router = Router::new().fallback(scim_request).with_state(route_state);
    let (shutdown, shutdown_receiver) = oneshot::channel();
    runtime.server = Some(RunningScimServer {
        shutdown,
        base_url: base_url.clone(),
        workspace_id: workspace_id.clone(),
    });
    drop(runtime);
    let runtime_state = state.runtime.clone();
    let cleanup_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_receiver.await;
            })
            .await;
        let mut runtime = runtime_state.lock().await;
        if runtime
            .server
            .as_ref()
            .is_some_and(|server| server.workspace_id == cleanup_workspace_id)
        {
            runtime.server = None;
        }
    });
    Ok(ScimServerStatus {
        running: true,
        base_url,
        workspace_id,
    })
}

pub async fn stop_scim_server(
    state: IdentityControlPlaneState,
) -> Result<ScimServerStatus, String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(server) = runtime.server.take() {
        let workspace_id = server.workspace_id;
        let _ = server.shutdown.send(());
        return Ok(ScimServerStatus {
            running: false,
            base_url: String::new(),
            workspace_id,
        });
    }
    Ok(ScimServerStatus {
        running: false,
        base_url: String::new(),
        workspace_id: runtime.workspace_id.clone(),
    })
}

pub async fn scim_server_status(state: IdentityControlPlaneState) -> ScimServerStatus {
    let runtime = state.runtime.lock().await;
    runtime
        .server
        .as_ref()
        .map(|server| ScimServerStatus {
            running: true,
            base_url: server.base_url.clone(),
            workspace_id: server.workspace_id.clone(),
        })
        .unwrap_or_else(|| ScimServerStatus {
            running: false,
            base_url: String::new(),
            workspace_id: runtime.workspace_id.clone(),
        })
}

fn scim_response(status: StatusCode, value: Value) -> Response {
    let mut response = Response::new(Body::from(value.to_string()));
    *response.status_mut() = status;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("application/scim+json; charset=utf-8"),
    );
    response
}

fn scim_error(status: StatusCode, detail: impl Into<String>) -> (StatusCode, Value, String) {
    let detail = detail.into();
    (
        status,
        json!({ "schemas": [SCIM_ERROR_SCHEMA], "status": status.as_u16().to_string(), "detail": detail }),
        detail,
    )
}

fn authorized(headers: &HeaderMap, token: &StoredScimToken) -> bool {
    let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return false;
    };
    BASE64.encode(digest::digest(&digest::SHA256, value.as_bytes()).as_ref()) == token.digest_base64
}

fn renew_automatic_scim_token(token: &mut StoredScimToken, now: chrono::DateTime<Utc>) -> bool {
    if token.refresh_mode != "oauth2" || token.expires_at.is_empty() {
        return false;
    }
    let issued = chrono::DateTime::parse_from_rfc3339(&token.issued_at)
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or(now - ChronoDuration::days(90));
    let expiry = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or(now);
    if expiry - now > ChronoDuration::days(20) {
        return false;
    }
    let lifetime = (expiry - issued).max(ChronoDuration::days(30));
    token.issued_at = now.to_rfc3339_opts(SecondsFormat::Secs, true);
    token.expires_at = (now + lifetime).to_rfc3339_opts(SecondsFormat::Secs, true);
    true
}

async fn scim_request(
    State(state): State<ScimRouteState>,
    method: Method,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
    body: Body,
) -> Response {
    let path = uri.path().to_string();
    let request_body = match to_bytes(body, MAX_SCIM_BODY_BYTES).await {
        Ok(body) => body,
        Err(_) => {
            return scim_response(
                StatusCode::PAYLOAD_TOO_LARGE,
                scim_error(StatusCode::PAYLOAD_TOO_LARGE, "SCIM request body too large").1,
            )
        }
    };
    let mut runtime = state.control_plane.runtime.lock().await;
    if runtime.workspace_id != state.workspace_id {
        return scim_response(
            StatusCode::CONFLICT,
            scim_error(StatusCode::CONFLICT, "The active workspace changed.").1,
        );
    }
    let Some(governance) = runtime.governance.as_mut() else {
        return scim_response(
            StatusCode::SERVICE_UNAVAILABLE,
            scim_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "Governance is unavailable.",
            )
            .1,
        );
    };
    let mut token = state.token.lock().await;
    let token_expired = !token.expires_at.is_empty()
        && chrono::DateTime::parse_from_rfc3339(&token.expires_at)
            .map(|expiry| expiry <= Utc::now())
            .unwrap_or(true);
    let (status, value, detail) = if token_expired {
        scim_error(
            StatusCode::UNAUTHORIZED,
            "The SCIM bearer token has expired.",
        )
    } else if !authorized(&headers, &token) {
        scim_error(
            StatusCode::UNAUTHORIZED,
            "A valid SCIM bearer token is required.",
        )
    } else {
        if renew_automatic_scim_token(&mut token, Utc::now()) {
            if let Err(error) = save_stored_scim_token(&state.workspace_id, &token) {
                return scim_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    scim_error(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Automatic SCIM token renewal failed: {error}"),
                    )
                    .1,
                );
            }
            governance.scim.issued_at = token.issued_at.clone();
            governance.scim.expires_at = token.expires_at.clone();
        }
        handle_scim(&method, &uri, &request_body, governance)
    };
    drop(token);
    governance.scim.logs.insert(
        0,
        ScimRequestLog {
            id: format!("scim-log-{}", Uuid::new_v4()),
            timestamp: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
            method: method.as_str().into(),
            path: path.chars().take(4_096).collect(),
            status: status.as_u16(),
            detail: detail.chars().take(2_000).collect(),
        },
    );
    governance.scim.logs.truncate(MAX_SCIM_LOGS);
    let event = GovernanceUpdateEvent {
        workspace_id: state.workspace_id.clone(),
        governance: governance.clone(),
    };
    drop(runtime);
    let _ = state.app.emit("identity-governance-updated", event);
    if status == StatusCode::NO_CONTENT {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = status;
        response
    } else {
        scim_response(status, value)
    }
}

fn parse_json_body(body: &[u8]) -> Result<Value, (StatusCode, Value, String)> {
    serde_json::from_slice(body)
        .map_err(|_| scim_error(StatusCode::BAD_REQUEST, "The SCIM JSON body is malformed."))
}

fn query_values(uri: &http::Uri) -> HashMap<String, String> {
    Url::parse(&format!("http://localhost{}", uri))
        .map(|url| url.query_pairs().into_owned().collect())
        .unwrap_or_default()
}

fn scim_location(governance: &GovernanceConfig, kind: &str, id: &str) -> String {
    let base = governance
        .scim
        .public_base_url
        .trim_end_matches('/')
        .to_string();
    if base.is_empty() {
        format!("/scim/v2/{kind}/{id}")
    } else {
        format!("{base}/{kind}/{id}")
    }
}

fn user_json(governance: &GovernanceConfig, member: &GovernanceMember) -> Value {
    let groups = governance
        .teams
        .iter()
        .filter(|team| team.member_ids.contains(&member.id))
        .map(|team| {
            json!({
                "value": team.id,
                "display": team.name,
                "$ref": scim_location(governance, "Groups", &team.id),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "schemas": [SCIM_USER_SCHEMA],
        "id": member.id,
        "externalId": member.external_id,
        "userName": member.email,
        "displayName": member.name,
        "name": { "formatted": member.name },
        "active": member.active,
        "groups": groups,
        "meta": { "resourceType": "User", "location": scim_location(governance, "Users", &member.id) },
    })
}

fn group_json(governance: &GovernanceConfig, team: &GovernanceTeam) -> Value {
    let members = team
        .member_ids
        .iter()
        .filter_map(|member_id| {
            governance
                .members
                .iter()
                .find(|member| &member.id == member_id)
                .map(|member| {
                    json!({
                        "value": member.id,
                        "display": member.email,
                        "$ref": scim_location(governance, "Users", &member.id),
                    })
                })
        })
        .collect::<Vec<_>>();
    json!({
        "schemas": [SCIM_GROUP_SCHEMA],
        "id": team.id,
        "externalId": team.external_id,
        "displayName": team.name,
        "members": members,
        "meta": { "resourceType": "Group", "location": scim_location(governance, "Groups", &team.id) },
    })
}

fn list_response(resources: Vec<Value>, query: &HashMap<String, String>) -> Value {
    let total = resources.len();
    let start = query
        .get("startIndex")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(1)
        .max(1);
    let count = query
        .get("count")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(100)
        .min(1_000);
    let page = resources
        .into_iter()
        .skip(start.saturating_sub(1))
        .take(count)
        .collect::<Vec<_>>();
    json!({ "schemas": [SCIM_LIST_SCHEMA], "totalResults": total, "startIndex": start, "itemsPerPage": page.len(), "Resources": page })
}

fn body_string(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn valid_email(email: &str) -> bool {
    let mut parts = email.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    !local.is_empty()
        && domain.contains('.')
        && parts.next().is_none()
        && !email.chars().any(char::is_whitespace)
        && email.len() <= 1_000
}

fn user_from_body(
    governance: &mut GovernanceConfig,
    value: &Value,
    existing_id: Option<&str>,
) -> Result<GovernanceMember, (StatusCode, Value, String)> {
    let email = body_string(value, "userName").to_ascii_lowercase();
    if !valid_email(&email) {
        return Err(scim_error(
            StatusCode::BAD_REQUEST,
            "SCIM users require a valid userName email address.",
        ));
    }
    let external_id = body_string(value, "externalId");
    let name = body_string(value, "displayName");
    let active = value.get("active").and_then(Value::as_bool).unwrap_or(true);
    let match_index = existing_id
        .and_then(|id| governance.members.iter().position(|member| member.id == id))
        .or_else(|| {
            (!external_id.is_empty()).then(|| {
                governance
                    .members
                    .iter()
                    .position(|member| member.external_id == external_id)
            })?
        })
        .or_else(|| {
            governance
                .members
                .iter()
                .position(|member| member.email.eq_ignore_ascii_case(&email))
        });
    let member = if let Some(index) = match_index {
        let current = &governance.members[index];
        if current.source == "manual" && existing_id.is_some() {
            return Err(scim_error(
                StatusCode::CONFLICT,
                "SCIM cannot modify a manually managed user until the IdP provisions that email.",
            ));
        }
        let active_owner_count = governance
            .members
            .iter()
            .filter(|member| member.active && member.role == "owner")
            .count();
        if current.role == "owner" && current.active && !active && active_owner_count == 1 {
            return Err(scim_error(
                StatusCode::CONFLICT,
                "SCIM cannot deactivate the last active organization owner.",
            ));
        }
        GovernanceMember {
            email,
            name: if name.is_empty() {
                current.name.clone()
            } else {
                name
            },
            active,
            source: "scim".into(),
            external_id,
            ..current.clone()
        }
    } else {
        GovernanceMember {
            id: format!("scim-user-{}", Uuid::new_v4()),
            name: if name.is_empty() { email.clone() } else { name },
            email,
            role: "editor".into(),
            active,
            source: "scim".into(),
            external_id,
            team_ids: Vec::new(),
            last_authenticated_at: String::new(),
        }
    };
    Ok(member)
}

fn save_user(governance: &mut GovernanceConfig, member: GovernanceMember) {
    if let Some(index) = governance
        .members
        .iter()
        .position(|candidate| candidate.id == member.id)
    {
        governance.members[index] = member;
    } else {
        governance.members.push(member);
    }
}

fn group_member_ids(value: &Value) -> Vec<String> {
    value
        .get("members")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|member| member.get("value").and_then(Value::as_str))
        .map(str::to_string)
        .take(10_000)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

fn sync_team_members(governance: &mut GovernanceConfig, team_id: &str, member_ids: &[String]) {
    let member_ids = member_ids.iter().cloned().collect::<HashSet<_>>();
    for member in &mut governance.members {
        if member_ids.contains(&member.id) {
            if !member.team_ids.iter().any(|id| id == team_id) {
                member.team_ids.push(team_id.to_string());
            }
        } else {
            member.team_ids.retain(|id| id != team_id);
        }
    }
}

fn upsert_group(
    governance: &mut GovernanceConfig,
    value: &Value,
    existing_id: Option<&str>,
) -> Result<GovernanceTeam, (StatusCode, Value, String)> {
    let name = body_string(value, "displayName");
    if name.is_empty() || name.len() > 500 {
        return Err(scim_error(
            StatusCode::BAD_REQUEST,
            "SCIM groups require a displayName of at most 500 bytes.",
        ));
    }
    let external_id = body_string(value, "externalId");
    let index = existing_id
        .and_then(|id| governance.teams.iter().position(|team| team.id == id))
        .or_else(|| {
            (!external_id.is_empty()).then(|| {
                governance
                    .teams
                    .iter()
                    .position(|team| team.external_id == external_id)
            })?
        });
    let member_ids = group_member_ids(value)
        .into_iter()
        .filter(|id| governance.members.iter().any(|member| &member.id == id))
        .collect::<Vec<_>>();
    let team = if let Some(index) = index {
        let current = &governance.teams[index];
        if current.source == "manual" && existing_id.is_some() {
            return Err(scim_error(
                StatusCode::CONFLICT,
                "SCIM cannot modify a manually managed team until the IdP provisions it.",
            ));
        }
        GovernanceTeam {
            name,
            external_id,
            source: "scim".into(),
            member_ids,
            ..current.clone()
        }
    } else {
        GovernanceTeam {
            id: format!("scim-team-{}", Uuid::new_v4()),
            name,
            external_id,
            source: "scim".into(),
            member_ids,
        }
    };
    sync_team_members(governance, &team.id, &team.member_ids);
    if let Some(index) = governance
        .teams
        .iter()
        .position(|candidate| candidate.id == team.id)
    {
        governance.teams[index] = team.clone();
    } else {
        governance.teams.push(team.clone());
    }
    Ok(team)
}

fn patch_operations(value: &Value) -> Vec<&Value> {
    value
        .get("Operations")
        .or_else(|| value.get("operations"))
        .and_then(Value::as_array)
        .map(|values| values.iter().collect())
        .unwrap_or_default()
}

fn patch_user_value(current: &GovernanceMember, patch: &Value) -> Value {
    let mut value = user_json_stub(current);
    for operation in patch_operations(patch) {
        let op = body_string(operation, "op").to_ascii_lowercase();
        let path = body_string(operation, "path");
        let operation_value = operation.get("value").cloned().unwrap_or(Value::Null);
        if path.is_empty() && operation_value.is_object() {
            if let (Some(target), Some(source)) =
                (value.as_object_mut(), operation_value.as_object())
            {
                target.extend(source.clone());
            }
        } else if matches!(op.as_str(), "add" | "replace") {
            value[path] = operation_value;
        }
    }
    value
}

fn user_json_stub(member: &GovernanceMember) -> Value {
    json!({ "externalId": member.external_id, "userName": member.email, "displayName": member.name, "active": member.active })
}

fn patch_group_value(current: &GovernanceTeam, patch: &Value) -> Value {
    let mut value = json!({
        "externalId": current.external_id,
        "displayName": current.name,
        "members": current.member_ids.iter().map(|id| json!({"value": id})).collect::<Vec<_>>(),
    });
    for operation in patch_operations(patch) {
        let op = body_string(operation, "op").to_ascii_lowercase();
        let path = body_string(operation, "path");
        let operation_value = operation.get("value").cloned().unwrap_or(Value::Null);
        if path.is_empty() && operation_value.is_object() {
            if let (Some(target), Some(source)) =
                (value.as_object_mut(), operation_value.as_object())
            {
                target.extend(source.clone());
            }
        } else if path.eq_ignore_ascii_case("members") {
            let target = value["members"]
                .as_array_mut()
                .expect("members is an array");
            let incoming = operation_value.as_array().cloned().unwrap_or_default();
            if op == "remove" {
                let removed = incoming
                    .iter()
                    .filter_map(|member| member.get("value").and_then(Value::as_str))
                    .collect::<HashSet<_>>();
                target.retain(|member| {
                    member
                        .get("value")
                        .and_then(Value::as_str)
                        .is_none_or(|id| !removed.contains(id))
                });
            } else if op == "replace" {
                *target = incoming;
            } else if op == "add" {
                target.extend(incoming);
            }
        } else if matches!(op.as_str(), "add" | "replace") {
            value[path] = operation_value;
        }
    }
    value
}

fn handle_scim(
    method: &Method,
    uri: &http::Uri,
    body: &[u8],
    governance: &mut GovernanceConfig,
) -> (StatusCode, Value, String) {
    let relative = uri.path().strip_prefix("/scim/v2").unwrap_or(uri.path());
    let segments = relative
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    let query = query_values(uri);
    match (method, segments.as_slice()) {
        (&Method::GET, ["ServiceProviderConfig"]) => (
            StatusCode::OK,
            json!({
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
                "patch": { "supported": true },
                "bulk": { "supported": false, "maxOperations": 0, "maxPayloadSize": 0 },
                "filter": { "supported": true, "maxResults": 1000 },
                "changePassword": { "supported": false },
                "sort": { "supported": false },
                "etag": { "supported": false },
                "authenticationSchemes": [{ "type": "oauthbearertoken", "name": "Bearer Token", "description": "OS-protected Brunomnia SCIM connector token", "specUri": "https://www.rfc-editor.org/rfc/rfc6750" }],
            }),
            "Read service-provider configuration.".into(),
        ),
        (&Method::GET, ["ResourceTypes"]) => (
            StatusCode::OK,
            list_response(
                vec![
                    json!({"id":"User","name":"User","endpoint":"/Users","schema":SCIM_USER_SCHEMA}),
                    json!({"id":"Group","name":"Group","endpoint":"/Groups","schema":SCIM_GROUP_SCHEMA}),
                ],
                &query,
            ),
            "Read SCIM resource types.".into(),
        ),
        (&Method::GET, ["Schemas"]) => (
            StatusCode::OK,
            list_response(
                vec![
                    json!({"id":SCIM_USER_SCHEMA,"name":"User","description":"Brunomnia organization user"}),
                    json!({"id":SCIM_GROUP_SCHEMA,"name":"Group","description":"Brunomnia organization team"}),
                ],
                &query,
            ),
            "Read SCIM schemas.".into(),
        ),
        (&Method::GET, ["Users"]) => {
            let filter = query.get("filter").map(String::as_str).unwrap_or_default();
            let mut members = governance
                .members
                .iter()
                .filter(|member| member.source == "scim")
                .collect::<Vec<_>>();
            if let Some(value) = filter
                .strip_prefix("userName eq \"")
                .and_then(|value| value.strip_suffix('"'))
            {
                members.retain(|member| member.email.eq_ignore_ascii_case(value));
            } else if let Some(value) = filter
                .strip_prefix("externalId eq \"")
                .and_then(|value| value.strip_suffix('"'))
            {
                members.retain(|member| member.external_id == value);
            }
            (
                StatusCode::OK,
                list_response(
                    members
                        .into_iter()
                        .map(|member| user_json(governance, member))
                        .collect(),
                    &query,
                ),
                "Listed SCIM users.".into(),
            )
        }
        (&Method::POST, ["Users"]) => {
            let value = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let member = match user_from_body(governance, &value, None) {
                Ok(member) => member,
                Err(error) => return error,
            };
            save_user(governance, member.clone());
            (
                StatusCode::CREATED,
                user_json(governance, &member),
                format!("Provisioned SCIM user {}.", member.email),
            )
        }
        (&Method::GET, ["Users", id]) => governance
            .members
            .iter()
            .find(|member| member.id == *id && member.source == "scim")
            .map(|member| {
                (
                    StatusCode::OK,
                    user_json(governance, member),
                    format!("Read SCIM user {id}."),
                )
            })
            .unwrap_or_else(|| scim_error(StatusCode::NOT_FOUND, "SCIM user not found.")),
        (&Method::PUT, ["Users", id]) => {
            let value = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let member = match user_from_body(governance, &value, Some(id)) {
                Ok(member) => member,
                Err(error) => return error,
            };
            save_user(governance, member.clone());
            (
                StatusCode::OK,
                user_json(governance, &member),
                format!("Replaced SCIM user {}.", member.email),
            )
        }
        (&Method::PATCH, ["Users", id]) => {
            let patch = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let Some(current) = governance
                .members
                .iter()
                .find(|member| member.id == *id && member.source == "scim")
                .cloned()
            else {
                return scim_error(StatusCode::NOT_FOUND, "SCIM user not found.");
            };
            let value = patch_user_value(&current, &patch);
            let member = match user_from_body(governance, &value, Some(id)) {
                Ok(member) => member,
                Err(error) => return error,
            };
            save_user(governance, member.clone());
            (
                StatusCode::OK,
                user_json(governance, &member),
                format!("Patched SCIM user {}.", member.email),
            )
        }
        (&Method::DELETE, ["Users", id]) => {
            let Some(current) = governance
                .members
                .iter()
                .find(|member| member.id == *id && member.source == "scim")
                .cloned()
            else {
                return scim_error(StatusCode::NOT_FOUND, "SCIM user not found.");
            };
            let mut value = user_json_stub(&current);
            value["active"] = Value::Bool(false);
            let member = match user_from_body(governance, &value, Some(id)) {
                Ok(member) => member,
                Err(error) => return error,
            };
            save_user(governance, member);
            (
                StatusCode::NO_CONTENT,
                Value::Null,
                format!("Deactivated SCIM user {id}."),
            )
        }
        (&Method::GET, ["Groups"]) => {
            let filter = query.get("filter").map(String::as_str).unwrap_or_default();
            let mut teams = governance
                .teams
                .iter()
                .filter(|team| team.source == "scim")
                .collect::<Vec<_>>();
            if let Some(value) = filter
                .strip_prefix("displayName eq \"")
                .and_then(|value| value.strip_suffix('"'))
            {
                teams.retain(|team| team.name.eq_ignore_ascii_case(value));
            } else if let Some(value) = filter
                .strip_prefix("externalId eq \"")
                .and_then(|value| value.strip_suffix('"'))
            {
                teams.retain(|team| team.external_id == value);
            }
            (
                StatusCode::OK,
                list_response(
                    teams
                        .into_iter()
                        .map(|team| group_json(governance, team))
                        .collect(),
                    &query,
                ),
                "Listed SCIM groups.".into(),
            )
        }
        (&Method::POST, ["Groups"]) => {
            let value = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let team = match upsert_group(governance, &value, None) {
                Ok(team) => team,
                Err(error) => return error,
            };
            (
                StatusCode::CREATED,
                group_json(governance, &team),
                format!("Provisioned SCIM group {}.", team.name),
            )
        }
        (&Method::GET, ["Groups", id]) => governance
            .teams
            .iter()
            .find(|team| team.id == *id && team.source == "scim")
            .map(|team| {
                (
                    StatusCode::OK,
                    group_json(governance, team),
                    format!("Read SCIM group {id}."),
                )
            })
            .unwrap_or_else(|| scim_error(StatusCode::NOT_FOUND, "SCIM group not found.")),
        (&Method::PUT, ["Groups", id]) => {
            let value = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let team = match upsert_group(governance, &value, Some(id)) {
                Ok(team) => team,
                Err(error) => return error,
            };
            (
                StatusCode::OK,
                group_json(governance, &team),
                format!("Replaced SCIM group {}.", team.name),
            )
        }
        (&Method::PATCH, ["Groups", id]) => {
            let patch = match parse_json_body(body) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let Some(current) = governance
                .teams
                .iter()
                .find(|team| team.id == *id && team.source == "scim")
                .cloned()
            else {
                return scim_error(StatusCode::NOT_FOUND, "SCIM group not found.");
            };
            let value = patch_group_value(&current, &patch);
            let team = match upsert_group(governance, &value, Some(id)) {
                Ok(team) => team,
                Err(error) => return error,
            };
            (
                StatusCode::OK,
                group_json(governance, &team),
                format!("Patched SCIM group {}.", team.name),
            )
        }
        (&Method::DELETE, ["Groups", id]) => {
            let Some(team) = governance
                .teams
                .iter()
                .find(|team| team.id == *id && team.source == "scim")
                .cloned()
            else {
                return scim_error(StatusCode::NOT_FOUND, "SCIM group not found.");
            };
            governance.teams.retain(|candidate| candidate.id != team.id);
            sync_team_members(governance, &team.id, &[]);
            (
                StatusCode::NO_CONTENT,
                Value::Null,
                format!("Deleted SCIM group {}.", team.name),
            )
        }
        _ => scim_error(StatusCode::NOT_FOUND, "SCIM endpoint not found."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn governance() -> GovernanceConfig {
        GovernanceConfig {
            current_member_id: "owner".into(),
            members: vec![GovernanceMember {
                id: "owner".into(),
                name: "Owner".into(),
                email: "owner@example.com".into(),
                role: "owner".into(),
                active: true,
                source: "manual".into(),
                external_id: String::new(),
                team_ids: Vec::new(),
                last_authenticated_at: String::new(),
            }],
            teams: Vec::new(),
            resource_grants: Vec::new(),
            organization: json!({}),
            sso: json!({}),
            scim: ScimConfig {
                enabled: true,
                bind_host: "127.0.0.1".into(),
                port: 49154,
                public_base_url: "https://identity.example/scim/v2".into(),
                token_id: String::new(),
                issued_at: String::new(),
                expires_at: String::new(),
                refresh_mode: "manual".into(),
                logs: Vec::new(),
            },
            policy: json!({}),
            audit: Vec::new(),
        }
    }

    #[test]
    fn scim_matches_manual_users_by_email_only_when_provisioned() {
        let mut governance = governance();
        governance.members.push(GovernanceMember {
            id: "manual".into(),
            name: "Manual".into(),
            email: "user@example.com".into(),
            role: "editor".into(),
            active: true,
            source: "manual".into(),
            external_id: String::new(),
            team_ids: Vec::new(),
            last_authenticated_at: String::new(),
        });
        let body =
            json!({"userName":"USER@example.com","externalId":"idp-1","displayName":"Provisioned"});
        let member = user_from_body(&mut governance, &body, None).unwrap();
        assert_eq!(member.id, "manual");
        assert_eq!(member.source, "scim");
        assert_eq!(member.external_id, "idp-1");
    }

    #[test]
    fn scim_refuses_to_deactivate_last_owner() {
        let mut governance = governance();
        governance.members[0].source = "scim".into();
        let body = json!({"userName":"owner@example.com","active":false});
        let error = user_from_body(&mut governance, &body, Some("owner")).unwrap_err();
        assert_eq!(error.0, StatusCode::CONFLICT);
    }

    #[test]
    fn scim_groups_update_both_membership_directions() {
        let mut governance = governance();
        let body = json!({"displayName":"Developers","externalId":"group-1","members":[{"value":"owner"}]});
        let team = upsert_group(&mut governance, &body, None).unwrap();
        assert_eq!(team.member_ids, vec!["owner"]);
        assert_eq!(governance.members[0].team_ids, vec![team.id]);
    }

    #[test]
    fn automatic_scim_tokens_extend_inside_the_twenty_day_window() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-07-21T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut token = StoredScimToken {
            version: 1,
            token_id: "token".into(),
            digest_base64: BASE64.encode([0_u8; 32]),
            issued_at: "2026-05-01T00:00:00Z".into(),
            expires_at: "2026-07-30T00:00:00Z".into(),
            refresh_mode: "oauth2".into(),
        };
        assert!(renew_automatic_scim_token(&mut token, now));
        assert!(chrono::DateTime::parse_from_rfc3339(&token.expires_at).unwrap() > now);
        assert!(!renew_automatic_scim_token(&mut token, now));
    }

    #[test]
    fn domain_validation_rejects_private_names_before_network() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let error = runtime
            .block_on(verify_domain(VerifyDomainInput {
                domain: "localhost".into(),
                challenge: "challenge".into(),
            }))
            .unwrap_err();
        assert!(error.contains("public DNS domain"));
    }
}

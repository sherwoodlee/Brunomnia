use crate::{
    client_identity::{effective_client_identity_pem, validate_certificate_material},
    models::{
        HttpHeaderOutput, HttpRedirectOutput, HttpRequestError, HttpRequestInput,
        HttpResponseOutput, TransportConfig,
    },
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use digest_auth::{AuthContext, HttpMethod as DigestMethod};
use reqwest::{
    header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE, SET_COOKIE, WWW_AUTHENTICATE},
    multipart, Certificate, Client, Method, RequestBuilder, Response, Version,
};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    sync::{Arc, Mutex},
    time::Instant,
};
use tokio::sync::oneshot;

#[cfg(test)]
use crate::client_identity::domain_matches;

#[derive(Clone, Copy, Debug, PartialEq)]
enum HttpVersionMode {
    Automatic,
    Http10,
    Http11,
    Http2,
    Http2PriorKnowledge,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum RedirectMode {
    Disabled,
    Limited(usize),
    Unlimited,
}

struct RedirectTrace {
    started: Instant,
    state: Mutex<RedirectTraceState>,
}

#[derive(Default)]
struct RedirectTraceState {
    entries: Vec<HttpRedirectOutput>,
    truncated: bool,
}

impl RedirectTrace {
    fn new(started: Instant) -> Self {
        Self {
            started,
            state: Mutex::new(RedirectTraceState::default()),
        }
    }

    fn record(&self, attempt: &reqwest::redirect::Attempt<'_>) {
        let from_url = attempt
            .previous()
            .last()
            .map(ToString::to_string)
            .unwrap_or_default();
        let mut state = self.state.lock().expect("redirect trace lock poisoned");
        if state.entries.len() >= 100 {
            state.truncated = true;
            return;
        }
        state.entries.push(HttpRedirectOutput {
            status: attempt.status().as_u16(),
            from_url,
            to_url: attempt.url().to_string(),
            elapsed_ms: self.started.elapsed().as_millis(),
        });
    }

    fn snapshot(&self) -> (Vec<HttpRedirectOutput>, bool) {
        let state = self.state.lock().expect("redirect trace lock poisoned");
        (state.entries.clone(), state.truncated)
    }
}

impl HttpRequestError {
    fn request(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            kind: "request".into(),
            elapsed_ms: 0,
            redirects: Vec::new(),
            redirects_truncated: false,
        }
    }

    fn from_reqwest(error: reqwest::Error) -> Self {
        let kind = if error.is_timeout() {
            "timeout"
        } else if error.is_connect() {
            "connect"
        } else if error.is_redirect() {
            "redirect"
        } else if error.is_decode() {
            "decode"
        } else if error.is_builder() {
            "request"
        } else if error.is_status() {
            "status"
        } else {
            "transport"
        };
        Self {
            message: error.to_string(),
            kind: kind.into(),
            elapsed_ms: 0,
            redirects: Vec::new(),
            redirects_truncated: false,
        }
    }

    fn with_trace(mut self, started: Instant, trace: &RedirectTrace) -> Self {
        let (redirects, redirects_truncated) = trace.snapshot();
        self.elapsed_ms = started.elapsed().as_millis();
        self.redirects = redirects;
        self.redirects_truncated = redirects_truncated;
        self
    }

    fn canceled(started: Instant) -> Self {
        Self {
            kind: "canceled".into(),
            elapsed_ms: started.elapsed().as_millis(),
            ..Self::request("Request canceled.")
        }
    }
}

impl From<String> for HttpRequestError {
    fn from(message: String) -> Self {
        Self::request(message)
    }
}

#[derive(Default)]
pub struct HttpCancellationState {
    registry: Mutex<HttpCancellationRegistry>,
}

#[derive(Default)]
struct HttpCancellationRegistry {
    active: HashMap<String, oneshot::Sender<()>>,
    pending: HashSet<String>,
}

impl HttpCancellationState {
    pub fn cancel(&self, cancellation_id: &str) -> bool {
        let mut registry = self
            .registry
            .lock()
            .expect("HTTP cancellation state lock poisoned");
        if let Some(sender) = registry.active.remove(cancellation_id) {
            return sender.send(()).is_ok();
        }
        if registry.pending.len() >= 1_024 {
            registry.pending.clear();
        }
        registry.pending.insert(cancellation_id.to_string());
        false
    }

    fn register(&self, cancellation_id: String) -> Option<oneshot::Receiver<()>> {
        let mut registry = self
            .registry
            .lock()
            .expect("HTTP cancellation state lock poisoned");
        if registry.pending.remove(&cancellation_id) {
            return None;
        }
        let (sender, receiver) = oneshot::channel();
        registry.active.insert(cancellation_id, sender);
        Some(receiver)
    }

    fn finish(&self, cancellation_id: &str) {
        let mut registry = self
            .registry
            .lock()
            .expect("HTTP cancellation state lock poisoned");
        registry.active.remove(cancellation_id);
        registry.pending.remove(cancellation_id);
    }
}

fn redirect_mode(transport: &TransportConfig) -> RedirectMode {
    if !transport.follow_redirects {
        RedirectMode::Disabled
    } else if transport.max_redirects < 0 {
        RedirectMode::Unlimited
    } else {
        RedirectMode::Limited(usize::try_from(transport.max_redirects).unwrap_or(usize::MAX))
    }
}

fn http_version_mode(transport: &TransportConfig) -> HttpVersionMode {
    match transport.preferred_http_version.as_str() {
        "http1.0" => HttpVersionMode::Http10,
        "http1.1" => HttpVersionMode::Http11,
        "http2" => HttpVersionMode::Http2,
        "http2-prior-knowledge" => HttpVersionMode::Http2PriorKnowledge,
        _ => HttpVersionMode::Automatic,
    }
}

pub fn apply_preferred_request_version(
    request: RequestBuilder,
    transport: &TransportConfig,
) -> RequestBuilder {
    match http_version_mode(transport) {
        HttpVersionMode::Http10 => request.version(Version::HTTP_10),
        HttpVersionMode::Http11 => request.version(Version::HTTP_11),
        _ => request,
    }
}

pub fn build_client(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_options(transport, request_url, true, true, None)
}

pub fn build_streaming_client(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_options(transport, request_url, false, true, None)
}

#[cfg(test)]
fn build_client_without_decompression(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_options(transport, request_url, true, false, None)
}

fn build_client_with_options(
    transport: &TransportConfig,
    request_url: Option<&str>,
    total_timeout: bool,
    automatic_decompression: bool,
    redirect_trace: Option<Arc<RedirectTrace>>,
) -> Result<Client, String> {
    validate_certificate_material(transport)?;
    let redirect_mode = redirect_mode(transport);
    let base_redirect = match redirect_mode {
        RedirectMode::Disabled => reqwest::redirect::Policy::none(),
        RedirectMode::Limited(limit) => reqwest::redirect::Policy::limited(limit),
        RedirectMode::Unlimited => reqwest::redirect::Policy::custom(|attempt| attempt.follow()),
    };
    let redirect =
        if let Some(trace) = redirect_trace.filter(|_| redirect_mode != RedirectMode::Disabled) {
            reqwest::redirect::Policy::custom(move |attempt| {
                trace.record(&attempt);
                base_redirect.redirect(attempt)
            })
        } else {
            base_redirect
        };
    let mut builder = Client::builder()
        .redirect(redirect)
        .danger_accept_invalid_certs(!transport.validate_certificates);
    if transport.timeout_ms > 0 {
        let timeout = std::time::Duration::from_millis(transport.timeout_ms);
        builder = builder.connect_timeout(timeout);
        if total_timeout {
            builder = builder.timeout(timeout);
        }
    }
    builder = match http_version_mode(transport) {
        HttpVersionMode::Http10 | HttpVersionMode::Http11 => builder.http1_only(),
        HttpVersionMode::Http2PriorKnowledge => builder.http2_prior_knowledge(),
        // The all-protocol client advertises h2 through TLS ALPN and retains HTTP/1 fallback.
        HttpVersionMode::Automatic | HttpVersionMode::Http2 => builder,
    };
    if !automatic_decompression {
        builder = builder.no_gzip().no_brotli().no_deflate().no_zstd();
    }

    if transport.validate_certificates && !transport.ca_certificate_pem.trim().is_empty() {
        let certificates = Certificate::from_pem_bundle(transport.ca_certificate_pem.as_bytes())
            .map_err(|error| format!("Invalid CA certificate PEM: {error}"))?;
        if certificates.is_empty() {
            return Err("The CA certificate PEM contains no certificates.".into());
        }
        for certificate in certificates {
            builder = builder.add_root_certificate(certificate);
        }
    }

    if transport.proxy_mode == "disabled" {
        builder = builder.no_proxy();
    } else if (transport.proxy_mode == "custom" || transport.proxy_mode.is_empty())
        && !transport.proxy_url.trim().is_empty()
    {
        let proxy = reqwest::Proxy::all(transport.proxy_url.trim())
            .map_err(|error| format!("Invalid proxy URL: {error}"))?
            .no_proxy(reqwest::NoProxy::from_string(
                transport.proxy_exclusions.trim(),
            ));
        builder = builder.proxy(proxy);
    }

    if let Some(identity) = effective_client_identity_pem(transport, request_url)? {
        let identity_pem = format!("{}\n{}", identity.certificate_pem, identity.private_key_pem);
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes())
            .map_err(|error| format!("Invalid client identity: {error}"))?;
        builder = builder.identity(identity);
    }

    builder.build().map_err(|error| error.to_string())
}

fn build_request(
    client: &Client,
    input: &HttpRequestInput,
    url: url::Url,
    authorization: Option<&str>,
) -> Result<RequestBuilder, String> {
    let method = Method::from_bytes(input.method.as_bytes())
        .map_err(|_| format!("Unsupported HTTP method: {}", input.method))?;
    let mut request =
        apply_preferred_request_version(client.request(method, url), &input.transport);

    for header in input.headers.iter().filter(|header| header.enabled) {
        request = request.header(&header.name, &header.value);
    }
    if let Some(value) = authorization {
        request = request.header(AUTHORIZATION, value);
    }

    request = match input.body_mode.as_str() {
        "none" => request,
        "json" | "text" | "graphql" => request.body(input.body.clone()),
        "form-urlencoded" => {
            let form: Vec<(String, String)> = input
                .form_body
                .iter()
                .filter(|field| field.enabled)
                .map(|field| (field.name.clone(), field.value.clone()))
                .collect();
            request.form(&form)
        }
        "multipart" => {
            let mut form = multipart::Form::new();
            for part in input.multipart_body.iter().filter(|part| {
                part.enabled
                    && (!part.name.is_empty()
                        || !part.value.is_empty()
                        || !part.file_name.is_empty()
                        || part
                            .file
                            .as_ref()
                            .is_some_and(|file| !file.file_name.is_empty()))
            }) {
                if part.kind == "file" {
                    let file = part
                        .file
                        .as_ref()
                        .ok_or_else(|| format!("Multipart field '{}' has no file.", part.name))?;
                    let bytes = STANDARD
                        .decode(&file.data_base64)
                        .map_err(|error| format!("Invalid base64 file payload: {error}"))?;
                    let file_name = if part.file_name.is_empty() {
                        &file.file_name
                    } else {
                        &part.file_name
                    };
                    let content_type = if part.content_type.is_empty() {
                        &file.mime_type
                    } else {
                        &part.content_type
                    };
                    let mut file_part = multipart::Part::bytes(bytes).file_name(file_name.clone());
                    if !content_type.is_empty() {
                        file_part = file_part
                            .mime_str(content_type)
                            .map_err(|error| format!("Invalid file MIME type: {error}"))?;
                    }
                    form = form.part(part.name.clone(), file_part);
                } else {
                    let mut text_part = multipart::Part::text(part.value.clone());
                    if !part.content_type.is_empty() {
                        text_part = text_part
                            .mime_str(&part.content_type)
                            .map_err(|error| format!("Invalid text-part MIME type: {error}"))?;
                    }
                    form = form.part(part.name.clone(), text_part);
                }
            }
            request.multipart(form)
        }
        "binary" => {
            let file = input
                .binary_body
                .as_ref()
                .ok_or_else(|| "Choose a binary file before sending.".to_string())?;
            let bytes = STANDARD
                .decode(&file.data_base64)
                .map_err(|error| format!("Invalid base64 file payload: {error}"))?;
            if !file.mime_type.is_empty()
                && !input.headers.iter().any(|header| {
                    header.enabled && header.name.eq_ignore_ascii_case(CONTENT_TYPE.as_str())
                })
            {
                request = request.header(CONTENT_TYPE, &file.mime_type);
            }
            request.body(bytes)
        }
        mode => return Err(format!("Unsupported body mode: {mode}")),
    };
    Ok(request)
}

async fn send_digest(
    client: &Client,
    input: &HttpRequestInput,
    url: url::Url,
) -> Result<Response, HttpRequestError> {
    let response = build_request(client, input, url.clone(), None)?
        .send()
        .await
        .map_err(HttpRequestError::from_reqwest)?;
    if response.status() != reqwest::StatusCode::UNAUTHORIZED {
        return Ok(response);
    }
    let challenge = response
        .headers()
        .get_all(WWW_AUTHENTICATE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .find(|value| value.trim_start().starts_with("Digest"))
        .ok_or_else(|| "The server returned 401 without a Digest challenge.".to_string())?;
    let mut prompt = digest_auth::parse(challenge)
        .map_err(|error| format!("Invalid Digest challenge: {error}"))?;
    let uri = match url.query() {
        Some(query) => format!("{}?{}", url.path(), query),
        None => url.path().to_string(),
    };
    let body = matches!(input.body_mode.as_str(), "json" | "text" | "graphql")
        .then_some(input.body.as_bytes());
    let context = AuthContext::new_with_method(
        input.auth.username.as_str(),
        input.auth.password.as_str(),
        uri,
        body,
        DigestMethod::from(input.method.as_str()),
    );
    let authorization = prompt
        .respond(&context)
        .map_err(|error| format!("Unable to answer Digest challenge: {error}"))?
        .to_string();
    build_request(client, input, url, Some(&authorization))?
        .send()
        .await
        .map_err(HttpRequestError::from_reqwest)
}

fn ntlm_challenge(header: &str) -> Option<&str> {
    header
        .split(',')
        .map(str::trim)
        .find_map(|value| value.strip_prefix("NTLM "))
}

async fn send_ntlm(
    client: &Client,
    input: &HttpRequestInput,
    url: url::Url,
) -> Result<Response, HttpRequestError> {
    let negotiate_flags = ntlmclient::Flags::NEGOTIATE_UNICODE
        | ntlmclient::Flags::REQUEST_TARGET
        | ntlmclient::Flags::NEGOTIATE_NTLM
        | ntlmclient::Flags::NEGOTIATE_WORKSTATION_SUPPLIED;
    let negotiate = ntlmclient::Message::Negotiate(ntlmclient::NegotiateMessage {
        flags: negotiate_flags,
        supplied_domain: input.auth.ntlm_domain.clone(),
        supplied_workstation: input.auth.ntlm_workstation.clone(),
        os_version: Default::default(),
    });
    let negotiate_header = format!(
        "NTLM {}",
        STANDARD.encode(
            negotiate
                .to_bytes()
                .map_err(|error| format!("Unable to encode NTLM negotiation: {error}"))?
        )
    );
    let response = build_request(client, input, url, Some(&negotiate_header))?
        .send()
        .await
        .map_err(HttpRequestError::from_reqwest)?;
    let authentication_url = response.url().clone();
    let challenge_header = response
        .headers()
        .get_all(WWW_AUTHENTICATE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .find_map(ntlm_challenge)
        .ok_or_else(|| "The server did not return an NTLM challenge.".to_string())?;
    let challenge_bytes = STANDARD
        .decode(challenge_header)
        .map_err(|error| format!("Invalid NTLM challenge encoding: {error}"))?;
    let challenge = ntlmclient::Message::try_from(challenge_bytes.as_slice())
        .map_err(|error| format!("Invalid NTLM challenge: {error}"))?;
    let challenge = match challenge {
        ntlmclient::Message::Challenge(value) => value,
        _ => {
            return Err(HttpRequestError::request(
                "The server returned the wrong NTLM message type.",
            ))
        }
    };
    let target_information = challenge
        .target_information
        .iter()
        .flat_map(|entry| entry.to_bytes())
        .collect::<Vec<_>>();
    let credentials = ntlmclient::Credentials {
        username: input.auth.username.clone(),
        password: input.auth.password.clone(),
        domain: input.auth.ntlm_domain.clone(),
    };
    let response = ntlmclient::respond_challenge_ntlm_v2(
        challenge.challenge,
        &target_information,
        ntlmclient::get_ntlm_time(),
        &credentials,
    );
    let authenticate = response.to_message(
        &credentials,
        &input.auth.ntlm_workstation,
        ntlmclient::Flags::NEGOTIATE_UNICODE | ntlmclient::Flags::NEGOTIATE_NTLM,
    );
    let authenticate_header = format!(
        "NTLM {}",
        STANDARD.encode(
            authenticate
                .to_bytes()
                .map_err(|error| format!("Unable to encode NTLM response: {error}"))?
        )
    );
    build_request(
        client,
        input,
        authentication_url,
        Some(&authenticate_header),
    )?
    .send()
    .await
    .map_err(HttpRequestError::from_reqwest)
}

fn netrc_credentials(source: &str, hostname: &str) -> Option<(String, String)> {
    let source = source
        .lines()
        .map(|line| line.split('#').next().unwrap_or_default())
        .collect::<Vec<_>>()
        .join(" ");
    let tokens = source.split_whitespace().collect::<Vec<_>>();
    let mut index = 0;
    let mut fallback = None;
    while index < tokens.len() {
        let matches = (tokens[index] == "machine" && tokens.get(index + 1) == Some(&hostname))
            || tokens[index] == "default";
        let is_default = tokens[index] == "default";
        index += if is_default { 1 } else { 2 };
        let mut login = None;
        let mut password = None;
        while index < tokens.len() && tokens[index] != "machine" && tokens[index] != "default" {
            if tokens[index] == "login" {
                login = tokens.get(index + 1).map(|value| (*value).to_string());
                index += 2;
            } else if tokens[index] == "password" {
                password = tokens.get(index + 1).map(|value| (*value).to_string());
                index += 2;
            } else {
                index += 1;
            }
        }
        if let (Some(login), Some(password)) = (login, password) {
            if matches && !is_default {
                return Some((login, password));
            }
            if is_default {
                fallback = Some((login, password));
            }
        }
    }
    fallback
}

async fn send_with_auth(
    client: &Client,
    input: &HttpRequestInput,
    url: url::Url,
) -> Result<Response, HttpRequestError> {
    if input.auth.disabled {
        return build_request(client, input, url, None)?
            .send()
            .await
            .map_err(HttpRequestError::from_reqwest);
    }
    match input.auth.auth_type.as_str() {
        "digest" => send_digest(client, input, url).await,
        "ntlm" => send_ntlm(client, input, url).await,
        "netrc" => {
            let hostname = url.host_str().unwrap_or_default();
            let (username, password) = netrc_credentials(&input.auth.netrc, hostname)
                .ok_or_else(|| format!("No Netrc credentials match '{hostname}'."))?;
            build_request(client, input, url, None)?
                .basic_auth(username, Some(password))
                .send()
                .await
                .map_err(HttpRequestError::from_reqwest)
        }
        _ => build_request(client, input, url, None)?
            .send()
            .await
            .map_err(HttpRequestError::from_reqwest),
    }
}

async fn read_response(
    response: Response,
    started: Instant,
    redirects: Vec<HttpRedirectOutput>,
    redirects_truncated: bool,
) -> Result<HttpResponseOutput, reqwest::Error> {
    let status = response.status();
    let http_version = format!("{:?}", response.version());
    let effective_url = response.url().to_string();
    let set_cookies = response
        .headers()
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::to_string)
        .collect();
    let headers = flatten_headers(response.headers());
    let header_lines = response
        .headers()
        .iter()
        .map(|(name, value)| HttpHeaderOutput {
            name: name.to_string(),
            value: value.to_str().unwrap_or("<binary header>").to_string(),
        })
        .collect();
    let bytes = response.bytes().await?;
    let size_bytes = bytes.len();
    let (body, body_base64) = response_body_fields(&bytes);

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers,
        header_lines,
        size_bytes,
        body,
        body_base64,
        duration_ms: started.elapsed().as_millis(),
        set_cookies,
        http_version,
        effective_url,
        redirects,
        redirects_truncated,
    })
}

fn response_body_fields(bytes: &[u8]) -> (String, Option<String>) {
    match std::str::from_utf8(bytes) {
        Ok(body) => (body.to_string(), None),
        Err(_) => (
            String::from_utf8_lossy(bytes).into_owned(),
            Some(STANDARD.encode(bytes)),
        ),
    }
}

pub async fn send(input: HttpRequestInput) -> Result<HttpResponseOutput, HttpRequestError> {
    let started = Instant::now();
    let trace = Arc::new(RedirectTrace::new(started));
    let url = url::Url::parse(&input.url)
        .map_err(|error| HttpRequestError::request(format!("Invalid URL: {error}")))?;
    let client = build_client_with_options(
        &input.transport,
        Some(&input.url),
        true,
        true,
        Some(Arc::clone(&trace)),
    )
    .map_err(|error| HttpRequestError::request(error).with_trace(started, trace.as_ref()))?;
    let response = send_with_auth(&client, &input, url.clone())
        .await
        .map_err(|error| error.with_trace(started, trace.as_ref()))?;
    let (redirects, redirects_truncated) = trace.snapshot();
    match read_response(response, started, redirects, redirects_truncated).await {
        Ok(output) => Ok(output),
        Err(error) if error.is_decode() => {
            let fallback_trace = Arc::new(RedirectTrace::new(started));
            let client = build_client_with_options(
                &input.transport,
                Some(&input.url),
                true,
                false,
                Some(Arc::clone(&fallback_trace)),
            )
            .map_err(|error| {
                HttpRequestError::request(error).with_trace(started, fallback_trace.as_ref())
            })?;
            let response = send_with_auth(&client, &input, url)
                .await
                .map_err(|error| error.with_trace(started, fallback_trace.as_ref()))?;
            let (redirects, redirects_truncated) = fallback_trace.snapshot();
            read_response(response, started, redirects, redirects_truncated)
                .await
                .map_err(|error| {
                    HttpRequestError::from_reqwest(error)
                        .with_trace(started, fallback_trace.as_ref())
                })
        }
        Err(error) => {
            Err(HttpRequestError::from_reqwest(error).with_trace(started, trace.as_ref()))
        }
    }
}

pub async fn send_cancellable(
    input: HttpRequestInput,
    cancellation_id: Option<String>,
    state: &HttpCancellationState,
) -> Result<HttpResponseOutput, HttpRequestError> {
    let started = Instant::now();
    let Some(cancellation_id) = cancellation_id.filter(|value| !value.is_empty()) else {
        return send(input).await;
    };
    let Some(cancellation) = state.register(cancellation_id.clone()) else {
        return Err(HttpRequestError::canceled(started));
    };
    let result = tokio::select! {
        result = send(input) => result,
        _ = cancellation => Err(HttpRequestError::canceled(started)),
    };
    state.finish(&cancellation_id);
    result
}

pub(crate) fn flatten_headers(headers: &HeaderMap) -> BTreeMap<String, String> {
    let mut output = BTreeMap::<String, String>::new();
    for (name, value) in headers {
        let value = value.to_str().unwrap_or("<binary header>");
        output
            .entry(name.to_string())
            .and_modify(|current| {
                current.push_str(", ");
                current.push_str(value);
            })
            .or_insert_with(|| value.to_string());
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{FilePayload, KeyValue, MultipartPart, NativeAuthConfig};

    fn body_test_input(body_mode: &str) -> HttpRequestInput {
        HttpRequestInput {
            method: "POST".into(),
            url: "http://127.0.0.1/".into(),
            headers: Vec::new(),
            body_mode: body_mode.into(),
            body: String::new(),
            form_body: Vec::new(),
            multipart_body: Vec::new(),
            binary_body: None,
            auth: NativeAuthConfig {
                disabled: true,
                ..Default::default()
            },
            transport: TransportConfig {
                preferred_http_version: "http1.1".into(),
                ..Default::default()
            },
        }
    }

    #[tokio::test]
    async fn signals_registered_http_cancellation_once() {
        let state = HttpCancellationState::default();
        let canceled = state.register("runner-item".into()).unwrap();

        assert!(state.cancel("runner-item"));
        assert!(canceled.await.is_ok());
        assert!(!state.cancel("runner-item"));
        assert!(state.register("runner-item".into()).is_none());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn cancels_an_in_flight_http_exchange() {
        use std::sync::Arc;
        use tokio::{net::TcpListener, time::Duration};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (ready_sender, ready_receiver) = oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let _ = read_loopback_request(&mut socket).await;
            let _ = ready_sender.send(());
            tokio::time::sleep(Duration::from_secs(5)).await;
        });
        let mut input = body_test_input("none");
        input.method = "GET".into();
        input.url = format!("http://{address}/slow");
        input.transport.timeout_ms = 0;
        let state = Arc::new(HttpCancellationState::default());
        let request_state = Arc::clone(&state);
        let request = tokio::spawn(async move {
            send_cancellable(input, Some("active-request".into()), request_state.as_ref()).await
        });

        ready_receiver.await.unwrap();
        assert!(state.cancel("active-request"));
        let result = tokio::time::timeout(Duration::from_secs(1), request)
            .await
            .unwrap()
            .unwrap();
        let error = result.unwrap_err();
        assert_eq!(error.message, "Request canceled.");
        assert_eq!(error.kind, "canceled");
        assert!(error.elapsed_ms > 0);
        server.abort();
    }

    #[tokio::test]
    async fn classifies_pre_response_connection_failures() {
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        drop(listener);
        let mut input = body_test_input("none");
        input.method = "GET".into();
        input.url = format!("http://{address}/unavailable");

        let error = send(input).await.unwrap_err();

        assert_eq!(error.kind, "connect");
        assert!(error.message.contains("error sending request"));
        assert!(error.redirects.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn captures_redirects_effective_url_and_duplicate_response_headers() {
        use tokio::{io::AsyncWriteExt, net::TcpListener};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for index in 0..2 {
                let (mut socket, _) = listener.accept().await.unwrap();
                let _ = read_loopback_request(&mut socket).await;
                let response = if index == 0 {
                    "HTTP/1.1 302 Found\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                } else {
                    "HTTP/1.1 200 OK\r\nX-Duplicate: first\r\nX-Duplicate: second\r\nSet-Cookie: one=1\r\nSet-Cookie: two=2\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok"
                };
                socket.write_all(response.as_bytes()).await.unwrap();
            }
        });
        let mut input = body_test_input("none");
        input.method = "GET".into();
        input.url = format!("http://{address}/start");

        let output = send(input).await.unwrap();

        assert_eq!(output.status, 200);
        assert_eq!(output.effective_url, format!("http://{address}/final"));
        assert_eq!(output.redirects.len(), 1);
        assert_eq!(output.redirects[0].status, 302);
        assert_eq!(
            output.redirects[0].from_url,
            format!("http://{address}/start")
        );
        assert_eq!(
            output.redirects[0].to_url,
            format!("http://{address}/final")
        );
        assert_eq!(
            output
                .header_lines
                .iter()
                .filter(|header| header.name == "x-duplicate")
                .map(|header| header.value.as_str())
                .collect::<Vec<_>>(),
            vec!["first", "second"]
        );
        assert_eq!(output.headers["x-duplicate"], "first, second");
        assert_eq!(output.set_cookies, vec!["one=1", "two=2"]);
        server.await.unwrap();
    }

    async fn read_loopback_request<S>(stream: &mut S) -> (String, Vec<u8>)
    where
        S: tokio::io::AsyncRead + Unpin,
    {
        use tokio::io::AsyncReadExt;

        let mut bytes = Vec::new();
        let header_end = loop {
            if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                break index + 4;
            }
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "request ended before its headers");
            bytes.extend_from_slice(&chunk[..read]);
        };
        let headers = String::from_utf8(bytes[..header_end].to_vec()).unwrap();
        let content_length = headers
            .lines()
            .filter_map(|line| line.split_once(':'))
            .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
            .and_then(|(_, value)| value.trim().parse::<usize>().ok())
            .unwrap_or(0);
        while bytes.len() < header_end + content_length {
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "request ended before its body");
            bytes.extend_from_slice(&chunk[..read]);
        }
        (
            headers,
            bytes[header_end..header_end + content_length].to_vec(),
        )
    }

    #[test]
    fn parses_matching_and_default_netrc_credentials() {
        let source = "machine api.example.com login alice password secret\ndefault login fallback password fallback-secret";
        assert_eq!(
            netrc_credentials(source, "api.example.com"),
            Some(("alice".into(), "secret".into()))
        );
        assert_eq!(
            netrc_credentials(source, "other.example.com"),
            Some(("fallback".into(), "fallback-secret".into()))
        );
    }

    #[test]
    fn scopes_client_certificates_to_exact_and_wildcard_domains() {
        assert!(domain_matches("api.example.com", "api.example.com"));
        assert!(domain_matches("*.example.com", "api.example.com"));
        assert!(!domain_matches("*.example.com", "example.com"));
        assert!(!domain_matches("api.example.com", "other.example.com"));
        assert!(domain_matches("::1", "[::1]"));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn trusts_workspace_ca_for_https_requests() {
        use rustls::ServerConfig;
        use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};
        use std::sync::Arc;
        use tokio::{io::AsyncWriteExt, net::TcpListener};
        use tokio_rustls::TlsAcceptor;

        const CA: &str = include_str!("../tests/fixtures/tls/ca.cert.pem");
        const CERTIFICATE: &str = include_str!("../tests/fixtures/tls/server.cert.pem");
        const KEY: &str = include_str!("../tests/fixtures/tls/server.key.pem");
        let certificates = CertificateDer::pem_slice_iter(CERTIFICATE.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let key = PrivateKeyDer::from_pem_slice(KEY.as_bytes()).unwrap();
        let mut config = ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certificates, key)
            .unwrap();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        let acceptor = TlsAcceptor::from(Arc::new(config));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut stream = acceptor.accept(stream).await.unwrap();
            let request = read_loopback_request(&mut stream).await;
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await
                .unwrap();
            request
        });

        let mut input = body_test_input("text");
        input.url = format!("https://127.0.0.1:{}/trusted", address.port());
        input.body = "hello".into();
        input.transport.ca_certificate_pem = CA.into();
        let response = send(input).await.unwrap();
        assert_eq!(response.status, 200);
        let (headers, body) = server.await.unwrap();
        assert!(headers.starts_with("POST /trusted HTTP/1.1"));
        assert_eq!(body, b"hello");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn sends_modern_pkcs12_identity_for_https_requests() {
        use rustls::{RootCertStore, ServerConfig};
        use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};
        use std::sync::Arc;
        use tokio::{io::AsyncWriteExt, net::TcpListener};
        use tokio_rustls::TlsAcceptor;

        const CA: &str = include_str!("../tests/fixtures/tls/ca.cert.pem");
        const CERTIFICATE: &str = include_str!("../tests/fixtures/tls/server.cert.pem");
        const KEY: &str = include_str!("../tests/fixtures/tls/server.key.pem");
        let certificates = CertificateDer::pem_slice_iter(CERTIFICATE.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let key = PrivateKeyDer::from_pem_slice(KEY.as_bytes()).unwrap();
        let mut roots = RootCertStore::empty();
        let authorities = CertificateDer::pem_slice_iter(CA.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(roots.add_parsable_certificates(authorities).0, 1);
        let verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(roots))
            .build()
            .unwrap();
        let mut config = ServerConfig::builder()
            .with_client_cert_verifier(verifier)
            .with_single_cert(certificates, key)
            .unwrap();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        let acceptor = TlsAcceptor::from(Arc::new(config));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut stream = acceptor.accept(stream).await.unwrap();
            let request = read_loopback_request(&mut stream).await;
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await
                .unwrap();
            request
        });

        let mut input = body_test_input("text");
        input.url = format!("https://127.0.0.1:{}/pfx", address.port());
        input.transport.validate_certificates = false;
        input.transport.client_certificate_pfx_base64 =
            crate::client_identity::test_pfx_base64("pfx-secret", false);
        input.transport.client_certificate_passphrase = "pfx-secret".into();
        let response = send(input).await.unwrap();
        assert_eq!(response.status, 200);
        assert!(server.await.unwrap().0.starts_with("POST /pfx HTTP/1.1"));
    }

    #[test]
    fn normalizes_preferred_http_version_modes() {
        let mode = |value: &str| {
            http_version_mode(&TransportConfig {
                preferred_http_version: value.into(),
                ..TransportConfig::default()
            })
        };
        assert_eq!(mode("default"), HttpVersionMode::Automatic);
        assert_eq!(mode("unknown"), HttpVersionMode::Automatic);
        assert_eq!(mode("http1.0"), HttpVersionMode::Http10);
        assert_eq!(mode("http1.1"), HttpVersionMode::Http11);
        assert_eq!(mode("http2"), HttpVersionMode::Http2);
        assert_eq!(
            mode("http2-prior-knowledge"),
            HttpVersionMode::Http2PriorKnowledge
        );

        for value in [
            "default",
            "http1.0",
            "http1.1",
            "http2",
            "http2-prior-knowledge",
        ] {
            let transport = TransportConfig {
                preferred_http_version: value.into(),
                ..TransportConfig::default()
            };
            let client = build_client(&transport, Some("https://example.test")).unwrap();
            let request =
                apply_preferred_request_version(client.get("https://example.test"), &transport)
                    .build()
                    .unwrap();
            let expected = match value {
                "http1.0" => Version::HTTP_10,
                "http1.1" => Version::HTTP_11,
                _ => Version::HTTP_11,
            };
            assert_eq!(request.version(), expected);
        }

        assert!(build_client_without_decompression(
            &TransportConfig::default(),
            Some("https://example.test")
        )
        .is_ok());
    }

    #[test]
    fn normalizes_redirect_policy_modes() {
        let mode = |follow_redirects, max_redirects| {
            redirect_mode(&TransportConfig {
                follow_redirects,
                max_redirects,
                ..TransportConfig::default()
            })
        };
        assert_eq!(mode(false, -1), RedirectMode::Disabled);
        assert_eq!(mode(false, 10), RedirectMode::Disabled);
        assert_eq!(mode(true, -1), RedirectMode::Unlimited);
        assert_eq!(mode(true, 0), RedirectMode::Limited(0));
        assert_eq!(mode(true, 10), RedirectMode::Limited(10));
    }

    #[test]
    fn preserves_exact_non_utf8_response_bytes() {
        assert_eq!(
            response_body_fields("héllo".as_bytes()),
            ("héllo".into(), None)
        );
        assert_eq!(
            response_body_fields(&[0x66, 0x80, 0x6f, 0x00]),
            ("f�o\0".into(), Some("ZoBvAA==".into()))
        );
    }

    #[test]
    fn defaults_binary_content_type_without_overriding_an_explicit_header() {
        let client = build_client(&TransportConfig::default(), Some("http://127.0.0.1/")).unwrap();
        let mut input = body_test_input("binary");
        input.binary_body = Some(FilePayload {
            file_name: "archive.bin".into(),
            mime_type: "application/x-archive".into(),
            data_base64: "AAH/".into(),
        });

        let request = build_request(
            &client,
            &input,
            url::Url::parse("http://127.0.0.1/").unwrap(),
            None,
        )
        .unwrap()
        .build()
        .unwrap();
        assert_eq!(request.headers()[CONTENT_TYPE], "application/x-archive");
        assert_eq!(
            request.body().and_then(reqwest::Body::as_bytes),
            Some(&[0, 1, 255][..])
        );

        input.headers = vec![KeyValue {
            name: "content-type".into(),
            value: "application/custom".into(),
            enabled: true,
        }];
        let request = build_request(
            &client,
            &input,
            url::Url::parse("http://127.0.0.1/").unwrap(),
            None,
        )
        .unwrap()
        .build()
        .unwrap();
        assert_eq!(request.headers()[CONTENT_TYPE], "application/custom");
    }

    #[tokio::test]
    async fn sends_ordered_repeated_and_empty_name_urlencoded_fields() {
        use tokio::{io::AsyncWriteExt, net::TcpListener};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let request = read_loopback_request(&mut stream).await;
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await
                .unwrap();
            request
        });

        let mut input = body_test_input("form-urlencoded");
        input.url = format!("http://{address}/form");
        input.form_body = vec![
            KeyValue {
                name: "repeat".into(),
                value: "one".into(),
                enabled: true,
            },
            KeyValue {
                name: "repeat".into(),
                value: "two & more".into(),
                enabled: true,
            },
            KeyValue {
                name: String::new(),
                value: "nameless".into(),
                enabled: true,
            },
            KeyValue {
                name: String::new(),
                value: String::new(),
                enabled: true,
            },
            KeyValue {
                name: "disabled".into(),
                value: "omit".into(),
                enabled: false,
            },
        ];

        let response = send(input).await.unwrap();
        assert_eq!(response.status, 200);
        let (headers, body) = server.await.unwrap();
        assert!(headers.lines().any(
            |line| line.eq_ignore_ascii_case("content-type: application/x-www-form-urlencoded")
        ));
        assert_eq!(
            String::from_utf8(body).unwrap(),
            "repeat=one&repeat=two+%26+more&=nameless&="
        );
    }

    #[tokio::test]
    async fn sends_enabled_multipart_metadata_and_exact_file_bytes() {
        use tokio::{io::AsyncWriteExt, net::TcpListener};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let request = read_loopback_request(&mut stream).await;
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await
                .unwrap();
            request
        });

        let mut input = body_test_input("multipart");
        input.url = format!("http://{address}/upload");
        input.multipart_body = vec![
            MultipartPart {
                name: "payload".into(),
                value: "{\"ok\":true}\nsecond".into(),
                enabled: true,
                kind: "text".into(),
                file: None,
                content_type: "application/json".into(),
                file_name: String::new(),
            },
            MultipartPart {
                name: "attachment".into(),
                value: String::new(),
                enabled: true,
                kind: "file".into(),
                file: Some(FilePayload {
                    file_name: "source.bin".into(),
                    mime_type: "application/octet-stream".into(),
                    data_base64: "AP8KDQ==".into(),
                }),
                content_type: "application/x-custom".into(),
                file_name: "renamed.bin".into(),
            },
            MultipartPart {
                name: "disabled".into(),
                value: "omit".into(),
                enabled: false,
                kind: "text".into(),
                file: None,
                content_type: String::new(),
                file_name: String::new(),
            },
            MultipartPart {
                name: String::new(),
                value: String::new(),
                enabled: true,
                kind: "text".into(),
                file: None,
                content_type: "application/x-omit".into(),
                file_name: String::new(),
            },
            MultipartPart {
                name: String::new(),
                value: "nameless".into(),
                enabled: true,
                kind: "text".into(),
                file: None,
                content_type: String::new(),
                file_name: String::new(),
            },
            MultipartPart {
                name: "repeat".into(),
                value: "first".into(),
                enabled: true,
                kind: "text".into(),
                file: None,
                content_type: String::new(),
                file_name: String::new(),
            },
            MultipartPart {
                name: "repeat".into(),
                value: "second".into(),
                enabled: true,
                kind: "text".into(),
                file: None,
                content_type: String::new(),
                file_name: String::new(),
            },
        ];

        let response = send(input).await.unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.body, "ok");

        let (headers, body) = server.await.unwrap();
        let content_type = headers
            .lines()
            .filter_map(|line| line.split_once(':'))
            .find(|(name, _)| name.eq_ignore_ascii_case("content-type"))
            .map(|(_, value)| value.trim())
            .unwrap();
        assert!(content_type.starts_with("multipart/form-data; boundary="));
        let body_text = String::from_utf8_lossy(&body);
        assert!(body_text.contains("Content-Disposition: form-data; name=\"payload\""));
        assert!(body_text.contains("Content-Type: application/json"));
        assert!(body_text.contains("{\"ok\":true}\nsecond"));
        assert!(body_text.contains(
            "Content-Disposition: form-data; name=\"attachment\"; filename=\"renamed.bin\""
        ));
        assert!(body_text.contains("Content-Type: application/x-custom"));
        assert!(!body_text.contains("disabled"));
        assert!(!body_text.contains("application/x-omit"));
        assert!(body_text.contains("Content-Disposition: form-data; name=\"\""));
        assert!(body_text.contains("nameless"));
        assert_eq!(body_text.matches("name=\"repeat\"").count(), 2);
        assert!(body.windows(4).any(|window| window == [0, 255, 10, 13]));
    }
}

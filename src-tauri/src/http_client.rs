use crate::models::{HttpRequestInput, HttpResponseOutput, TransportConfig};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use digest_auth::{AuthContext, HttpMethod as DigestMethod};
use reqwest::{
    header::{HeaderMap, AUTHORIZATION, SET_COOKIE, WWW_AUTHENTICATE},
    multipart, Client, Method, RequestBuilder, Response, Version,
};
use std::{collections::BTreeMap, time::Instant};

#[derive(Clone, Copy, Debug, PartialEq)]
enum HttpVersionMode {
    Automatic,
    Http10,
    Http11,
    Http2,
    Http2PriorKnowledge,
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

fn domain_matches(pattern: &str, hostname: &str) -> bool {
    let pattern = pattern.trim().to_ascii_lowercase();
    let hostname = hostname.to_ascii_lowercase();
    if pattern == "*" {
        return true;
    }
    if let Some(suffix) = pattern.strip_prefix("*.") {
        return hostname.ends_with(&format!(".{suffix}"));
    }
    hostname == pattern
}

fn identity_enabled(transport: &TransportConfig, request_url: Option<&str>) -> bool {
    if transport.client_certificate_domains.trim().is_empty() {
        return true;
    }
    let hostname = request_url
        .and_then(|value| url::Url::parse(value).ok())
        .and_then(|value| value.host_str().map(str::to_string));
    hostname.is_some_and(|hostname| {
        transport
            .client_certificate_domains
            .split([',', '\n'])
            .any(|pattern| domain_matches(pattern, &hostname))
    })
}

pub fn build_client(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_timeout(transport, request_url, true)
}

pub fn build_streaming_client(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_timeout(transport, request_url, false)
}

fn build_client_with_timeout(
    transport: &TransportConfig,
    request_url: Option<&str>,
    total_timeout: bool,
) -> Result<Client, String> {
    let redirect = if transport.follow_redirects {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };
    let mut builder = Client::builder()
        .redirect(redirect)
        .danger_accept_invalid_certs(!transport.validate_certificates)
        .connect_timeout(std::time::Duration::from_millis(
            transport.timeout_ms.clamp(100, 600_000),
        ));
    if total_timeout {
        builder = builder.timeout(std::time::Duration::from_millis(
            transport.timeout_ms.clamp(100, 600_000),
        ));
    }
    builder = match http_version_mode(transport) {
        HttpVersionMode::Http10 | HttpVersionMode::Http11 => builder.http1_only(),
        HttpVersionMode::Http2PriorKnowledge => builder.http2_prior_knowledge(),
        // The all-protocol client advertises h2 through TLS ALPN and retains HTTP/1 fallback.
        HttpVersionMode::Automatic | HttpVersionMode::Http2 => builder,
    };

    if !transport.proxy_url.trim().is_empty() {
        let proxy = reqwest::Proxy::all(transport.proxy_url.trim())
            .map_err(|error| format!("Invalid proxy URL: {error}"))?
            .no_proxy(reqwest::NoProxy::from_string(
                transport.proxy_exclusions.trim(),
            ));
        builder = builder.proxy(proxy);
    }

    if !transport.client_certificate_pem.trim().is_empty()
        || !transport.client_key_pem.trim().is_empty()
    {
        if transport.client_certificate_pem.trim().is_empty()
            || transport.client_key_pem.trim().is_empty()
        {
            return Err("A client certificate and private key must be supplied together.".into());
        }
        if identity_enabled(transport, request_url) {
            let identity_pem = format!(
                "{}\n{}",
                transport.client_certificate_pem.trim(),
                transport.client_key_pem.trim()
            );
            let identity = reqwest::Identity::from_pem(identity_pem.as_bytes())
                .map_err(|error| format!("Invalid client identity PEM: {error}"))?;
            builder = builder.identity(identity);
        }
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
            for part in input.multipart_body.iter().filter(|part| part.enabled) {
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
) -> Result<Response, String> {
    let response = build_request(client, input, url.clone(), None)?
        .send()
        .await
        .map_err(|error| error.to_string())?;
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
        .map_err(|error| error.to_string())
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
) -> Result<Response, String> {
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
        .map_err(|error| error.to_string())?;
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
        _ => return Err("The server returned the wrong NTLM message type.".into()),
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
    .map_err(|error| error.to_string())
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
) -> Result<Response, String> {
    if input.auth.disabled {
        return build_request(client, input, url, None)?
            .send()
            .await
            .map_err(|error| error.to_string());
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
                .map_err(|error| error.to_string())
        }
        _ => build_request(client, input, url, None)?
            .send()
            .await
            .map_err(|error| error.to_string()),
    }
}

pub async fn send(input: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    let url = url::Url::parse(&input.url).map_err(|error| format!("Invalid URL: {error}"))?;
    let client = build_client(&input.transport, Some(&input.url))?;

    let started = Instant::now();
    let response = send_with_auth(&client, &input, url).await?;
    let status = response.status();
    let http_version = format!("{:?}", response.version());
    let set_cookies = response
        .headers()
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::to_string)
        .collect();
    let headers = flatten_headers(response.headers());
    let body = response.text().await.map_err(|error| error.to_string())?;

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers,
        size_bytes: body.len(),
        body,
        duration_ms: started.elapsed().as_millis(),
        set_cookies,
        http_version,
    })
}

fn flatten_headers(headers: &HeaderMap) -> BTreeMap<String, String> {
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
    }
}

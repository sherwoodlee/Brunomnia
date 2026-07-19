use crate::models::{HttpRequestInput, HttpResponseOutput, TransportConfig};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use digest_auth::{AuthContext, HttpMethod as DigestMethod};
use reqwest::{
    header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE, SET_COOKIE, WWW_AUTHENTICATE},
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

#[derive(Clone, Copy, Debug, PartialEq)]
enum RedirectMode {
    Disabled,
    Limited(usize),
    Unlimited,
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

pub(crate) fn identity_enabled(transport: &TransportConfig, request_url: Option<&str>) -> bool {
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
    build_client_with_options(transport, request_url, true, true)
}

pub fn build_streaming_client(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_options(transport, request_url, false, true)
}

fn build_client_without_decompression(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Client, String> {
    build_client_with_options(transport, request_url, true, false)
}

fn build_client_with_options(
    transport: &TransportConfig,
    request_url: Option<&str>,
    total_timeout: bool,
    automatic_decompression: bool,
) -> Result<Client, String> {
    let redirect = match redirect_mode(transport) {
        RedirectMode::Disabled => reqwest::redirect::Policy::none(),
        RedirectMode::Limited(limit) => reqwest::redirect::Policy::limited(limit),
        RedirectMode::Unlimited => reqwest::redirect::Policy::custom(|attempt| attempt.follow()),
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

async fn read_response(
    response: Response,
    started: Instant,
) -> Result<HttpResponseOutput, reqwest::Error> {
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
    let bytes = response.bytes().await?;
    let size_bytes = bytes.len();
    let (body, body_base64) = response_body_fields(&bytes);

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers,
        size_bytes,
        body,
        body_base64,
        duration_ms: started.elapsed().as_millis(),
        set_cookies,
        http_version,
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

pub async fn send(input: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    let url = url::Url::parse(&input.url).map_err(|error| format!("Invalid URL: {error}"))?;
    let client = build_client(&input.transport, Some(&input.url))?;

    let started = Instant::now();
    let response = send_with_auth(&client, &input, url.clone()).await?;
    match read_response(response, started).await {
        Ok(output) => Ok(output),
        Err(error) if error.is_decode() => {
            let client = build_client_without_decompression(&input.transport, Some(&input.url))?;
            let response = send_with_auth(&client, &input, url).await?;
            read_response(response, started)
                .await
                .map_err(|fallback_error| fallback_error.to_string())
        }
        Err(error) => Err(error.to_string()),
    }
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

    async fn read_loopback_request(stream: &mut tokio::net::TcpStream) -> (String, Vec<u8>) {
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
            .unwrap();
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
        assert!(body.windows(4).any(|window| window == [0, 255, 10, 13]));
    }
}

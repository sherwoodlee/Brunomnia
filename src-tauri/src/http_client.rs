use crate::models::{HttpRequestInput, HttpResponseOutput, TransportConfig};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::{header::HeaderMap, multipart, Client, Method};
use std::{collections::BTreeMap, time::Instant};

pub fn build_client(transport: &TransportConfig) -> Result<Client, String> {
    let redirect = if transport.follow_redirects {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };
    let mut builder = Client::builder()
        .redirect(redirect)
        .timeout(std::time::Duration::from_millis(
            transport.timeout_ms.clamp(100, 600_000),
        ))
        .danger_accept_invalid_certs(!transport.validate_certificates);

    if !transport.proxy_url.trim().is_empty() {
        let proxy = reqwest::Proxy::all(transport.proxy_url.trim())
            .map_err(|error| format!("Invalid proxy URL: {error}"))?;
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
        let identity_pem = format!(
            "{}\n{}",
            transport.client_certificate_pem.trim(),
            transport.client_key_pem.trim()
        );
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes())
            .map_err(|error| format!("Invalid client identity PEM: {error}"))?;
        builder = builder.identity(identity);
    }

    builder.build().map_err(|error| error.to_string())
}

pub async fn send(input: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    let method = Method::from_bytes(input.method.as_bytes())
        .map_err(|_| format!("Unsupported HTTP method: {}", input.method))?;
    let url = url::Url::parse(&input.url).map_err(|error| format!("Invalid URL: {error}"))?;
    let client = build_client(&input.transport)?;
    let mut request = client.request(method, url);

    for header in input.headers.into_iter().filter(|header| header.enabled) {
        request = request.header(&header.name, &header.value);
    }

    request = match input.body_mode.as_str() {
        "none" => request,
        "json" | "text" | "graphql" => request.body(input.body),
        "form-urlencoded" => {
            let form: Vec<(String, String)> = input
                .form_body
                .into_iter()
                .filter(|field| field.enabled)
                .map(|field| (field.name, field.value))
                .collect();
            request.form(&form)
        }
        "multipart" => {
            let mut form = multipart::Form::new();
            for part in input.multipart_body.into_iter().filter(|part| part.enabled) {
                if part.kind == "file" {
                    let file = part
                        .file
                        .ok_or_else(|| format!("Multipart field '{}' has no file.", part.name))?;
                    let bytes = STANDARD
                        .decode(&file.data_base64)
                        .map_err(|error| format!("Invalid base64 file payload: {error}"))?;
                    let mut file_part = multipart::Part::bytes(bytes).file_name(file.file_name);
                    if !file.mime_type.is_empty() {
                        file_part = file_part
                            .mime_str(&file.mime_type)
                            .map_err(|error| format!("Invalid file MIME type: {error}"))?;
                    }
                    form = form.part(part.name, file_part);
                } else {
                    form = form.text(part.name, part.value);
                }
            }
            request.multipart(form)
        }
        "binary" => {
            let file = input
                .binary_body
                .ok_or_else(|| "Choose a binary file before sending.".to_string())?;
            let bytes = STANDARD
                .decode(&file.data_base64)
                .map_err(|error| format!("Invalid base64 file payload: {error}"))?;
            request.body(bytes)
        }
        mode => return Err(format!("Unsupported body mode: {mode}")),
    };

    let started = Instant::now();
    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let headers = flatten_headers(response.headers());
    let body = response.text().await.map_err(|error| error.to_string())?;

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers,
        size_bytes: body.len(),
        body,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn flatten_headers(headers: &HeaderMap) -> BTreeMap<String, String> {
    headers
        .iter()
        .map(|(name, value)| {
            (
                name.to_string(),
                value.to_str().unwrap_or("<binary header>").to_string(),
            )
        })
        .collect()
}

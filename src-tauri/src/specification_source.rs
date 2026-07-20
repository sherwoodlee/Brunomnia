use futures_util::StreamExt;
use reqwest::{redirect::Policy, Url};
use std::{net::IpAddr, time::Duration};
use tokio::net::lookup_host;

const SOURCE_LIMIT: usize = 1_000_000;

fn is_private_or_loopback(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_unspecified()
                || address.octets()[0] == 0
        }
        IpAddr::V6(address) => {
            address.is_loopback()
                || address.is_unspecified()
                || (address.segments()[0] & 0xfe00) == 0xfc00
                || (address.segments()[0] & 0xffc0) == 0xfe80
                || address
                    .to_ipv4_mapped()
                    .is_some_and(|mapped| is_private_or_loopback(IpAddr::V4(mapped)))
        }
    }
}

async fn validate_url(raw_url: &str) -> Result<Url, String> {
    let url = Url::parse(raw_url)
        .map_err(|_| "Remote specification source URL is invalid.".to_string())?;
    if url.scheme() != "https" {
        return Err("Remote specification sources must use HTTPS.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Remote specification source URLs cannot contain credentials.".into());
    }
    let host = url
        .host_str()
        .filter(|host| !host.is_empty())
        .ok_or_else(|| "Remote specification source URL has no host.".to_string())?;
    if host.eq_ignore_ascii_case("localhost") || host.to_ascii_lowercase().ends_with(".localhost") {
        return Err("Remote specification source targets a private or loopback host.".into());
    }
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = lookup_host((host, port))
        .await
        .map_err(|error| format!("Failed to resolve remote specification source: {error}"))?;
    for address in addresses {
        if is_private_or_loopback(address.ip()) {
            return Err(
                "Remote specification source resolves to a private or loopback address.".into(),
            );
        }
    }
    Ok(url)
}

pub async fn fetch(raw_url: &str) -> Result<String, String> {
    let url = validate_url(raw_url).await?;
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;
    let response =
        client.get(url.clone()).send().await.map_err(|error| {
            format!("Failed to fetch remote specification source '{url}': {error}")
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch remote specification source '{}': {}",
            url,
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > SOURCE_LIMIT as u64)
    {
        return Err("Remote specification source exceeds the 1 MB limit.".into());
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        if bytes.len() + chunk.len() > SOURCE_LIMIT {
            return Err("Remote specification source exceeds the 1 MB limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| "Remote specification source is not valid UTF-8.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_private_and_public_addresses() {
        for address in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.1.1",
            "192.168.1.1",
            "::1",
            "fd00::1",
            "fe80::1",
        ] {
            assert!(
                is_private_or_loopback(address.parse().unwrap()),
                "{address}"
            );
        }
        for address in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
            assert!(
                !is_private_or_loopback(address.parse().unwrap()),
                "{address}"
            );
        }
    }

    #[tokio::test]
    async fn rejects_non_https_and_loopback_sources_before_fetch() {
        assert!(validate_url("http://example.com/spec.yaml")
            .await
            .unwrap_err()
            .contains("HTTPS"));
        assert!(validate_url("https://127.0.0.1/spec.yaml")
            .await
            .unwrap_err()
            .contains("private or loopback"));
    }

    #[tokio::test]
    #[ignore = "requires the immutable public Kong/insomnia OpenAPI fixture"]
    async fn fetches_immutable_public_specification_fixture() {
        let contents = fetch("https://raw.githubusercontent.com/Kong/insomnia/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia-smoke-test/fixtures/openapi3.yaml")
            .await
            .unwrap();
        assert!(contents.starts_with("openapi: 3.0.0"));
        assert!(contents.contains("title: Smoke Test API server"));
    }
}

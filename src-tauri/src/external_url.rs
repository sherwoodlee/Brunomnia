#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
use std::process::Command;

const MAX_EXTERNAL_URL_LENGTH: usize = 8_192;

fn normalized_external_url(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("External URL cannot be empty.".into());
    }
    if value.len() > MAX_EXTERNAL_URL_LENGTH {
        return Err("External URL exceeds the 8 KiB limit.".into());
    }
    let parsed = url::Url::parse(value).map_err(|_| "External URL is malformed.".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Only HTTP and HTTPS response links can be opened.".into());
    }
    Ok(parsed.to_string())
}

pub fn open(value: &str) -> Result<(), String> {
    let url = normalized_external_url(value)?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("/usr/bin/open");
        command.arg(&url);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32.exe");
        command.arg("url.dll,FileProtocolHandler").arg(&url);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("/usr/bin/xdg-open");
        command.arg(&url);
        command
    };

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Unable to open response link: {error}"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("Opening external URLs is not supported on this platform.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_bounded_http_and_https_urls() {
        assert_eq!(
            normalized_external_url(" https://example.test/a path?q=one ").unwrap(),
            "https://example.test/a%20path?q=one"
        );
        assert_eq!(
            normalized_external_url("http://example.test").unwrap(),
            "http://example.test/"
        );
        for value in ["", "not a URL", "javascript:alert(1)", "file:///tmp/secret"] {
            assert!(normalized_external_url(value).is_err());
        }
        assert!(normalized_external_url(&format!(
            "https://example.test/{}",
            "x".repeat(MAX_EXTERNAL_URL_LENGTH)
        ))
        .is_err());
    }
}

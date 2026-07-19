use crate::models::TransportConfig;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use p12_keystore::KeyStore;

const MAX_CERTIFICATE_TEXT_BYTES: usize = 1_048_576;
const MAX_CA_CERTIFICATE_TEXT_BYTES: usize = 5_242_880;
const MAX_CERTIFICATE_PFX_BYTES: usize = 5_242_880;
const MAX_CERTIFICATE_PASSPHRASE_BYTES: usize = 4_096;
const MAX_CERTIFICATE_PFX_BASE64_BYTES: usize = MAX_CERTIFICATE_PFX_BYTES.div_ceil(3) * 4;

pub(crate) struct ClientIdentityPem {
    pub certificate_pem: String,
    pub private_key_pem: String,
}

fn pem_block(label: &str, der: &[u8]) -> String {
    let encoded = STANDARD.encode(der);
    let mut pem = format!("-----BEGIN {label}-----\n");
    for line in encoded.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(line).expect("base64 output is ASCII"));
        pem.push('\n');
    }
    pem.push_str(&format!("-----END {label}-----\n"));
    pem
}

pub(crate) fn domain_matches(pattern: &str, hostname: &str) -> bool {
    let pattern = pattern.trim().trim_matches(['[', ']']).to_ascii_lowercase();
    let hostname = hostname.trim_matches(['[', ']']).to_ascii_lowercase();
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

pub(crate) fn validate_certificate_material(transport: &TransportConfig) -> Result<(), String> {
    if transport.ca_certificate_pem.len() > MAX_CA_CERTIFICATE_TEXT_BYTES {
        return Err("The CA certificate PEM exceeds the 5 MiB limit.".into());
    }
    if transport.client_certificate_pem.len() > MAX_CERTIFICATE_TEXT_BYTES {
        return Err("The client certificate PEM exceeds the 1 MiB limit.".into());
    }
    if transport.client_key_pem.len() > MAX_CERTIFICATE_TEXT_BYTES {
        return Err("The client private key PEM exceeds the 1 MiB limit.".into());
    }
    if transport.client_certificate_pfx_base64.len() > MAX_CERTIFICATE_PFX_BASE64_BYTES {
        return Err("The client PFX/PKCS#12 identity exceeds the 5 MiB limit.".into());
    }
    if transport.client_certificate_passphrase.len() > MAX_CERTIFICATE_PASSPHRASE_BYTES {
        return Err("The client-certificate passphrase exceeds the 4 KiB limit.".into());
    }
    let has_pfx = !transport.client_certificate_pfx_base64.trim().is_empty();
    let has_certificate = !transport.client_certificate_pem.trim().is_empty();
    let has_key = !transport.client_key_pem.trim().is_empty();
    if has_pfx && (has_certificate || has_key) {
        return Err(
            "Use either a PFX/PKCS#12 identity or a PEM certificate and key, not both.".into(),
        );
    }
    if !has_pfx && has_certificate != has_key {
        return Err("A client certificate and private key must be supplied together.".into());
    }
    Ok(())
}

pub(crate) fn effective_client_identity_pem(
    transport: &TransportConfig,
    request_url: Option<&str>,
) -> Result<Option<ClientIdentityPem>, String> {
    validate_certificate_material(transport)?;
    let has_pfx = !transport.client_certificate_pfx_base64.trim().is_empty();
    let has_pem = !transport.client_certificate_pem.trim().is_empty();
    if (!has_pfx && !has_pem) || !identity_enabled(transport, request_url) {
        return Ok(None);
    }
    if has_pem {
        return Ok(Some(ClientIdentityPem {
            certificate_pem: transport.client_certificate_pem.trim().to_string(),
            private_key_pem: transport.client_key_pem.trim().to_string(),
        }));
    }
    let pfx_der = STANDARD
        .decode(transport.client_certificate_pfx_base64.trim())
        .map_err(|_| "The client PFX/PKCS#12 identity is not valid base64.".to_string())?;
    if pfx_der.len() > MAX_CERTIFICATE_PFX_BYTES {
        return Err("The client PFX/PKCS#12 identity exceeds the 5 MiB limit.".into());
    }
    let store = KeyStore::from_pkcs12(&pfx_der, &transport.client_certificate_passphrase)
        .map_err(|error| format!("Invalid PFX/PKCS#12 identity or passphrase: {error}"))?;
    let (_, identity) = store.private_key_chain().ok_or_else(|| {
        "The PFX/PKCS#12 identity contains no private-key certificate chain.".to_string()
    })?;
    if identity.key().is_empty() || identity.chain().is_empty() {
        return Err("The PFX/PKCS#12 identity contains no usable client identity.".into());
    }
    let certificate_pem = identity
        .chain()
        .iter()
        .map(|certificate| pem_block("CERTIFICATE", certificate.as_der()))
        .collect::<String>();
    Ok(Some(ClientIdentityPem {
        certificate_pem,
        private_key_pem: pem_block("PRIVATE KEY", identity.key()),
    }))
}

#[cfg(test)]
pub(crate) fn test_pfx_base64(password: &str, legacy: bool) -> String {
    use p12_keystore::{Certificate, EncryptionAlgorithm, KeyStoreEntry, PrivateKeyChain};
    use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};

    let certificate = CertificateDer::pem_slice_iter(
        include_str!("../tests/fixtures/tls/client.cert.pem").as_bytes(),
    )
    .next()
    .unwrap()
    .unwrap();
    let key = PrivateKeyDer::from_pem_slice(
        include_str!("../tests/fixtures/tls/client.key.pkcs8.pem").as_bytes(),
    )
    .unwrap();
    let chain = PrivateKeyChain::new(
        key.secret_der(),
        b"brunomnia-test-client",
        [Certificate::from_der(certificate.as_ref()).unwrap()],
    );
    let mut store = KeyStore::new();
    store.add_entry(
        "brunomnia-test-client",
        KeyStoreEntry::PrivateKeyChain(chain),
    );
    let writer = store.writer(password);
    let der = if legacy {
        writer
            .encryption_algorithm(EncryptionAlgorithm::PbeWithShaAnd3KeyTripleDesCbc)
            .write()
            .unwrap()
    } else {
        writer.write().unwrap()
    };
    STANDARD.encode(der)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_conflicting_or_oversized_identity_material() {
        let mut transport = TransportConfig {
            client_certificate_pem: "cert".into(),
            client_key_pem: "key".into(),
            client_certificate_pfx_base64: "cGZ4".into(),
            ..TransportConfig::default()
        };
        assert!(validate_certificate_material(&transport)
            .unwrap_err()
            .contains("either a PFX/PKCS#12"));
        transport.client_certificate_pem.clear();
        transport.client_key_pem.clear();
        transport.client_certificate_pfx_base64 = "A".repeat(MAX_CERTIFICATE_PFX_BASE64_BYTES + 1);
        assert!(validate_certificate_material(&transport)
            .unwrap_err()
            .contains("5 MiB"));
    }

    #[test]
    fn scopes_identity_domains_before_parsing_pfx() {
        let transport = TransportConfig {
            client_certificate_pfx_base64: "not-base64".into(),
            client_certificate_domains: "*.example.test".into(),
            ..TransportConfig::default()
        };
        assert!(
            effective_client_identity_pem(&transport, Some("https://outside.test"))
                .unwrap()
                .is_none()
        );
        let error =
            match effective_client_identity_pem(&transport, Some("https://api.example.test")) {
                Err(error) => error,
                Ok(_) => panic!("matching malformed PFX must fail"),
            };
        assert!(error.contains("base64"));
    }

    #[test]
    fn decodes_modern_and_legacy_pkcs12_identity_chains() {
        for legacy in [false, true] {
            let transport = TransportConfig {
                client_certificate_pfx_base64: test_pfx_base64("correct horse", legacy),
                client_certificate_passphrase: "correct horse".into(),
                ..TransportConfig::default()
            };
            let identity = effective_client_identity_pem(&transport, Some("https://api.test"))
                .unwrap()
                .unwrap();
            assert!(identity.certificate_pem.contains("BEGIN CERTIFICATE"));
            assert!(identity.private_key_pem.contains("BEGIN PRIVATE KEY"));
            let invalid = TransportConfig {
                client_certificate_passphrase: "wrong".into(),
                ..transport
            };
            let error = match effective_client_identity_pem(&invalid, Some("https://api.test")) {
                Err(error) => error,
                Ok(_) => panic!("wrong PKCS#12 passphrase must fail"),
            };
            assert!(error.contains("passphrase"));
        }
    }

    #[test]
    fn decodes_openssl_modern_pkcs12_identity() {
        let transport = TransportConfig {
            client_certificate_pfx_base64: include_str!(
                "../tests/fixtures/tls/client.openssl-modern.p12.b64"
            )
            .trim()
            .into(),
            client_certificate_passphrase: "openssl-secret".into(),
            ..TransportConfig::default()
        };
        let identity = effective_client_identity_pem(&transport, Some("https://api.test"))
            .unwrap()
            .unwrap();
        assert_eq!(
            identity
                .certificate_pem
                .matches("BEGIN CERTIFICATE")
                .count(),
            2
        );
        assert!(identity.private_key_pem.contains("BEGIN PRIVATE KEY"));
    }
}

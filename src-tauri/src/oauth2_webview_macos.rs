use crate::{client_identity::effective_client_identity_pem, models::TransportConfig};
use block2::DynBlock;
use core_foundation::{
    base::{TCFType, ToVoid},
    data::CFData,
    dictionary::CFDictionary,
    error::{CFError, CFErrorRef},
    string::CFString,
};
use objc2::{
    ffi, msg_send,
    runtime::{AnyClass, AnyObject, AnyProtocol, Bool, Imp, Sel},
    sel, ClassType,
};
use objc2_foundation::{
    NSArray, NSURLAuthenticationChallenge, NSURLCredential, NSURLCredentialPersistence,
    NSURLSessionAuthChallengeDisposition,
};
use objc2_security::{
    SecCertificate as ObjcSecCertificate, SecIdentity as ObjcSecIdentity, SecTrust as ObjcSecTrust,
};
use objc2_web_kit::WKWebView;
use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};
use security_framework::{certificate::SecCertificate, identity::SecIdentity, key::SecKey};
use security_framework_sys::{
    base::{SecCertificateRef, SecIdentityRef, SecKeyRef},
    certificate::SecCertificateCopyKey,
    item::{
        kSecAttrKeyClass, kSecAttrKeyClassPrivate, kSecAttrKeyType,
        kSecAttrKeyTypeECSECPrimeRandom, kSecAttrKeyTypeRSA,
    },
    key::SecKeyCreateWithData,
};
use std::{
    collections::HashMap,
    ffi::c_void,
    ptr,
    sync::{Mutex, OnceLock},
};
use url::Url;

const SERVER_TRUST_METHOD: &str = "NSURLAuthenticationMethodServerTrust";
const CLIENT_CERTIFICATE_METHOD: &str = "NSURLAuthenticationMethodClientCertificate";

unsafe extern "C" {
    fn SecIdentityCreate(
        allocator: *const c_void,
        certificate: SecCertificateRef,
        private_key: SecKeyRef,
    ) -> SecIdentityRef;
}

pub(crate) struct PreparedOAuthWebviewPolicy {
    flow_id: String,
    authorization_url: Url,
    validate_certificates: bool,
    client_identity: Option<PreparedClientIdentity>,
}

struct PreparedClientIdentity {
    certificate_pem: String,
    private_key_pem: String,
}

#[derive(Clone)]
struct OAuthWebviewPolicy {
    flow_id: String,
    authorization_url: Url,
    validate_certificates: bool,
    client_identity: Option<MacClientIdentity>,
}

#[derive(Clone)]
struct MacClientIdentity {
    identity: SecIdentity,
    certificates: Vec<SecCertificate>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ChallengeAction {
    Default,
    Cancel,
    TrustServer,
    UseClientIdentity,
}

static POLICIES: OnceLock<Mutex<HashMap<usize, OAuthWebviewPolicy>>> = OnceLock::new();
static DELEGATE_HOOK: OnceLock<Result<(), String>> = OnceLock::new();

fn policies() -> &'static Mutex<HashMap<usize, OAuthWebviewPolicy>> {
    POLICIES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn prepare_policy(
    flow_id: &str,
    authorization_url: &Url,
    validate_certificates: bool,
    transport: TransportConfig,
) -> Result<PreparedOAuthWebviewPolicy, String> {
    let client_identity =
        effective_client_identity_pem(&transport, Some(authorization_url.as_str()))?.map(
            |identity| PreparedClientIdentity {
                certificate_pem: identity.certificate_pem,
                private_key_pem: identity.private_key_pem,
            },
        );
    Ok(PreparedOAuthWebviewPolicy {
        flow_id: flow_id.to_string(),
        authorization_url: authorization_url.clone(),
        validate_certificates,
        client_identity,
    })
}

pub(crate) unsafe fn install_policy(
    raw_webview: *mut c_void,
    prepared: PreparedOAuthWebviewPolicy,
) -> Result<(), String> {
    if raw_webview.is_null() {
        return Err("The OAuth browser did not expose its native WebView.".into());
    }
    let webview = unsafe { &*raw_webview.cast::<WKWebView>() };
    install_delegate_hook(webview)?;
    let client_identity = prepared
        .client_identity
        .map(import_client_identity)
        .transpose()?;
    policies()
        .lock()
        .map_err(|_| "The OAuth certificate policy lock was poisoned.".to_string())?
        .insert(
            webview as *const WKWebView as usize,
            OAuthWebviewPolicy {
                flow_id: prepared.flow_id,
                authorization_url: prepared.authorization_url,
                validate_certificates: prepared.validate_certificates,
                client_identity,
            },
        );
    Ok(())
}

pub(crate) fn remove_policy(flow_id: &str) {
    if let Ok(mut policies) = policies().lock() {
        policies.retain(|_, policy| policy.flow_id != flow_id);
    }
}

fn import_client_identity(prepared: PreparedClientIdentity) -> Result<MacClientIdentity, String> {
    let certificates = CertificateDer::pem_slice_iter(prepared.certificate_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Invalid OAuth client certificate PEM: {error}"))?
        .into_iter()
        .map(|certificate| {
            SecCertificate::from_der(certificate.as_ref())
                .map_err(|error| format!("Invalid OAuth client certificate: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let certificate = certificates
        .first()
        .ok_or_else(|| "The OAuth client certificate PEM contains no certificates.".to_string())?;
    let private_key = import_private_key(&prepared.private_key_pem, certificate)?;
    let raw_identity = unsafe {
        SecIdentityCreate(
            ptr::null(),
            certificate.as_concrete_TypeRef(),
            private_key.as_concrete_TypeRef(),
        )
    };
    if raw_identity.is_null() {
        return Err("The OAuth client certificate does not match its private key.".into());
    }
    Ok(MacClientIdentity {
        identity: unsafe { SecIdentity::wrap_under_create_rule(raw_identity) },
        certificates,
    })
}

fn import_private_key(
    private_key_pem: &str,
    certificate: &SecCertificate,
) -> Result<SecKey, String> {
    let private_key = PrivateKeyDer::from_pem_slice(private_key_pem.as_bytes())
        .map_err(|error| format!("Invalid OAuth client private key PEM: {error}"))?;
    let raw_public_key = unsafe { SecCertificateCopyKey(certificate.as_concrete_TypeRef()) };
    if raw_public_key.is_null() {
        return Err("Unable to read the OAuth client certificate public key.".into());
    }
    let public_key = unsafe { SecKey::wrap_under_create_rule(raw_public_key) };
    let public_attributes = public_key.attributes();
    let key_type = public_attributes
        .find(unsafe { kSecAttrKeyType }.to_void())
        .map(|value| unsafe { CFString::wrap_under_get_rule((*value).cast()) })
        .ok_or_else(|| "The OAuth client certificate key type is unavailable.".to_string())?;
    let rsa_type = unsafe { CFString::wrap_under_get_rule(kSecAttrKeyTypeRSA) };
    let ec_type = unsafe { CFString::wrap_under_get_rule(kSecAttrKeyTypeECSECPrimeRandom) };
    let key_data = if key_type == rsa_type {
        match &private_key {
            PrivateKeyDer::Pkcs1(key) => key.secret_pkcs1_der().to_vec(),
            PrivateKeyDer::Pkcs8(key) => pkcs8_private_key(key.secret_pkcs8_der())?.to_vec(),
            _ => return Err("The OAuth client certificate requires an RSA private key.".into()),
        }
    } else if key_type == ec_type {
        let sec1 = match &private_key {
            PrivateKeyDer::Sec1(key) => key.secret_sec1_der(),
            PrivateKeyDer::Pkcs8(key) => pkcs8_private_key(key.secret_pkcs8_der())?,
            _ => {
                return Err(
                    "The OAuth client certificate requires an elliptic-curve private key.".into(),
                )
            }
        };
        let scalar = sec1_private_scalar(sec1)?;
        let public_data = public_key.external_representation().ok_or_else(|| {
            "Unable to export the OAuth client certificate public key.".to_string()
        })?;
        let public_data = public_data.bytes();
        if public_data.first() != Some(&4) || (public_data.len() - 1) % 2 != 0 {
            return Err("The OAuth client certificate has an unsupported EC public key.".into());
        }
        let scalar_size = (public_data.len() - 1) / 2;
        let scalar = scalar
            .strip_prefix(&[0])
            .filter(|scalar| scalar.len() <= scalar_size)
            .unwrap_or(scalar);
        if scalar.len() > scalar_size {
            return Err("The OAuth client private key exceeds its certificate curve size.".into());
        }
        let mut x963 = Vec::with_capacity(public_data.len() + scalar_size);
        x963.extend_from_slice(public_data);
        x963.resize(public_data.len() + scalar_size - scalar.len(), 0);
        x963.extend_from_slice(scalar);
        x963
    } else {
        return Err("The OAuth client certificate uses an unsupported private-key type.".into());
    };
    create_private_key(&key_data, &key_type)
}

fn create_private_key(key_data: &[u8], key_type: &CFString) -> Result<SecKey, String> {
    let data = CFData::from_buffer(key_data);
    let attribute_key_type = unsafe { CFString::wrap_under_get_rule(kSecAttrKeyType) };
    let attribute_key_class = unsafe { CFString::wrap_under_get_rule(kSecAttrKeyClass) };
    let private_key_class = unsafe { CFString::wrap_under_get_rule(kSecAttrKeyClassPrivate) };
    let attributes = CFDictionary::from_CFType_pairs(&[
        (attribute_key_type, key_type.as_CFType()),
        (attribute_key_class, private_key_class.as_CFType()),
    ]);
    let mut error: CFErrorRef = ptr::null_mut();
    let raw_key = unsafe {
        SecKeyCreateWithData(
            data.as_concrete_TypeRef(),
            attributes.as_concrete_TypeRef(),
            &mut error,
        )
    };
    if !raw_key.is_null() {
        return Ok(unsafe { SecKey::wrap_under_create_rule(raw_key) });
    }
    let message = if error.is_null() {
        "Security.framework rejected the key data.".into()
    } else {
        unsafe { CFError::wrap_under_create_rule(error) }.to_string()
    };
    Err(format!("Invalid OAuth client private key: {message}"))
}

fn pkcs8_private_key(input: &[u8]) -> Result<&[u8], String> {
    let sequence = der_value(input, 0x30)?.0;
    let (_, remaining) = der_value(sequence, 0x02)?;
    let (_, remaining) = der_value(remaining, 0x30)?;
    der_value(remaining, 0x04)
        .map(|(private_key, _)| private_key)
        .map_err(|_| "The OAuth PKCS#8 private key is malformed.".into())
}

fn sec1_private_scalar(input: &[u8]) -> Result<&[u8], String> {
    let sequence = der_value(input, 0x30)?.0;
    let (_, remaining) = der_value(sequence, 0x02)?;
    der_value(remaining, 0x04)
        .map(|(scalar, _)| scalar)
        .map_err(|_| "The OAuth SEC1 private key is malformed.".into())
}

fn der_value(input: &[u8], expected_tag: u8) -> Result<(&[u8], &[u8]), String> {
    if input.first() != Some(&expected_tag) || input.len() < 2 {
        return Err("The OAuth private key contains invalid DER.".into());
    }
    let first_length = input[1];
    let (length, offset) = if first_length & 0x80 == 0 {
        (first_length as usize, 2)
    } else {
        let length_bytes = (first_length & 0x7f) as usize;
        if length_bytes == 0
            || length_bytes > std::mem::size_of::<usize>()
            || input.len() < 2 + length_bytes
        {
            return Err("The OAuth private key contains invalid DER.".into());
        }
        let mut length = 0usize;
        for byte in &input[2..2 + length_bytes] {
            length = length
                .checked_mul(256)
                .and_then(|length| length.checked_add(*byte as usize))
                .ok_or_else(|| "The OAuth private key DER length overflowed.".to_string())?;
        }
        (length, 2 + length_bytes)
    };
    let end = offset
        .checked_add(length)
        .filter(|end| *end <= input.len())
        .ok_or_else(|| "The OAuth private key contains truncated DER.".to_string())?;
    Ok((&input[offset..end], &input[end..]))
}

fn install_delegate_hook(webview: &WKWebView) -> Result<(), String> {
    DELEGATE_HOOK
        .get_or_init(|| unsafe {
            let delegate = webview.navigationDelegate().ok_or_else(|| {
                "The OAuth browser did not expose its navigation delegate.".to_string()
            })?;
            let object: &AnyObject = AsRef::<AnyObject>::as_ref(&*delegate);
            let class = object.class();
            add_delegate_hook(class)
        })
        .clone()
}

unsafe fn add_delegate_hook(class: &AnyClass) -> Result<(), String> {
    let selector = sel!(webView:didReceiveAuthenticationChallenge:completionHandler:);
    let implementation = authentication_challenge_implementation();
    if let Some(method) = class.instance_method(selector) {
        return if method.implementation() as usize == implementation as usize {
            Ok(())
        } else {
            Err(
                "The OAuth browser navigation delegate already handles authentication challenges."
                    .into(),
            )
        };
    }
    let protocol = AnyProtocol::get(c"WKNavigationDelegate")
        .ok_or_else(|| "The WebKit navigation protocol is unavailable.".to_string())?;
    let description =
        unsafe { ffi::protocol_getMethodDescription(protocol, selector, Bool::NO, Bool::YES) };
    if description.types.is_null() {
        return Err("The WebKit authentication-challenge signature is unavailable.".into());
    }
    let added = unsafe {
        ffi::class_addMethod(
            class as *const AnyClass as *mut AnyClass,
            selector,
            implementation,
            description.types,
        )
    };
    if !added.as_bool() {
        return Err("Unable to install the OAuth authentication-challenge handler.".into());
    }
    Ok(())
}

fn authentication_challenge_implementation() -> Imp {
    let implementation: unsafe extern "C-unwind" fn(
        &AnyObject,
        Sel,
        &WKWebView,
        &NSURLAuthenticationChallenge,
        &DynBlock<dyn Fn(NSURLSessionAuthChallengeDisposition, *mut NSURLCredential)>,
    ) = handle_authentication_challenge;
    unsafe { std::mem::transmute(implementation) }
}

unsafe extern "C-unwind" fn handle_authentication_challenge(
    _delegate: &AnyObject,
    _selector: Sel,
    webview: &WKWebView,
    challenge: &NSURLAuthenticationChallenge,
    completion: &DynBlock<dyn Fn(NSURLSessionAuthChallengeDisposition, *mut NSURLCredential)>,
) {
    let protection_space = challenge.protectionSpace();
    let authentication_method = protection_space.authenticationMethod().to_string();
    let host = protection_space.host().to_string();
    let protocol = protection_space.protocol().map(|value| value.to_string());
    let port = protection_space.port();
    let previous_failures = challenge.previousFailureCount();
    let policies = match policies().lock() {
        Ok(policies) => policies,
        Err(_) => {
            completion.call((
                NSURLSessionAuthChallengeDisposition::PerformDefaultHandling,
                ptr::null_mut(),
            ));
            return;
        }
    };
    let policy = policies
        .get(&(webview as *const WKWebView as usize))
        .cloned();
    drop(policies);
    let Some(policy) = policy else {
        completion.call((
            NSURLSessionAuthChallengeDisposition::PerformDefaultHandling,
            ptr::null_mut(),
        ));
        return;
    };
    match challenge_action(
        &policy,
        &authentication_method,
        &host,
        port,
        protocol.as_deref(),
        previous_failures,
    ) {
        ChallengeAction::Default => completion.call((
            NSURLSessionAuthChallengeDisposition::PerformDefaultHandling,
            ptr::null_mut(),
        )),
        ChallengeAction::Cancel => completion.call((
            NSURLSessionAuthChallengeDisposition::CancelAuthenticationChallenge,
            ptr::null_mut(),
        )),
        ChallengeAction::TrustServer => {
            let trust: *mut ObjcSecTrust = unsafe { msg_send![&*protection_space, serverTrust] };
            if trust.is_null() {
                completion.call((
                    NSURLSessionAuthChallengeDisposition::PerformDefaultHandling,
                    ptr::null_mut(),
                ));
                return;
            }
            let credential = unsafe { server_trust_credential(&*trust) };
            completion.call((
                NSURLSessionAuthChallengeDisposition::UseCredential,
                credential,
            ));
        }
        ChallengeAction::UseClientIdentity => {
            let Some(client_identity) = policy.client_identity.as_ref() else {
                completion.call((
                    NSURLSessionAuthChallengeDisposition::PerformDefaultHandling,
                    ptr::null_mut(),
                ));
                return;
            };
            let credential = unsafe { client_identity_credential(client_identity) };
            completion.call((
                NSURLSessionAuthChallengeDisposition::UseCredential,
                credential,
            ));
        }
    }
}

unsafe fn server_trust_credential(trust: &ObjcSecTrust) -> *mut NSURLCredential {
    unsafe { msg_send![NSURLCredential::class(), credentialForTrust: trust] }
}

unsafe fn client_identity_credential(client_identity: &MacClientIdentity) -> *mut NSURLCredential {
    let identity =
        unsafe { &*(client_identity.identity.as_concrete_TypeRef() as *const ObjcSecIdentity) };
    let certificates = client_identity
        .certificates
        .iter()
        .map(|certificate| unsafe {
            &*(certificate.as_concrete_TypeRef() as *const ObjcSecCertificate)
        })
        .collect::<Vec<_>>();
    let certificates = NSArray::from_slice(&certificates);
    unsafe {
        msg_send![
            NSURLCredential::class(),
            credentialWithIdentity: identity,
            certificates: &*certificates,
            persistence: NSURLCredentialPersistence::ForSession
        ]
    }
}

fn challenge_action(
    policy: &OAuthWebviewPolicy,
    authentication_method: &str,
    host: &str,
    port: isize,
    protocol: Option<&str>,
    previous_failures: isize,
) -> ChallengeAction {
    if authentication_method == SERVER_TRUST_METHOD {
        if policy.validate_certificates {
            ChallengeAction::Default
        } else if previous_failures > 0 {
            ChallengeAction::Cancel
        } else {
            ChallengeAction::TrustServer
        }
    } else if authentication_method == CLIENT_CERTIFICATE_METHOD
        && policy.client_identity.is_some()
        && protection_space_matches(&policy.authorization_url, host, port, protocol)
    {
        if previous_failures > 0 {
            ChallengeAction::Cancel
        } else {
            ChallengeAction::UseClientIdentity
        }
    } else {
        ChallengeAction::Default
    }
}

fn protection_space_matches(
    expected: &Url,
    host: &str,
    port: isize,
    protocol: Option<&str>,
) -> bool {
    if !expected
        .host_str()
        .is_some_and(|expected_host| expected_host.eq_ignore_ascii_case(host))
    {
        return false;
    }
    if protocol.is_some_and(|protocol| !protocol.eq_ignore_ascii_case(expected.scheme())) {
        return false;
    }
    let expected_port = expected.port_or_known_default().unwrap_or(0) as isize;
    let actual_port = if port > 0 {
        port
    } else if protocol.is_some_and(|protocol| protocol.eq_ignore_ascii_case("http")) {
        80
    } else {
        443
    };
    expected_port == actual_port
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy(validate_certificates: bool, with_identity: bool) -> OAuthWebviewPolicy {
        OAuthWebviewPolicy {
            flow_id: "test-flow".into(),
            authorization_url: Url::parse("https://identity.example:9443/authorize").unwrap(),
            validate_certificates,
            client_identity: with_identity.then(|| {
                import_client_identity(PreparedClientIdentity {
                    certificate_pem: include_str!("../tests/fixtures/tls/client.cert.pem").into(),
                    private_key_pem: include_str!("../tests/fixtures/tls/client.key.pem").into(),
                })
                .unwrap()
            }),
        }
    }

    #[test]
    fn imports_pem_identity_without_persisting_it_to_a_keychain() {
        let identity = policy(true, true).client_identity.unwrap();
        assert_eq!(identity.certificates.len(), 1);
        assert!(identity.identity.certificate().is_ok());
        assert!(identity.identity.private_key().is_ok());
        objc2::rc::autoreleasepool(|_| {
            assert!(!unsafe { client_identity_credential(&identity) }.is_null());
            let trust = security_framework::trust::SecTrust::create_with_certificates(
                &identity.certificates,
                &[security_framework::policy::SecPolicy::create_x509()],
            )
            .unwrap();
            let trust = unsafe { &*(trust.as_concrete_TypeRef() as *const ObjcSecTrust) };
            assert!(!unsafe { server_trust_credential(trust) }.is_null());
        });
    }

    #[test]
    fn imports_pkcs12_identity_without_persisting_it_to_a_keychain() {
        let prepared = prepare_policy(
            "pfx-flow",
            &Url::parse("https://identity.example/authorize").unwrap(),
            true,
            TransportConfig {
                client_certificate_pfx_base64: crate::client_identity::test_pfx_base64(
                    "oauth-secret",
                    false,
                ),
                client_certificate_passphrase: "oauth-secret".into(),
                ..TransportConfig::default()
            },
        )
        .unwrap()
        .client_identity
        .map(import_client_identity)
        .transpose()
        .unwrap()
        .unwrap();
        assert!(prepared.identity.certificate().is_ok());
        assert!(prepared.identity.private_key().is_ok());
    }

    #[test]
    fn imports_rsa_pkcs1_identity_without_persisting_it_to_a_keychain() {
        let identity = import_client_identity(PreparedClientIdentity {
            certificate_pem: include_str!("../tests/fixtures/tls/client-rsa.cert.pem").into(),
            private_key_pem: include_str!("../tests/fixtures/tls/client-rsa.key.pem").into(),
        })
        .unwrap();
        assert!(identity.identity.certificate().is_ok());
        assert!(identity.identity.private_key().is_ok());
    }

    #[test]
    fn installs_the_optional_webkit_challenge_selector_on_a_delegate_class() {
        let builder = objc2::runtime::ClassBuilder::new(
            c"BrunomniaOAuthChallengeDelegateTest",
            objc2::runtime::NSObject::class(),
        )
        .unwrap();
        let class = builder.register();
        unsafe { add_delegate_hook(class) }.unwrap();
        assert!(class
            .instance_method(sel!(webView:didReceiveAuthenticationChallenge:completionHandler:))
            .is_some());
    }

    #[test]
    fn scopes_server_trust_and_client_identity_challenges() {
        assert_eq!(
            challenge_action(
                &policy(true, false),
                SERVER_TRUST_METHOD,
                "identity.example",
                9443,
                Some("https"),
                0
            ),
            ChallengeAction::Default
        );
        assert_eq!(
            challenge_action(
                &policy(false, false),
                SERVER_TRUST_METHOD,
                "identity.example",
                9443,
                Some("https"),
                0
            ),
            ChallengeAction::TrustServer
        );
        assert_eq!(
            challenge_action(
                &policy(false, false),
                SERVER_TRUST_METHOD,
                "identity.example",
                9443,
                Some("https"),
                1
            ),
            ChallengeAction::Cancel
        );
        let identity = policy(true, true);
        assert_eq!(
            challenge_action(
                &identity,
                CLIENT_CERTIFICATE_METHOD,
                "identity.example",
                9443,
                Some("https"),
                0
            ),
            ChallengeAction::UseClientIdentity
        );
        assert_eq!(
            challenge_action(
                &identity,
                CLIENT_CERTIFICATE_METHOD,
                "other.example",
                9443,
                Some("https"),
                0
            ),
            ChallengeAction::Default
        );
        assert_eq!(
            challenge_action(
                &identity,
                "NSURLAuthenticationMethodHTTPBasic",
                "identity.example",
                9443,
                Some("https"),
                0
            ),
            ChallengeAction::Default
        );
    }
}

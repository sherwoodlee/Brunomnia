# Milestone 113 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: accept Insomnia-compatible `grpc:` and `grpcs:` authored endpoint schemes without weakening Tonic transport validation.

- Pinned Insomnia parses `grpc:` as insecure and `grpcs:` as TLS.
- Native normalization maps them to Tonic `http:`/`https:` while preserving host, port, path, and query; HTTP/HTTPS remain valid aliases and unsupported schemes fail.
- Secure classification continues through Milestone 112 certificate validation and domain-scoped identity.
- Focused scheme tests, 85 native tests, 347 frontend tests, strict Rust gates, production/CLI builds, and the macOS app bundle pass.
- Rendered QA remains omitted by standing direction. Importable proto trees and other named gRPC gaps remain open, so parity is not declared.

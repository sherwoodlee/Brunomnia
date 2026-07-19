# Milestone 5 verification

Verified on 2026-07-16 on macOS against the Phase 5 request/authentication-fidelity implementation.

## Automated gates

| Gate | Result |
| --- | --- |
| `./node_modules/.bin/vitest run --pool=forks --maxWorkers=1` | Pass — 11 files, 47 tests |
| `npm run build` | Pass — TypeScript, Vite production bundle, and bundled CLI |
| Focused CLI TypeScript check | Pass — `cli/brunomnia.ts` with ES2023, DOM, and Node types |
| `cargo fmt --check` | Pass |
| `cargo test` | Pass — 10 native tests, including loopback integration (run outside the filesystem/network sandbox so localhost could bind) |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |

The final Tauri packaging run reused the already verified production `dist/` and disabled only Tauri's duplicate `beforeBuildCommand`; Rust compilation and `.app` bundling ran normally.

## Focused evidence

- OAuth 1 RFC vector, AWS IAM v4, Hawk, and OAuth 2 PKCE tests pass in `src/lib/auth.test.ts`.
- Cookie domain/path/secure/expiry replacement and rejection tests pass in `src/lib/cookies.test.ts`.
- UUID/time/dynamic aliases, encoding/hash/JSONPath/prompt tags, and response chaining tests pass in `src/lib/templates.test.ts`.
- Runner tests prove iteration and request-local variables cross the pre-request/request/after-response boundary.
- Interchange tests prove advanced auth mapping and Insomnia v4/v5 cookie-jar round trips.
- Native tests cover Netrc selection, certificate domain matching, binary WebSocket decoding, SSE parsing, gRPC, and loopback mocks.
- OpenAPI tests prove safe Spectral-style custom rules produce actionable lint results.

## Rendered QA

Production preview: `http://127.0.0.1:4173/` in the Codex in-app browser.

| Check | Desktop 1280×720 | Narrow 390×844 |
| --- | --- | --- |
| Page identity / meaningful DOM | Pass | Pass |
| Framework overlay | None | None |
| Console warnings/errors | None | None |
| OAuth 2 editor | Grant, endpoints, PKCE, credentials, and token controls rendered | DOM retained controls |
| Cookie manager | Add action produced SameSite, expiry, secure, HTTP-only, and host-only fields | No horizontal document overflow |
| Custom lint | A local rule produced the expected visible warning | Responsive workbench remains scrollable |
| Streaming | Runner sample-window control rendered; WebSocket connected | Binary file/base64 frame state rendered |

Interaction path: Requests → Auth → OAuth 2; Response → Cookies → Add cookie; API Design → Custom rules → enter a rule → visible warning; Collection Runner → stream sample window; Collections → Live Orders → Body/Preview → Connect → Binary (base64).

## Deliberate bounds

- OAuth 2 uses a copied authorization URL with manual returned code/token entry; embedded callback capture is not claimed.
- Digest/NTLM/Netrc execution is native-only; browser fallback remains constrained by browser networking rules.
- The custom rules engine is a safe Spectral-compatible subset and does not execute arbitrary JavaScript or remote/package extensions.
- At this milestone, File/external-vault template tags, MD5, full Faker/JSONPath breadth, WebSocket proxy/client identity, and full headless streaming/auth parity remained tracked in the parity ledger. Milestone 131 later closes the File/external-vault/Faker/JSONPath dynamic-variable gaps.

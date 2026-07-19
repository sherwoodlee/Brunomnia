# Milestone 139 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete pinned HTTP request-body authoring and wire parity across raw MIME selection, URL encoding, multipart inclusion/metadata, binary bytes, rendering controls, and portable local-file handling without broadening the full-parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/ui/components/dropdowns/content-type-dropdown.tsx` exposes Form Data, Form URL Encoded, GraphQL, JSON, XML, YAML, EDN, Plain Text, Other, File, and No Body while replacing the active Content-Type header. Brunomnia's protocol-specific GraphQL editor and HTTP body tabs now expose the equivalent HTTP raw/structured/file choices with arbitrary editable MIME values.
- `packages/insomnia/src/ui/components/editors/body/form-editor.tsx` uses one ordered key-value model for URL-encoded and multipart data with files, multiline values, descriptions, and disabled rows.
- `packages/insomnia/src/main/network/libcurl-promise.ts` serializes every URL-encoded parameter through `URLSearchParams`, preserving order, repeated names, empty names, and empty values.
- `packages/insomnia/src/main/network/multipart.ts` omits only rows where both name and value/file are absent, derives file disposition/type, treats a string-valued multiline field as text-part Content-Type, preserves ordered duplicates, and writes exact file bytes behind a generated boundary.
- Pinned file bodies retain reusable absolute paths. Brunomnia deliberately captures user-approved bytes and metadata at selection time, preserving future sends, runners, CLI use, import/export warnings, and self-contained generation without granting ambient reads from a stale path.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused browser/editor/interchange/body-helper regressions | Pass — 4 files, 20 tests |
| Focused native form/multipart loopbacks | Pass — 2 tests |
| Full Vitest suite | Pass — 62 files, 439 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 344.42 kB main renderer; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Selecting None, JSON, Text, Form URL Encoded, Multipart, or Binary replaces stale Content-Type state appropriately. Raw bodies expose JSON/XML/YAML/EDN/Plain Text suggestions while retaining any valid custom MIME string.
- Valid JSON and XML-looking/custom-XML text retain local beautification behavior. Other raw MIME bodies remain byte-for-byte UTF-8 text unless the user edits them.
- URL-encoded native and browser paths retain enabled row order, repeated keys, empty names, empty values, and standards-based escaping while omitting disabled rows. The native loopback proves `repeat=one&repeat=two+%26+more&=nameless&=` exactly.
- Multipart inclusion now matches pinned behavior: a completely blank enabled row is ignored, but an empty-name row with a value remains present. Repeated names retain their order.
- The native multipart loopback proves generated Content-Type/boundary, custom text MIME, edited file name/type, exact `00 ff 0a 0d` file bytes, duplicate names, an empty-name value, disabled omission, and blank-row omission.
- Browser development preserves URL/form inclusion and exact file bytes but intentionally leaves custom text-part MIME to the packaged native transport instead of fabricating a Blob filename. The Tauri app, runner/CLI native paths, and generated clients retain the authored MIME.
- Body-template rendering remains independently switchable across raw text, GraphQL variables, form names/values, and multipart names/values/filenames/types. URL, headers, authentication, transport, and scripts keep normal rendering.
- Insomnia v4/v5 controls and body metadata retain existing round-trip tests; binary/file omissions in path-based compatibility exports remain explicit warnings rather than silent data substitution.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes pure body-authoring controls, browser serialization, native serialization, tests, and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, pure helper tests, exact loopback bytes, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 139 accepts Request bodies parity for the pinned source-backed raw, form, multipart, file, binary, rendering, import/export-control, runner/CLI, and generated-client workflows. Browser-only `FormData` text-part MIME and reusable absolute paths are deliberately replaced by packaged-native metadata and approved portable bytes without removing a Tauri app action. The Request bodies row is `Complete`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 140.

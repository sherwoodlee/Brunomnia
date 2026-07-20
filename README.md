# Brunomnia

Brunomnia is a local-first API workbench built with Tauri 2, Rust, React, and TypeScript. It is an original clean-room foundation for moving a desktop API client away from Electron while keeping product capabilities available without an account, subscription, telemetry requirement, or premium feature gate.

> This is the one-hundred-sixty-second runnable migration milestone, not full Insomnia ecosystem parity yet. See the [parity ledger](docs/PARITY.md) and [migration map](docs/MIGRATION.md) for the honest coverage list.

## What works now

- Native Rust transports for HTTP, GraphQL, WebSocket, Socket.IO, SSE, and dynamic gRPC calls
- Multiple account-free local projects with create/switch/rename/duplicate-any/reorder/delete/restore workflows, independent atomic files and encrypted vaults, legacy migration, rotating backups, catalog reconstruction, recently deleted management, and explicit corruption recovery
- GraphQL 16.10 operation/variables authoring with parsed operation selection, AST formatting, full nested language-service diagnostics/completion/hover, typed variable coercion, bounded remote/automatic introspection and local JSON import, complete searchable schema documentation, safe field insertion, and native `graphql-transport-ws` subscriptions with operation-aware routing
- WebSocket text/binary-frame sessions with an ordered bidirectional event log, inherited certificate validation, domain-scoped PEM or PFX/PKCS#12 client identity for WSS, zero/finite/unlimited redirect handling with cross-origin credential stripping and per-hop policy reevaluation, absolute-form plain-WS proxy forwarding, and authenticated HTTP/HTTPS WSS tunnels with no-proxy exclusions
- Socket.IO Engine.IO v4 sessions with polling-first negotiation, policy-preserving WebSocket upgrade and polling-only fallback, automatic transient-loss reconnection with offline emit/listener continuity, custom paths and URL namespaces, headers/cookies/Bearer connect auth, ordered JSON/text event arguments, optional acknowledgements, nested binary Buffer reconstruction, live named listeners, and an ordered event console
- Long-running Server-Sent Events sessions with incremental parsing, bounded or unlimited automatic reconnects, server retry hints, `Last-Event-ID` resume, and real reconnect/cancellation loopback coverage
- Persistent chronologically grouped GraphQL subscription, WebSocket, Socket.IO, and SSE session history with finite/zero/unlimited retention, active-environment filtering, incremental event persistence, handshake status/headers/version/duration, lifecycle timelines, type filtering, text search, non-destructive clear-view cutoffs, historical request-version restoration, prior-session selection, selectable Friendly/Source/Raw JSON and Socket.IO-argument inspection, raw copy, exact text/binary per-message export, and delete/clear actions
- Scheme-less plaintext and gRPC/GRPCS/HTTP/HTTPS endpoints plus Unix-domain gRPC endpoints on Unix; reflection; bounded multi-file/folder `.proto` import and compilation; dynamic JSON messages; all four call shapes; effective TLS validation overrides; workspace CA trust; and host/port-scoped PEM or PFX/PKCS#12 client identity
- JSON plus arbitrary raw MIME authoring (including XML, YAML, EDN, and plain text), ordered/repeated/empty-name URL-encoded and multipart rows with enablement/descriptions/multiline editing, multipart file/part metadata and exact bytes, binary bodies, and a per-request body-template switch
- Standard or custom HTTP methods, explicit encoded path parameters, repeated query keys, regular or device-persistent bulk query/header editing, row descriptions, multiline values, and local JSON/XML body beautification
- Local client-code generation for cURL, JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient`, including self-contained multipart and binary bytes
- Device-local redirect, request-timeout, API/authentication certificate-validation, workspace CA/PEM/PFX multi-identity management, and system/manual proxy defaults; per-request inheritance/overrides; `0`-disabled deadlines; a finite or unlimited native redirect ceiling; no-proxy lists; and host/port-scoped client-certificate controls
- Device-local Default, HTTP 1.0, HTTP 1.1, HTTP/2, and HTTP/2 Prior Knowledge preferences with the negotiated native version in response evidence
- Transparent native gzip, Brotli, deflate, and zstd response decoding with one decode-error-only raw fallback
- Local collections with persistent mixed folder/request drag and Option/Alt-keyboard ordering, indent/outdent, cross-collection moves, deep folder-subtree duplication, a device-local pinned-request list, persistent temporary/permanent collection, request, folder, API design, project Environment, mock server/route, standalone test-suite, workspace Runner, and folder Runner document tabs with shared close/reopen/history/cycling/drag order, isolated per-open-Runner unsaved control drafts, exact Close All/Close Other Tabs actions, a persistent project dashboard after final-tab closure, full collection/environment/folder configuration panes, nested request folders, request/collection/folder documentation, and inherited folder headers, authentication, variables, and scripts
- Distinct global-base/selected-global and collection-base/selected-collection environments, persistent sub-environment drag and Option/Alt-keyboard ordering, collision-safe duplication, device-local private global sub-environments, folder/iteration/request-local variables, dynamic aliases, and template tags for UUIDs, time, Faker values, encoding, hashing, JSONPath, cookies, prompts, requests, and chained responses
- Basic, Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc authentication, including cancellable system-browser OAuth 2 loopback callbacks across direct, runner, script/plugin, and user-triggered integration sends, generated state/PKCE/nonce, authorization-code exchange, implicit access/identity tokens, send-time acquisition, and expiry-aware refresh
- Persistent editable cookie jar with per-request send/store controls
- A searchable 100-send activity log plus chronologically grouped per-request response history with finite/unlimited retention, active-environment filtering, rich URL/method/status/time/size evidence, bounded pre/post-script test results, saved cookie policy and environment identities, explicit response-only legacy entries, delete/clear actions, and historical request-version restoration that preserves current naming, documentation, source linkage, and tree position; persistent Visual/Source/Raw preview modes with charset-aware and JSON/HTML content-detected text, bounded HTTP(S) links in JSON/source viewers with a device-local disable choice, safe-by-default HTML with response-URL-aware relative links, one-click preview reset, and separate opt-in remote-resource and isolated JavaScript authorities, byte-backed image/PDF/audio viewers, bounded CSV tables, and selectable byte-backed multipart sections with bounded recursive friendly viewers, JSONPath/XPath body filters, 5/100 MiB preview safety gates, byte-exact decoded-body/raw and prettified JSON downloads, selected-response HTTP debug/HAR exports, body/header inspection, and persisted size-bounded configured outgoing headers, duplicate-preserving native response values, redirects/effective URL, classified pre-response failures, payload, response, and protocol timeline evidence
- Delayed one-shot sends and sequential repeating sends with explicit cancellation and a 1,000-run safety bound
- Permission-bounded pre-request scripts and async after-response tests with documented seven-level environment lookup, exact base/selected scope aliases, folder/query/auth helpers, shared Chai `assert` and chainable `expect` surfaces, bounded adapters for every documented bundled module name, path-scoped opt-in primary/secondary local body and PEM/PFX attachment, and mediated HTTP/vault capabilities
- Persistent collection-owned standalone test suites with ordered suite/test CRUD, selected HTTP/GraphQL requests, JavaScript/Chai editing, bounded run-one/run-all execution, default or ID-targeted `insomnia.send()`, inherited environments, OAuth/plugins/cookies/response chaining, saved local run results, Insomnia v4/v5 interchange, and suite/API-spec CLI selection
- Selectable drag/keyboard-ordered collection runs with bounded JSON/CSV iteration data, a 41-label encoding picker with UTF-32 and reopen-safe in-memory source bytes, retries, bail/cancellation, cookie/response chaining, bounded GraphQL subscription/WebSocket/Socket.IO/SSE samples, redacted request metadata, size-limited response inspection, saved reports, downloadable JSON/JUnit evidence, and a shell-safe Run via CLI preview of the active plan
- OpenAPI 3.x YAML/JSON editing, formatting, resolved operation preview/request generation, the pinned Spectral 1.22 OAS runtime, all runtime-exported safe built-in custom functions, nested local/public-HTTPS ruleset extension, selected multi-file/public-HTTPS references, and source/range-aware diagnostics
- Native loopback mock servers with live route editing, response-pane server/route create-or-overwrite selection, route parameters, delays, headers, CORS, request-aware header/query/decoded-path/JSON/form/multipart output templates, ordered repeated query/form/multipart arrays, computed bracket properties, LiquidJS-compatible quoted strings/escapes/comparisons/logic/`elsif` inside bounded `assign`/`if`/`unless`/`raw` controls, structured template-error responses, all 118 currently documented Faker outputs, and dynamic response tokens
- A headless CLI for OpenAPI lint/generation/export, JSON or split-YAML project collection execution with repeated selected-request, regex request-name, and request-delay controls, and standalone test-suite execution by suite or linked API-spec identity with regex test-name filtering, the documented Inso reporter names, and JSON/JUnit artifacts
- File, pasted-text, and HTTP(S) URL imports with format detection and a warning preview
- Insomnia JSON v4/v5, Postman Collection 2.0/2.1 and environments, HAR, OpenAPI 3.x, Swagger 2, WSDL, and cURL imports, including nested mixed request/folder sibling order
- Scoped Brunomnia JSON, Insomnia v4/v5, HAR, and raw OpenAPI exports, with v4/v5 mixed request/folder order round trips
- Versioned workspace migrations with collision-safe import history, distinct environment-store interoperability, advanced-auth/cookie-jar mapping, and preserved source metadata
- Reviewable split-YAML filesystem projects with ordinary Git init/clone/status/push-readiness/actionable-push-errors/aggregate-and-per-file-diff/selected-or-bulk-stage/unstaged-discard/credential-preflighted-commit-and-push/history/local-and-remote-branch/create/delete/fetch/pull/push/clean-tree-merge workflows
- Three-way text conflict editing, binary ours/theirs resolution, and explicit merge abort without silently discarding local changes
- Local dependency-free CommonJS plugins with disabled-by-default installation, explicit capability grants, request/response hooks, template tags, actions, themes, and plugin-local storage
- A time-limited Worker boundary for plugin code, mediated network/prompt/clipboard access, and automatic grant removal when source changes or a workspace is imported
- A passphrase-derived AES-256-GCM local vault whose decrypted values exist only in memory and resolve through `{{ vault.name }}`
- AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, and HashiCorp Vault template adapters through user-authenticated official CLIs, an in-memory cache, and an explicit per-reference-tuple allowlist
- End-to-end encrypted shared-file revisions with optimistic conflict checks, explicit force, device-local data filtering, and self-hosted filesystem/WebDAV compatibility
- Local owner/admin/editor/viewer metadata, storage and plaintext-secret policies, bounded audit records, and governance migration hardening
- Project-scoped MCP clients over Streamable HTTP/JSON-RPC and native STDIO, with first-class Insomnia v4/v5 interchange, cached tools/prompts/resources, guided prompt and bounded recursive/conditional JSON-Schema tool forms, guided RFC 6570 resource templates, per-primitive drafts, reusable device-memory HTTP sessions and persistent direct-child STDIO sessions with bounded login-shell `PATH` discovery, reviewed isolated process environments, explicit disconnect/recovery, cancellable discovery/invocation, roots, persistent device-local response/event/notification/console history with filters and environment-aware retention, and authorization-code/PKCE OAuth with discovery, bounded metadata redirects, dynamic registration, refresh, scope escalation, and device-local credentials
- Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible providers with vault-only credential execution, AI mock generation from manual, reviewed specification-URL, or explicitly selected active-request/latest-response context, and reviewable ordered Git commit groups with optional push
- Pull-only Konnect control-plane discovery and Gateway Service mapping across managed route/path/protocol folders and HTTP/HTTPS, WebSocket, and gRPC combinations with regex and bounded expression-router conversion, remote-template sanitization, local-work preservation, safe control-plane proxy defaults with loopback fallback, and explicit unextractable/SNI/L4 skips
- Workspace v39 migrations, bounded MCP process-environment/history and collection-owned standalone test-suite/result normalization, device-local bulk/editor/layout/typography/password-visibility/HTML-script and script-data-folder preferences, legacy-safe timeout/certificate/proxy overrides, complete bounded GraphQL schema-cache refresh, bounded resource hierarchy, request-row/Socket.IO/session-history/request-snapshot/handshake-metadata normalization, collection sub-environment repair, private-global publication filtering, split-YAML serialization, import-time authority stripping, and device-local integration/script permissions
- Atomic per-project persistence in the OS application-data directory with recoverable prior revisions and restorable soft-deleted workspace/backup/vault snapshots in device-local trash
- System/dark/light appearance, comfortable/compact density, horizontal/responsive or forced-vertical request layout, separate interface/editor font families and 8–24 px sizes, configurable editor wrapping/indentation/ligatures, masked authentication and integration credentials with device-wide or per-field reveal, request defaults, and customizable keyboard shortcuts
- Responsive desktop UI with no login, upgrade, or cloud dependency

## Run it

Requirements: Node.js 20.19+ (or 22.12+) and Rust 1.77.2+.

```sh
npm install
npm run tauri dev
```

For browser-only UI development:

```sh
npm run dev
```

The browser development build uses deterministic protocol demos for the `*.acme.dev` examples. Other HTTP URLs use browser `fetch`; the Tauri build routes protocol execution through Rust, so browser CORS rules do not apply.

See [local mock servers](docs/MOCK_SERVERS.md) for request-aware response-template syntax, bounds, and current compatibility limits.
See [local projects and recovery](docs/LOCAL_PROJECTS.md) for lifecycle, storage, backup, migration, and vault-isolation behavior.

## Use the CLI

Build the bundled `brunomnia` executable and inspect its commands:

```sh
npm run build:cli
node bin/brunomnia.cjs --help
node bin/brunomnia.cjs --version
```

Pinned `-v`/`--version` prints the bundled package version and exits without loading projects or configuration. Release wrappers may supply the same `VERSION` environment override used by Inso; an empty or absent override falls back to `package.json`.

Use `brunomnia <command> [subcommand] --help`, `-h`, or `brunomnia help <command> [subcommand]` for scoped syntax, descriptions, local flags, and shared global flags. Help short-circuits before workspace/config loading or prompts. Brunomnia lists its additional trust/report options alongside pinned flags instead of hiding local extensions.

Examples:

```sh
node bin/brunomnia.cjs lint spec orders-api.yaml -w examples
node bin/brunomnia.cjs generate collection examples/orders-api.yaml --output collection.json
node bin/brunomnia.cjs export spec "CLI API" -w examples/cli-workspace.json --skipAnnotations --output exports/api.yaml
node bin/brunomnia.cjs run collection collection-id --workingDir workspace.brunomnia.json --globals global-id --env collection-environment-id --item request-third --item request-first --requestNamePattern '^(Third|First)$' --requestTimeout 30000 --env-var region=staging --delay-request 100 --iteration-data iterations.csv --iteration-count 2 --bail
node bin/brunomnia.cjs run collection collection-id --workingDir workspace.brunomnia.json --ci --item request-first --includeFullData=redact --acceptRisk --output reports/run.json
node bin/brunomnia.cjs run test "CLI Health" -w examples/cli-workspace.json --ci --allow-scripts
node bin/brunomnia.cjs run test cli-api-design -w examples/cli-workspace.json --ci --allow-scripts --bail --reporter junit --output report.xml
npm run test:cli-runner-smoke
npm run test:cli-template-smoke
npm run test:cli-container
```

The checked-in [CLI workspace fixture](examples/cli-workspace.json) is self-contained and does not make an internet request. Pinned `-w`/`--workingDir` accepts a Brunomnia JSON file or connected split-YAML project directory, leaving an optional collection, suite, or linked API-spec name/full-or-unambiguous-prefix ID positional; the earlier `<workspace> <identifier>` form remains compatible. Omitting that identifier in a terminal presents a bounded numbered collection, suite/API-design, or stored-design prompt. Non-interactive stdin/stderr refuses before transport with identifier/`--ci` guidance. `--ci` retains Brunomnia's established deterministic first-collection/suite/design fallback; pinned Inso only applies first-resource CI fallback to collections, so the broader fallback is an explicit automation extension rather than claimed failure-mode identity. `--config <path>` or pinned Cosmiconfig-order upward discovery loads bounded `package.json` `inso`, `.insorc*`, `.config/insorc*`, and `inso.config.*` files. JSON/YAML remains data-only; JS/CJS/MJS/TS requires explicit `--allow-config-code` for a trusted workspace. Executable config runs in a fresh resource-limited worker with a 500 ms VM deadline, no imports or `require`, no Node process/filesystem/network authority, no string/WebAssembly code generation or external buffers, and 1 MB source/compiled/result limits; only a JSON-compatible object returns. Supported `workingDir`, `ci`, `verbose`, and `printOptions` values are filtered from unknown keys; explicit CLI values win. The merged options apply uniformly to `run`, `lint spec`, `export spec`, and `script`; config discovery and loaded-option diagnostics go to stderr so report/spec stdout stays parseable. Run a bounded config alias with `brunomnia script <name> [arguments...]`: tasks must begin with `inso`, receive quote-aware tokenization and pass-through arguments, and dispatch the bundled CLI without shell expansion. Pinned `-g`/`--globals` selects a workspace global environment by exact name or full/unambiguous-prefix ID, or reads the first environment from a bounded Brunomnia, Insomnia v4/v5, or split-YAML-compatible standalone file; `-e`/`--env` independently selects the collection sub-environment the same way. Explicit `--env` wins. Without it, `--ci` auto-selects exactly one sub-environment and rejects multiple; an interactive terminal prompts, while non-interactive execution fails before transport with `--env`/`--ci` guidance. Ambiguous ID prefixes also fail before transport instead of depending on resource order. `run collection` accepts repeated pinned `--item`/`-i` selectors for request IDs, unambiguous request names, or folder IDs in execution order (`--request` remains an alias). Folder items recursively expand descendants in resource-tree order before de-duplication and optional selected-or-full `-t`/`--requestNamePattern` regex filtering. Pinned `--requestTimeout <milliseconds>` overrides the workspace default for collection and test sends while request-level custom timeouts still win; `0` disables the global deadline. `--iteration-data`/`-d` accepts a local JSON/CSV path or explicit HTTP(S) URL under the shared 5 MB bound, and repeated `--env-var key=value` overrides merge over every row. `--delay-request`, `--iteration-count`/`-n`, `--bail`/`-b`, and the desktop Runner's remaining retry controls also work; the earlier `--iterations` and `--data` spellings remain compatible aliases. CLI JavaScript is disabled unless `--allow-scripts` is present. Trusted scripts can make arbitrary secondary HTTP requests only when `--allow-script-requests` is also present, while a suite's saved-request `insomnia.send()` stays confined to its owning collection. Script attachments require `--allow-script-files`; built-in File tags require `--allow-template-files` or the broader script-file grant; either file grant also requires one or more pinned `-f`/`--dataFolders` roots. Roots and requested files are canonicalized, and traversal or symlink escapes are rejected. Approved external-vault tags require `--allow-external-vaults`. Stored enabled plugins with a prior `template` grant additionally require `--allow-plugins`; CLI tag workers retain in-memory store continuity but cannot access the Node process, host network, files, prompts, or clipboard. Imported workspace preferences cannot enable any of these authorities. The localhost-only smokes prove Runner command continuity plus config aliases, partial-ID and deterministic resource/environment selection, root-confined template/script files, saved-request execution, OS/hash/custom-time/plugin rendering, dependent responses, cookies, remote iteration data, and request deadlines without external internet access. Both run commands default to pinned `spec`; reporters are `dot`, `list`, `min`, `progress`, `spec`, `tap`, `json`, and `junit`. `run test --output` writes the selected reporter artifact. Pinned collection `--output` writes metadata-safe JSON while the selected reporter stays on stdout. See [runner reports and CI](docs/RUNNER_REPORTS.md).

Pinned test-only `--keepFile` retains the generated suite source in a unique private temporary directory and prints `Test files: ["<path>"].` after the selected reporter, matching the upstream diagnostic contract. The file preserves sorted suite/test names, default request IDs, and user test code, so treat it as sensitive and remove it when debugging is complete. Brunomnia uses mode `0600` and does not retain the injected executable runtime harness; `--keep-file` is an additional alias. Collection runs reject the flag before transport.

Pinned `--httpProxy`, `--httpsProxy`, and `--noProxy` override matching ambient proxy variables for CLI runs. `--disableCertValidation` (or test `-k`) disables target validation only for that invocation. Request-level Custom/Direct routing, Never/Always validation, matching workspace CA roots, and PEM/PFX client identities use request-scoped Undici dispatchers rather than process-global Node settings.

The [CLI container guide](docs/CLI_CONTAINER.md) covers the non-root local image and the multi-architecture GHCR release path. Main-branch and version-tag images include BuildKit provenance/SBOM attestations and a keyless Cosign signature over the immutable digest; the release workflow rebuilds the checked-in bundle before publication.

Pinned `export spec <design-name-or-id-prefix> -w <workspace-or-project>` reads Brunomnia JSON or split YAML, preserves source text by default, and supports `-s`/`--skipAnnotations` to recursively remove only `x-kong-*` keys before YAML serialization. `--output`/`-o` resolves under the effective working directory and creates nested parents; without it, the specification is written to stdout. The earlier `export spec <workspace> <identifier>` form remains compatible.

Pinned `lint spec <design-name-id-prefix-or-file> -w <workspace-or-project>` resolves a file relative to the working-directory base before falling back to a stored design. Brunomnia's automation extension lets `--ci` select the first stored design when no identifier is supplied; pinned Inso instead refuses that no-selection CI case. `-r`/`--ruleset` explicitly overrides the design ruleset or file-folder default; file lint otherwise discovers the first deterministic sibling `.spectral*` file. Lint runs the pinned Spectral 1.22 OAS ruleset and safe built-in functions. File inputs recursively collect bounded root-confined JSON/YAML `$ref` sources and YAML ruleset `extends`, reject symlink/root escapes, and resolve public HTTPS references through DNS private/loopback checks, no redirects, a ten-second deadline, and a 1 MB response bound. Custom JavaScript, package rulesets, URL credentials, non-HTTPS targets, and private hosts remain blocked.

The pinned Inso command/flag and execution contract is source-audited as complete. Brunomnia intentionally adds deterministic CI fallbacks, explicit trust grants, stored-plugin template tags, bounded local-reference lint, retries, and JSON/JUnit output; pinned Inso itself has no user plugin-directory loader, plugin host RPC, or desktop local-vault API.

Pinned collection `--output` defaults to a versioned metadata-safe report: environment values, auth, headers, bodies, proxy credentials, and certificate material are omitted while collection/request identity, response status/time, tests, iteration/attempt, timing, and statistics remain. `--includeFullData <redact|plaintext>` replaces that file with final rendered requests, complete responses, effective variables, and transport evidence. Full-data mode requires non-interactive `--acceptRisk`; omission fails before transport. `redact` replaces environment values, authentication fields, known sensitive header values, proxy URL credentials, and request/workspace CA or client-identity material with `<Redacted by Insomnia>`. It is not a general secret scanner: URLs, bodies, response bodies, test/error text, and custom non-sensitive-named headers remain complete, so protect either full-data mode as sensitive. Relative output paths resolve from `--workingDir`, missing parent directories are created locally, and existing non-files or non-writable files fail before transport.

## Verify it

```sh
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build -- --debug --bundles app
```

## Architecture

- `src/` — React workbench, design/runner/script/interchange engines, local state, templating, and browser fallback
- `src-tauri/` — native shell, atomic workspace/project persistence, Git process boundary, local plugin reader, protocol transports, and loopback mocks
- `cli/` — headless automation entry point sharing the OpenAPI and runner modules
- `design/` — accepted full-screen concept and verified implementation captures
- `docs/` — migration, project/plugin/security guides, verification records, and feature-access policy

Brunomnia is independent software and is not affiliated with or endorsed by Kong Inc. “Insomnia” is referenced only to describe import/migration goals.

## License

Apache-2.0. See [LICENSE](LICENSE).

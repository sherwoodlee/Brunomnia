# Insomnia feature-parity ledger

Last reconciled: **2026-07-20** against the current Kong Developer documentation for Insomnia. Milestone-specific source checks after that date are recorded in their verification files.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Complete | Multiple account-free local projects support create, switch, rename, duplicate, reorder, guarded deletion/recovery, immutable snapshots, and identity-preserving typed-file moves across Collection, Document, Mock Server, Environment, and MCP Client scopes. Native and browser catalogs use rotating backups, corruption recovery, project-scoped encrypted vaults, destination-first move rollback, and genuinely empty projects without manufactured resources. Workspace v43 gives every typed file independent device-local cookies plus CA/client certificates; generated collections inherit their API Design file, ambiguous legacy global state clones independently during migration, and direct/dependent desktop, workbench, plugin, integration, schema, realtime, codegen, and CLI execution resolve the owning file. Duplicate, move, import, and export carry only selected file state, while folder/Git/encrypted-sync publication keeps it local. Native and browser saves use one bounded project manifest plus one authoritative physical record per visible typed file; design records include their generated collection, environment records include their descendant branch, and file-owned state stays in the same record. Legacy aggregate documents migrate transparently, rotating backup/recovery/trash/snapshot behavior remains intact, corrupt individual records fall back to the last valid project backup, and the CLI assembles native sibling records without following symlinks. The pinned project picker defines Local Vault, Cloud Sync, and Git Sync as separate storage types; account/session-backed organization discovery is exclusively Cloud Sync behavior and remains tracked there, while Git provider onboarding is complete in the Git row. Brunomnia's local projects need no account, network, organization, entitlement, or subscription. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Complete | Editable collections/requests, persistent mixed folder/request drag ordering and cross-collection moves, focusable Option/Alt keyboard sibling reorder/first/last/indent/outdent controls, request duplication plus collision-safe deep folder-subtree duplication, a separately filtered device-local pinned-request list with active-request pin/unpin control, bounded per-project temporary/permanent collection, request, folder, API design, project Environment, mock server, mock route, standalone test-suite, workspace Runner, and folder Runner document tabs with one shared temporary slot, replacement/promotion, active history, close/reopen, keyboard cycling, drag order, middle-click close, final/all-tab closure to a persistent project resource dashboard, right-click Close All/Close Other Tabs, dashboard reopen, and isolated unsaved collection/environment/options/data/request-plan context for each open synthetic Runner document, full collection and project-global Environment plus folder Auth/Headers/Scripts/Environment/Docs panes and settings, nested folders, collection/folder/request documentation, inherited folder headers/auth/scripts/variables, distinct global-base/selected-global and collection-base/selected-collection editors, persisted Table/Raw JSON modes across global, collection base/sub-, and folder environments, typed object/array values with nested dot-path rendering, pinned loss warnings, invalid-JSON switch blocking, persistent pinned-compatible sub-environment sibling drag and Option/Alt-keyboard ordering plus collision-safe local duplication, device-local private global sub-environments, iteration/request-local variables, delayed/repeating sends, custom methods, explicit path/query rows, descriptions, multiline values, device-persistent regular/bulk header and query editing, a 100-send activity log, guided template-tag insertion across every shared-renderer request field, and chronologically grouped per-request response history with rich restored-method/URL/status/time/size evidence, bounded pre/post-script results, saved send/store cookie policy, global/collection environment identity, 20/default, finite, zero, unlimited, active-environment-filtered retention, exact-entry deletion, active-environment clearing, and request-version snapshots/restoration across direct, dependent, runner, script, and plugin paths. Restoration preserves the current name, documentation, source linkage, and tree position; legacy entries without a version remain explicitly response-only, matching pinned Insomnia. Persistent ten-entry full JSONPath Plus/XPath preview-filter history, byte-exact decoded-body/raw and prettified JSON downloads, and selected-response HTTP debug/HAR 1.2 exports exist. Pinned Insomnia's collection trees are single-select and expose per-resource actions, so collection-tree multi-select/bulk actions are not a parity requirement. The local project manager exposes all five pinned typed workspace scopes, same/cross-project duplication with fresh nested identities, and identity-preserving cross-project moves with collection-owned suites/results, Runner/request/response/stream evidence, response-viewer state, and design-generated collections. New and final-file-move source projects remain empty across native/browser save, reload, backup, snapshot, trash, and restore; the requestless dashboard creates or imports the first file without persisting a hidden collection or environment. Workspace v43 isolates cookies and CA/client certificates per typed file across execution, transfer, import/export, and local-only publication. Each Collection, Document with generated Collection, Mock Server, root Environment branch, and MCP Client is now an authoritative native/browser physical record behind a bounded project manifest, with transparent legacy migration, backup/recovery/trash assembly, and CLI loading. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/), [requests](https://developer.konghq.com/insomnia/requests/) |
| REST/HTTP execution | Complete | Native execution, custom token-valid methods, encoded `{path}` substitution, repeated query keys, default `Accept: */*`, native `Accept-Encoding`, transport-calculated Host presentation, default `brunomnia/0.1.0` User-Agent with custom/disabled/request-level suppression and browser-Fetch exclusion, response inspection, persistent per-request Visual/Source/Raw preview modes with declared-charset text, valid-JSON/leading-doctype detection despite misleading headers, bounded HTTP(S) link opening in JSON/source viewers with an upstream-default disable preference, and response-URL-aware HTML with upstream-default remote-resource/opaque-origin JavaScript authority, preview reset, external scripts/connections/workers, byte-backed responsive image/embedded PDF/native audio viewers, bounded CSV-table viewer, and selectable byte-backed multipart sections with headers/charset-aware text/exact save plus selected-part recursion into the same friendly viewers up to the 100 MiB response-preview ceiling. Exact decoded entity bytes persist across native/browser execution, saved history, raw downloads, and response-plugin buffers. Native gzip/Brotli/deflate/zstd negotiation retains compressed wire and decoded content sizes across the response badge, history, timeline, plugins, and HAR, while decode failures receive one raw fallback. Timeline evidence includes prepared requests, configured/calculated outgoing headers, bounded outgoing data, duplicate final headers, redirects/effective URL, connection/TLS/proxy summaries, compressed/decoded byte counts, negotiated protocol, and classified timeout/connect/redirect/decode/request/status/transport/canceled failures retained as status-zero history. Device-local redirect/30-second timeout/API certificate-validation defaults support per-request inheritance/overrides, `0`-disabled deadlines, `0`/finite/`-1` redirect maxima, inherited system/manual/direct proxy routing with protocol-specific URLs and no-proxy exclusions, domain-scoped PEM or PFX/PKCS#12 identity, per-request cookie policy, and Default/HTTP 1.0/HTTP 1.1/HTTP/2/HTTP/2 Prior Knowledge preferences. Pinned source confirms its sniffing is likewise limited to valid JSON and a leading HTML doctype, HTTP/3 is not exposed, response/timeline sidecars are persistence architecture whose viewers still load complete buffers, and browser forbidden-header/TLS restrictions are platform constraints. Byte-exact libcurl header casing/global order, transport framing, challenge-round headers, DNS/connect/TLS callback boundaries, and chunk boundaries are incidental implementation diagnostics rather than separate workbench capabilities; Brunomnia provides the corresponding user-facing text timeline without fabricating unavailable wire bytes. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| GraphQL | Complete | GraphQL 16.10 query/variables authoring provides AST-backed operation selection and formatting, full nested language-service diagnostics/completion/hover, selected-operation variable coercion, native HTTP execution, generated-code/runner/CLI propagation, and literal query-template boundaries. Bounded remote/automatic introspection and 20 MB local introspection JSON import persist complete directives/interfaces/possible types/input/enum/default/deprecation/one-of/scalar-specification metadata; pre-v34 partial caches refresh safely. Searchable navigable documentation, safe root insertion, secure scalar links, and in-editor errors are account-free. Native `graphql-transport-ws` subscriptions convert HTTP(S) to WS(S), negotiate the subprotocol, perform `connection_init`/ack/subscribe, close on protocol error/complete, inherit redirect/custom-proxy/no-proxy/TLS/client-identity policy, and retain searchable history plus selectable Friendly/Source/Raw message inspection, raw copy, and exact binary/text export. | [GraphQL](https://developer.konghq.com/insomnia/graphql/) |
| WebSocket | Complete | Native text and exact base64/file binary composition, default/custom/suppressed User-Agent, authored subprotocols, follow/off redirect policy with `0`/finite/`-1` ceilings, relative/absolute WS(S) locations, fresh per-hop keys, and cross-origin Authorization/Cookie stripping work. Every hop re-evaluates direct/manual/custom HTTP/HTTPS proxy routing, Basic proxy credentials, exact/suffix/port/IP-CIDR no-proxy exclusions, WSS validation, workspace CA, and domain-scoped PEM or PFX/PKCS#12 identity. Pinned source installs only explicit manual HTTP/HTTPS proxy agents and otherwise connects directly; PAC/system discovery was an incorrect ledger requirement. Ordered events, runner samples, handshake status/headers/version/duration, lifecycle timeline, bounded inline history equivalent to pinned response-owned NDJSON, finite/zero/unlimited retention, environment filtering, chronological selection, request-version restoration, type/search/clear-view controls, selectable Friendly/Source/Raw JSON/binary inspection, raw copy, exact per-message export, delete, and clear are account-free. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Socket.IO | Complete | Native Engine.IO v4 starts with bounded HTTP polling, preserves query/header/cookie plus default/custom/suppressed User-Agent and custom proxy/no-proxy/client-identity/TLS/redirect policy, upgrades through the `2probe`/`3probe`/`5` WebSocket sequence when eligible, and remains functional on polling-only or failed-upgrade servers. URL-derived namespaces, custom paths, Bearer connect auth, ordered JSON/text arguments, optional acknowledgements, nested receive-side binary event/ack hydration into Node Buffer-shaped JSON, enabled/live-toggled named listeners, server `maxPayload`, bounded runner samples, first-class Insomnia v4/v5 interchange, handshake/timeline metadata, shared history controls, and selectable per-argument Friendly plus Source/Raw copy/export inspection are account-free. Unexpected post-connect Engine.IO/WebSocket/polling loss now uses unlimited randomized exponential reconnect attempts capped at five seconds, renegotiates the complete transport policy, retains listener changes, queues offline emits, records lifecycle evidence, and cancels during delay or handshake. Initial connect errors, server namespace disconnects, malformed protocol data, and explicit client disconnects remain terminal. Pinned source installs only explicit manual proxy agents, not PAC/system discovery, and realtime routes bypass plugin hooks. | [Insomnia Socket.IO source](https://github.com/Kong/insomnia/tree/develop/packages/insomnia/src) |
| Server-Sent Events | Complete | Native long-running sessions cover default/custom/suppressed User-Agent policy, chunking, CRLF, comments, event names, multiline data, persistent bounded/unlimited reconnect policy, server `retry:` hints, `Last-Event-ID` resume, reconnect cancellation, response status/headers/HTTP version/duration, persisted reconnect/error/close timeline, bounded runner samples, and per-request history with finite/zero/unlimited retention, active-environment filtering, chronological selection, historical request-version restoration, search, upstream-disabled type selection, non-destructive clear-view, selectable Friendly/Source/Raw message inspection, raw copy/export, delete, and clear behavior. A real initial-response/reconnect/resume/cancel loopback covers the packaged path. Pinned response-owned NDJSON and Brunomnia's bounded inline local record provide the same user-visible history; pinned realtime routes bypass plugin hooks and expose no whole-log export. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| gRPC | Complete | Scheme-less plaintext hosts, authored `grpc:`, `grpcs:`, `http:`, and `https:` endpoints, and Unix-domain sockets on Unix desktop builds feed ordinary server reflection with modern `grpc.reflection.v1` plus pinned-Insomnia-compatible `v1alpha` fallback, bounded multi-file/folder proto-tree import with active/entry selection and cross-file compilation, and Buf Schema Registry reflection through its binary Connect API. Buf URL/module/API-key templates, optional Bearer authentication, disable-user-agent behavior, registry-host workspace CA/PEM/PFX selection, bounded descriptor responses, v4/v5 interchange, dynamic JSON/protobuf mapping, descriptor-generated request stubs with one-click application, all four call shapes, persistent start/send/commit/cancel lifecycle for interactive client and bidirectional streams, ordered call events, numeric status/name/details plus bounded initial/trailing/error metadata, and templated request metadata are account-free. Secure channels always install native-root TLS, and focused guidance preserves the underlying error for invalid local roots, untrusted server certificates, required client certificates, TLS-to-plaintext mismatch, unsupported reflection, server cancellation, and unimplemented methods. An opt-in matrix passes reflection plus all four RPC shapes against the official plaintext and trusted-TLS `grpcb.in` fixtures. Pinned Insomnia keeps call state transient and constructs direct `@grpc/grpc-js` channels without a separate HTTP/HTTPS proxy agent, so persisted call history and a custom gRPC proxy are not parity requirements. | [gRPC requests](https://developer.konghq.com/insomnia/grpc-requests/) |
| Request bodies | Complete | JSON plus arbitrary raw MIME authoring with JSON/XML/YAML/EDN/plain suggestions and synchronized Content-Type, ordered URL-encoded and multipart rows with enablement, descriptions, one-line/multiline editing, repeated and empty names, blank-row omission, multipart files, editable filename/content type, exact persisted bytes, binary payloads, local JSON/conservative-XML beautification, and a shared disable-body-rendering switch are account-free. Native/browser/CLI/runner/generated paths preserve the applicable row contract; packaged native loopbacks prove exact form encoding, text/file metadata, binary bytes, disabled/blank omission, and generated boundaries. Insomnia v4/v5 controls round-trip. Pinned Insomnia exposes no arbitrary per-part-header model. Reusable absolute paths are deliberately replaced by safer portable approved bytes, and browser-only text-part MIME limits do not affect the Tauri app. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Client code generation | Complete | All thirty-nine clients across all twenty target families in the pinned HTTPSnippet 3.0.10 registry use the shared complete template renderer before enabled request-plugin hooks, then materialize matching cookie-jar values, inherited configuration, active environment values, Basic/Bearer/API-key/OAuth 1/OAuth 2/Hawk/ASAP authentication, text/form/GraphQL bodies, multipart framing, and standalone binary bytes through separate locally persisted selectors with declared-default fallback. Authored Authorization and Cookie headers win, ASAP uses the pinned ten-minute expiry, Node native receives exact prepared Content-Length without replacing an authored value, thirty-eight executable clients preserve exact payload bytes, and raw HTTP/1.1 visibly represents arbitrary bytes as decode-before-send Base64. Library-only converter options, dependency installation, target validation, and snippet execution are not exposed by pinned Insomnia and are not parity requirements. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Request authentication | Complete | All documented families have editable execution paths: Basic, Digest, OAuth 1/2, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc. Tauri OAuth 2 authorization-code and implicit flows default to a privilege-free isolated built-in browser with a persisted UUID session; bounded configured HTTP(S) and custom-scheme redirects are detected through navigation, completed loads, and popup requests, query/fragment responses and state are checked, manual HTTP/SOCKS5 proxy plus No proxy policy applies, and explicit or restart-time session clearing rotates the partition. Authorization-code requests can instead select the system browser with bounded HTTP loopback capture and ephemeral-port rewriting. Both paths generate missing state/PKCE/OIDC nonce values, retain access/identity/refresh tokens, exchange codes, time out, and cancel explicitly; browser development keeps a manual copied-URL fallback. Direct, collection-run, script/plugin secondary, and user-triggered project/integration sends can acquire interactive credentials through one status/cancel surface; all shared HTTP sends fetch noninteractive grants, refresh expired tokens, and recover rejected refresh grants before protected traffic, while inherited-folder tokens persist to their owner. In the packaged macOS app, runtime codes/verifiers/access/identity/refresh tokens and expiry are removed from ordinary catalog JSON and authenticated inside a bounded AES-256-GCM envelope whose random master key is held by macOS Keychain; active, backup, legacy, and deleted-project copies migrate before use. Those values remain omitted from Git/folder and encrypted-sync payloads, with matching local owner state restored after reload/pull. Origin, combined ID/access responses, identity-token fallback, token expiry, `NO_PREFIX`, clearing, and token-transport authentication-certificate separation match the pinned upstream behavior. Before the first embedded navigation, macOS installs WebKit's optional authentication-challenge selector on Wry's existing delegate: normal server trust uses platform defaults, disabled auth-certificate validation returns a scoped trust credential, repeated failures cancel, and every unrelated challenge variant retains WebKit default handling. The matching file-owned port/host client identity is selected explicitly, bounded PEM or PFX/PKCS#12 material becomes an in-memory `SecIdentity` without keychain persistence, and its credential is limited to the original authorization origin. Pinned Insomnia's own OAuth smoke uses a deterministic local OIDC provider rather than a cross-platform live-provider matrix, so external provider fixtures are evidence choices rather than missing product behavior. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Complete | Persistent editable jar, automatic primary/dependent-request Set-Cookie storage, send/store policy, active-environment-aware response chaining, and seven-level base/selected global/collection/folder/iteration/local precedence with disabled-row masking are account-free. The shared async renderer matches pinned Faker 9.7's 118 names; JSONPath Plus 10.4; date-fns 3.6 custom timestamps; UUID, Base64, MD5/SHA, seven-function native or Node OS, cookie, six-argument cached/masked prompt, current-request, approved File/external values, and exact raw/header/url/body response tags. Response bodies preserve large integers, support JSONPath/XPath and multiple JSONPath results, and can resend dependencies with preview suppression, active-environment selection, shared cookie/response side effects, and recursion guards. HTTP/GraphQL, OAuth/schema, generated code, direct and interactive gRPC, WebSocket/GraphQL-subscription/SSE/Socket.IO connection and outbound payloads, desktop and portable CLI collection runs, plugins, and integrations use that built-in renderer; granted plugin tags additionally resolve on plugin-backed HTTP/code generation, realtime, direct gRPC, and explicitly authorized portable CLI HTTP/GraphQL execution. The fourteen-family Tags dialog inserts compatible syntax across HTTP, realtime, Buf, and gRPC execution fields. | [Template tags](https://developer.konghq.com/insomnia/template-tags/), [dynamic variables](https://developer.konghq.com/insomnia/dynamic-variables/), [request chaining](https://developer.konghq.com/how-to/chain-requests/) |
| API specification design | Complete | Each local API design participates as a persistent shared `document` tab with temporary/permanent lifecycle and resource-targeted editing. OpenAPI 3.x YAML/JSON editing, formatting, resolved operation preview, and request generation now run beside the pinned Spectral 1.22 OAS ruleset and every safe function exported by its runtime. Bounded selected file/folder trees resolve nested local `$ref` and local YAML ruleset `extends`; public HTTPS document references and recursively extended rulesets use explicit refresh plus a short cache, desktop DNS/private/loopback checks, no redirects or URL credentials, 10-second/1 MB/20-source/depth/cycle limits, and source/code/line/character diagnostics. Custom JavaScript, tuple extends, unsafe fields/prototype paths, non-HTTPS/private targets, root escapes, and oversized source sets fail closed. Pinned Insomnia likewise rejects custom `functions`, limits local extends to YAML under the selected root, and treats non-built-in/non-path entries as URLs rather than supporting package identifiers; its validator's accepted `typedEnum` token has no export in the pinned Spectral functions runtime and is not executable behavior. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Complete | Disposable desktop Workers cover distinct global/collection base and selected stores, documented seven-level aliases/priority, ID/name parent folders, pinned-shaped bounded `insomnia.execution.location` with `current`, pre-send `skipRequest()`, request ID/name `setNextRequest()`, query-string/object URL mutation, keyed-array Basic/Bearer/API-key updates, proxy/certificate helpers, response facades, ordered sync/async `insomnia.test` plus non-executing `insomnia.test.skip`, passed/failed/skipped status, pre-request/after-response/unknown category, monotonic callback timing through desktop and CLI persistence, every currently documented public `chai.assert` method name plus Chai BDD chain/assertion/alias name through shared bounded adapters, all currently documented external-library and Node-module names, and separately opt-in primary/secondary binary/multipart/PEM/PFX attachment restricted to canonical device-approved roots plus mediated HTTP and pinned read-only local-vault access with cookie/response continuity. Modern PBES2/AES PKCS#8 and legacy OpenSSL AES/DES PEM-key passphrases share the native HTTP, realtime, gRPC, OAuth, workspace, request-local, and script identity path. Trusted CLI execution now runs in disposable resource-limited `worker_threads` Workers with a restricted string/Wasm-code-generation-disabled `vm` context, no Node host globals, timeout termination, and host-mediated request/file RPC; portable CLI client identities were completed in M210. Pinned source exposes attachment paths but no script file-write API, constructs `insomnia.vault` from the private global environment rather than external providers, and sources its Lodash-compatible `_` from `es-toolkit/compat`; package internals are not separate user capabilities. Deprecated Postman interfaces are explicitly unsupported upstream, not a parity requirement. | [Scripts](https://developer.konghq.com/insomnia/scripts/), [Chai assert API](https://www.chaijs.com/api/assert/), [Chai BDD API](https://www.chaijs.com/api/bdd/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Collection runner and automated tests | Baseline | Persistent workspace-wide and folder-scoped synthetic Runner documents share the ordinary temporary/permanent tab lifecycle; each open document retains isolated unsaved collection, environment, iterations, retries, pinned-default-on bail/log retention, delay, stream-window, raw data, data-source filename/encoding, and ordered request-plan controls while switching tabs, and closing it discards that draft. Request Order exposes exact none/partial/all Select All behavior and selected/total state, method labels, full parent-folder context, request-name navigation that preserves the Runner document, checkboxes, drag ordering, and labeled up/down controls; every mutable collection/environment/plan/iteration/retry/bail/log/delay/stream/data control locks while active. A local upload/preview dialog accepts JSON arrays or quoted CSV under 5 MB, 1,000 iterations, and 100 variables; filters invalid JSON members, preserves nested JSON values as compact text, previews the first 100 rows across unioned headers, supports change/remove, and adopts the valid row count as iterations. It exposes the pinned 41-label picker, detects UTF-16/32 BOMs, validates UTF-8, falls back to Windows-1252, portably decodes every real listed encoding through explicit UTF-32/ASCII/Latin-1/EUC-CN/KOI8-RU/KOI8-T handling plus standard WebView decoders, rejects the nonexistent ISO-8859-12 label like the pinned backend, and retains exact selected bytes only in the bounded open-document draft so encoding changes still work after reopening the dialog without granting a filesystem path. Folder targets include direct and nested descendant requests and reject missing folders without broadening scope. Selectable drag/keyboard-ordered data-driven runs preallocate pinned-shaped pending/running/completed/failed/canceled/skipped rows for every iteration, force Results to remain the active pane throughout execution while preserving the selected inactive pane for post-run return, expose exact `Running|Finished completed+failed / total requests (skipped skipped, canceled canceled)` live summaries plus per-item HTTP status/message, response time/size, tests, and errors, omit assertion filters from active/manually-canceled live mode, retain the canceled live cards after settlement, prevent prior saved evidence from flashing at new-run startup, permit queued or active request skipping, and make Cancel all abort browser/native HTTP or disconnect active stream samples before marking every unfinished item canceled. Results expose source-shaped All/Passed/Failed/Skipped controls with exact assertion-status filtering and pinned `fuzzysort` 1.9.0 name-only matching; every request attempt stays visible across active, latest, and reopened historical runs, and filters do not mutate aggregate or saved evidence. The direct response Tests pane uses the same row-local controls. The Results tab shows pinned `passed / total` assertion accounting with neutral zero, all-passed success, and failed-or-skipped failure treatment; completed latest/selected historical runs show the shared pinned-formatted total duration without leaking it into active/canceled live mode. Results group request-attempt cards by iteration; active cards start collapsed, remount expanded when the run finishes, and saved cards start expanded, while completed/failed cards retain independent accessible expand/collapse controls. Cards use the pinned fixed lifecycle labels, standard HTTP reason fallback, code-family tones, `ERROR` fallback, and rounded `ms - bytes/kilobytes/megabytes/gigabytes` response statistics while suppressing absent/negative values. Every expanded card exposes each retained assertion as PASS/FAIL/SKIP with its name/error, pinned Pre-request Test/After-response Test/Unknown category, and `< 0.1`/one-decimal callback timing plus the existing bounded request/response evidence across those same live/latest/history sources; explicit skipped assertions do not execute callbacks or fail successful attempts, while legacy evidence remains labeled Unknown/Timing unavailable. Scripts expose collection/folder/request execution ancestry, can skip before transport, seek forward by exact ID or the last matching trimmed name, repeat the current request, and preserve their selected flow through retries; missing/already-passed targets skip the remaining iteration, while a report-visible 10,000-extra-step safety bound prevents non-converging self-flow. Retries, a cancelable 0–30,000 ms delay before every first/retry transport attempt, bail, separated global/collection/folder/iteration/local propagation, disabled-row masking, primary/secondary cookie/response chaining, bounded GraphQL subscription/WebSocket/Socket.IO/SSE samples, ordered async assertions, saved live outcomes and attempt reports, redacted resolved request metadata, bounded status/header/body response inspection, default-on per-attempt timeline capture under 64 KiB/1 MiB local budgets, and pinned-prefixed Results/History/Console inspection with request separators, multiline category formatting, retry/error ordering, truncation notice, and sensitive-header redaction work. Configured/calculated outgoing headers retain duplicate order; native final response evidence retains duplicate values plus redirect status/source/target hops and effective URL; classified pre-response failures retain elapsed/error/request/available-redirect evidence as status-zero results; and all of it flows through the existing Runner bounds and URL/header-secret redaction. A newest-first 30-run local History is scoped independently to each collection or folder Runner, derives Total/Passed/Failed/Skipped and success state from retained assertion rows rather than attempts, formats duration with pinned strict millisecond/second/minute thresholds and magnitude-based precision, shows source/date/iterations, reopens historical Results and Console, exports the selected run, and permanently deletes exact entries. Downloadable versioned JSON/JUnit/TAP/text evidence remains available. A Run via CLI dialog generates POSIX-shell-safe commands with independent pinned `--globals` and `--env` selection plus exact request IDs/order, iterations, retries, pre-send delay, data path, and bail state; Tauri resolves the complete saved local JSON path, split-YAML folder/Git paths are accepted directly, and unavailable browser/data paths remain explicit required inputs instead of fabricated authority. Standalone suites explicitly own one Brunomnia collection as the pinned-workspace adaptation, persist ordered suite/test models and saved runs, share the ordinary document lifecycle, expose CRUD/owner/request selection/JavaScript editing/run-one/run-all/results, and execute owner-scoped HTTP/GraphQL through a bounded Worker with Chai, inherited environment configuration, OAuth, plugins, cookies, response chaining/history, plus pinned-shaped default or ID-targeted `insomnia.send()` results. The CLI selects one suite or every linked API-spec suite in sort-key order with regex, retry, bail, reporter, and trust-grant continuity; collection CLI runs accept JSON or split-YAML project inputs, repeated ordered request selectors, data, and bounded pre-send delay through shared desktop execution flow and safety bounds. Exact probabilistic chardet identity, byte-exact wire header casing/global order, transport-added request framing, DNS/connect/TLS callbacks, challenge-round headers, compressed transfer-byte accounting, remaining runner/result edge semantics, and remaining Inso breadth remain. Pinned Runner dispatches only ordinary Request resources through the shared send action; Brunomnia's bounded realtime samples are an account-free extension rather than a parity requirement. | [Collection runner guide](https://developer.konghq.com/how-to/use-the-collection-runner/), [collections](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Every local server and route now has a persistent shared `mockServer` or method-tagged `mockRoute` document tab whose resource-targeted workbench preserves one-temporary-tab navigation and edit promotion. Real native loopback mock server with live route updates, parameters, headers, delays, CORS, request-aware output from headers, ordered repeated query/form/multipart arrays, decoded path segments/parameters, and raw or parsed JSON/form/multipart bodies with literal/computed bracket and dot traversal plus the upstream-only chainable `default` filter; quote-aware LiquidJS string escapes, typed equality/relational/`contains`/`not`/right-associative `and`/`or` conditions, `elsif`, bounded `assign`/`if`/`unless`/`else`/`raw` controls, permissive missing variables, structured HTTP 500 failures for malformed or disabled syntax and resource ceilings, all 118 currently documented Faker names, three legacy dynamic tokens, and optional AI generation from pasted prompt/spec/example material, an explicitly fetched/reviewed specification URL, or credential-redacted active-request/latest-response context also work. A dedicated response tab can create a new local server and route, create a conflict-checked route in an existing server, overwrite an existing route, and open the selected route with no project-type or subscription gate. Exact LiquidJS diagnostics/ranges/timing/memory/JavaScript-object identity, exact FakerJS corpus/distribution identity, and hosted/self-host deployment workflows remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/), [Faker variables](https://developer.konghq.com/insomnia/faker-variables/) |
| Headless CLI and CI | Complete | Bundled CLI lints/generates/exports OpenAPI. Root `-v`/`--version` prints the package version or pinned-compatible `VERSION` release override without loading project state. Root, parent, and leaf `-h`/`--help` plus `help <topic>` expose scoped syntax, descriptions, local flags, shared global flags, and visible Brunomnia extensions before project loading. Pinned `lint spec` resolves a working-directory-relative file before a stored design and supports explicit `-r`/`--ruleset`; Brunomnia additionally retains its established CI first-design fallback and deterministically discovers a sibling `.spectral*` file. Lint now uses the pinned Spectral 1.22 OAS runtime and every safe exported built-in function. File inputs recursively collect bounded root-confined JSON/YAML `$ref` sources and YAML ruleset `extends`, reject root/symlink escapes, and resolve public HTTPS documents/rulesets through DNS private/loopback checks, no redirects, ten-second/1 MB response limits, and the shared remote-source cap. Stored designs use their persisted selected sources. Custom JavaScript, package rulesets, URL credentials, non-HTTPS/private targets, and unsafe ruleset fields remain blocked like the audited pinned path. Pinned identifier-only `export spec ... -w <project>` plus legacy workspace/identifier input preserve source text or recursively remove only `x-kong-*` keys through `-s`/`--skipAnnotations`, with nested working-directory-relative output. Stored API designs and collections accept exact names or full/unambiguous-prefix IDs; ambiguity fails explicitly rather than depending on storage order. Omitted collection, suite/API-design, lint-design, and export-design identifiers open bounded numbered terminal prompts; non-TTY execution refuses before transport with identifier/`--ci` guidance. Brunomnia retains deterministic first-resource CI fallback across those commands as an automation extension, while pinned Inso applies it only to collection runs. Run commands likewise accept pinned `-w`/`--workingDir` input alongside the legacy positional workspace form. Pinned Cosmiconfig-order `package.json`, `.insorc*`, `.config/insorc*`, and `inso.config.*` discovery filters workingDir/CI/verbose/print options with CLI precedence; JSON/YAML remains data-only, while separately granted `--allow-config-code` evaluates JS/CJS/MJS/TS in a fresh resource-limited worker under source/compiled/result limits, VM/worker deadlines, disabled imports/`require`, absent Node process/filesystem/network authority, disabled string/WebAssembly code generation and external buffers, and JSON-compatible object output; one shared merge path applies them to run/lint/export/script and keeps diagnostics on stderr. Quote-aware `inso` config aliases recursively dispatch the bundled CLI without a shell and return child exit status. Pinned `-g`/`--globals` selects a workspace global environment by exact name or full/unambiguous-prefix ID, or the first environment in a bounded Brunomnia/Insomnia v4/v5 local file, while `-e`/`--env` independently selects the collection sub-environment the same way for collection and suite execution. Explicit `--env` wins; otherwise CI auto-selects exactly one sub-environment and rejects multiple, an interactive terminal prompts with active/default context, and non-interactive execution refuses before transport with `--env`/`--ci` guidance. It runs HTTP/GraphQL collections from full JSON or managed split-YAML project inputs with shared runner logic, repeated request ID/name or recursively expanded folder-item selection, selected-or-full `-t`/`--requestNamePattern` regex filtering, bounded local or explicit HTTP(S) iteration data, iterations, bounded pre-send delay, bounded pinned `--requestTimeout` overrides, retries, and bail, and runs persistent standalone suites selected by exact name or full/prefix ID; a linked API-spec name or ID selects every owned suite in sort-key order. Both run subjects default to pinned `spec`; suite runs preserve validated `-t`/`--testNamePattern` regex filtering, request-timeout override continuity, retries, retry-aware `--bail`, inherited global/collection/folder variables, saved-request `insomnia.send()`, arbitrary granted `insomnia.sendRequest()`, dependent responses, cookies, and the documented `dot`, `list`, `min`, `progress`, `spec`, and `tap` reporters alongside JSON/JUnit. Pinned test-only `--keepFile` retains sorted generated suite/test source with default request IDs in a private temporary file and prints the upstream-shaped path notice after the reporter; the source is diagnostic rather than a retained executable harness. The shared async renderer covers environment/Faker/UUID/time/Node-OS/Base64/hash/JSONPath/cookie/request/response values, explicit 5 MB UTF-8 File reads, and allowlisted AWS/GCP/Azure/HashiCorp official-CLI secrets. File, external-vault, scripts, arbitrary script-network, script-file, and stored-plugin authority stay off unless their separate trusted-workspace flags are present; file reads additionally require canonical pinned `-f`/`--dataFolders` roots, and saved suite sends remain confined to the owner collection. `--allow-plugins` executes only enabled stored plugins with a prior `template` grant in fresh resource-limited Node workers; `process`/`global`, host RPC, Node modules, files, external vaults, hooks, actions, and themes remain unavailable, while bounded plugin stores persist in memory for the run. Pinned `--httpProxy`/`--httpsProxy`/`--noProxy` plus environment defaults route through request-scoped Undici dispatchers; `--disableCertValidation`/`-k` forces target TLS validation off for the run, while rendered request/workspace CA and PEM/PFX identity material remain scoped per request. Collection `--output` prevalidates existing destinations before transport, writes metadata-safe versioned JSON from the working-directory base, and keeps the selected reporter on stdout; `--includeFullData` replaces that file with pinned redact/plaintext modes only after explicit noninteractive risk acceptance. Full reports retain final rendered primary requests, complete responses, effective variables, tests, timing, and stats, while redaction covers environment/auth/known-header/proxy-credential/certificate fields under a documented non-scanner boundary. The pinned user-facing command/flag inventory is covered; `generate-docs` is a source-maintainer command that writes bundled reference files and exits nonzero, not an end-user parity requirement. A digest-pinned non-root OCI image plus immutable-action GHCR workflow rebuilds the bundle, smoke-tests it without network, emits AMD64/ARM64 manifests with SBOM/provenance, and keylessly signs pushed digests. Its first main digest independently passes Cosign issuer, workflow-identity, claim, certificate-chain, and transparency-log verification. Exact Commander/Enquirer cosmetics and byte-identical Mocha reporter prose are presentation details rather than command behavior. Brunomnia's deterministic noninteractive fallbacks, stricter trust grants, stored-plugin tags, local-reference lint, additional reporters/retries, and stronger process isolation are account-free extensions. The pinned Inso package exposes no arbitrary user plugin-directory loader, plugin hooks/actions/host RPC, or desktop local-vault API, so those prior CLI gaps were false cross-surface requirements. | [Inso CLI](https://developer.konghq.com/inso-cli/), [run test reference](https://developer.konghq.com/inso-cli/reference/run_test/) |
| Import and export formats | Baseline | Existing formats/scopes map advanced Insomnia/Postman auth, scope-aware Postman scripts and collection variables including `pm.execution` and legacy `postman.setNextRequest` flow translation, custom HTTP methods, explicit path/query/header rows with descriptions and multiline values, OpenAPI path parameters, cookie jars, Insomnia `global`/`on`/`off` redirect modes, first-class Insomnia v4/v5 Socket.IO requests/payloads/listeners, complete bounded Insomnia v4 gRPC `proto_directory`/`proto_file` trees with entry references, distinct collection base/sub-environments, standalone v5 global environments, and nested folders with headers/auth/variables/scripts/docs. First-class Insomnia v4 `mcp_request` workspaces and v5 `mcpClient.insomnia/5.0` documents preserve HTTP/STDIO transport, safely quoted argument arrays, enabled/disabled environment rows, headers, public auth configuration, roots, and self-contained public environments; imports are disabled with plaintext integration credentials cleared, runtime OAuth state is omitted, scoped omissions warn, and collision-safe application rekeys client/row identities. Brunomnia v41 JSON preserves typed environment values/editor modes, GGUF settings, MCP process-environment order/disabled state/protected references and device-local response history, plus bounded collection-owned standalone suites, tests, request references, and local result history. Insomnia v4 imports/exports workspace-owned `unit_test_suite`/`unit_test` resources with request-ID remapping; Insomnia v5 imports/exports suites on matching specification documents, warns when a collection-only scope cannot represent them, and collision-safe artifact application rekeys suite, collection, and request references together. V4 preserves table/raw mode and disabled table rows, while v4/v5 preserve typed object/array environment data. Arbitrary mixed request/folder sibling order round-trips through Insomnia v4 `metaSortKey` and v5 `meta.sortKey`, with source-array fallback when legacy siblings omit complete sort metadata. V5 YAML's database-ID-only proto reference, partial/deprecated scripts, external files, WSDL placeholders, and omitted binary bytes remain explicit bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Complete | Split-YAML projects in standard repositories support init/clone/status with push readiness and unpublished-branch evidence, selected/all stage and unstage, selected/all unstaged discard with index preservation, aggregate and confined per-file working/staged diffs including bounded untracked text, commit, ordered reviewed grouped commits, or remote-access-preflighted commit-and-push with explicit partial-progress, nothing-to-push defense, and actionable non-fast-forward/auth/access failure reporting, a bounded current-branch history with author/date/parents/decorations and selected-commit patches, local branch create/switch/merged-delete, explicit fetch/prune, remote-only branch discovery and tracking checkout, remotes, pull/push, clean-tree-guarded merge, three-way text resolution, binary side selection, and abort. A guided account-free onboarding flow selects reusable device-global GitHub, GitLab, or custom HTTP(S) credentials—or the installed Git credential helper/SSH agent—validates provider identity and repository access, discovers GitHub/GitLab pullable repositories and author emails, selects an exact remote branch, scans a bounded no-checkout tree for Brunomnia/Insomnia/API-spec files, and clones that branch. Provider and username metadata are authenticated with each token inside a bounded AES-256-GCM record whose random master key stays in macOS Keychain; Git receives host-scoped credentials only through transient environment-backed helpers, never command arguments or repository configuration. Existing projects can switch the reusable credential used for every network operation. No Brunomnia account, hosted broker, entitlement, or subscription is required. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/), [Git Sync](https://developer.konghq.com/insomnia/git-sync/) |
| Plugins and extension API | Baseline | Disabled-by-default local CommonJS plugins run in disposable Workers with explicit grants. Request/response hooks, custom tags, actions, themes, local store, notifications, and mediated network/prompt/clipboard APIs work for desktop HTTP, GraphQL, gRPC, and collection runs. Stored enabled/granted template tags additionally work for portable CLI collection/suite HTTP/GraphQL execution only after `--allow-plugins`, inside a stricter resource-limited Node worker without host RPC or persistent writes. Remote/npm dependency installation, external plugin-directory discovery/hot reload, complete supported context/hook coverage, CLI hooks/actions/host RPC, and ecosystem compatibility remain. Pinned realtime connect routes bypass plugin request/response hooks, so streaming hooks are not a parity requirement. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/), [hooks and actions](https://developer.konghq.com/insomnia/plugins/hooks-and-actions/) |
| Secrets and external vaults | Baseline | A passphrase-derived AES-256-GCM local vault keeps decrypted values in memory, resolves `vault.*` variables, and can be exposed to desktop scripts only through a device-local off-by-default grant. Device-local private sub-environment trees are omitted from exports/projects/encrypted sync. Desktop and explicitly granted portable CLI HTTP/GraphQL tags use installed AWS, GCP, Azure, and HashiCorp official-CLI credential chains, a bounded memory cache, and per-reference approval. macOS Keychain wrapping now protects request/folder/MCP OAuth runtime state and reusable Git provider credentials; wrapping for the local-vault root and other stored provider secrets, provider-native login UX/SDKs, script access to external providers, and broader secret-field UX remain. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Cloud sync and collaboration | Baseline | A user-controlled shared file now carries filtered workspace data under AES-256-GCM E2EE with pull/push revisions, conflict rejection, explicit force, local actor labels, and no hosted dependency. Git remains available for branch/commit workflows. Per-user key wrapping, real-time sync/presence, comments, resource-specific cloud branches/history, discovery, and offline merge UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/), [data security](https://developer.konghq.com/insomnia/end-to-end-encryption/) |
| MCP clients | Complete | Multiple project-scoped HTTP/STDIO clients support initialization, paginated discovery/caching and invocation of tools/prompts/resources/templates, roots, JSON/SSE parsing, session IDs, vault-backed credentials, event records, split-YAML serialization, and first-class Insomnia v4/v5 MCP-resource interchange. Prompt arguments and bounded recursive tool JSON-Schema forms have synchronized guided/JSON editors and per-primitive drafts. Typed scalar/enum/const controls, nested objects/arrays, optional recursive children, local `$ref`, `allOf`, selectable `oneOf`/`anyOf`, `if`/`then`/`else`, modern/legacy dependencies, additional properties, composed defaults, branch choices, and advisory nonblocking path validation are guided; truncated, specialized-format, remote-reference, and uncommon draft-keyword values remain editable in authoritative JSON. Resource templates preserve their URI template, derive required variables, preview and expand bounded RFC 6570 values before `resources/read`. HTTP OAuth supports manual or discovered RFC 9728/RFC 8414/OIDC metadata, explicit twenty-hop per-URL-validated metadata redirects, dynamic registration, PKCE, resource parameters, loopback capture, refresh recovery, scope escalation, and device-local credentials. Project/client-scoped HTTP connections remain only in bounded device memory, reuse initialization even for stateless servers, carry validated session plus protocol-version headers, expose explicit/best-effort configuration-triggered `DELETE` termination, and replace a server-rejected `404` session once. Native Streamable HTTP consumes long-lived POST SSE incrementally, returns before EOF on the matching response, resumes only primed unfinished POST streams through GET plus `Last-Event-ID`, and starts the optional post-initialization GET stream with nonfatal `405`, live event-console delivery, server `retry`, `1.5` capped backoff, and a two-retry ceiling. Active HTTP/STDIO discovery and invocation can be canceled; HTTP drops the exact native reader and sends a detached session/request-aware `notifications/cancelled`, while native STDIO signals the exact pending request and retains its initialized process. Native STDIO retains one serialized direct-child session per project/client with monotonically increasing request IDs, a dedicated idle message dispatcher, bounded in-memory identity/registry/stream state, explicit and configuration-triggered termination, executable/argument/environment replacement, and fatal process/protocol cleanup so the next operation starts clean without silently retrying the failed call. Up to 100 reviewed process-environment rows preserve order/disabled state, render project plus prompt/file/vault templates, require protected sensitive values, apply last-duplicate-wins, and run inside an ambient-variable-cleared bounded login-shell-resolved `PATH` (app fallback) plus reviewed-overrides environment with 512-byte names, 32,768-byte values, and a 1 MB aggregate limit. HTTP and persistent STDIO advertise roots/list-changed, elicitation, and sampling; live reviewed requests are deduplicated into a bounded queue, server cancellation removes them, roots are answered automatically and emit change notifications, elicitation uses the recursive schema form with accept/decline/cancel, and sampling exposes editable approve/reject fields plus an optional configured-provider draft that is never auto-approved. Responses return through the authenticated HTTP session or concurrency-safe STDIO writer while the originating operation remains active. Negotiated `resources.subscribe` enables ordinary-resource Subscribe/Unsubscribe controls, session-aware protocol calls, idle `notifications/resources/updated` delivery, bounded device-memory state, and disconnect cleanup across both transports. Each logical connection has bounded device-local response history with outgoing and matching result events, separate searchable Notifications, elapsed Console evidence, event-type/search/clear-view/detail controls, shared finite/zero/unlimited retention, environment filtering, historical selection, delete, and clear behavior; restart, folder/Git, import, and encrypted-sync boundaries preserve Insomnia's non-syncable response model. Pinned Insomnia's provider does not supply the exact SDK's optional `clientMetadataUrl`, so URL-based client-ID metadata documents are not a user-facing parity requirement. The exact locked SDK selects the first advertised authorization server and only parses DPoP metadata while Insomnia supplies no proof hook, so authorization-server failover and DPoP are not parity requirements. Packaged macOS catalog, backup, legacy, and deleted-project copies wrap request/folder and MCP OAuth runtime credentials in a bounded workspace-authenticated AES-256-GCM envelope whose random master key stays in macOS Keychain. A credential-free public matrix passes protocol `2025-06-18` initialization, discovery, named tool invocation, result parsing, and stateless/stateful disconnect behavior through both the shared client and native Tauri transport against DeepWiki 2.14.3, Context7 3.2.3, and Cloudflare Docs 0.4.9. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Complete | Optional direct `.gguf`, OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible configuration drives bounded mock generation from manual, explicitly fetched/reviewed specification-URL, or selected active-request/latest-response context plus reviewable Git commit grouping that can be executed in order with optional push. The same configured provider can draft MCP sampling content into a bounded editable form, but only a separate explicit approval returns it to the server. Direct GGUF uses pinned-compatible model discovery and sampling controls, a root-confined app-data `llms` folder, persisted filenames/defaults, model chat templates, an 8K/4,096-token context/output boundary, stateful UTF-8 decoding, Metal with CPU retry on macOS, and a bounded crash-isolated native worker. Hosted credentials are vault-backed; no Brunomnia account, bundled model, entitlement, or subscription is required. Focused path/symlink/parameter/adapter/migration tests plus a checksum-recorded public tiny-model Metal inference verify the local path. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Complete | The pull-only Konnect adapter now reconciles the pinned active `us`, `eu`, `au`, `in`, and `sg` regions into one inactive-created local project per control plane, one root Environment per project, and one source-backed Collection per Gateway Service without switching the active coordinator or racing its autosave. Exact page-number control-plane and offset service/route pagination, bounded 429 retry, five-service route concurrency, control-plane deployment metadata, created/updated/deleted/skipped counts, progress, duration, skipped route/region evidence, stale-service cleanup, and stale-project deletion only for successfully fetched regions match the pinned flow. Managed projects receive no PAT, imports/shares/duplicates cannot inherit sync ownership, and a browser/native inactive-create path preserves catalog authority. Existing route/path/protocol folders, every supported HTTP/HTTPS method/path/protocol combination, WS/WSS path, gRPC/GRPCS service method, expression conversion, proxy defaults, remote-template sanitization, stable keys, and local query/auth/body/transport/script/test/custom-header/proxy/folder preservation remain. Missing-identifier, missing-service, unextractable/SNI-expression, traditional-SNI, and L4 routes stay visible with reasons; sync never pushes Gateway configuration. An opt-in live-tenant fixture reads real control-plane/service/route inventories without storing credentials. The complete official Insomnia documentation tree at Kong/developer.konghq.com `73995e32ed758882a290c945807225d7442b483e` documents Konnect as its only service integration, so no additional adapter remains. | [Konnect integration](https://developer.konghq.com/insomnia/konnect-integration/) |
| SSO, RBAC, SCIM, audit, and organization controls | Early baseline | Workspace v23 retains normalized owner/admin/editor/viewer actors, last-owner protection, storage/secret/external-reference policy checks, encrypted-sync and integration edit enforcement, device-local script authorities, and bounded local audit events. These are local controls, not identity proof. Self-hosted SAML/OIDC, SCIM, authenticated organization service, complete RBAC enforcement, and tamper-evident audit export remain. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [SSO](https://developer.konghq.com/insomnia/sso/), [SCIM](https://developer.konghq.com/insomnia/scim/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Baseline | Device-local system/dark/light themes, comfortable/compact density, editor font sizing, request/script defaults, preferred HTTP version, redirect/timeout/API-validation/auth-validation and system/manual proxy defaults, regular/bulk header and query editors, forced-vertical layout, editor wrapping/tabs/indent width/ligatures, separate interface/editor families and 8–24 px sizes, masked request/folder authentication and MCP/AI/Konnect credentials with global/per-field reveal, maximum redirects, timeline chunk size, response-history limit/environment filtering, response-viewer link disabling, off-by-default HTML-preview remote resources/JavaScript plus script network/file/vault grants, delete confirmation, GraphQL auto-introspection, eleven editable shortcuts with collision warnings—including Generate Code—sidebar toggling, and a macOS Tauri app bundle exist. A digest-pinned non-root CLI image and keyless signed multi-architecture GHCR release workflow add SBOM/provenance-backed headless packaging. Full command/action coverage, accessibility audit, updater, desktop signing/notarization, and Windows/Linux desktop release artifacts remain. | [Keyboard shortcuts](https://developer.konghq.com/insomnia/keyboard-shortcuts/), [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

## Milestone 3 acceptance evidence

- Shared design and generation engine: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Permission-bounded browser runtime: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Shared runner and data parser: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Native loopback server and integration test: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
- Direct text-response-to-route conversion and focused tests: [`src/lib/mockRouteFromResponse.ts`](../src/lib/mockRouteFromResponse.ts) and [`src/lib/mockRouteFromResponse.test.ts`](../src/lib/mockRouteFromResponse.test.ts)
- Request-aware native mock rendering and handler-level fixtures: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
- Headless entry point and offline fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- UI surfaces: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Exact verification record: [`docs/QA.md`](QA.md)

## Milestone 4 acceptance evidence

- Format detection and adapter routing: [`src/lib/interchange/index.ts`](../src/lib/interchange/index.ts)
- Insomnia, Postman, HAR, cURL, API definition, and WSDL converters: [`src/lib/interchange/`](../src/lib/interchange/)
- Scoped compatibility exports and round-trip tests: [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts) and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Import fixtures for every adapter: [`examples/imports/`](../examples/imports/)
- Pre-apply warning and export-preview UI: [`src/components/InterchangeDialogs.tsx`](../src/components/InterchangeDialogs.tsx)
- Collision-safe application and workspace v4 migration: [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts) and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_4.md`](QA_MILESTONE_4.md)

## Milestone 5 acceptance evidence

- Advanced signers, OAuth helpers, and native challenge handlers: [`src/lib/auth.ts`](../src/lib/auth.ts) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Persistent cookie and template/chaining engines: [`src/lib/cookies.ts`](../src/lib/cookies.ts) and [`src/lib/templates.ts`](../src/lib/templates.ts)
- Auth, cookie, transport, multipart, and binary WebSocket UI: [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx), [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), and [`src/App.tsx`](../src/App.tsx)
- Runner/script/custom-ruleset compatibility: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), and [`src/lib/openapi.ts`](../src/lib/openapi.ts)
- Advanced interoperability and workspace v5 migration: [`src/lib/interchange/`](../src/lib/interchange/) and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_5.md`](QA_MILESTONE_5.md)

## Milestone 6 acceptance evidence

- Split-YAML ownership, symlink confinement, standard Git operations, and conflicts: [`src-tauri/src/project.rs`](../src-tauri/src/project.rs)
- Native local package reader and Tauri command boundary: [`src-tauri/src/plugin.rs`](../src-tauri/src/plugin.rs) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Git status/diff/branch/remote/conflict UI: [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- Permissioned plugin Worker, compatibility adapter, and tests: [`src/lib/plugins.ts`](../src/lib/plugins.ts) and [`src/lib/plugins.test.ts`](../src/lib/plugins.test.ts)
- Disabled-by-default installation and per-capability grant UI: [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx)
- Request/runner integration and workspace v6 migration: [`src/lib/http.ts`](../src/lib/http.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- User guides: [`docs/GIT_PROJECTS.md`](GIT_PROJECTS.md) and [`docs/PLUGINS.md`](PLUGINS.md)
- Exact verification record: [`docs/QA_MILESTONE_6.md`](QA_MILESTONE_6.md)

## Milestone 7 acceptance evidence

- AES-GCM vault and revision-checked encrypted sync: [`src-tauri/src/secure_store.rs`](../src-tauri/src/secure_store.rs)
- Four-family bounded official-CLI adapter and memory cache: [`src-tauri/src/external_vault.rs`](../src-tauri/src/external_vault.rs)
- Shareable-scope filtering, vault variables, policy scanning, audit helper, and tests: [`src/lib/security.ts`](../src/lib/security.ts) and [`src/lib/security.test.ts`](../src/lib/security.test.ts)
- Vault, external-provider, encrypted-sync, member/role, policy, and audit UI: [`src/components/SecurityWorkbench.tsx`](../src/components/SecurityWorkbench.tsx)
- Request/OAuth/runner template integration: [`src/lib/http.ts`](../src/lib/http.ts), [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Workspace v7 migration normalization and policy-safe Git persistence: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- User guide: [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md)
- Exact verification record: [`docs/QA_MILESTONE_7.md`](QA_MILESTONE_7.md)

## Milestone 8 acceptance evidence

- MCP HTTP protocol/session/discovery/invocation implementation and parser tests: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts)
- Direct-process bounded MCP STDIO implementation and native tests: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs)
- Hosted/custom/local provider adapters, structured-output validation, mock generation, Git suggestions, and tests: [`src/lib/ai.ts`](../src/lib/ai.ts) and [`src/lib/ai.test.ts`](../src/lib/ai.test.ts)
- Reviewable credential-redacted active-request/latest-response mock context and focused tests: [`src/lib/mockAiContext.ts`](../src/lib/mockAiContext.ts) and [`src/lib/mockAiContext.test.ts`](../src/lib/mockAiContext.test.ts)
- Konnect pagination confinement, mapping/preservation logic, and tests: [`src/lib/konnect.ts`](../src/lib/konnect.ts) and [`src/lib/konnect.test.ts`](../src/lib/konnect.test.ts)
- All-region Konnect project reconciliation, inactive catalog persistence, progress/count evidence, stale-region safety, and opt-in tenant fixture: [`src/lib/konnectCatalog.ts`](../src/lib/konnectCatalog.ts), [`src/lib/konnectCatalog.test.ts`](../src/lib/konnectCatalog.test.ts), [`src/lib/konnectLive.integration.test.ts`](../src/lib/konnectLive.integration.test.ts), [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), and [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs)
- Disabled-by-default integration configuration and operation UI: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- AI mock and Git suggestion review surfaces: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- Workspace v8 normalization, authority stripping, project serialization, and plaintext credential policy: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src-tauri/src/project.rs`](../src-tauri/src/project.rs)
- User guide: [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md)
- Exact verification record: [`docs/QA_MILESTONE_8.md`](QA_MILESTONE_8.md)

## Milestone 9 acceptance evidence

- Bounded introspection, schema normalization, structural/root validation, and safe insertion logic: [`src/lib/graphql.ts`](../src/lib/graphql.ts) and [`src/lib/graphql.test.ts`](../src/lib/graphql.test.ts)
- Schema explorer, documentation pane, and query/variables composition UI: [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Device-local appearance, request defaults, shortcut editing/collision detection, and reset UI: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), [`src/lib/preferences.ts`](../src/lib/preferences.ts), and [`src/lib/preferences.test.ts`](../src/lib/preferences.test.ts)
- Delayed/repeating send control, cancellation, request actions, and customizable global bindings: [`src/App.tsx`](../src/App.tsx)
- Workspace v9 schema/preference normalization and device-local synchronization boundaries: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src/lib/project.ts`](../src/lib/project.ts)
- User guide: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_9.md`](QA_MILESTONE_9.md)

## Milestone 10 acceptance evidence

- Bounded environment/folder ancestry, inherited execution composition, private-tree filtering, and focused tests: [`src/lib/resources.ts`](../src/lib/resources.ts) and [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Nested collection/folder/request and base/sub-environment editing: [`src/App.tsx`](../src/App.tsx)
- Workspace v10 cycle repair, private-descendant normalization, and migration tests: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Folder/environment-aware runner and CLI paths: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Insomnia v4/v5 folder and environment hierarchy round trips: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts) and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Private publication filtering and inherited secret-policy scanning: [`src/lib/security.ts`](../src/lib/security.ts), [`src/lib/project.ts`](../src/lib/project.ts), and [`src/lib/security.test.ts`](../src/lib/security.test.ts)
- User guide: [`docs/RESOURCE_HIERARCHY.md`](RESOURCE_HIERARCHY.md)
- Exact verification record: [`docs/QA_MILESTONE_10.md`](QA_MILESTONE_10.md)

## Milestone 11 acceptance evidence

- Method-token normalization, encoded path substitution, repeated query keys, and JSON/XML body formatting: [`src/lib/request.ts`](../src/lib/request.ts) and [`src/lib/request.test.ts`](../src/lib/request.test.ts)
- Six-target local code generator and focused output/warning tests: [`src/lib/codegen.ts`](../src/lib/codegen.ts) and [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Custom-method, path/query/header, multiline-row, Beautify, Generate Code, and shortcut UI: [`src/App.tsx`](../src/App.tsx), [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), and [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- OpenAPI, Postman, and Insomnia v4/v5 request-authoring preservation and round trips: [`src/lib/openapi.ts`](../src/lib/openapi.ts), [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Workspace v11 row/method/shortcut migration and project/import propagation: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), and [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts)
- User guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_11.md`](QA_MILESTONE_11.md)

## Milestone 12 acceptance evidence

- Permission-bounded Worker bridge, request normalization, selected module adapters, vault/network grants, and focused tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Direct-send scope persistence and mediated transport integration: [`src/App.tsx`](../src/App.tsx)
- Collection/folder scope propagation and permission-aware runner integration: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Explicit CLI trusted-script/network flags and compatibility runtime: [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Workspace v12 safe-default permission migration and device-local controls: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- User guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_12.md`](QA_MILESTONE_12.md)

## Milestone 13 acceptance evidence

- Executable Worker compatibility harness, secondary state helper, exact request/scope APIs, async assertions, and focused tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Scope-correct direct/runner execution and secondary cookie/response continuity: [`src/App.tsx`](../src/App.tsx), [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Trusted CLI async Chai compatibility and self-contained fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Scope-aware Postman script translation and import coverage: [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts) and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_13.md`](QA_MILESTONE_13.md)

## Milestone 14 acceptance evidence

- Distinct global and collection base/selected scope resolution, disabled masking, direct persistence, and collection environment editing: [`src/lib/resources.ts`](../src/lib/resources.ts), [`src/App.tsx`](../src/App.tsx), and [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Seven-level executable Worker contract with alias/mutation coverage: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Scope-identical collection runner and trusted CLI propagation: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Workspace v13 collection-environment normalization, project serialization, and secret-policy coverage: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Corrected Postman and Insomnia v4/v5 environment-store interchange with round-trip tests: [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_14.md`](QA_MILESTONE_14.md)

## Milestone 15 acceptance evidence

- Shared self-contained adapters for the complete documented module-name surface: [`src/lib/scriptModules.ts`](../src/lib/scriptModules.ts)
- Direct adapter contracts, exact name inventory, common-operation coverage, 5 MB input bounds, serialized-Worker execution, and unknown-module denial: [`src/lib/scriptModules.test.ts`](../src/lib/scriptModules.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Identical desktop Worker and trusted CLI module injection: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Offline trusted-CLI schema/CSV/SHA-256 fixture: [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_15.md`](QA_MILESTONE_15.md)

## Milestone 16 acceptance evidence

- Worker-side path references, explicit authority checks, body/multipart/PEM facades, host hydration, aggregate limits, and executable denial/attachment tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Bounded regular-file Tauri command and focused native test: [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) and [`src-tauri/src/models.rs`](../src-tauri/src/models.rs)
- Device-only desktop reader and direct-send/runner injection: [`src/lib/scriptFiles.ts`](../src/lib/scriptFiles.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Separate trusted CLI authority plus offline exact-byte fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`examples/cli-workspace.json`](../examples/cli-workspace.json), and [`examples/cli-script-file.txt`](../examples/cli-script-file.txt)
- Workspace v14 safe-default preference migration and UI: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_16.md`](QA_MILESTONE_16.md)

## Milestone 17 acceptance evidence

- Shared clean-room `chai.assert` implementation and desktop/CLI module factory: [`src/lib/scriptModules.ts`](../src/lib/scriptModules.ts)
- Official public-name inventory, representative direct operations and getter overloads, custom-message failure behavior, and serialized-Worker coverage: [`src/lib/scriptModules.test.ts`](../src/lib/scriptModules.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Offline trusted-CLI deep nested-property and key assertions: [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_17.md`](QA_MILESTONE_17.md)

## Milestone 18 acceptance evidence

- Shared serializable `expect` implementation: [`src/lib/scriptExpect.ts`](../src/lib/scriptExpect.ts)
- Current BDD name/alias inventory plus representative direct behavior and failure coverage: [`src/lib/scriptExpect.test.ts`](../src/lib/scriptExpect.test.ts)
- Identical desktop Worker and trusted CLI injection: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Serialized-Worker and offline trusted-CLI deep nested/ordered chain coverage: [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_18.md`](QA_MILESTONE_18.md)

## Milestone 19 acceptance evidence

- Shared subrequest normalization, inert path resolution, host hydration, and execution-wide budget: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Desktop Worker message bridge and trusted CLI invocation of the same preparer: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Binary, multipart, PEM, denial, template, exact-byte, and aggregate-budget coverage: [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_19.md`](QA_MILESTONE_19.md)

## Milestone 20 acceptance evidence

- Shared deterministic reporter and artifact formatter: [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts)
- JSON, JUnit, TAP, text-reporter, escaping, and inventory coverage: [`src/lib/runnerReport.test.ts`](../src/lib/runnerReport.test.ts)
- Desktop JSON/JUnit downloads and CLI reporter/output integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- User guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_20.md`](QA_MILESTONE_20.md)

## Milestone 21 acceptance evidence

- Shared selected-order and retry-aware bail semantics: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Desktop checkbox plan, drag/drop, accessible move controls, and bail option: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- CLI `--bail` propagation and bailed-report output: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_21.md`](QA_MILESTONE_21.md)

## Milestone 22 acceptance evidence

- Shared UTF-8-safe response capture and aggregate budgets: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Serializable response snapshot contract: [`src/types.ts`](../src/types.ts)
- Keyboard-selectable saved/live response detail pane: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_22.md`](QA_MILESTONE_22.md)

## Milestone 23 acceptance evidence

- Shared resolved/redacted request capture and budgets: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Serializable request metadata contract: [`src/types.ts`](../src/types.ts)
- Actual request URL propagation in desktop demo and CLI transports: [`src/lib/http.ts`](../src/lib/http.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Combined request/response attempt evidence pane: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_23.md`](QA_MILESTONE_23.md)

## Milestone 24 acceptance evidence

- Persistent mixed-resource order and move contract: [`src/types.ts`](../src/types.ts) and [`src/lib/resources.ts`](../src/lib/resources.ts)
- Collection, request, folder, and subtree move coverage: [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Malformed/stale order normalization: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Collision-safe imported-order remapping: [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts)
- Native sidebar drag targets and drop indicators: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Updated guide: [`docs/RESOURCE_HIERARCHY.md`](RESOURCE_HIERARCHY.md)
- Exact verification record: [`docs/QA_MILESTONE_24.md`](QA_MILESTONE_24.md)

## Milestone 25 acceptance evidence

- Shared regex validation, propagation, clean-unmatched omission, failure retention, and match counts: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Callback-level filtering in desktop Workers and trusted CLI scripts: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Filter metadata in JSON and text evidence: [`src/types.ts`](../src/types.ts), [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts), and [`src/lib/runnerReport.test.ts`](../src/lib/runnerReport.test.ts)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_25.md`](QA_MILESTONE_25.md)

## Milestone 26 acceptance evidence

- Persistent request-level reconnect contract and migration defaults: [`src/types.ts`](../src/types.ts), [`src/data/seed.ts`](../src/data/seed.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Native lifetime, reconnect, retry-hint, resume, and cancellation behavior: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Reconnect editor and stream-state feedback: [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Focused frontend and native policy/parser coverage: [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- User guide: [`docs/SSE_STREAMS.md`](SSE_STREAMS.md)
- Exact verification record: [`docs/QA_MILESTONE_26.md`](QA_MILESTONE_26.md)

## Milestone 27 acceptance evidence

- Device-local preference model, safe normalization, import reset, and authoring UI: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Native HTTP/1 forcing, HTTP/2 negotiation/prior knowledge, and actual response version capture: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs) and [`src-tauri/src/models.rs`](../src-tauri/src/models.rs)
- Ordinary, GraphQL, Event Stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, and Konnect preference propagation: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Negotiated-version summary, timeline, saved-history continuity, and focused coverage: [`src/App.tsx`](../src/App.tsx), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Updated guide: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_27.md`](QA_MILESTONE_27.md)

## Milestone 28 acceptance evidence

- Explicit native compression feature set and locked codec dependencies: [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) and [`src-tauri/Cargo.lock`](../src-tauri/Cargo.lock)
- Shared HTTP/SSE automatic decoding plus ordinary-request decode-error fallback: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Updated request guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_28.md`](QA_MILESTONE_28.md)

## Milestone 29 acceptance evidence

- Device-local redirect preference, safe normalization, import reset, and authoring UI: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Native disabled/finite/unlimited redirect modes plus bounded SSE header establishment: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Primary, stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI propagation: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Focused invocation, stream-input, migration, immutability, and native policy coverage: [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_29.md`](QA_MILESTONE_29.md)

## Milestone 30 acceptance evidence

- Device-local response preferences, safe normalization/import reset, and authoring controls: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Finite/zero/unlimited and environment-scoped retention/visibility policy: [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts) and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Main-request, collection-run, and secondary-script persistence plus environment-filtered template execution: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), and [`src/lib/http.ts`](../src/lib/http.ts)
- Saved-response selector, request/environment restoration, and responsive styling: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Migration/invocation/template coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts), and [`src/lib/templates.test.ts`](../src/lib/templates.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_30.md`](QA_MILESTONE_30.md)

## Milestone 31 acceptance evidence

- Device-local default, request-mode migration, and three-state authoring controls: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared inheritance policy for ordinary HTTP and native Event Streams: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/protocol.ts`](../src/lib/protocol.ts)
- Primary, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI context propagation: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx)
- Insomnia v4/v5 `global`/`on`/`off` preservation: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and their focused tests
- Inheritance, override, migration, invocation, stream-input, and interchange coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/`](../src/lib/interchange/)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_31.md`](QA_MILESTONE_31.md)

## Milestone 32 acceptance evidence

- Device-local 10 KiB default, safe normalization/import reset, and current-compatible setting UI: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Prepared request payload classification, exact threshold/zero-fallback policy, response summary, and IEC size evidence: [`src/lib/timeline.ts`](../src/lib/timeline.ts) and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Native/browser execution attachment plus plugin and saved-history continuity: [`src/lib/http.ts`](../src/lib/http.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Persisted timeline normalization and responsive inspection: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Focused migration, invocation, text/form/multipart, exact-boundary, and zero-fallback coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_32.md`](QA_MILESTONE_32.md)

## Milestone 33 acceptance evidence

- Device-local 30-second execution default, `0`-disabled deadlines, safe normalization/import reset, and inherited/custom authoring controls: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared effective-timeout resolution for HTTP, GraphQL, Event Streams, gRPC, browser Fetch, and the CLI: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Native no-deadline behavior for HTTP, SSE response-header establishment, gRPC connection/RPC deadlines, and gRPC response streams: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Primary, collection-run, script/plugin, artifact-import, OAuth, integration, and Git-AI context propagation with explicit safety deadlines retained by bounded internal adapters: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), and [`src/lib/`](../src/lib/)
- Inheritance, explicit override, zero, legacy migration, native invocation, stream-input, and cURL-import coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_33.md`](QA_MILESTONE_33.md)

## Milestone 34 acceptance evidence

- Separate on-by-default API/authentication settings, safe normalization/import reset, inherited/always/never request controls, and v16 migration: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared effective-validation resolution for native HTTP, GraphQL, Event Streams, and gRPC: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/protocol.ts`](../src/lib/protocol.ts)
- Primary, collection-run, script/plugin, artifact-import, OAuth, integration, and Git-AI propagation with OAuth authentication-setting separation: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), and [`src/lib/http.ts`](../src/lib/http.ts)
- Browser ownership and explicit CLI refusal boundary: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), [`src/lib/http.ts`](../src/lib/http.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Inheritance, explicit override, legacy migration, OAuth separation, native invocation, stream-input, and cURL coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_34.md`](QA_MILESTONE_34.md)

## Milestone 35 acceptance evidence

- Device-local system/manual preference model, protocol-specific URLs, no-proxy list, safe normalization/import reset, and v17 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Shared effective proxy resolution and inherited/custom/direct authoring controls: [`src/lib/transport.ts`](../src/lib/transport.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Native system/custom/direct reqwest configuration plus primary HTTP, GraphQL, OAuth, Event Stream, collection-run, script/plugin, artifact-import, and HTTP-backed integration propagation: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Browser ownership, explicit CLI manual-proxy refusal, and gRPC/WebSocket compatibility boundaries: [`src/lib/http.ts`](../src/lib/http.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- System/manual protocol selection, no-proxy forwarding, explicit overrides, legacy migration, native invocation, stream-input, and cURL coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_35.md`](QA_MILESTONE_35.md)

## Milestone 36 acceptance evidence

- Device-local false defaults, strict normalization/import reset, preference controls, and workspace v18 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Direct request-pane Bulk Edit/Regular Edit switching for headers and query parameters: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Current-compatible enabled-row formatting, first-colon parsing, trimming, blank omission, and duplicate ordering: [`src/lib/bulkKeyValues.ts`](../src/lib/bulkKeyValues.ts)
- Focused syntax, migration, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/bulkKeyValues.test.ts`](../src/lib/bulkKeyValues.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_36.md`](QA_MILESTONE_36.md)

## Milestone 37 acceptance evidence

- Device-local current-compatible defaults, strict normalization/import reset, authoring controls, and workspace v19 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Forced vertical request/response layout, editor wrapping, tab width, font size, and ligature application: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Tabs/spaces insertion plus selection-aware indent/outdent behavior: [`src/lib/editorText.ts`](../src/lib/editorText.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Focused editor-edit, normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/editorText.test.ts`](../src/lib/editorText.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_37.md`](QA_MILESTONE_37.md)

## Milestone 38 acceptance evidence

- Current-compatible split defaults, 8–24 px bounds, bounded family normalization, import reset, authoring controls, and workspace v20 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Independent live interface/editor family and size application with built-in fallback stacks: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Focused default, bounds, family normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_38.md`](QA_MILESTONE_38.md)

## Milestone 39 acceptance evidence

- Device-local allowed-folder defaults, bounded normalization/deduplication, import reset, authoring controls, and workspace v21 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Canonical native containment for every mediated desktop script file read: [`src/lib/scriptFiles.ts`](../src/lib/scriptFiles.ts), [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Frontend and native coverage for safe defaults, explicit preservation, authority stripping, allowed reads, size limits, outside roots, empty/invalid roots, and symlink escape: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Updated guides: [`docs/SCRIPTING.md`](SCRIPTING.md) and [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_39.md`](QA_MILESTONE_39.md)

## Milestone 40 acceptance evidence

- Device-local false default, strict normalization/import reset, authoring control, and workspace v22 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Request and folder authentication masking plus device-wide and accessible per-field reveal behavior: [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx) and [`src/App.tsx`](../src/App.tsx)
- Focused default/global/per-field visibility, normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/components/AuthEditor.test.ts`](../src/components/AuthEditor.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_40.md`](QA_MILESTONE_40.md)

## Milestone 41 acceptance evidence

- Shared integration credential mask/global-reveal/local-reveal behavior and MCP client disclosure reset: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Device-local authoring control and boundary copy: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Focused default/global/per-field visibility coverage: [`src/components/IntegrationWorkbench.test.ts`](../src/components/IntegrationWorkbench.test.ts)
- Updated guides: [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md), [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md), and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_41.md`](QA_MILESTONE_41.md)

## Milestone 42 acceptance evidence

- Persisted exact-entry deletion, request/environment-scoped clearing, deterministic fallback selection, and accessible response-summary actions: [`src/App.tsx`](../src/App.tsx)
- Pure history mutation boundaries and focused preservation tests: [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts) and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_42.md`](QA_MILESTONE_42.md)

## Milestone 43 acceptance evidence

- Direct-send capture, asynchronous selection/delete restoration, request-switch race guard, and current tree-position preservation: [`src/App.tsx`](../src/App.tsx)
- Snapshot contract, independent clone helper, lazy runtime validation/restoration, and focused coverage: [`src/types.ts`](../src/types.ts), [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts), [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts), and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Collection-run and script-subrequest capture: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Storage survival and secondary-request evidence: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_43.md`](QA_MILESTONE_43.md)

## Milestone 44 acceptance evidence

- Selected-response raw/prettified actions and lazy artifact dispatch: [`src/App.tsx`](../src/App.tsx)
- Deterministic textual artifact contract, content-type mapping, filename confinement, browser/WebView download, and focused coverage: [`src/lib/responseDownload.ts`](../src/lib/responseDownload.ts) and [`src/lib/responseDownload.test.ts`](../src/lib/responseDownload.test.ts)
- Lazy-loaded existing code-generation dialog boundary: [`src/App.tsx`](../src/App.tsx) and [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_44.md`](QA_MILESTONE_44.md)

## Milestone 88 acceptance evidence

- Loopback-only native callback listener, browser opener, state verification, fragment bridge, timeout, and cancellation: [`src-tauri/src/oauth2_callback.rs`](../src-tauri/src/oauth2_callback.rs)
- Generated state/PKCE preparation, callback mapping, native channel bridge, and provider-error handling: [`src/lib/oauth2.ts`](../src/lib/oauth2.ts) and [`src/lib/oauth2.test.ts`](../src/lib/oauth2.test.ts)
- Authorization-code exchange plus access, refresh, and identity-token retention: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx)
- Insomnia-compatible implicit response types and import/export persistence: [`src/types.ts`](../src/types.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Exact verification record: [`docs/QA_MILESTONE_88.md`](QA_MILESTONE_88.md)

## Milestone 89 acceptance evidence

- OAuth Origin, OIDC nonce, ID-token fallback, `NO_PREFIX`, expiry, and refresh semantics: [`src/lib/auth.ts`](../src/lib/auth.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/oauth2.ts`](../src/lib/oauth2.ts)
- Automatic direct-send browser authorization plus cancellable status UI: [`src/App.tsx`](../src/App.tsx)
- Shared noninteractive pre-send acquisition for direct, runner, script, plugin, and integration HTTP execution: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Request/folder ownership persistence and secret-policy coverage: [`src/lib/resources.ts`](../src/lib/resources.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_89.md`](QA_MILESTONE_89.md)

## Milestone 90 acceptance evidence

- Shared interactive resolver contract that blocks protected dispatch until credentials return: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/lib/http.test.ts`](../src/lib/http.test.ts)
- Direct, script/plugin, project, and integration resolver propagation with request-switch/project cancellation: [`src/App.tsx`](../src/App.tsx)
- Collection-run and runner-script authorization, persistence, and Cancel-run integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Reusable lazy waiting/cancel surface: [`src/components/OAuthAuthorizationDialog.tsx`](../src/components/OAuthAuthorizationDialog.tsx)
- Exact verification record: [`docs/QA_MILESTONE_90.md`](QA_MILESTONE_90.md)

## Milestone 91 acceptance evidence

- Pure local-only runtime credential scrub/restore boundary with untrusted-input sanitization: [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts) and [`src/lib/oauth2Tokens.test.ts`](../src/lib/oauth2Tokens.test.ts)
- Git/folder project omission and owner-matched local restoration: [`src/lib/project.ts`](../src/lib/project.ts) and [`src/lib/project.test.ts`](../src/lib/project.test.ts)
- Encrypted-sync omission/restoration and publish-policy integration: [`src/lib/security.ts`](../src/lib/security.ts), [`src/App.tsx`](../src/App.tsx), and the security/project workbenches
- Typed invalid-refresh detection with interactive/noninteractive recovery: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/oauth2.ts`](../src/lib/oauth2.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_91.md`](QA_MILESTONE_91.md)

## Milestone 92 acceptance evidence

- MCP-to-request OAuth adapter, token propagation across sessions/discovery/invocation, and focused transport fixtures: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts)
- Project-scoped endpoint/client/scope authoring, token status, clearing, and shared authorization dialog integration: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- MCP runtime-token omission/restoration, incoming-token sanitization, import reset, and client-secret policy: [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/security.ts`](../src/lib/security.ts)
- Exact verification record: [`docs/QA_MILESTONE_92.md`](QA_MILESTONE_92.md)

## Milestone 93 acceptance evidence

- Bearer challenge parsing, RFC 9728/RFC 8414/OIDC fallback construction, metadata validation, scope selection, guarded fetches, and dynamic registration: [`src/lib/mcpOAuthDiscovery.ts`](../src/lib/mcpOAuthDiscovery.ts)
- Unauthenticated probe, immediate local registration/token persistence, authorization retry, RFC 8707 resource binding, and insufficient-scope step-up: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Local-only registered-client credential normalization, scrub/restore, import reset, and focused end-to-end negotiation fixtures: [`src/types.ts`](../src/types.ts), [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_93.md`](QA_MILESTONE_93.md)

## Milestone 94 acceptance evidence

- Bounded RFC 6570 expression parsing, variable extraction, scalar/list/object expansion, encoding, modifiers, and focused examples: [`src/lib/mcpUriTemplate.ts`](../src/lib/mcpUriTemplate.ts) and [`src/lib/mcpUriTemplate.test.ts`](../src/lib/mcpUriTemplate.test.ts)
- Resource/template distinction, derived metadata, exact `resources/read` expansion, and OAuth/session-safe invocation: [`src/types.ts`](../src/types.ts), [`src/lib/mcp.ts`](../src/lib/mcp.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Per-variable string controls, expanded-URI preview, malformed-template refusal, and template-aware operation counts: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_94.md`](QA_MILESTONE_94.md)

## Milestone 95 acceptance evidence

- Bounded top-level scalar JSON-Schema normalization, required/default/title/description/enum/const handling, coercion, and focused fixtures: [`src/lib/mcpParameterSchema.ts`](../src/lib/mcpParameterSchema.ts) and [`src/lib/mcpParameterSchema.test.ts`](../src/lib/mcpParameterSchema.test.ts)
- Guided prompt arguments and tool scalar fields synchronized with editable JSON, complex-field fallback, and primitive-aware initial values: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Client/family/name-isolated 1,000-entry draft retention plus operation/client reset coverage: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx) and [`src/components/IntegrationWorkbench.test.ts`](../src/components/IntegrationWorkbench.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_95.md`](QA_MILESTONE_95.md)

## Milestone 98 acceptance evidence

- Workspace v23 Socket.IO request, argument, acknowledgement, and listener normalization plus sample authoring data: [`src/types.ts`](../src/types.ts), [`src/data/seed.ts`](../src/data/seed.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- First-class Insomnia v4/v5 Socket.IO request and separate-payload import/export compatibility: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and their focused tests
- Native Engine.IO v4/Socket.IO connect, namespace, heartbeat, emit, acknowledgement, listener, limit, and disconnect transport with loopback integration coverage: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Lazy request editor, event console, transport bridge, live listener controls, and runner sampling: [`src/components/SocketIoEditor.tsx`](../src/components/SocketIoEditor.tsx), [`src/components/StreamConsole.tsx`](../src/components/StreamConsole.tsx), [`src/lib/socketIo.ts`](../src/lib/socketIo.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`src/App.tsx`](../src/App.tsx)
- Exact verification record: [`docs/QA_MILESTONE_98.md`](QA_MILESTONE_98.md)

## Milestone 99 acceptance evidence

- Polling-first Engine.IO target construction, bounded open-packet parsing, cache-busted GET/POST requests, server `maxPayload`, namespace handshake, and proxy/TLS/client-identity reuse: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Standards-based WebSocket probe/upgrade with header continuity and automatic polling fallback when the server omits or rejects upgrade support: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Independent long-poll receive task plus concurrent emit/ack/listener/heartbeat/disconnect command handling without HTTP/1 head-of-line deadlock: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Real polling-only and polling-to-WebSocket loopback fixtures covering namespace connect, emit, acknowledgement, incoming listener, transport evidence, and disconnect: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_99.md`](QA_MILESTONE_99.md)

## Milestone 100 acceptance evidence

- Socket.IO type 5 binary-event and type 6 binary-ack parsing with namespace, attachment-count, acknowledgement-ID, JSON payload, count, and size validation: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Recursive array/object placeholder hydration into Node-compatible `{ type: "Buffer", data: [...] }` values with missing-index rejection: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Shared stateful attachment delivery across raw WebSocket binary frames and Engine.IO polling `b<base64>` packets, preserving listener filters and pending acknowledgement correlation: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Unit plus real upgraded-WebSocket and polling-only fixtures covering nested multi-attachment events, binary acknowledgements, console evidence, and ordinary event continuity: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_100.md`](QA_MILESTONE_100.md)

## Milestone 101 acceptance evidence

- Workspace v24 stream-session model, bounded migration, orphan removal, and local catalog persistence: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Shared finite/zero/unlimited retention, active-environment visibility, chronological grouping, incremental event append, reconnect lifecycle, deletion, and clearing: [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts) and [`src/lib/streamHistory.test.ts`](../src/lib/streamHistory.test.ts)
- Live create/append/restore/select/delete/clear integration with abandoned-scope and late-event race guards: [`src/App.tsx`](../src/App.tsx) and [`src/components/StreamHistoryControls.tsx`](../src/components/StreamHistoryControls.tsx)
- Device-local project/sync boundaries and duplicate reset coverage: [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_101.md`](QA_MILESTONE_101.md)

## Milestone 102 acceptance evidence

- Independent editable-request snapshots on every newly retained realtime session: [`src/types.ts`](../src/types.ts) and [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts)
- Shared structural restoration preserving current request identity/tree placement and rejecting missing, mismatched, or malformed legacy snapshots: [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts) and the history suites
- Selection and delete-to-latest restoration after live disconnect/race guards: [`src/App.tsx`](../src/App.tsx)
- Workspace v25 migration/import/export propagation with request-ID-scoped snapshot acceptance: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_102.md`](QA_MILESTONE_102.md)

## Milestone 103 acceptance evidence

- Pinned-compatible event category derivation, message/error/close text search, and clear-through timestamp filtering: [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts) and [`src/lib/streamHistory.test.ts`](../src/lib/streamHistory.test.ts)
- Responsive lazy stream-console toolbar with WebSocket/Socket.IO type selection, shared search/count evidence, SSE-compatible disabled type control, and non-destructive clear view: [`src/components/StreamConsole.tsx`](../src/components/StreamConsole.tsx) and [`src/styles.css`](../src/styles.css)
- Session-ID reset propagation preventing filters/cutoffs from leaking across saved histories: [`src/App.tsx`](../src/App.tsx)
- Exact verification record: [`docs/QA_MILESTONE_103.md`](QA_MILESTONE_103.md)

## Milestone 104 acceptance evidence

- Shared native handshake result for status/message, flattened response headers, HTTP version, elapsed duration, and effective transport: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Typed Tauri/browser bridge plus bounded metadata/timeline merge helpers: [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/socketIo.ts`](../src/lib/socketIo.ts), and [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts)
- Live-retention-zero and saved-history selected-session metadata view with stream-aware Headers, Timeline, summary, and selector evidence: [`src/App.tsx`](../src/App.tsx) and [`src/components/StreamHistoryControls.tsx`](../src/components/StreamHistoryControls.tsx)
- Workspace v26 normalization and focused metadata/lifecycle/native-transport coverage: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and the stream suites
- Exact verification record: [`docs/QA_MILESTONE_104.md`](QA_MILESTONE_104.md)

## Milestone 105 acceptance evidence

- Real two-response SSE loopback covering initial event ID, server retry override, resumed request headers, second event delivery, metadata, explicit cancellation, and terminal close: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Test HTTP request capture now retains normalized headers so protocol fixtures can assert transport-visible resume/auth/content behavior rather than event output alone: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_105.md`](QA_MILESTONE_105.md)

## Milestone 106 acceptance evidence

- Collision-checked CRLF multipart serialization with resolved metadata, duplicate text fields, optional content types, exact binary parts, header-line neutralization, and explicit invalid-file warnings: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- One shared inline byte payload emitted through cURL, JavaScript Fetch, Python Requests, Go, Java, and C#, plus standalone binary MIME/byte preservation: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Focused byte-level framing, cross-target identity, boundary-collision, binary, and invalid-data coverage: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_106.md`](QA_MILESTONE_106.md)

## Milestone 107 acceptance evidence

- Lazy URL-encoded/multipart controls for enablement, multiline editing, descriptions, ordering, files, and metadata plus focused transition/reorder tests: [`src/components/MultipartEditor.tsx`](../src/components/MultipartEditor.tsx) and [`src/components/MultipartEditor.test.ts`](../src/components/MultipartEditor.test.ts)
- Shared body-rendering policy, binary MIME defaults, browser/native/CLI/codegen propagation, and legacy request-history restoration: [`src/lib/http.ts`](../src/lib/http.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/codegen.ts`](../src/lib/codegen.ts), and [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts)
- Insomnia v4/v5 body policy/multiline/description/disabled/order round trips and workspace v27 migration: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Real native multipart wire capture plus exact binary MIME/body construction: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_107.md`](QA_MILESTONE_107.md)

## Milestone 108 acceptance evidence

- Operation-aware GraphQL document selection that honors `operationName` while ignoring comments, strings, fragments, and variable-default object literals: [`src/lib/graphql.ts`](../src/lib/graphql.ts) and [`src/lib/graphql.test.ts`](../src/lib/graphql.test.ts)
- Shared GraphQL-subscription routing, HTTP(S)-to-WS(S) conversion, required subprotocol input, exact serialized payload reuse, bounded runner sampling, and static OAuth/API-key continuity: [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Native `graphql-transport-ws` lifecycle with `connection_init`, ack-triggered UUID subscribe, typed incoming/outgoing events, terminal error/complete close, and a real loopback handshake/protocol test: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- GraphQL stream console/history integration plus workspace v28 session normalization and request-version restoration: [`src/App.tsx`](../src/App.tsx), [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_108.md`](QA_MILESTONE_108.md)

## Milestone 109 acceptance evidence

- Request-local Rustls connector construction for native roots, explicit invalid-certificate authority, complete PEM identity parsing, and shared HTTP/WebSocket domain scoping: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Direct Rustls/native-root/PKI/Tokio-Rustls declarations constrained to the versions already present in the lock graph: [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) and [`src-tauri/Cargo.lock`](../src-tauri/Cargo.lock)
- Repository-owned CA/server/client fixtures plus a real strict-validation/domain-mismatch/matching-mTLS WSS loopback: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Existing frontend effective validation and client-identity input reused unchanged by WebSocket and GraphQL subscription execution: [`src/lib/protocol.ts`](../src/lib/protocol.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Exact verification record: [`docs/QA_MILESTONE_109.md`](QA_MILESTONE_109.md)

## Milestone 110 acceptance evidence

- Shared boxed native WebSocket transport for direct TCP, HTTP/HTTPS proxy connections, nested target TLS, request-local validation, scoped client identity, and bracket-safe IPv6 domain matching: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Bounded HTTP CONNECT negotiation, default-protocol normalization, percent-decoded Basic credentials with control-character rejection, explicit proxy errors, and exact/suffix/port/IPv4/IPv6-CIDR no-proxy matching: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- WebSocket, converted GraphQL subscription, and Engine.IO WebSocket-upgrade reuse of the same effective frontend transport policy: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Real authenticated proxy, direct bypass, nested WSS mTLS, HTTPS proxy, and polling-to-proxied-WebSocket Socket.IO loopbacks: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_110.md`](QA_MILESTONE_110.md)

## Milestone 111 acceptance evidence

- Pinned `http-proxy-agent`-compatible absolute-form plain-WS request rewriting while leaving Tungstenite's generated headers and handshake verification intact: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Partial-write-safe async adapter, `http://` target authority/path/query construction, configured Basic authorization override, and default `Proxy-Connection` injection: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Protocol split retaining bounded authenticated CONNECT for WSS, including GraphQL subscriptions and HTTPS Socket.IO targets, while HTTP Socket.IO upgrades use forward-proxy form: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Updated plain HTTP proxy, TLS proxy, WSS mTLS tunnel, bypass, and Socket.IO upgrade loopbacks asserting the proxy-visible request form: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_111.md`](QA_MILESTONE_111.md)

## Milestone 112 acceptance evidence

- Effective secure-endpoint validation through Tonic's custom Rustls verifier API with request-local Never authority and no global TLS mutation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Domain-scoped PEM identity reuse from native HTTP, paired-material validation, native-root retention, TLS-handshake timeout continuity, and plain-endpoint isolation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Repository-owned CA/server/client fixtures plus a real strict-validation, mismatched-identity, and matching-mTLS gRPC TLS handshake sequence: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_112.md`](QA_MILESTONE_112.md)

## Milestone 113 acceptance evidence

- Validated `grpc:`/`grpcs:` normalization to Tonic's HTTP/HTTPS transport schemes with path/query preservation and explicit unsupported-scheme rejection: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_113.md`](QA_MILESTONE_113.md)

## Milestone 114 acceptance evidence

- Bounded file/folder ingestion, common-root removal, path normalization, service-bearing entry selection, active-file persistence, and synchronized legacy source: [`src/lib/grpcProto.ts`](../src/lib/grpcProto.ts), [`src/lib/grpcProtoImport.ts`](../src/lib/grpcProtoImport.ts), and [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx)
- Workspace v29 legacy-source migration, malformed-tree repair, and native invocation serialization: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and their focused tests
- Isolated native tree reconstruction, repeated path validation, explicit entry compilation, imported descriptor inclusion, and a real cross-file proto compiler test: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_114.md`](QA_MILESTONE_114.md)

## Milestone 115 acceptance evidence

- Bounded workspace CA/client-certificate model, port-first/host-fallback wildcard selection, request-local override precedence, and focused tests: [`src/lib/certificates.ts`](../src/lib/certificates.ts) and [`src/lib/certificates.test.ts`](../src/lib/certificates.test.ts)
- Account-free certificate import/paste, enable/disable, list, and delete UI: [`src/components/CertificateManager.tsx`](../src/components/CertificateManager.tsx) and [`src/components/SecurityWorkbench.tsx`](../src/components/SecurityWorkbench.tsx)
- Shared HTTP/realtime/gRPC serialization plus native Reqwest/Rustls/Tonic trust extension and size enforcement: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Workspace v30 local-only migration, project/sync preservation, and real HTTPS/WSS/gRPC private-CA loopbacks: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and native transport tests
- Exact verification record: [`docs/QA_MILESTONE_115.md`](QA_MILESTONE_115.md)

## Milestone 116 acceptance evidence

- Mutually exclusive bounded workspace/request PEM or PFX model, base64 sizing, host/port selection, normalization, and request-local precedence: [`src/types.ts`](../src/types.ts), [`src/lib/certificates.ts`](../src/lib/certificates.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Account-free workspace and request-local PFX import with masked passphrases and conflict-clearing editor behavior: [`src/components/CertificateManager.tsx`](../src/components/CertificateManager.tsx) and [`src/components/TransportEditor.tsx`](../src/components/TransportEditor.tsx)
- Pure-Rust modern/legacy PKCS#12 decoding into one shared Reqwest/Rustls/Tonic identity path with bounded IPC validation: [`src-tauri/src/client_identity.rs`](../src-tauri/src/client_identity.rs), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Opt-in primary/secondary PFX script hydration, local-only workspace persistence, explicit-export behavior, and plaintext-publication checks: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Repository-owned modern OpenSSL fixture plus generated modern/legacy bundles and real HTTPS, WSS, and gRPC mTLS loopbacks: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and native transport tests
- Exact verification record: [`docs/QA_MILESTONE_116.md`](QA_MILESTONE_116.md)

## Milestone 117 acceptance evidence

- Pinned `grpcCalls` lifecycle audit covering `start`, `sendMessage`, `commit`, `cancel`, status/data/error/end events, and the absence of a separate gRPC proxy agent: [`docs/QA_MILESTONE_117.md`](QA_MILESTONE_117.md)
- Duplicate-safe bounded native session state, dynamic per-message validation, half-close/cancel behavior, and TLS/CA/PEM/PFX/metadata continuity: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Account-free interactive call controls, ordered 500-event console, environment resolution, and browser-development fallback: [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and [`src/styles.css`](../src/styles.css)
- Real HTTP/2 client-streaming, bidirectional send/commit, and cancellation loopbacks plus focused renderer command/channel tests: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_117.md`](QA_MILESTONE_117.md)

## Milestone 118 acceptance evidence

- Pinned transient `GrpcRequestState` and response-pane audit for numeric status code, details, metadata, error fallback, and non-persisted response messages: [`docs/QA_MILESTONE_118.md`](QA_MILESTONE_118.md)
- Optional structured status fields on the shared IPC event contract plus bounded ASCII/binary initial, trailing, and error metadata capture: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Status badge, details, expandable metadata, ordered event continuity, and deterministic browser status simulation: [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), [`src/lib/grpc.ts`](../src/lib/grpc.ts), [`src/types.ts`](../src/types.ts), and [`src/styles.css`](../src/styles.css)
- Real HTTP/2 success metadata and `INVALID_ARGUMENT` code/details/error-metadata assertions plus renderer channel-field preservation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_118.md`](QA_MILESTONE_118.md)

## Milestone 119 acceptance evidence

- Pinned `mockRequestMethods` scalar/nested/enum/repeated/ID audit and request-pane one-click replacement behavior: [`docs/QA_MILESTONE_119.md`](QA_MILESTONE_119.md)
- Bounded descriptor traversal for valid protobuf JSON across scalars, bytes, enums, nested/recursive messages, repeated fields, maps, JSON names, and one selected oneof branch: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Schema IPC example propagation, browser-preview compatibility, and account-free **Use stub** action: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), [`src/types.ts`](../src/types.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx)
- Exact nested/repeated/map/enum/bytes/oneof/UUID/recursion native fixture: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_119.md`](QA_MILESTONE_119.md)

## Milestone 120 acceptance evidence

- Corrected pinned-upstream semantics: `reflectionApi.enabled` selects the Buf Schema Registry API, while ordinary gRPC server reflection remains a separate descriptor source: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts) and [`docs/QA_MILESTONE_120.md`](QA_MILESTONE_120.md)
- Bounded binary Connect unary descriptor retrieval with optional Bearer authentication, controllable User-Agent, upstream-compatible 401/404 guidance, and registry-scoped timeout/TLS/CA/PEM/PFX transport: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Account-free Buf registry mode with templated URL/module/API key, masked credential input, disable-user-agent control, and stale-schema invalidation: [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and [`src/styles.css`](../src/styles.css)
- Workspace v32 bounded persistence, plaintext-publication protection, and Insomnia v4/v5 import/export continuity: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src/lib/interchange/`](../src/lib/interchange/)
- Real loopback Connect/protobuf wire fixture plus renderer, migration, interchange, and security regressions: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs), [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_120.md`](QA_MILESTONE_120.md)

## Milestone 121 acceptance evidence

- Pinned `ui/utils/grpc.ts` audit of the seven recognized gRPC connection/reflection failure classes and their exact user guidance: [`docs/QA_MILESTONE_121.md`](QA_MILESTONE_121.md)
- Shared context-aware classifier for Node-style upstream strings and Tonic/Rustls-native equivalents without hiding unknown or underlying errors: [`src/lib/grpc.ts`](../src/lib/grpc.ts)
- Schema-load response titles/details plus live-call multiline guidance across start, send, commit, cancel, and asynchronous native error events: [`src/App.tsx`](../src/App.tsx), [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), and [`src/styles.css`](../src/styles.css)
- Table-driven coverage for invalid roots, unknown issuers, required client certificates, wrong TLS version, unsupported reflection, cancellation, unimplemented methods, and unrecognized error preservation: [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_121.md`](QA_MILESTONE_121.md)

## Milestone 122 acceptance evidence

- Exact pinned dependency audit proving Insomnia's `grpc-reflection-js` lock commit uses `/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo`: [`docs/QA_MILESTONE_122.md`](QA_MILESTONE_122.md)
- Modern-v1-first reflection negotiation with fallback only for transport or protocol `UNIMPLEMENTED`, retaining metadata, one shared channel, and all existing TLS/identity policy: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Shared descriptor decoding, service filtering, duplicate suppression, error-response handling, and 10 MiB descriptor-set boundary across both reflection versions: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Real Tonic `v1` and `v1alpha`-only reflection servers advertising and returning the same multi-method descriptor set: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_122.md`](QA_MILESTONE_122.md)

## Milestone 123 acceptance evidence

- Pinned `ProtoFile`/`ProtoDirectory`, v4 export-type registry, recursive temp-tree writer, and v5 `protoFileId` schema audit: [`docs/QA_MILESTONE_123.md`](QA_MILESTONE_123.md)
- Workspace-confined v4 proto ancestor/descendant reconstruction with sanitized relative paths, referenced-entry selection, bounded tree normalization, and explicit missing/invalid-resource warnings: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts)
- Deterministic v4 root/subdirectory/file resource generation for every proto-backed request with a valid entry `protoFileId`: [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Explicit v5 reference-only import/export behavior that preserves the source ID as unsupported metadata and never substitutes Brunomnia's seed schema: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts) and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Nested two-file cross-import round trip plus v5 warning regressions: [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts) and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_123.md`](QA_MILESTONE_123.md)

## Milestone 124 acceptance evidence

- Pinned render/header-editor/WebSocket/Socket.IO/model audit for default insertion, top-level opt-out, all-disabled authored suppression, final-row removal behavior, and realtime plugin-hook exclusion: [`docs/QA_MILESTONE_124.md`](QA_MILESTONE_124.md)
- Shared immutable request-header policy plus native HTTP, CLI HTTP/GraphQL, WebSocket, GraphQL subscription, SSE, Socket.IO, and Buf reflection integration with browser-Fetch exclusion: [`src/lib/userAgent.ts`](../src/lib/userAgent.ts), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/socketIo.ts`](../src/lib/socketIo.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Account-free regular-editor read-only default control, authored-only bulk text, and safe final-authored-row removal in either mode: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Workspace v33 top-level migration plus Insomnia v4/v5 preservation for every compatible request family: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Focused default/custom/disabled/removed, native/browser/realtime, migration, gRPC, and interchange regressions: [`src/lib/userAgent.test.ts`](../src/lib/userAgent.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/http.browser.test.ts`](../src/lib/http.browser.test.ts), [`src/lib/protocol.native.test.ts`](../src/lib/protocol.native.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and the interchange suites
- Exact verification record: [`docs/QA_MILESTONE_124.md`](QA_MILESTONE_124.md)

## Milestone 125 acceptance evidence

- Pinned read-only HTTP-pair, bulk early-return, and `parseHeaderStrings` default-Accept audit: [`docs/QA_MILESTONE_125.md`](QA_MILESTONE_125.md)
- Immutable enabled-row-aware Accept default plus protocol-specific regular-editor calculated-row descriptors: [`src/lib/calculatedHeaders.ts`](../src/lib/calculatedHeaders.ts)
- Native Tauri and CLI HTTP/GraphQL default insertion with browser Fetch left platform-controlled: [`src/lib/http.ts`](../src/lib/http.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), and [`src/lib/http.browser.test.ts`](../src/lib/http.browser.test.ts)
- Non-persisted regular-editor Accept/Host/User-Agent rows and authored-only bulk continuity: [`src/App.tsx`](../src/App.tsx)
- Focused absent/enabled/disabled/custom/protocol/non-mutation regressions: [`src/lib/calculatedHeaders.test.ts`](../src/lib/calculatedHeaders.test.ts) and [`src/lib/http.test.ts`](../src/lib/http.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_125.md`](QA_MILESTONE_125.md)

## Milestone 126 acceptance evidence

- Pinned Insomnia modal/IPC/dependency audit plus HTTPSnippet 3.0.10 twenty-family/default-client inventory: [`docs/QA_MILESTONE_126.md`](QA_MILESTONE_126.md)
- Node.js native HTTP, PHP cURL, Ruby `Net::HTTP`, Swift `URLSession`, and Rust Reqwest emitters integrated into the stable local target list: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Shared effective-request materialization, warnings, exact UTF-8 and binary Base64 payloads, and target-safe string escaping across all eleven selected clients: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Stable target identity, all-target request generation, exact UTF-8 bytes, escaped metadata, multipart identity, binary identity, and invalid-data regressions: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Updated account-free authoring guide and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`docs/QA_MILESTONE_126.md`](QA_MILESTONE_126.md)

## Milestone 127 acceptance evidence

- Pinned remaining-target/default-client audit, registry-order proof, and HTTP metadata-key mismatch record: [`docs/QA_MILESTONE_127.md`](QA_MILESTONE_127.md)
- C libcurl, Clojure clj-http, Crystal native, raw HTTP/1.1, Kotlin OkHttp, Objective-C NSURLSession, OCaml CoHTTP, PowerShell Invoke-WebRequest, and R httr emitters: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Exact C/OCaml byte literals, Base64-backed executable payloads, raw HTTP origin-form/Host/UTF-8 Content-Length behavior, and explicit binary-preview warning: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Pinned twenty-family ordering plus all-family custom-method/URL/header/multipart/binary/UTF-8/escaping regressions: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Updated account-free authoring guide and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`docs/QA_MILESTONE_127.md`](QA_MILESTONE_127.md)

## Milestone 128 acceptance evidence

- Exact pinned 20-family/39-client/default/order inventory and Insomnia target/client persistence audit: [`docs/QA_MILESTONE_128.md`](QA_MILESTONE_128.md)
- Typed family/client registry, declared-default resolver, nineteen alternate emitters, and explicit unsupported-method warnings: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Separate locally persisted target/client selectors with family-default switching and invalid-saved-selection recovery: [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- Full registry/default ordering, selection fallback, all-client custom-method/URL/multipart/binary, and alternate-client UTF-8 payload regressions: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Updated account-free authoring guide and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`docs/QA_MILESTONE_128.md`](QA_MILESTONE_128.md)

## Milestone 129 acceptance evidence

- Pinned render/hooks/HAR/auth-header audit proving OAuth 1, Hawk, ASAP, authored-Authorization precedence, and ten-minute ASAP configuration: [`docs/QA_MILESTONE_129.md`](QA_MILESTONE_129.md)
- Async advanced-auth materialization layered over the shared prepared request plus OAuth 2 `NO_PREFIX` correction: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Cancellable async preview refresh with explicit signing-failure warnings and no request side effect: [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- Shared ASAP expiry correction for runtime and generated requests: [`src/lib/auth.ts`](../src/lib/auth.ts)
- Deterministic OAuth 1/Hawk, generated-key ASAP claims/signature shape, authored precedence, and OAuth 2 prefix regressions: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Updated account-free authoring guide and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`docs/QA_MILESTONE_129.md`](QA_MILESTONE_129.md)

## Milestone 130 acceptance evidence

- Pinned render/hook/HAR/cookie and Node-native Content-Length audit: [`docs/QA_MILESTONE_130.md`](QA_MILESTONE_130.md)
- Shared complete request rendering used by live HTTP and generated-code preparation: [`src/lib/requestRender.ts`](../src/lib/requestRender.ts) and [`src/lib/http.ts`](../src/lib/http.ts)
- Async template-before-hook preparation, matching cookie-jar materialization, authored Cookie precedence, and client-specific Content-Length injection: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Granted plugin runtime integration with persisted local store, host APIs, visible notifications, stale-completion protection, and explicit generated-request safety copy: [`src/App.tsx`](../src/App.tsx) and [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- Focused rendering order, hook mutation, cookie matching/precedence, Node-only exact UTF-8 length, authored length, and full code-generation regressions: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Updated account-free authoring guide and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`docs/QA_MILESTONE_130.md`](QA_MILESTONE_130.md)

## Milestone 131 acceptance evidence

- Pinned dependency, 118-function mapping, JSONPath, File mediation, and local-tag definition audit: [`docs/QA_MILESTONE_131.md`](QA_MILESTONE_131.md)
- Exact lazy Faker 9.7 registry and full JSONPath Plus 10.4 safe evaluation in the shared renderer: [`src/lib/faker.ts`](../src/lib/faker.ts), [`src/lib/templates.ts`](../src/lib/templates.ts), and [`src/lib/responseFilter.ts`](../src/lib/responseFilter.ts)
- Canonical-root-confined desktop File tags propagated across live sends, OAuth/schema traffic, collection runs, plugins/integrations, and generated code: [`src/lib/scriptFiles.ts`](../src/lib/scriptFiles.ts), [`src/lib/requestRender.ts`](../src/lib/requestRender.ts), [`src/lib/http.ts`](../src/lib/http.ts), and the app/workbench request contexts
- Account-free fourteen-family builder with escaped syntax and append/replace destinations for HTTP, realtime, Buf, and gRPC renderer fields: [`src/components/TemplateTagDialog.tsx`](../src/components/TemplateTagDialog.tsx), [`src/lib/templateTagBuilder.ts`](../src/lib/templateTagBuilder.ts), and [`src/App.tsx`](../src/App.tsx)
- All-function Faker, advanced JSONPath, File/cookie/Base64/time/concurrency, immutable destination insertion, and shared request regressions: [`src/lib/templates.test.ts`](../src/lib/templates.test.ts), [`src/lib/responseFilter.test.ts`](../src/lib/responseFilter.test.ts), and [`src/lib/templateTagBuilder.test.ts`](../src/lib/templateTagBuilder.test.ts)
- Updated account-free authoring/security guides and exact verification record: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), and [`docs/QA_MILESTONE_131.md`](QA_MILESTONE_131.md)

## Milestone 132 acceptance evidence

- Pinned parser, channel-construction, official documentation, and live-fixture audit: [`docs/QA_MILESTONE_132.md`](QA_MILESTONE_132.md)
- Scheme-less plaintext normalization, Unix-domain connector, and unconditional secure-channel native-root configuration: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Deterministic scheme/Unix/reflection/TLS regressions plus an opt-in plaintext/TLS all-four-shape `grpcb.in` matrix: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Updated endpoint and compatibility documentation: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md) and [`README.md`](../README.md)

## Milestone 133 acceptance evidence

- Corrective pinned-source audit for timestamp, OS, hash, prompt, request, response, gRPC, and realtime rendering behavior: [`docs/QA_MILESTONE_133.md`](QA_MILESTONE_133.md)
- Exact date-fns/MD5/large-integer/XPath dependencies plus a bounded native OS-information command: [`package.json`](../package.json), [`src-tauri/src/template_os.rs`](../src-tauri/src/template_os.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Source-shaped custom timestamps, seven-function OS values, MD5/SHA output, six-argument prompt caching/masking, broad request extraction, and raw/JSONPath/XPath/large-integer/resend response behavior: [`src/lib/templates.ts`](../src/lib/templates.ts) and [`src/components/TemplatePromptDialog.tsx`](../src/components/TemplatePromptDialog.tsx)
- Shared async rendering across direct/interactive gRPC plus WebSocket, GraphQL subscription, SSE, Socket.IO connection and outbound payload paths: [`src/lib/grpc.ts`](../src/lib/grpc.ts), [`src/lib/requestRender.ts`](../src/lib/requestRender.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`src/lib/socketIo.ts`](../src/lib/socketIo.ts)
- Fourteen-family guided syntax and HTTP/realtime/Buf/gRPC destinations: [`src/components/TemplateTagDialog.tsx`](../src/components/TemplateTagDialog.tsx) and [`src/lib/templateTagBuilder.ts`](../src/lib/templateTagBuilder.ts)
- Focused renderer, HTTP, gRPC, realtime, builder, and native OS regressions: [`src/lib/templates.test.ts`](../src/lib/templates.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts), [`src/lib/protocol.native.test.ts`](../src/lib/protocol.native.test.ts), and [`src-tauri/src/template_os.rs`](../src-tauri/src/template_os.rs)

## Milestone 134 acceptance evidence

- Pinned Inso in-memory render-before-send and File mediation audit plus exact verification record: [`docs/QA_MILESTONE_134.md`](QA_MILESTONE_134.md)
- Shared async HTTP/GraphQL CLI rendering, dependent sends, response history, cookie continuity, and rendered-URL certificate policy: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`src/lib/requestRender.ts`](../src/lib/requestRender.ts)
- Allowlisted official AWS/GCP/Azure/HashiCorp CLI adapters with direct argument arrays, bounded output, strict parsing, and aggregate memory cache limits: [`cli/externalVault.ts`](../cli/externalVault.ts) and [`src/lib/cliExternalVault.test.ts`](../src/lib/cliExternalVault.test.ts)
- Reproducible localhost-only denial/grant, OS/hash/custom-time, zero-history response-chain, and cookie smoke: [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs) and [`examples/cli-template-workspace.json`](../examples/cli-template-workspace.json)

## Milestone 150 acceptance evidence

- Pinned response-model, request-version restore ignore-list, response pane, and legacy-history audits: [`docs/QA_MILESTONE_150.md`](QA_MILESTONE_150.md)
- Bounded collected test results, cookie policy, global/collection environment identity, and every persistent response-writer path: [`src/types.ts`](../src/types.ts), [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Current-name/documentation/source/tree preservation plus explicit response-only legacy behavior: [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts) and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Bounded local migration and direct/runner/script regression evidence: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)

## Milestone 151 acceptance evidence

- Pinned debug modal, text viewer, current/legacy libcurl callbacks, and timeline loader audit: [`docs/QA_MILESTONE_151.md`](QA_MILESTONE_151.md)
- Corrected Collections boundary and preserved REST/HTTP HeaderIn/HeaderOut/Text evidence gap: this ledger's capability rows above
- Account-free deterministic response transcript and HAR extensions remain implemented and explicitly non-wire-reconstructive: [`src/lib/responseDownload.ts`](../src/lib/responseDownload.ts) and [`src/lib/responseDownload.test.ts`](../src/lib/responseDownload.test.ts)

## Milestone 152 acceptance evidence

- Pinned v4/v5 sort-key model, map, schema, import, and export audit: [`docs/QA_MILESTONE_152.md`](QA_MILESTONE_152.md)
- Mixed nested sibling serialization and parsing through v4 `metaSortKey`, v5 `meta.sortKey`, and Brunomnia `resourceOrder`: [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts) and [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts)
- Exact root/nested v4/v5 round trips plus shared nested-folder classification regression: [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), [`src/lib/resources.ts`](../src/lib/resources.ts), and [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)

## Milestone 153 acceptance evidence

- Pinned tab-list/context close-other source audit: [`docs/QA_MILESTONE_153.md`](QA_MILESTONE_153.md)
- Bounded pure close-other mutation, active selection, history reset, closed-tab continuity, and focused tests: [`src/lib/requestTabs.ts`](../src/lib/requestTabs.ts) and [`src/lib/requestTabs.test.ts`](../src/lib/requestTabs.test.ts)
- Per-tab right-click menu, outside-click/Escape dismissal, and request-workbench integration: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)

## Milestone 154 acceptance evidence

- Pinned final-tab, batch-close, closed-history, and project-route source audit: [`docs/QA_MILESTONE_154.md`](QA_MILESTONE_154.md)
- Persisted intentional-dashboard state, final/all-tab mutations, ordinary-startup fallback distinction, reopen continuity, and focused tests: [`src/lib/requestTabs.ts`](../src/lib/requestTabs.ts) and [`src/lib/requestTabs.test.ts`](../src/lib/requestTabs.test.ts)
- Project resource dashboard, exact Close All/Close Other Tabs menu, sidebar/card/new/reopen paths, and responsive source styling: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)

## Milestone 155 acceptance evidence

- Pinned BaseTab inference, route synchronization, request-group route/pane, and middle-click source audit: [`docs/QA_MILESTONE_155.md`](QA_MILESTONE_155.md)
- Legacy-safe request/folder tab typing, shared temporary replacement, ordering, close/reopen/dashboard continuity, and focused tests: [`src/lib/requestTabs.ts`](../src/lib/requestTabs.ts) and [`src/lib/requestTabs.test.ts`](../src/lib/requestTabs.test.ts)
- Shared request/folder strip, folder sidebar navigation, selected state, full inherited-configuration pane, and settings continuity: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)

## Milestone 156 acceptance evidence

- Pinned synthetic ID, workspace/folder launch, route synchronization, run-time promotion, and context-state audit: [`docs/QA_MILESTONE_156.md`](QA_MILESTONE_156.md)
- Typed Runner persistence, shared temporary/close/reopen/dashboard lifecycle, and focused tab regressions: [`src/lib/requestTabs.ts`](../src/lib/requestTabs.ts) and [`src/lib/requestTabs.test.ts`](../src/lib/requestTabs.test.ts)
- Safe direct+nested folder target resolution and focused runner tests: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Activity/palette/folder launches, embedded shared-strip workbench, and target-aware runner controls: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/styles.css`](../src/styles.css)

## Milestone 162 acceptance evidence

- Pinned standalone suite/test model, route, ordering, execution, result, and deprecation audit: [`docs/QA_MILESTONE_162.md`](QA_MILESTONE_162.md)
- Workspace v35 suite/test/result normalization, deterministic resource helpers, request-reference repair, and focused regressions: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/unitTests.ts`](../src/lib/unitTests.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/unitTests.test.ts`](../src/lib/unitTests.test.ts)
- Bounded default/ID-targeted `insomnia.send()` bridge with pinned-shaped response output: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Shared `testSuite` tab lifecycle, dashboard/activity/command paths, source-styled CRUD/editor/result workbench, complete HTTP/GraphQL execution context, and responsive source styling: [`src/lib/requestTabs.ts`](../src/lib/requestTabs.ts), [`src/App.tsx`](../src/App.tsx), [`src/components/UnitTestWorkbench.tsx`](../src/components/UnitTestWorkbench.tsx), and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_162.md`](QA_MILESTONE_162.md)

## Milestone 163 acceptance evidence

- Pinned raw/table environment editor, toggle-loss warning, key validation, and typed-row conversion audit: [`docs/QA_MILESTONE_163.md`](QA_MILESTONE_163.md)
- Workspace v36 typed values and persisted editor modes across global, collection base/sub-, and folder scopes: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Shared bounded conversion, validation, nested dot-path resolution, and regression coverage: [`src/lib/environmentJson.ts`](../src/lib/environmentJson.ts), [`src/lib/environmentJson.test.ts`](../src/lib/environmentJson.test.ts), [`src/lib/request.ts`](../src/lib/request.ts), and [`src/lib/resources.ts`](../src/lib/resources.ts)
- Reusable Table/Raw UI, typed JSON-value modal, loss confirmation, invalid-switch blocking, and all-scope integration: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Typed Insomnia v4/v5 import/export and v4 editor-mode/KV-pair continuity: [`src/lib/interchange/common.ts`](../src/lib/interchange/common.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_163.md`](QA_MILESTONE_163.md)

## Milestone 164 acceptance evidence

- Pinned suite model, v4/v5 schema, import/export, Inso selection, and execution audit: [`docs/QA_MILESTONE_164.md`](QA_MILESTONE_164.md)
- Workspace v37 ownership migration, owner-scoped editing/sends, deterministic selection, and focused regressions: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/unitTests.ts`](../src/lib/unitTests.ts), [`src/components/UnitTestWorkbench.tsx`](../src/components/UnitTestWorkbench.tsx), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/unitTests.test.ts`](../src/lib/unitTests.test.ts)
- Insomnia v4/v5 suite import/export plus collision-safe collection/request/test rekeying: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts), [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts), and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Standalone suite/API-spec CLI selection, pinned-shaped `insomnia.send()`, reporters/filtering/bail/trust continuity, and reproducible fixtures: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`examples/cli-workspace.json`](../examples/cli-workspace.json), [`examples/cli-template-workspace.json`](../examples/cli-template-workspace.json), and [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs)
- Exact verification record: [`docs/QA_MILESTONE_164.md`](QA_MILESTONE_164.md)

## Milestone 165 acceptance evidence

- Pinned runner-feedback, execution-store, live-pane, result-card, and route audit: [`docs/QA_MILESTONE_165.md`](QA_MILESTONE_165.md)
- Stable planned-item lifecycle, queued/active skip, cancel-all, retries/bail continuity, saved live outcomes, and focused regressions: [`src/types.ts`](../src/types.ts), [`src/lib/runner.ts`](../src/lib/runner.ts), and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Browser/native HTTP abort identity plus active stream disconnection and native loopback evidence: [`src/lib/http.ts`](../src/lib/http.ts), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and their focused tests
- Live progress counts, status/message/time/size/test/error rows, per-item Skip, cancel-all, attempt evidence, reporter skips, and source styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts), and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_165.md`](QA_MILESTONE_165.md)

## Milestone 166 acceptance evidence

- Pinned execution object, network propagation, send-action, runner-flow, and Postman translation audit: [`docs/QA_MILESTONE_166.md`](QA_MILESTONE_166.md)
- Browser/Node execution location, pre-send skip, next-request state, direct-send handling, and focused sandbox regressions: [`src/types.ts`](../src/types.ts), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/App.tsx`](../src/App.tsx), and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Forward ID jumps, last duplicate-name selection, missing-target skipping, self-repeat, retry continuity, bounded flow failure, saved live evidence, reporters, and focused regressions: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts)
- Postman execution-flow translation and import regression: [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts) and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_166.md`](QA_MILESTONE_166.md)

## Milestone 167 acceptance evidence

- Pinned keep-log default/control, timeline aggregation, Results/History/Console tabs, and response-timeline formatting audit: [`docs/QA_MILESTONE_167.md`](QA_MILESTONE_167.md)
- Default-on per-document log setting, bounded per-attempt/report capture, category preservation, sensitive-header redaction, retry/error aggregation, and focused regressions: [`src/types.ts`](../src/types.ts), [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/timeline.ts`](../src/lib/timeline.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Results/Console inspection, exact request separators and category prefixes, disabled/empty/truncated states, and responsive source styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_167.md`](QA_MILESTONE_167.md)

## Milestone 168 acceptance evidence

- Pinned result-history loading, reverse chronology, row metrics, result reopening, and exact deletion audit: [`docs/QA_MILESTONE_168.md`](QA_MILESTONE_168.md)
- Optional historical source/folder identity, collection/folder Runner scoping, exact immutable deletion, execution persistence, and focused regressions: [`src/types.ts`](../src/types.ts), [`src/lib/runner.ts`](../src/lib/runner.ts), and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Results/History/Console navigation, source/date/iteration/duration/result rows, selected historical result/console/export continuity, exact deletion, empty state, and responsive source styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_168.md`](QA_MILESTONE_168.md)

## Milestone 169 acceptance evidence

- Pinned default advanced configuration, upload/update/remove workflow, MIME/encoding handling, JSON/CSV parsing, preview table, and automatic iteration-count audit: [`docs/QA_MILESTONE_169.md`](QA_MILESTONE_169.md)
- Bounded file parser, compact structured values, quoted CSV, source-name draft persistence, pinned-default bail, and focused regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Account-free upload/change/remove modal, union-header preview, 100-row render bound, iteration adoption, raw-data continuity, dismissal controls, and responsive source styling: [`src/components/RunnerDataDialog.tsx`](../src/components/RunnerDataDialog.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_169.md`](QA_MILESTONE_169.md)

## Milestone 170 acceptance evidence

- Pinned 41-label encoding inventory, file re-read behavior, and encoding-change reparsing audit: [`docs/QA_MILESTONE_170.md`](QA_MILESTONE_170.md)
- Device-supported encoding inventory, UTF-16 BOM/UTF-8 validation/Windows fallback detection, fatal bounded decoding, source-encoding draft persistence, and focused regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Fresh-file byte retention, encoding selector, immediate reparse/validation, saved encoding display, exact apply/remove/raw-edit continuity, and responsive source styling: [`src/components/RunnerDataDialog.tsx`](../src/components/RunnerDataDialog.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_170.md`](QA_MILESTONE_170.md)

## Milestone 171 acceptance evidence

- Pinned CLI preview argument generation, selected-order/folder behavior, environment, iteration, delay, data-path, bail, and copy-surface audit: [`docs/QA_MILESTONE_171.md`](QA_MILESTONE_171.md)
- POSIX-shell-safe command construction, bounded/default control rendering, exact selected-order generation, and focused regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Account-free Runner preview, complete native local JSON path resolution, explicit browser/data path requirements, clipboard state, trust-boundary notice, and responsive styling: [`src/components/RunnerCliDialog.tsx`](../src/components/RunnerCliDialog.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs), and [`src/styles.css`](../src/styles.css)
- JSON/split-YAML project loading, repeated ID/name request selection, shared delay, short aliases, bundled localhost regression, and CLI documentation: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_171.md`](QA_MILESTONE_171.md)

## Milestone 172 acceptance evidence

- Pinned raw-header/debug callback, duplicate value, timeline-category, data-threshold, and Runner timeline-reuse audit: [`docs/QA_MILESTONE_172.md`](QA_MILESTONE_172.md)
- Duplicate-preserving final response values, followed redirect trace/effective URL, unchanged policy wrapping, 100-hop evidence bound, explicit truncation, and real loopback regression: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Transport-field stripping, configured duplicate outgoing rows, final status/headers, redirect/effective URL, response summary, protocol timeline merge, and focused frontend regressions: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/timeline.ts`](../src/lib/timeline.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Existing bounded Runner capture, duplicate-line retention, URL/header-secret redaction, active/history Console continuity, and focused regression: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Exact verification record: [`docs/QA_MILESTONE_172.md`](QA_MILESTONE_172.md)

## Milestone 173 acceptance evidence

- Pinned failed-request debug retention, filtering, Runner reuse, and reqwest evidence-boundary audit: [`docs/QA_MILESTONE_173.md`](QA_MILESTONE_173.md)
- Serialized native timeout/connect/redirect/decode/request/status/transport/canceled failures with elapsed and available redirect trace: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Shared failure timeline construction, structured frontend errors, and ordinary status-zero activity/response history: [`src/lib/timeline.ts`](../src/lib/timeline.ts), [`src/lib/http.ts`](../src/lib/http.ts), [`src/App.tsx`](../src/App.tsx), and [`src/lib/http.test.ts`](../src/lib/http.test.ts)
- Existing bounded Runner duration/timeline capture plus query/header-secret redaction for failed attempts: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Exact verification record: [`docs/QA_MILESTONE_173.md`](QA_MILESTONE_173.md)

## Milestone 174 acceptance evidence

- Pinned 41-label picker, `chardet`/`iconv-lite` decoder, and path re-read audit: [`docs/QA_MILESTONE_174.md`](QA_MILESTONE_174.md)
- Exact picker inventory, UTF-32/ASCII/Latin-1 decoding, deterministic BOM detection, bounded source-byte Base64, and focused regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Reopen-safe in-memory bytes, immediate encoding reparsing, and raw-edit/remove/document-close cleanup: [`src/components/RunnerDataDialog.tsx`](../src/components/RunnerDataDialog.tsx) and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Account-free user documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_174.md`](QA_MILESTONE_174.md)

## Milestone 175 acceptance evidence

- Pinned iconv-lite 0.6.3 KOI8-RU/KOI8-T tables, undefined slots, and ISO-8859-12 rejection audit: [`docs/QA_MILESTONE_175.md`](QA_MILESTONE_175.md)
- Portable KOI8 variant decoding, strict undefined-byte handling, chunked bounded output, and exact mapping regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Updated account-free iteration-data contract: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_175.md`](QA_MILESTONE_175.md)

## Milestone 176 acceptance evidence

- Pinned live-item, pre-send delay, interruption, request-resource filter, and shared-send dispatch audit: [`docs/QA_MILESTONE_176.md`](QA_MILESTONE_176.md)
- One cancelable delay per first/retry attempt, no trailing wait, skip-before-transport handling, and deterministic fake-timer regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Source-shaped desktop control wording and shared CLI timing documentation: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_176.md`](QA_MILESTONE_176.md)

## Milestone 177 acceptance evidence

- Pinned active result-category/name toolbar and commented history-column audit: [`docs/QA_MILESTONE_177.md`](QA_MILESTONE_177.md)
- Latest-retry/legacy-safe attempt outcome and case-insensitive request/assertion filtering with focused regressions: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Accessible toolbar, filtered/total state, no-match handling, historical continuity, and responsive styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Account-free behavior documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_177.md`](QA_MILESTONE_177.md)

## Milestone 178 acceptance evidence

- Pinned selected-request assertion status/name/error/category/timing audit and honest saved-model boundary: [`docs/QA_MILESTONE_178.md`](QA_MILESTONE_178.md)
- Pure assertion evidence component with PASS/FAIL, exact retained names/errors, explicit missing-error/empty states, and focused static-render regressions: [`src/components/RunnerAssertionEvidence.tsx`](../src/components/RunnerAssertionEvidence.tsx) and [`src/components/RunnerAssertionEvidence.test.tsx`](../src/components/RunnerAssertionEvidence.test.tsx)
- Active/latest/history selected-attempt integration and compact responsive styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Account-free behavior documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_178.md`](QA_MILESTONE_178.md)

## Milestone 179 acceptance evidence

- Pinned assertion model, callback timing, skip, phase-category, and result-row formatting audit: [`docs/QA_MILESTONE_179.md`](QA_MILESTONE_179.md)
- Shared current/legacy status semantics plus pinned category/duration formatting: [`src/lib/scriptTests.ts`](../src/lib/scriptTests.ts) and [`src/lib/scriptTests.test.ts`](../src/lib/scriptTests.test.ts)
- Promise-returning desktop/CLI test handlers, non-executing skip callbacks, callback-settlement timing, phase assignment, and focused execution regressions: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts), and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Bounded persistence, direct-response/Runner rendering, CLI loopback evidence, and account-free documentation: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/App.tsx`](../src/App.tsx), [`src/components/RunnerAssertionEvidence.tsx`](../src/components/RunnerAssertionEvidence.tsx), [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`docs/SCRIPTING.md`](SCRIPTING.md), and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_179.md`](QA_MILESTONE_179.md)

## Milestone 180 acceptance evidence

- Pinned Runner card, request-test row, and shared fuzzysort behavior audit: [`docs/QA_MILESTONE_180.md`](QA_MILESTONE_180.md)
- Exact status/name assertion filtering, legacy status continuity, garbage-score rejection, and focused regressions: [`src/lib/scriptTests.ts`](../src/lib/scriptTests.ts), [`src/lib/scriptTests.test.ts`](../src/lib/scriptTests.test.ts), and [`src/components/RunnerAssertionEvidence.test.tsx`](../src/components/RunnerAssertionEvidence.test.tsx)
- Complete attempt-table retention, selected assertion-row filtering, direct response controls, and source-shaped styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/RunnerAssertionEvidence.tsx`](../src/components/RunnerAssertionEvidence.tsx), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Exact locked runtime dependency and account-free documentation: [`package.json`](../package.json), [`package-lock.json`](../package-lock.json), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/SCRIPTING.md`](SCRIPTING.md), and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_180.md`](QA_MILESTONE_180.md)

## Milestone 181 acceptance evidence

- Pinned live-progress/result-pane/request-card grouping, key, default-expansion, and action audit: [`docs/QA_MILESTONE_181.md`](QA_MILESTONE_181.md)
- Reusable attempt card with live summary, accessible independent expansion, assertion filters, bounded request/response evidence, and focused static-render regressions: [`src/components/RunnerAttemptCard.tsx`](../src/components/RunnerAttemptCard.tsx) and [`src/components/RunnerAttemptCard.test.tsx`](../src/components/RunnerAttemptCard.test.tsx)
- Iteration-grouped active/latest/history rendering, live-to-finished remounting, skip continuity, and source-shaped responsive styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Account-free behavior documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_181.md`](QA_MILESTONE_181.md)

## Milestone 182 acceptance evidence

- Pinned runner-feedback implementation and regression audit: [`docs/QA_MILESTONE_182.md`](QA_MILESTONE_182.md)
- Shared fixed/status-code label, standard reason, tone, rounded time, long byte-unit, threshold, and invalid-value formatting with upstream-shaped regressions: [`src/lib/runnerFeedback.ts`](../src/lib/runnerFeedback.ts) and [`src/lib/runnerFeedback.test.ts`](../src/lib/runnerFeedback.test.ts)
- Iteration-card integration plus exact static-render continuity: [`src/components/RunnerAttemptCard.tsx`](../src/components/RunnerAttemptCard.tsx) and [`src/components/RunnerAttemptCard.test.tsx`](../src/components/RunnerAttemptCard.test.tsx)
- Corrected source/adaptation boundary and account-free behavior documentation: [`docs/QA_MILESTONE_181.md`](QA_MILESTONE_181.md) and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_182.md`](QA_MILESTONE_182.md)

## Milestone 183 acceptance evidence

- Pinned Runner History assertion-count, status-icon, duration, and live-cancel audit: [`docs/QA_MILESTONE_183.md`](QA_MILESTONE_183.md)
- Pure current/legacy assertion aggregation, elapsed-time fallback, strict unit thresholds, magnitude precision, and focused regressions: [`src/lib/runnerHistory.ts`](../src/lib/runnerHistory.ts) and [`src/lib/runnerHistory.test.ts`](../src/lib/runnerHistory.test.ts)
- History row integration, raw-duration tooltip, assertion-failure icon, and exact Cancel all label: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated account-free History and OAuth-cancellation documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md), and [`docs/MIGRATION.md`](MIGRATION.md)
- Exact verification record: [`docs/QA_MILESTONE_183.md`](QA_MILESTONE_183.md)

## Milestone 184 acceptance evidence

- Pinned live-progress pane, runner route transition, and empty-state audit: [`docs/QA_MILESTONE_184.md`](QA_MILESTONE_184.md)
- Shared finished-state and active/finished summary semantics with focused runner-core regressions: [`src/lib/runnerFeedback.ts`](../src/lib/runnerFeedback.ts), [`src/lib/runnerFeedback.test.ts`](../src/lib/runnerFeedback.test.ts), and [`src/lib/runner.ts`](../src/lib/runner.ts)
- Exact active/canceled live toolbar, Cancel all placement, assertion-toolbar suppression, canceled-card continuity, source empty states, and stale-prior-report guard: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Updated account-free live-progress documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_184.md`](QA_MILESTONE_184.md)

## Milestone 185 acceptance evidence

- Pinned route-level Results count badge, color, and total-duration audit: [`docs/QA_MILESTONE_185.md`](QA_MILESTONE_185.md)
- Shared current/legacy assertion summary with zero/all-passed/non-passed tones and focused regressions: [`src/lib/runnerHistory.ts`](../src/lib/runnerHistory.ts) and [`src/lib/runnerHistory.test.ts`](../src/lib/runnerHistory.test.ts)
- Active/latest/history badge integration, saved-run duration tag, raw-millisecond tooltip, and source-shaped styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Updated account-free Results documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_185.md`](QA_MILESTONE_185.md)

## Milestone 186 acceptance evidence

- Pinned Request Order GridList, selection toolbar, navigation, and active disabled-state audit: [`docs/QA_MILESTONE_186.md`](QA_MILESTONE_186.md)
- Pure none/partial/all plan selection semantics with focused regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Select All/Unselect All state, method/folder context, request navigation, drag/keyboard ordering, and complete active-run control locking: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Updated account-free Request Order documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_186.md`](QA_MILESTONE_186.md)

## Milestone 187 acceptance evidence

- Pinned clearable Iterations/Delay state, decimal parsing, blur restoration, upload synchronization, and empty-selection Run guard audit: [`docs/QA_MILESTONE_187.md`](QA_MILESTONE_187.md)
- Shared bounded numeric-draft parsing and focused blank/invalid/range/decimal regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Separate iterations/retries/delay/stream drafts, last-valid execution continuity, uploaded-row synchronization, and zero-selection Run lock: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated account-free Runner input documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_187.md`](QA_MILESTONE_187.md)

## Milestone 188 acceptance evidence

- Pinned Runner `request_send`, capture-phase key binding, active/empty disabled guard, and empty-state hotkey audit: [`docs/QA_MILESTONE_188.md`](QA_MILESTONE_188.md)
- Pure configured-shortcut matching, repeat suppression, runnable-state gating, and display-label regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Window-capture Runner execution binding and current-shortcut Run tooltip: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated account-free Runner shortcut documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_188.md`](QA_MILESTONE_188.md)

## Milestone 189 acceptance evidence

- Pinned forced/responsive Runner direction and split-pane orientation audit: [`docs/QA_MILESTONE_189.md`](QA_MILESTONE_189.md)
- Pure forced-layout direction mapping with focused regression: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Preference-driven Runner direction state and wide-screen vertical stack styling: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Updated account-free Runner layout documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_189.md`](QA_MILESTONE_189.md)

## Milestone 190 acceptance evidence

- Pinned Panel/PanelResizeHandle orientation, 35% minimum, 90% maximum, and responsive-boundary audit: [`docs/QA_MILESTONE_190.md`](QA_MILESTONE_190.md)
- Pure pointer geometry, bounds, axis-aware keyboard movement, and direction regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Focusable ARIA separator with pointer capture, arrow/Shift/Home/End controls, and static-render regression: [`src/components/RunnerPaneSplitter.tsx`](../src/components/RunnerPaneSplitter.tsx) and [`src/components/RunnerPaneSplitter.test.tsx`](../src/components/RunnerPaneSplitter.test.tsx)
- Horizontal/vertical grid integration, narrow-screen fallback, and account-free documentation: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/styles.css`](../src/styles.css), and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_190.md`](QA_MILESTONE_190.md)

## Milestone 191 acceptance evidence

- Pinned `RenderedText` live-card URL behavior and real slow-request smoke assertion audit: [`docs/QA_MILESTONE_191.md`](QA_MILESTONE_191.md)
- Pre-transport configured URL rendering, post-script refresh, effective-response replacement, query-secret redaction, and rebuilt shared CLI core: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Focused pending/running/completed URL regression with templated environment values and redacted token evidence: [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Updated account-free live Runner documentation: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_191.md`](QA_MILESTONE_191.md)

## Milestone 192 acceptance evidence

- Pinned saved `testCtx.duration` accumulation, History source, and completed-versus-failed request audit: [`docs/QA_MILESTONE_192.md`](QA_MILESTONE_192.md)
- Explicit bounded completed-response duration accumulation in desktop and shared CLI Runner reports: [`src/types.ts`](../src/types.ts), [`src/lib/runner.ts`](../src/lib/runner.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Shared History/text/JSON/JUnit duration selection with legacy wall-clock/attempt fallback regressions: [`src/lib/runnerHistory.ts`](../src/lib/runnerHistory.ts), [`src/lib/runnerHistory.test.ts`](../src/lib/runnerHistory.test.ts), [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts), and [`src/lib/runnerReport.test.ts`](../src/lib/runnerReport.test.ts)
- Corrected historical boundary and account-free documentation: [`docs/QA_MILESTONE_183.md`](QA_MILESTONE_183.md) and [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_192.md`](QA_MILESTONE_192.md)

## Milestone 193 acceptance evidence

- Pinned controlled Results/History/Console active-tab audit: [`docs/QA_MILESTONE_193.md`](QA_MILESTONE_193.md)
- Pure active-execution pane selection with post-run restoration regression: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Controlled visual/ARIA pane state that keeps live progress, Skip, and Cancel all reachable throughout execution: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Exact verification record: [`docs/QA_MILESTONE_193.md`](QA_MILESTONE_193.md)

## Milestone 194 acceptance evidence

- Pinned initial Results Hotkey guidance and saved empty-run distinction audit: [`docs/QA_MILESTONE_194.md`](QA_MILESTONE_194.md)
- Semantic configured-shortcut guidance with focused static-render regressions: [`src/components/RunnerResultsEmptyState.tsx`](../src/components/RunnerResultsEmptyState.tsx) and [`src/components/RunnerResultsEmptyState.test.tsx`](../src/components/RunnerResultsEmptyState.test.tsx)
- Initial/saved empty-state integration and corrected M188 presentation boundary: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`docs/QA_MILESTONE_188.md`](QA_MILESTONE_188.md)
- Exact verification record: [`docs/QA_MILESTONE_194.md`](QA_MILESTONE_194.md)

## Milestone 195 acceptance evidence

- Pinned Runner History PromptButton and two-second confirmation audit: [`docs/QA_MILESTONE_195.md`](QA_MILESTONE_195.md)
- Pure same-entry confirmation decision with focused regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Per-entry armed warning, timer cleanup, accessible confirmation label, and exact report deletion integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Updated account-free History documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_195.md`](QA_MILESTONE_195.md)

## Milestone 196 acceptance evidence

- Pinned React Aria selected-key, before/after, and dedicated drag-handle audit: [`docs/QA_MILESTONE_196.md`](QA_MILESTONE_196.md)
- Pure selected-drag derivation and order-preserving block movement with focused regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Dedicated accessible drag handle, midpoint placement, active locking, and retained up/down controls: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Corrected M186 boundary, updated account-free Request Order documentation, and exact verification record: [`docs/QA_MILESTONE_186.md`](QA_MILESTONE_186.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_196.md`](QA_MILESTONE_196.md)

## Milestone 197 acceptance evidence

- Pinned Source/Iterations-only ColumnResizer and transient table-state audit: [`docs/QA_MILESTONE_197.md`](QA_MILESTONE_197.md)
- Pure bounded keyboard sizing with focused regressions: [`src/lib/runnerPlan.ts`](../src/lib/runnerPlan.ts) and [`src/lib/runnerPlan.test.ts`](../src/lib/runnerPlan.test.ts)
- Pointer-captured focusable ARIA separator and static-render regression: [`src/components/RunnerHistoryColumnResizer.tsx`](../src/components/RunnerHistoryColumnResizer.tsx) and [`src/components/RunnerHistoryColumnResizer.test.tsx`](../src/components/RunnerHistoryColumnResizer.test.tsx)
- CSS-grid width integration, horizontal overflow, account-free documentation, and exact verification record: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/styles.css`](../src/styles.css), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_197.md`](QA_MILESTONE_197.md)

## Milestone 198 acceptance evidence

- Pinned date-fns fixed local timestamp and Source-tooltip audit: [`docs/QA_MILESTONE_198.md`](QA_MILESTONE_198.md)
- Shared zero-padded local timestamp formatter with focused Date/ISO/invalid regressions: [`src/lib/runnerHistory.ts`](../src/lib/runnerHistory.ts) and [`src/lib/runnerHistory.test.ts`](../src/lib/runnerHistory.test.ts)
- Identical History row, tooltip, and guarded delete-label integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated account-free History documentation and exact verification record: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md) and [`docs/QA_MILESTONE_198.md`](QA_MILESTONE_198.md)

## Milestone 199 acceptance evidence

- Pinned Inso collection-only `--env-var`, URLSearchParams, and iteration-data merge audit: [`docs/QA_MILESTONE_199.md`](QA_MILESTONE_199.md)
- Shared later-wins override application with focused decoding/merge regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Bundled CLI flag parsing, collection/test boundary, and localhost CSV/override execution smoke: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated command examples, account-free CI documentation, and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_199.md`](QA_MILESTONE_199.md)

## Milestone 200 acceptance evidence

- Pinned Inso collection `-t`/`--requestNamePattern`, selected-plan ordering, and zero-match failure audit: [`docs/QA_MILESTONE_200.md`](QA_MILESTONE_200.md)
- Shared bounded regex validation and full-or-selected request filtering with focused regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Subject-specific CLI short flag, collection/test boundary, bundled help, and localhost execution smoke: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated command examples, account-free CI documentation, and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_200.md`](QA_MILESTONE_200.md)

## Milestone 201 acceptance evidence

- Pinned Inso collection `--item`, `--iteration-count`, `--iteration-data`, and short bail-option audit: [`docs/QA_MILESTONE_201.md`](QA_MILESTONE_201.md)
- Backward-compatible parser aliases and bundled help alignment: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Run-via-CLI generation using pinned long names with focused shell-command regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Packaged selected-order/data/iteration aliases plus real short-bail failure smoke and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_201.md`](QA_MILESTONE_201.md)

## Milestone 202 acceptance evidence

- Pinned recursive RequestGroup item collection and single-folder tree-sort audit: [`docs/QA_MILESTONE_202.md`](QA_MILESTONE_202.md)
- Cycle-safe mixed resource-tree expansion, request-name compatibility, argument-order retention, and de-duplication regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- CLI item resolution before regex filtering and bundled selected-folder execution: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated account-free folder-item guidance and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_202.md`](QA_MILESTONE_202.md)

## Milestone 203 acceptance evidence

- Pinned Inso collection/test `--requestTimeout`, `parseInt`, and slow-request fixture audit: [`docs/QA_MILESTONE_203.md`](QA_MILESTONE_203.md)
- Shared fallback/zero/clamp/integer-prefix/invalid parsing regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Primary/dependent/suite execution override wiring, bundled help, and packaged slow success/timeout evidence: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated account-free timeout guidance and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_203.md`](QA_MILESTONE_203.md)

## Milestone 204 acceptance evidence

- Pinned Inso path-or-URL iteration-data and content-driven JSON/CSV parsing audit: [`docs/QA_MILESTONE_204.md`](QA_MILESTONE_204.md)
- Local/HTTP classification, status handling, streamed byte bounds, and UTF-8 decoding regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- CLI loader integration plus packaged remote CSV, override, iteration, and exact-request execution: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated account-free remote-data guidance and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_204.md`](QA_MILESTONE_204.md)

## Milestone 205 acceptance evidence

- Pinned global `-w`/`--workingDir`, identifier-only run command, and config-precedence prerequisite audit: [`docs/QA_MILESTONE_205.md`](QA_MILESTONE_205.md)
- Option-aware legacy/pinned positional extraction and generated-command regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Collection/test input resolution, bundled help, and packaged split-project execution through both long and short working-directory flags: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`bin/brunomnia.cjs`](../bin/brunomnia.cjs), and [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs)
- Updated account-free working-directory guidance and exact verification record: [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_205.md`](QA_MILESTONE_205.md)

## Milestone 206 acceptance evidence

- Pinned cosmiconfig search, supported global-option filtering, scripts retention, and merge-precedence audit: [`docs/QA_MILESTONE_206.md`](QA_MILESTONE_206.md)
- Pure bounded option/script normalization and positional-config regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Explicit/upward config loading, package property support, CLI precedence, CI fallback, verbose/print diagnostics, and bundled help: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged explicit/discovered config execution, missing-file rejection, updated account-free guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_206.md`](QA_MILESTONE_206.md)

## Milestone 207 acceptance evidence

- Pinned `script <script-name>`, `inso` prefix, string-argv tokenization, pass-through, and recursive program-dispatch audit: [`docs/QA_MILESTONE_207.md`](QA_MILESTONE_207.md)
- Quote/escape/empty-argument parsing, invalid-prefix/unterminated-input rejection, and bounded config regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Non-shell child CLI dispatch, config/workingDir/global propagation, recursion bound, exit-code forwarding, and bundled help: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged alias execution, forwarded timeout, invalid/missing task diagnostics, updated account-free guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_207.md`](QA_MILESTONE_207.md)

## Milestone 208 acceptance evidence

- Pinned global-environment ID/name/file loading and independent collection-environment selection audit: [`docs/QA_MILESTONE_208.md`](QA_MILESTONE_208.md)
- Pure hierarchical global and collection selector helpers plus generated-command regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Bounded Brunomnia/Insomnia v4/v5 environment-file parsing, collection/suite execution wiring, and bundled help: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Run-via-CLI dual-scope generation, packaged ID/name/file/failure smoke, updated guidance, and exact verification record: [`src/components/RunnerCliDialog.tsx`](../src/components/RunnerCliDialog.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_208.md`](QA_MILESTONE_208.md)

## Milestone 209 acceptance evidence

- Pinned variadic `-f`/`--dataFolders` request-run option and secure-reader boundary audit: [`docs/QA_MILESTONE_209.md`](QA_MILESTONE_209.md)
- Variadic option extraction, positional protection, and focused regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Canonical root normalization, component-aware containment, regular-file checks, and shared template/script readers: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged rootless/outside/symlink denial plus valid template/script reads, updated security guidance, and exact verification record: [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs), [`README.md`](../README.md), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), [`docs/SCRIPTING.md`](SCRIPTING.md), [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md), and [`docs/QA_MILESTONE_209.md`](QA_MILESTONE_209.md)

## Milestone 210 acceptance evidence

- Pinned collection/test proxy defaults, explicit flags, no-proxy, validation override, and runtime-option audit: [`docs/QA_MILESTONE_210.md`](QA_MILESTONE_210.md)
- Proxy/TLS option-aware positional extraction and focused regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Request-scoped Undici direct/proxy dispatchers, forced validation precedence, native-root extension, and PEM/PFX identity wiring: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`package.json`](../package.json), [`package-lock.json`](../package-lock.json), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged HTTP proxy/no-proxy, HTTPS CONNECT, untrusted TLS, workspace CA, PEM mTLS, and encrypted PKCS#12 mTLS evidence plus updated guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), and [`docs/QA_MILESTONE_210.md`](QA_MILESTONE_210.md)

## Milestone 211 acceptance evidence

- Pinned collection full-report schema, redact/plaintext choice, exact redaction marker, output-path, and risk-disclaimer audit: [`docs/QA_MILESTONE_211.md`](QA_MILESTONE_211.md)
- Inline-value option parsing plus full-data positional protection regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Primary rendered-request/response capture, effective-variable evidence, field redaction, pre-transport risk gating, nested working-directory output, and versioned JSON serialization: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged risk rejection, redacted non-leakage, plaintext preservation, mTLS/proxy material, output resolution, and updated security guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), and [`docs/QA_MILESTONE_211.md`](QA_MILESTONE_211.md)

## Milestone 212 acceptance evidence

- Pinned default result-report field minimization, output-file preflight, parent creation, reporter continuity, and working-directory audit: [`docs/QA_MILESTONE_212.md`](QA_MILESTONE_212.md)
- Metadata-safe collection/environment/request/response projection, proxy-credential stripping, primary execution capture, and separate reporter stdout: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged directory rejection before mTLS transport, nested safe-file creation, secret non-leakage, reporter-format continuity, and updated output/security guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_212.md`](QA_MILESTONE_212.md)

## Milestone 213 acceptance evidence

- Pinned shared `defaultReporter = 'spec'` audit and exact verification record: [`docs/QA_MILESTONE_213.md`](QA_MILESTONE_213.md)
- Collection/test CLI fallback alignment with explicit JSON/JUnit extensions retained: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged default collection `spec` stdout evidence through accepted redacted-result output plus updated automation guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), and [`docs/QA_MILESTONE_213.md`](QA_MILESTONE_213.md)

## Milestone 214 acceptance evidence

- Pinned export-spec identifier, working-directory, annotation stripping, stdout/file, and nested-parent audit: [`docs/QA_MILESTONE_214.md`](QA_MILESTONE_214.md)
- Bounded recursive `x-kong-*` removal with focused nested-retention regressions: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Pinned/legacy export argument resolution, config working-directory continuity, aliases, and nested output: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged split-project raw stdout plus stripped nested-file evidence and updated command guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/QA.md`](QA.md), and [`docs/QA_MILESTONE_214.md`](QA_MILESTONE_214.md)

## Milestone 215 acceptance evidence

- Pinned file/stored-design/CI resolution, explicit ruleset override, sibling discovery, and exit-contract audit: [`docs/QA_MILESTONE_215.md`](QA_MILESTONE_215.md)
- Shared working-directory-base resolution and lint integration with option-aware positional protection: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged split-project design/CI success plus explicit and sibling-ruleset failure evidence with updated command guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/QA.md`](QA.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_215.md`](QA_MILESTONE_215.md)

## Milestone 216 acceptance evidence

- Pinned partial-ID and collection-environment prompt/CI decision audit: [`docs/QA_MILESTONE_216.md`](QA_MILESTONE_216.md)
- Shared exact-name/full-or-prefix selector with explicit ambiguity rejection and focused regressions: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts) and [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts)
- Stored design/collection/global/collection-environment wiring plus terminal-aware selection: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged prefix execution, CI multi-environment refusal, non-TTY refusal, pre-transport proof, updated automation guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_216.md`](QA_MILESTONE_216.md)

## Milestone 217 acceptance evidence

- Pinned collection, suite/API-specification, and API-specification prompt audit with explicit CI-difference accounting: [`docs/QA_MILESTONE_217.md`](QA_MILESTONE_217.md)
- Shared bounded numbered terminal selector plus collection/test/lint/export integration: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged non-TTY refusal for all four command paths, pre-transport proof, real pseudo-terminal collection/environment traversal, updated automation guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_217.md`](QA_MILESTONE_217.md)

## Milestone 218 acceptance evidence

- Pinned generated-test lifecycle, source shape, temp path, stdout notice, and cleanup audit: [`docs/QA_MILESTONE_218.md`](QA_MILESTONE_218.md)
- Stable sorted suite/test source generator with default-request and escaping regressions: [`src/lib/unitTests.ts`](../src/lib/unitTests.ts) and [`src/lib/unitTests.test.ts`](../src/lib/unitTests.test.ts)
- Test-only private retention, pinned notice, option-aware positional parsing, and explicit collection refusal: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged mode/source/path/cleanup evidence, updated sensitive-artifact guidance, and exact verification record: [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_218.md`](QA_MILESTONE_218.md)

## Milestone 219 acceptance evidence

- Pinned package/environment version-option audit and exact verification record: [`docs/QA_MILESTONE_219.md`](QA_MILESTONE_219.md)
- Root `-v`/`--version` short-circuit, package fallback, and release-wrapper `VERSION` override: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Option-aware positional protection, packaged default/override execution, updated CLI guidance, and exact verification record: [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts), [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_219.md`](QA_MILESTONE_219.md)

## Milestone 220 acceptance evidence

- Pinned Commander parent/leaf syntax, local/global options, subcommand, `-h`/`--help`, and `help <topic>` audit: [`docs/QA_MILESTONE_220.md`](QA_MILESTONE_220.md)
- Bounded structured root/parent/leaf help routing before command execution: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged test/collection/lint help through long, short, and help-command forms plus updated guidance and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_220.md`](QA_MILESTONE_220.md)

## Milestone 221 acceptance evidence

- Pinned standard-Git route, action, UI, and implementation audit with reproducible source commands: [`docs/QA_MILESTONE_221.md`](QA_MILESTONE_221.md)
- Corrected Git requirements and current compatibility bounds without changing product behavior: [`docs/PARITY.md`](PARITY.md), [`docs/GIT_PROJECTS.md`](GIT_PROJECTS.md), [`docs/MIGRATION.md`](MIGRATION.md), [`docs/QA_MILESTONE_6.md`](QA_MILESTONE_6.md), and [`docs/QA_MILESTONE_61.md`](QA_MILESTONE_61.md)
- Confirmed provider authentication/onboarding, credential validation, and repository discovery as the remaining standard-Git gaps while preserving exactly 19 incomplete parity rows: [`docs/QA_MILESTONE_221.md`](QA_MILESTONE_221.md)

## Milestone 222 acceptance evidence

- Pinned command/action inventory, shared global-option merge, and maintainer-only `generate-docs` audit: [`docs/QA_MILESTONE_222.md`](QA_MILESTONE_222.md)
- Shared config/CLI precedence and stderr diagnostics across run, lint, export, and script commands: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Packaged cross-command diagnostics, both CLI smokes, updated automation guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`scripts/cli-template-smoke.mjs`](../scripts/cli-template-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/MIGRATION.md`](MIGRATION.md), and [`docs/QA_MILESTONE_222.md`](QA_MILESTONE_222.md)

## Milestone 223 acceptance evidence

- Pinned Inso container/signing and plugin/vault runtime audit with explicit real-gap classification: [`docs/QA_MILESTONE_223.md`](QA_MILESTONE_223.md)
- Digest-pinned non-root image, minimal context, immutable release actions, bundle freshness gate, multi-architecture provenance/SBOM publication, and keyless digest signing: [`Dockerfile.cli`](../Dockerfile.cli), [`.dockerignore`](../.dockerignore), and [`.github/workflows/cli-container.yml`](../.github/workflows/cli-container.yml)
- Local image/version/suite smoke, AMD64/ARM64 OCI export, release guidance, and exact verification record: [`scripts/cli-container-smoke.mjs`](../scripts/cli-container-smoke.mjs), [`docs/CLI_CONTAINER.md`](CLI_CONTAINER.md), [`README.md`](../README.md), and [`docs/QA_MILESTONE_223.md`](QA_MILESTONE_223.md)

## Milestone 224 acceptance evidence

- Successful remote verify/publish jobs, exact main commit, immutable GHCR digest, and independent Cosign/OIDC/transparency-log verification: [`docs/QA_MILESTONE_224.md`](QA_MILESTONE_224.md)
- Published-image verification command and permanent first-release evidence: [`docs/CLI_CONTAINER.md`](CLI_CONTAINER.md) and [`docs/QA_MILESTONE_224.md`](QA_MILESTONE_224.md)
- Corrected Headless CLI boundary after observing the real signed artifact while preserving exactly 19 incomplete rows: [`docs/PARITY.md`](PARITY.md)

## Milestone 225 acceptance evidence

- Pinned Inso user/bundled plugin-template loading audit and explicit stored-workspace adaptation: [`docs/QA_MILESTONE_225.md`](QA_MILESTONE_225.md)
- Resource-limited Node worker adapter with hidden process/global authority, refused host RPC, bounded output/store, in-memory continuity, and focused regressions: [`cli/pluginRuntime.ts`](../cli/pluginRuntime.ts) and [`cli/pluginRuntime.test.ts`](../cli/pluginRuntime.test.ts)
- Separate `--allow-plugins` routing across primary, dependent, and saved-suite HTTP/GraphQL sends with option-aware parsing and generated bundle: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`src/lib/runnerCli.test.ts`](../src/lib/runnerCli.test.ts), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- Default-denial/explicit-grant packaged evidence, signed Node 22 no-network container execution, updated trust guidance, and exact verification record: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`scripts/cli-container-smoke.mjs`](../scripts/cli-container-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/PLUGINS.md`](PLUGINS.md), [`docs/CLI_CONTAINER.md`](CLI_CONTAINER.md), and [`docs/QA_MILESTONE_225.md`](QA_MILESTONE_225.md)

## Milestone 226 acceptance evidence

- Pinned Cosmiconfig 9 loader and default search-place audit with a bounded Brunomnia adaptation: [`docs/QA_MILESTONE_226.md`](QA_MILESTONE_226.md)
- Explicit `--allow-config-code`, full package/`.insorc`/`.config`/`inso.config` discovery, filtered global-option routing, deterministic license-comment normalization, and generated bundle: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/runnerCli.ts`](../src/lib/runnerCli.ts), [`package.json`](../package.json), [`scripts/normalize-cli-bundle.mjs`](../scripts/normalize-cli-bundle.mjs), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)
- In-memory TypeScript transpilation plus fresh resource-limited workers, deadlines, disabled imports/host authority/code generation/external buffers, strict JSON output, and focused regressions: [`cli/configCode.ts`](../cli/configCode.ts) and [`cli/configCode.test.ts`](../cli/configCode.test.ts)
- Default-denial/explicit-grant packaged and no-network Node 22 container evidence with updated trust guidance: [`scripts/cli-runner-preview-smoke.mjs`](../scripts/cli-runner-preview-smoke.mjs), [`scripts/cli-container-smoke.mjs`](../scripts/cli-container-smoke.mjs), [`README.md`](../README.md), [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md), [`docs/CLI_CONTAINER.md`](CLI_CONTAINER.md), and [`docs/QA_MILESTONE_226.md`](QA_MILESTONE_226.md)
- Successful remote rebuild/smoke, AMD64/ARM64 publication, keyless digest signing, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_226.md`](QA_MILESTONE_226.md)

## Milestone 227 acceptance evidence

- Pinned Insomnia provider plus exact locked MCP SDK audit proving URL-based client IDs are unreachable without `clientMetadataUrl`: [`docs/QA_MILESTONE_227.md`](QA_MILESTONE_227.md)
- Explicit twenty-hop metadata redirect handling with per-hop URL validation/traces, loop and overflow rejection, and no registration-POST redirect authority: [`src/lib/mcpOAuthDiscovery.ts`](../src/lib/mcpOAuthDiscovery.ts)
- Redirect success, native-follow denial, insecure-target refusal, loop detection, overflow coverage, full regression/build evidence, and corrected integration guidance: [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts), [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md), and [`docs/QA_MILESTONE_227.md`](QA_MILESTONE_227.md)
- Successful remote Node 22 rebuild/smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_227.md`](QA_MILESTONE_227.md)

## Milestone 228 acceptance evidence

- Pinned pending-event cancel control, message-ID AbortController registry, and per-request SDK signal audit: [`docs/QA_MILESTONE_228.md`](QA_MILESTONE_228.md)
- Abort-aware HTTP discovery/invocation with detached session/request-aware cancellation notifications and focused transport fixtures: [`src/lib/mcp.ts`](../src/lib/mcp.ts), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), and [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts)
- Race-safe bounded native cancellation registration, protocol notification, child termination, reader cleanup, and live-process regression: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Visible cancel action, unmount cleanup, retained cancellation evidence, full regression/native/build gates, and exact verification record: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx), [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md), and [`docs/QA_MILESTONE_228.md`](QA_MILESTONE_228.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_228.md`](QA_MILESTONE_228.md)

## Milestone 229 acceptance evidence

- Pinned persistent connection/client reuse plus exact locked SDK session/protocol header, optional stateless mode, reconnect, and DELETE/405 audit: [`docs/QA_MILESTONE_229.md`](QA_MILESTONE_229.md)
- Bounded project/client-scoped device-memory session registry, stateless reuse, validated identities, protocol headers, one-shot 404 replacement, and best-effort termination: [`src/lib/mcp.ts`](../src/lib/mcp.ts)
- Explicit connected/disconnect state plus automatic termination on disable, delete, or connection-setting changes: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx) and [`src/App.tsx`](../src/App.tsx)
- Project isolation, reuse, stateless behavior, DELETE/header, 404 recovery, identity-bound, real loopback, full regression/build, and exact verification evidence: [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts), [`src/lib/mcpSession.integration.test.ts`](../src/lib/mcpSession.integration.test.ts), and [`docs/QA_MILESTONE_229.md`](QA_MILESTONE_229.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_229.md`](QA_MILESTONE_229.md)

## Milestone 230 acceptance evidence

- Pinned retained-client, STDIO transport, explicit-close, and environment-boundary audit: [`docs/QA_MILESTONE_230.md`](QA_MILESTONE_230.md)
- Bounded project/client session registry, direct-child reuse, serialized monotonic calls, retained-process cancellation, fatal cleanup, and explicit close command: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Fingerprinted renderer session identity, spawn/fatal cleanup, visible disconnect state, and connection-setting invalidation: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Stable-key, cancellation-reuse, disconnect, spawn-failure, real-child lifecycle, full regression/build, and exact verification evidence: [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs), and [`docs/QA_MILESTONE_230.md`](QA_MILESTONE_230.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_230.md`](QA_MILESTONE_230.md)

## Milestone 231 acceptance evidence

- Pinned MCP model, disconnected-only text environment editor, render path, explicit child environment, and v5 interchange audit: [`docs/QA_MILESTONE_231.md`](QA_MILESTONE_231.md)
- Workspace v38 ordered/disabled row model, normalization, security publication diagnostics, and scoped persistence: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src-tauri/src/project.rs`](../src-tauri/src/project.rs)
- Selected-environment/template/vault rendering, sensitive-value refusal, duplicate handling, fingerprinted renderer state, and locked connected editor: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Ambient-cleared `PATH`-plus-overrides spawning, bounded validation, resolved-environment process replacement, real-child evidence, full regressions/builds, packaged CLI smokes, and exact verification record: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), and [`docs/QA_MILESTONE_231.md`](QA_MILESTONE_231.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_231.md`](QA_MILESTONE_231.md)

## Milestone 232 acceptance evidence

- Pinned `shell-path` 3.1.0, lock-resolved `shell-env` 4.0.3/`default-shell` 2.2.0 invocation, alternate-shell fallback, and reviewed-precedence audit: [`docs/QA_MILESTONE_232.md`](QA_MILESTONE_232.md)
- Bounded Unix login-shell discovery, UUID-delimited parsing, app-path fallback, explicit empty-path behavior, and direct-child precedence: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs)
- Noisy/failing/hanging shell, bare executable, reviewed override, persistent lifecycle, full regression/build, packaged CLI smoke, and app-bundle evidence: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs) and [`docs/QA_MILESTONE_232.md`](QA_MILESTONE_232.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_232.md`](QA_MILESTONE_232.md)

## Milestone 233 acceptance evidence

- Pinned v4 `mcp_request`, v5 `mcpClient.insomnia/5.0`, auth, environment, roots, and command-text audit: [`docs/QA_MILESTONE_233.md`](QA_MILESTONE_233.md)
- First-class bounded artifact clients, collision-safe apply, v4 workspace extraction/emission, v5 document detection/emission, environment-tree adaptation, and disabled credential-stripped imports: [`src/lib/interchange/types.ts`](../src/lib/interchange/types.ts), [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- HTTP/STDIO quote round trips, roots/env/auth/header preservation, runtime-secret omission, scoped warnings, repeated apply, sensitive clearing, inert shell-operator evidence, full regressions/builds, packaged CLI smokes, and exact verification record: [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`docs/QA_MILESTONE_233.md`](QA_MILESTONE_233.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_233.md`](QA_MILESTONE_233.md)

## Milestone 234 acceptance evidence

- Pinned RJSF 6/AJV 8 tool-schema form, default-state synchronization, advisory validation, and JSON-overview audit: [`docs/QA_MILESTONE_234.md`](QA_MILESTONE_234.md)
- Bounded local-reference/composition/conditional schema model, recursive object/array/additional-property controls, typed variants/defaults, immutable path edits, and nonblocking issues: [`src/lib/mcpParameterSchema.ts`](../src/lib/mcpParameterSchema.ts), [`src/components/McpParameterField.tsx`](../src/components/McpParameterField.tsx), and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Recursive/default/reference/union/dependency/path regression fixtures, full frontend/native/build/CLI gates, and exact verification record: [`src/lib/mcpParameterSchema.test.ts`](../src/lib/mcpParameterSchema.test.ts) and [`docs/QA_MILESTONE_234.md`](QA_MILESTONE_234.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_234.md`](QA_MILESTONE_234.md)

## Milestone 235 acceptance evidence

- Pinned Insomnia provider and exact locked MCP SDK Streamable HTTP lifecycle/retry audit: [`docs/QA_MILESTONE_235.md`](QA_MILESTONE_235.md)
- Shared rendered/authenticated HTTP preparation plus bounded native POST/GET SSE bridge, session registry, cancellation, and live renderer events: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/mcp.ts`](../src/lib/mcp.ts), [`src-tauri/src/mcp_http.rs`](../src-tauri/src/mcp_http.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Open-POST completion, primed resume, no post-result reconnect, optional GET `405`, server retry, `Last-Event-ID`, two-retry ceiling, cancellation, explicit disconnect, full regression/build, and exact verification evidence: [`src-tauri/src/mcp_http.rs`](../src-tauri/src/mcp_http.rs), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), and [`docs/QA_MILESTONE_235.md`](QA_MILESTONE_235.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_235.md`](QA_MILESTONE_235.md)

## Milestone 236 acceptance evidence

- Pinned Insomnia client-request resolver plus elicitation, sampling, and event-view source audit: [`docs/QA_MILESTONE_236.md`](QA_MILESTONE_236.md)
- Live HTTP POST/GET and persistent STDIO server-request delivery, bounded pending registry, concurrent response routing, cancellation, roots updates, and advertised capabilities: [`src-tauri/src/mcp_http.rs`](../src-tauri/src/mcp_http.rs), [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs), [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs), and [`src/lib/mcp.ts`](../src/lib/mcp.ts)
- Elicitation schema review, sampling approve/reject, configured-provider draft-only generation, bounded queue controls, focused transport/UI regressions, and exact verification record: [`src/components/McpServerRequestPanel.tsx`](../src/components/McpServerRequestPanel.tsx), [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), and [`docs/QA_MILESTONE_236.md`](QA_MILESTONE_236.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_236.md`](QA_MILESTONE_236.md)

## Milestone 237 acceptance evidence

- Pinned MCP request model, capability gate, Subscribe/Unsubscribe control, client primitive methods, disconnect cleanup, and exact locked SDK OAuth/DPoP audit: [`docs/QA_MILESTONE_237.md`](QA_MILESTONE_237.md)
- Negotiated HTTP/STDIO resource-subscription state, session-aware protocol calls, disconnect cleanup, and visible ordinary-resource controls: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Persistent STDIO response routing plus idle notification dispatch, fatal-state propagation, bounded fallback events, real-child coverage, real HTTP loopback coverage, and exact verification record: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), [`src/lib/mcpSession.integration.test.ts`](../src/lib/mcpSession.integration.test.ts), and [`docs/QA_MILESTONE_237.md`](QA_MILESTONE_237.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_237.md`](QA_MILESTONE_237.md)

## Milestone 238 acceptance evidence

- Pinned non-syncable MCP response model, per-connection event/timeline streams, separate notification query, history loader, filters, clear-view, delete, and clear audit: [`docs/QA_MILESTONE_238.md`](QA_MILESTONE_238.md)
- Workspace v39 bounded local connection/event/timeline model, normalization, retention, environment filtering, restart repair, and publication stripping: [`src/types.ts`](../src/types.ts), [`src/lib/mcpHistory.ts`](../src/lib/mcpHistory.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/security.ts`](../src/lib/security.ts)
- Stable HTTP/STDIO logical history identities, matching result events, live idle recording, lifecycle finalization, and Events/Notifications/Console history controls: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Focused response/filter/retention/migration/security regressions and exact verification record: [`src/lib/mcpHistory.test.ts`](../src/lib/mcpHistory.test.ts), [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/security.test.ts`](../src/lib/security.test.ts), and [`docs/QA_MILESTONE_238.md`](QA_MILESTONE_238.md)
- Successful remote Node 22 rebuild/no-network smoke, signed AMD64/ARM64 publication, and independent exact-identity Cosign verification: [`docs/QA_MILESTONE_238.md`](QA_MILESTONE_238.md)

## Milestone 239 acceptance evidence

- Pinned Electron safe-storage bridge and MCP OAuth persistence audit plus exact local/remote verification: [`docs/QA_MILESTONE_239.md`](QA_MILESTONE_239.md)
- macOS Keychain master-key retrieval, bounded AES-256-GCM credential envelope, workspace-identity authentication, strict parsing, and tamper rejection: [`src-tauri/src/runtime_credentials.rs`](../src-tauri/src/runtime_credentials.rs)
- Transparent catalog, backup, legacy, deleted-project, restore, and legacy-command protection/migration: [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Packaged/browser disclosure in the MCP editor and security/integration guides: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx), [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md), and [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md)

## Milestone 240 acceptance evidence

- Credential-free public endpoint/source audit, exact live matrix, bounded disclosure, and local/remote verification: [`docs/QA_MILESTONE_240.md`](QA_MILESTONE_240.md)
- Shared-client discovery/invocation/session/disconnect coverage against DeepWiki, Context7, and Cloudflare Docs: [`src/lib/mcpPublic.integration.test.ts`](../src/lib/mcpPublic.integration.test.ts) and [`package.json`](../package.json)
- Native packaged-path initialization, SSE parsing, session-header, tool discovery, and invocation matrix: [`src-tauri/src/mcp_http.rs`](../src-tauri/src/mcp_http.rs)
- Public compatibility contract and reproducible commands: [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md)

## Milestone 244 acceptance evidence

- Pinned GGUF folder, discovery, defaults/ranges, activation, and utility-process isolation audit: [`docs/QA_MILESTONE_244.md`](QA_MILESTONE_244.md)
- Root-confined model catalog, bounded executable worker protocol, llama.cpp chat-template/generation pipeline, Metal/CPU attempt policy, EOG and stateful UTF-8 handling: [`src-tauri/src/gguf.rs`](../src-tauri/src/gguf.rs), [`src-tauri/src/main.rs`](../src-tauri/src/main.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Workspace v40 settings, native adapter/dispatch, desktop model folder/select/refresh/advanced controls, and local-data disclosure: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/gguf.ts`](../src/lib/gguf.ts), [`src/lib/ai.ts`](../src/lib/ai.ts), and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Focused frontend/native regressions plus checksum-recorded live GGUF inference: [`src/lib/gguf.test.ts`](../src/lib/gguf.test.ts), [`src/lib/ai.gguf.test.ts`](../src/lib/ai.gguf.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`docs/QA_MILESTONE_244.md`](QA_MILESTONE_244.md)

## Milestone 246 acceptance evidence

- Pinned five-scope project/workspace model, v5-backed duplicate modal, and separate true-reparent route audit: [`docs/QA_MILESTONE_246.md`](QA_MILESTONE_246.md)
- Typed inventory plus collision-safe collection/design/mock/environment/MCP duplication and reference remapping: [`src/lib/projectWorkspaces.ts`](../src/lib/projectWorkspaces.ts)
- Healthy catalog source/target integration with destination-only persistence and opening: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts)
- Lazy Project files inventory and named current/cross-project duplicate workflow: [`src/components/WorkspaceSwitcher.tsx`](../src/components/WorkspaceSwitcher.tsx) and [`src/App.tsx`](../src/App.tsx)
- Five-scope, nested identity, suite-reference, runtime-state, and catalog persistence regressions: [`src/lib/projectWorkspaces.test.ts`](../src/lib/projectWorkspaces.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`docs/QA_MILESTONE_246.md`](QA_MILESTONE_246.md)

## Milestone 247 acceptance evidence

- Pinned identity-preserving workspace parent-update audit and exact local ownership boundary: [`docs/QA_MILESTONE_247.md`](QA_MILESTONE_247.md)
- Collision-checked Collection/Document/Mock/Environment/MCP moves, owned evidence transfer, and source fallback repair: [`src/lib/projectWorkspaces.ts`](../src/lib/projectWorkspaces.ts)
- Destination-first persistence, two-document rollback, and active-autosave generation invalidation: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts) and [`src/App.tsx`](../src/App.tsx)
- Healthy cross-project destination picker and explicit identity/evidence move disclosure: [`src/components/WorkspaceSwitcher.tsx`](../src/components/WorkspaceSwitcher.tsx)
- Ownership, identity, design dependency, placeholder, collision, same-project, and catalog regressions: [`src/lib/projectWorkspaces.test.ts`](../src/lib/projectWorkspaces.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`docs/QA_MILESTONE_247.md`](QA_MILESTONE_247.md)

## Milestone 248 acceptance evidence

- Pinned permanent project/workspace deletion language, confirmation, and immediate-removal route audit: [`docs/QA_MILESTONE_248.md`](QA_MILESTONE_248.md)
- Optional deleted-project catalog metadata plus backward-compatible creation/update timestamp restoration: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts) and [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs)
- Exact-group and recognized-regular-artifact-only all-trash permanent deletion APIs: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Confirmed Restore/Delete/Empty project-manager controls plus browser/native lifecycle regressions: [`src/components/WorkspaceSwitcher.tsx`](../src/components/WorkspaceSwitcher.tsx), [`src/App.tsx`](../src/App.tsx), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`docs/QA_MILESTONE_248.md`](QA_MILESTONE_248.md)

## Milestone 249 acceptance evidence

- Pinned named snapshot creation, newest-first History table, object count, and confirmed rollback audit: [`docs/QA_MILESTONE_249.md`](QA_MILESTONE_249.md)
- Bounded full-project snapshot validation, retention, exact restore, native credential protection, and symlink-safe filesystem storage: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Snapshot ownership through project delete, restore, purge, Empty, and ID-collision refusal across native and browser stores: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Named Project history controls with message/time/file-count/size evidence and confirmed restore: [`src/components/WorkspaceSwitcher.tsx`](../src/components/WorkspaceSwitcher.tsx), [`src/App.tsx`](../src/App.tsx), [`src/styles.css`](../src/styles.css), and [`docs/QA_MILESTONE_249.md`](QA_MILESTONE_249.md)

## Milestone 250 acceptance evidence

- Pinned zero-workspace project creation, empty route, and first-file action audit: [`docs/QA_MILESTONE_250.md`](QA_MILESTONE_250.md)
- Workspace v43 explicit-empty preservation, genuinely empty catalog creation, and zero-file snapshot evidence: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Final Collection/Document/Environment move source emptying without replacement identities: [`src/lib/projectWorkspaces.ts`](../src/lib/projectWorkspaces.ts), [`src/lib/projectWorkspaces.test.ts`](../src/lib/projectWorkspaces.test.ts), and [`src/components/WorkspaceSwitcher.tsx`](../src/components/WorkspaceSwitcher.tsx)
- Requestless runtime fallback plus Welcome, Send a request, Create document, and Import dashboard behavior: [`src/App.tsx`](../src/App.tsx), [`src/App.emptyProject.test.tsx`](../src/App.emptyProject.test.tsx), and [`src/styles.css`](../src/styles.css)

## Milestone 251 acceptance evidence

- Pinned workspace-parent cookie-jar, CA-certificate, client-certificate, route loading, and default-jar creation audit: [`docs/QA_MILESTONE_251.md`](QA_MILESTONE_251.md)
- Workspace v43 ownership, bounded legacy migration, generated-design inheritance, and isolated mutation helpers: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/workspaceFileState.ts`](../src/lib/workspaceFileState.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/workspaceFileState.test.ts`](../src/lib/workspaceFileState.test.ts)
- Request/dependency/workbench/plugin/integration/realtime/schema/codegen/CLI execution wiring: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/UnitTestWorkbench.tsx`](../src/components/UnitTestWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Selected-file duplicate/move/import/export ownership plus folder/Git/encrypted-sync local-only boundaries: [`src/lib/projectWorkspaces.ts`](../src/lib/projectWorkspaces.ts), [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), [`src/lib/project.ts`](../src/lib/project.ts), and [`src/lib/security.ts`](../src/lib/security.ts)

## Milestone 252 acceptance evidence

- Shared identity-bound manifest/record split and assembly contract plus focused corruption/mismatch/order coverage: [`src/lib/workspacePhysicalStore.ts`](../src/lib/workspacePhysicalStore.ts), [`src/lib/workspacePhysicalStore.test.ts`](../src/lib/workspacePhysicalStore.test.ts), and [`docs/QA_MILESTONE_252.md`](QA_MILESTONE_252.md)
- Browser generation records, aggregate migration, rotating backup, delete/restore, exact purge/Empty cleanup, and catalog regressions: [`src/lib/workspaceCatalog.ts`](../src/lib/workspaceCatalog.ts) and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Native staged manifest/record persistence, credential protection, backup/corruption recovery, catalog reconstruction, snapshots, trash lifecycle, and symlink-safe reads: [`src-tauri/src/workspace_physical_store.rs`](../src-tauri/src/workspace_physical_store.rs) and [`src-tauri/src/workspace_store.rs`](../src-tauri/src/workspace_store.rs)
- Packaged CLI sibling-record confinement and execution continuity: [`cli/physicalStore.ts`](../cli/physicalStore.ts), [`cli/physicalStore.test.ts`](../cli/physicalStore.test.ts), [`scripts/cli-physical-store-smoke.mjs`](../scripts/cli-physical-store-smoke.mjs), and [`bin/brunomnia.cjs`](../bin/brunomnia.cjs)

## Milestone 256 acceptance evidence

- Pinned OAuth window/challenge and local OIDC smoke audit, gap classification, exact local/release gates, and remote evidence: [`docs/QA_MILESTONE_256.md`](QA_MILESTONE_256.md)
- Delayed first navigation, bounded validation/client-identity IPC, native policy lifecycle, and packaged command registration: [`src/lib/oauth2.ts`](../src/lib/oauth2.ts), [`src-tauri/src/oauth2_callback.rs`](../src-tauri/src/oauth2_callback.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Wry delegate selector installation, platform-default challenge preservation, scoped server trust, in-memory EC/RSA/PFX identities, origin confinement, and native regressions: [`src-tauri/src/oauth2_webview_macos.rs`](../src-tauri/src/oauth2_webview_macos.rs)
- Matching certificate IPC plus fixed EC/RSA/PFX and Objective-C credential evidence: [`src/lib/oauth2.test.ts`](../src/lib/oauth2.test.ts), [`src-tauri/tests/fixtures/tls/client-rsa.cert.pem`](../src-tauri/tests/fixtures/tls/client-rsa.cert.pem), and [`src-tauri/tests/fixtures/tls/client-rsa.key.pem`](../src-tauri/tests/fixtures/tls/client-rsa.key.pem)

## Milestone 257 acceptance evidence

- Pinned response persistence, size badge, content sniffing, HTML authority, multipart recursion, timeline, HTTP/3, and browser-limit classification: [`docs/QA_MILESTONE_257.md`](QA_MILESTONE_257.md)
- Explicit native compression negotiation/decoding, raw fallback, compressed wire and decoded entity sizes, and live gzip coverage: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/mcp_http.rs`](../src-tauri/src/mcp_http.rs)
- Response badge/history, plugin, HAR, timeline, connection/TLS/proxy, and calculated-header evidence: [`src/App.tsx`](../src/App.tsx), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/timeline.ts`](../src/lib/timeline.ts), [`src/lib/plugins.ts`](../src/lib/plugins.ts), and [`src/lib/responseDownload.ts`](../src/lib/responseDownload.ts)
- Upstream-default HTML authority with secure-import reset plus 100 MiB/100-level nested multipart viewing: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/multipartPreview.ts`](../src/lib/multipartPreview.ts), and [`src/components/ResponseBodyPreview.tsx`](../src/components/ResponseBodyPreview.tsx)

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).

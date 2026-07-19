# Runner reports and CI

Brunomnia keeps the latest 30 collection-run reports in device-local workspace storage. A report records every attempt in order, including iteration and retry numbers, request status, duration, script assertion results, runner errors, cancellation state, and aggregate pass/fail counts.

## Request plan

The desktop runner lists the selected collection's requests before execution. Clear a checkbox to omit a request. Drag rows to reorder them, or use each row's labeled up/down buttons for the same operation without dragging. The plan is transient runner state and does not reorder or remove requests in the collection itself. Newly created requests enter the plan enabled; removed requests are discarded.

Enable **Stop after first exhausted failure** to bail once a request has used all configured retry attempts and still fails. A failure that succeeds on retry does not bail. Manual cancellation and bail remain distinct report states.

The optional 0–30,000 ms delay runs after an item becomes active but before each transport attempt, including the first request and retries. Skip or Cancel during that wait prevents the transport from starting; Brunomnia does not add a trailing delay after the final attempt.

## Response snapshots

Results are grouped by iteration into one card per request attempt. Cards stay collapsed while a run is active, then completed and failed cards remount expanded when the run finishes; each saved historical attempt also starts expanded. Use the labeled chevron control to collapse or reopen an individual card without hiding any other attempt. Expanded successful attempts show status text, duration, original response size, retained headers, and a text body preview. Failed attempts that never received a response show the runner or transport error instead.

Each expanded attempt card lists every retained script assertion before the request and response snapshots. Each row shows PASS, FAIL, or SKIP; the assertion name and recorded error; its Pre-request Test, After-response Test, or Unknown category; and measured callback execution time using the pinned `< 0.1 ms`/one-decimal display. Attempts without assertions, failed assertions without retained error text, and legacy assertions without timing have explicit states. `insomnia.test.skip(name, callback)` records SKIP without invoking the callback or failing an otherwise successful request. The list works for active, latest, and reopened historical results because it reads the saved attempt evidence directly.

The Results toolbar leaves every request-attempt card visible and filters only the assertion rows inside every expanded card, matching pinned Runner request cards. All, Passed, Failed, and Skipped use the retained assertion status. The name field uses pinned `fuzzysort` 1.9.0 behavior against the assertion name only, including its `-8000` garbage-match floor; request identity, URL, response status, and error text do not masquerade as assertion-name matches. Filters apply equally to active, latest, and reopened historical results without changing cards, aggregate counters, saved reports, Console evidence, or exports. The direct response Tests pane uses the same controls and matcher.

Snapshots are intentionally bounded device-local evidence, not a second full response archive:

- 32,000 UTF-8 bytes maximum per attempt
- 16,000 UTF-8 bytes maximum for the body preview
- 64 headers, with 256-byte names and 2,048-byte values
- 1,000,000 UTF-8 content bytes across the entire report

Truncation backs up to a valid UTF-8 boundary and is identified separately for headers and the body. When the report budget is exhausted, later attempts retain their ordinary status/result metadata but can have empty truncated snapshots. Response data may contain credentials or personal data; reports stay device-local unless you explicitly export them.

## Request snapshots

The same result detail pane shows bounded request evidence above the response: protocol, method, resolved URL, configured enabled headers, and body mode/size metadata. JSON/text body content, form values, GraphQL variables, gRPC input, WebSocket startup text, and binary bytes are not stored. Multipart evidence keeps only field and filename metadata plus an estimated payload size.

Request evidence uses a separate 16,000-byte per-attempt and 500,000-byte per-report UTF-8 budget. URL content is capped at 4,000 bytes; up to 64 configured headers use the same 256-byte name and 2,048-byte value limits as response snapshots.

Header and query-parameter names matching authorization, cookie, token, secret, password, passphrase, or API-key patterns have their values replaced with `[redacted]`. This is a bounded safeguard, not a secret detector: arbitrary custom names, URL paths, non-redacted headers, field names, and filenames may still be sensitive. Configured header evidence also does not claim every cookie or advanced-auth header that a transport adds later. Reports remain device-local unless explicitly exported.

## Desktop exports

Open **Test → Collection runner** and run a collection. Once a saved report exists for the selected collection, use **Export JSON** or **Export JUnit** in the header to download that collection's latest report. Downloads are generated locally; they do not upload the report or require an account.

JSON is a versioned envelope with `format: "brunomnia-run-report"`, `version: 1`, and the complete saved report, including retained response snapshots. JUnit creates one `testcase` per request attempt without embedding response content. Script assertion/status failures become `failure` elements, while runner or transport exceptions become `error` elements. Retry attempts are not collapsed.

## Iteration data

Upload JSON arrays or CSV files up to 5 MB, 1,000 iterations, and 100 variables. The picker exposes the pinned 41-label inventory, detects UTF-8 and UTF-16/32 byte-order marks, and decodes every real listed encoding portably through explicit UTF-32, ASCII, Latin-1, EUC-CN, KOI8-RU, and KOI8-T handling plus the active WebView's standard decoders. The listed ISO-8859-12 encoding was never standardized and produces the same explicit unsupported result as the pinned backend's codec check.

The exact selected bytes remain only in the open Runner document's bounded in-memory draft. Closing and reopening the data dialog can therefore change encoding without selecting the file again. Editing the raw data, removing it, or closing the Runner document discards those bytes; Brunomnia does not persist or reuse an unrestricted filesystem path.

## Run via CLI

Use **Run via CLI** in a collection or folder Runner to preview a POSIX-shell command for the current environment, selected request order, iterations, retries, pre-send delay, data file, and bail setting. Values are shell-quoted rather than concatenated into executable syntax. The Tauri app resolves its saved device-local project JSON automatically; connected folder and Git project directories are also valid CLI inputs because the CLI reads their `.brunomnia/project.yaml` metadata and managed split YAML resources.

Browser-local projects have no filesystem path, so export all workspace data as Brunomnia JSON and enter the downloaded path. Browser file inputs likewise do not reveal a durable data-file path; when the Runner contains iteration data, save the decoded data as UTF-8 JSON/CSV and enter its path before copying. The copy action stays disabled while either required path is unresolved.

Repeated `--request`/`-i` flags preserve the previewed order and omit unchecked requests. `--delay-request`/`--delay` uses the same bounded 0–30,000 ms delay before every desktop Runner attempt; `--iterations`/`-n`, `--data`/`-d`, and `--env`/`-e` have matching short aliases. Duplicate request names are rejected as ambiguous, so generated commands use stable request IDs. CLI script, file, script-network, template-file, and external-vault authorities remain separate explicit `--allow-*` grants and are never added silently by the preview.

## CLI reporters

`run test` defaults to the readable `spec` reporter. `run collection` retains JSON as its default for automation. Select an explicit format with `--reporter` (or `-r`):

```sh
node bin/brunomnia.cjs run test workspace.json "Contract suite" --allow-scripts --reporter tap
node bin/brunomnia.cjs run test workspace.json api-spec-id --allow-scripts --bail --reporter junit --output report.xml
node bin/brunomnia.cjs run collection workspace.json "Collection" --reporter json --output report.json
```

Supported names are `dot`, `list`, `min`, `progress`, `spec`, and `tap`, matching the names in the current Inso `run test` reference, plus machine-readable `json` and `junit`. `--output`/`-o` writes the selected artifact to a file; without it, the report goes to standard output. A failed attempt still makes the process exit non-zero regardless of reporter or destination.

For `run collection`, `--bail` stops subsequent requests and iterations only after the current request exhausts its configured retries. For `run test`, it stops subsequent standalone tests after the current test exhausts its retries. Without it, the runner records the complete plan.

## Test-name filtering

`run test` accepts the current Inso-compatible `-t` / `--testNamePattern <regex>` option (and `--test-name-pattern` as a Brunomnia convenience alias):

```bash
node bin/brunomnia.cjs run test workspace.json "Contract suite" --allow-scripts -t '^Status is (?:200|201)$'
```

The regex is compiled and length-checked before any saved request executes. An invalid regex or a pattern longer than 1,000 characters exits non-zero without running the suite. Matching is case-sensitive JavaScript regex behavior, consistent with the documented regex contract.

`run test` filters persistent standalone test names before their scripts execute. A zero-match run reports `0 passed, 0 failed, 0 total, 0 matched tests`. Filtered JSON reports store `testNamePattern` and `matchedTests`; text summaries include the matched count.

The identifier selects one suite by exact name or full/prefix ID. A linked API-specification name or full/prefix ID selects every collection-owned suite in sort-key order. Each test executes as one async assertion and may call default or ID-targeted `insomnia.send()` within the owning collection while sharing inherited environments, cookies, response chaining, and explicit CLI trust grants.

The text reporters provide compatible roles and stable plain text, not byte-identical Mocha formatting. JSON and JUnit are Brunomnia portability formats and do not claim to be upstream Inso formats.

# Runner reports and CI

Brunomnia keeps the latest 30 collection-run reports in device-local workspace storage. A report records every attempt in order, including iteration and retry numbers, request status, duration, script assertion results, runner errors, cancellation state, and aggregate pass/fail counts.

## Request plan

The desktop runner lists the selected collection's requests before execution. Clear a checkbox to omit a request. Drag rows to reorder them, or use each row's labeled up/down buttons for the same operation without dragging. The plan is transient runner state and does not reorder or remove requests in the collection itself. Newly created requests enter the plan enabled; removed requests are discarded.

Enable **Stop after first exhausted failure** to bail once a request has used all configured retry attempts and still fails. A failure that succeeds on retry does not bail. Manual cancellation and bail remain distinct report states.

## Response snapshots

Select a result row with the pointer, Enter, or Space to open its response snapshot. Successful attempts show status text, duration, original response size, retained headers, and a text body preview. Failed attempts that never received a response show the runner or transport error instead.

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

## CLI reporters

`run test` defaults to the readable `spec` reporter. `run collection` retains JSON as its default for automation. Select an explicit format with `--reporter` (or `-r`):

```sh
node bin/brunomnia.cjs run test workspace.json "Collection" --reporter tap
node bin/brunomnia.cjs run test workspace.json "Collection" --bail --reporter junit --output report.xml
node bin/brunomnia.cjs run collection workspace.json "Collection" --reporter json --output report.json
```

Supported names are `dot`, `list`, `min`, `progress`, `spec`, and `tap`, matching the names in the current Inso `run test` reference, plus machine-readable `json` and `junit`. `--output`/`-o` writes the selected artifact to a file; without it, the report goes to standard output. A failed attempt still makes the process exit non-zero regardless of reporter or destination.

`--bail` stops subsequent requests and iterations only after the current request exhausts its configured retries. Without it, the runner records the complete plan.

The text reporters provide compatible roles and stable plain text, not byte-identical Mocha formatting. JSON and JUnit are Brunomnia portability formats and do not claim to be upstream Inso formats.

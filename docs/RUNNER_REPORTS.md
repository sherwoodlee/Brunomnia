# Runner reports and CI

Brunomnia keeps the latest 30 collection-run reports in device-local workspace storage. A report records every attempt in order, including iteration and retry numbers, request status, duration, script assertion results, runner errors, cancellation state, and aggregate pass/fail counts. The History table follows pinned Insomnia by deriving Total, Passed, Failed, Skipped, and its success/failure icon from retained assertions rather than request attempts; a transport failure with no assertion therefore contributes no History test count. Row dates use the fixed local `yyyy-MM-dd HH:mm:ss` format across visible text, tooltips, and delete labels. Source and Iterations have bounded pointer- and keyboard-resizable column separators; widths remain presentation-only state for the open Runner. Deleting one exact entry requires a second click on its armed warning within two seconds. New reports store the sum of completed response durations, including response-bearing retry attempts while excluding pre-send delay, script time, cancellation, skips, and pre-response failures. Legacy reports without that field retain their prior wall-clock fallback. Duration display uses strict `> 1,000 ms` seconds and `> 60,000 ms` minutes thresholds with zero, one, or two decimal places based on magnitude, while the raw millisecond value remains available as a tooltip.

## Request plan

The desktop runner lists the selected collection's requests before execution. **Select All** selects every request when selection is empty or partial; **Unselect All** clears a complete selection, and the toolbar shows selected/total state. Each row exposes a drag handle, its HTTP/custom method, complete parent-folder breadcrumb, and request name. Selecting the name promotes the current Runner document and opens that request without discarding the Runner draft. Clear a checkbox to omit a request. Dragging an included request moves the complete selected set as one order-preserving block before or after the drop target; dragging an excluded request moves only that row. Each row's labeled up/down buttons retain the accessible single-row equivalent. The plan is transient runner state and does not reorder or remove requests in the collection itself. Newly created requests enter the plan enabled; removed requests are discarded.

While execution is active, collection, environment, selection, row navigation, drag/drop, keyboard-equivalent up/down controls, iterations, retries, bail, log retention, delay, stream window, raw iteration data, and data upload/view controls are disabled. This freezes the visible execution contract instead of allowing edits that cannot affect the already-started run. Results Skip and Cancel all remain available through their dedicated live controls.

Run and Run via CLI stay disabled when the plan has no selected requests. Iterations, retries, delay, and stream-window inputs keep their visible editing draft separate from the last valid execution value: clearing a field, typing an invalid value, or moving outside its documented bounds does not silently replace the runnable value. Leaving the field restores that last valid value. Applying uploaded iteration data updates both the runnable iteration count and its visible draft.

The configured **Send request** shortcut starts the open Runner from anywhere in its document, including while a control has focus. It follows the same active-run and selected-request guards as the Run button, ignores key-repeat events, and appears in both the Run button tooltip and initial Results guidance using the current device-local shortcut preference.

Enabling **Use vertical layout** in Preferences stacks Runner configuration above Results on wide screens as well as narrow ones. With the preference off, Runner keeps its side-by-side desktop layout and still falls back to the same stacked presentation at the responsive breakpoint.

On wide layouts, drag the separator between configuration and Results to resize the first pane from 35% through 90%. The separator is focusable: the axis-matching arrow keys move 2%, Shift+Arrow moves 10%, and Home/End select the limits. Forced vertical layout uses the same bounded control on the vertical axis; the automatic narrow-screen stack removes the horizontal splitter.

Enable **Stop after first exhausted failure** to bail once a request has used all configured retry attempts and still fails. A failure that succeeds on retry does not bail. Manual cancellation and bail remain distinct report states.

The optional 0–30,000 ms delay runs after an item becomes active but before each transport attempt, including the first request and retries. Skip or Cancel during that wait prevents the transport from starting; Brunomnia does not add a trailing delay after the final attempt.

While a run is active, Results remains the controlled active pane and shows `Running finished / total requests (skipped skipped, canceled canceled)` plus a **Cancel all** action; a prior History or Console choice returns after settlement. Finished excludes skipped and canceled items exactly as pinned Insomnia does. Assertion filters stay out of live mode. Manual cancellation remains on the live cards after execution settles, changes the summary to `Finished`, expands completed/failed evidence, and keeps canceled/skipped cards visible; starting another run, changing collections, or opening a saved History row exits that canceled-run view. Starting a run also clears the prior run before new live items arrive, so an older saved report never flashes as current progress.

Active cards resolve the configured request URL before transport begins and refresh it after pre-request scripts apply their final request/local/iteration variables. Slow in-flight requests therefore show the same rendered target they are executing instead of raw `{{ template }}` text. Authorization, cookie, token, secret, password, passphrase, and API-key query values use the existing `[redacted]` safeguard; a response-provided effective URL replaces the prepared URL when available.

## Response snapshots

Results are grouped by iteration into one card per request attempt. Cards stay collapsed while a run is active, then completed and failed cards remount expanded when the run finishes; each saved historical attempt also starts expanded. Use the labeled chevron control to collapse or reopen an individual card without hiding any other attempt. Status tags use the response message or standard HTTP reason, fall back to `ERROR` when a completed/failed item has neither, and apply success/warning/error tones by status-code family. Expanded cards format nonnegative response time and size with the pinned rounded `ms - bytes/kilobytes/megabytes/gigabytes` contract. Expanded successful attempts also show retained headers and a text body preview. Failed attempts that never received a response show the runner or transport error instead.

Each expanded attempt card lists every retained script assertion before the request and response snapshots. Each row shows PASS, FAIL, or SKIP; the assertion name and recorded error; its Pre-request Test, After-response Test, or Unknown category; and measured callback execution time using the pinned `< 0.1 ms`/one-decimal display. Attempts without assertions, failed assertions without retained error text, and legacy assertions without timing have explicit states. `insomnia.test.skip(name, callback)` records SKIP without invoking the callback or failing an otherwise successful request. The list works for active, latest, and reopened historical results because it reads the saved attempt evidence directly.

The Results toolbar leaves every request-attempt card visible and filters only the assertion rows inside every expanded card, matching pinned Runner request cards. All, Passed, Failed, and Skipped use the retained assertion status. The name field uses pinned `fuzzysort` 1.9.0 behavior against the assertion name only, including its `-8000` garbage-match floor; request identity, URL, response status, and error text do not masquerade as assertion-name matches. Filters apply equally to active, latest, and reopened historical results without changing cards, aggregate counters, saved reports, Console evidence, or exports. The direct response Tests pane uses the same controls and matcher.

The Results tab always shows `passed / total` retained assertions. It stays neutral at `0 / 0`, turns successful only when every retained assertion passed, and uses the failed treatment when any assertion failed or was skipped, matching the pinned tab badge. This differs from History's row icon, which fails only for an actual failed assertion. Completed latest and selected historical runs also show their pinned-formatted total duration with raw milliseconds available as a tooltip; active and manually canceled live mode does not reuse an older report's duration.

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

Use **Run via CLI** in a collection or folder Runner to preview a POSIX-shell command for the current global and collection environments, selected request order, iterations, retries, pre-send delay, data file, and bail setting. Values are shell-quoted rather than concatenated into executable syntax. Generated commands use pinned `--workingDir <path>` input shape. The Tauri app resolves its saved device-local project JSON automatically; connected folder and Git project directories are also valid CLI inputs because the CLI reads their `.brunomnia/project.yaml` metadata and managed split YAML resources.

Browser-local projects have no filesystem path, so export all workspace data as Brunomnia JSON and enter the downloaded path. Browser file inputs likewise do not reveal a durable data-file path; when the Runner contains iteration data, save the decoded data as UTF-8 JSON/CSV and enter its path before copying. The copy action stays disabled while either required path is unresolved.

Repeated pinned `--item`/`-i` flags preserve the previewed order and omit unchecked requests. `--delay-request`/`--delay` uses the same bounded 0–30,000 ms delay before every desktop Runner attempt; `--iteration-count`/`-n`, `--iteration-data`/`-d`, `--bail`/`-b`, `--globals`/`-g`, and `--env`/`-e` match pinned spellings. Generated commands use `--globals` for the active workspace global environment and add `--env` only for an active collection sub-environment. The earlier `--request`, `--iterations`, and `--data` forms remain compatible aliases. Duplicate request names are rejected as ambiguous, so generated commands use stable request IDs. CLI script, file, script-network, template-file, and external-vault authorities remain separate explicit `--allow-*` grants and are never added silently by the preview.

For direct CLI use, `--globals` accepts a workspace global environment ID/name or a local environment file. Files are capped at 20 MB and support bounded Brunomnia environment resources/lists, pinned Insomnia v4 exports, and Insomnia v5 environment documents; the first environment is selected, matching pinned Inso. `--env` separately selects a collection sub-environment by ID/name. Missing selectors fail before transport instead of silently falling back to another scope.

Both `-w` and `--workingDir` may appear before or after the run identifier, matching pinned global-option behavior; `--working-dir` is an additional alias. The legacy Brunomnia form with workspace path followed by identifier remains accepted for existing automation.

`--config <path>` loads an explicit bounded `.insorc`, `.insorc.json`, `.insorc.yaml`, `.insorc.yml`, or `package.json` `inso` property. Without it, the CLI searches upward from the explicit working directory or current directory. The supported pinned global options are `workingDir`, `ci`, `verbose`, and `printOptions`; CLI flags take precedence, `ci` supplies the first collection/suite when the identifier is omitted, and print diagnostics go to stderr so report stdout stays parseable. Unknown options are ignored. Executable JavaScript/TypeScript config formats remain disabled.

Run one of up to 100 bounded config aliases with `brunomnia script <name> [arguments...]`. Like pinned Inso, each task must start with `inso`; Brunomnia removes that token, parses single/double quotes and escapes, forwards already-tokenized extra arguments, propagates the config and explicit working directory, and returns the child command's exit code. Dispatch uses `process.execPath` with an argument array and never a shell, so command substitution, pipes, redirects, and environment expansion are inert text. Recursive aliases stop after ten nested invocations.

For direct CLI use, an `--item` value may also be a folder ID. The folder recursively expands all descendant requests in the collection's mixed resource-tree order; mixed folder/request items retain argument order, and duplicates execute once. Unknown items and folders with no matching requests fail before transport instead of producing an empty successful run.

Pinned `--requestTimeout <milliseconds>` applies to both `run collection` and `run test`. It replaces the workspace request-timeout default for primary, dependent, and saved suite sends, while a request's explicit custom timeout remains higher precedence. `0` disables the inherited deadline; negative values clamp to zero, oversized values clamp to the desktop maximum, integer prefixes match pinned `parseInt` behavior, and invalid values fail before transport. `--request-timeout` is an additional Brunomnia alias.

Pinned `--iteration-data`/`-d` accepts either a local path or an explicit HTTP(S) URL. Both inputs use the desktop Runner's 5 MB UTF-8 text bound before JSON/CSV parsing. Remote loads require a successful HTTP response, stream-cancel on overflow, and use a 30-second acquisition deadline; non-HTTP URL schemes remain local path text rather than gaining a new protocol handler. Environment overrides still merge after parsing.

## CLI reporters

`run test` defaults to the readable `spec` reporter. `run collection` retains JSON as its default for automation. Select an explicit format with `--reporter` (or `-r`):

```sh
node bin/brunomnia.cjs run test workspace.json "Contract suite" --allow-scripts --reporter tap
node bin/brunomnia.cjs run test workspace.json api-spec-id --allow-scripts --bail --reporter junit --output report.xml
node bin/brunomnia.cjs run collection workspace.json "Collection" --reporter json --output report.json
```

`run collection` accepts repeated `--env-var key=value` overrides. Values use URL-query decoding, later entries win, and overrides replace matching fields in every JSON/CSV iteration row. Without a data file, the overrides form one reusable iteration row. The flag is collection-only, matching pinned Inso.

`run collection` also accepts `-t`/`--requestNamePattern <regex>`. It filters either the full collection or the requests selected by repeated `--item`/`-i` flags, preserves selected order, and exits with an error when nothing matches. `run test` keeps the same short flag for its separate `--testNamePattern` behavior, matching pinned Inso's subject-specific command surface.

Supported names are `dot`, `list`, `min`, `progress`, `spec`, and `tap`, matching the names in the current Inso `run test` reference, plus machine-readable `json` and `junit`. `--output`/`-o` writes the selected artifact to a file; without it, the report goes to standard output. A failed attempt still makes the process exit non-zero regardless of reporter or destination.

For `run collection`, `--bail`/`-b` stops subsequent requests and iterations only after the current request exhausts its configured retries. For `run test`, it stops subsequent standalone tests after the current test exhausts its retries. Without it, the runner records the complete plan.

## Test-name filtering

`run test` accepts the current Inso-compatible `-t` / `--testNamePattern <regex>` option (and `--test-name-pattern` as a Brunomnia convenience alias):

```bash
node bin/brunomnia.cjs run test workspace.json "Contract suite" --allow-scripts -t '^Status is (?:200|201)$'
```

The regex is compiled and length-checked before any saved request executes. An invalid regex or a pattern longer than 1,000 characters exits non-zero without running the suite. Matching is case-sensitive JavaScript regex behavior, consistent with the documented regex contract.

`run test` filters persistent standalone test names before their scripts execute. A zero-match run reports `0 passed, 0 failed, 0 total, 0 matched tests`. Filtered JSON reports store `testNamePattern` and `matchedTests`; text summaries include the matched count.

The identifier selects one suite by exact name or full/prefix ID. A linked API-specification name or full/prefix ID selects every collection-owned suite in sort-key order. Each test executes as one async assertion and may call default or ID-targeted `insomnia.send()` within the owning collection while sharing inherited environments, cookies, response chaining, and explicit CLI trust grants.

The text reporters provide compatible roles and stable plain text, not byte-identical Mocha formatting. JSON and JUnit are Brunomnia portability formats and do not claim to be upstream Inso formats.

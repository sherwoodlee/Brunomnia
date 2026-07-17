# Runner reports and CI

Brunomnia keeps the latest 30 collection-run reports in device-local workspace storage. A report records every attempt in order, including iteration and retry numbers, request status, duration, script assertion results, runner errors, cancellation state, and aggregate pass/fail counts.

## Desktop exports

Open **Test → Collection runner** and run a collection. Once a saved report exists for the selected collection, use **Export JSON** or **Export JUnit** in the header to download that collection's latest report. Downloads are generated locally; they do not upload the report or require an account.

JSON is a versioned envelope with `format: "brunomnia-run-report"`, `version: 1`, and the complete saved report. JUnit creates one `testcase` per request attempt. Script assertion/status failures become `failure` elements, while runner or transport exceptions become `error` elements. Retry attempts are not collapsed.

## CLI reporters

`run test` defaults to the readable `spec` reporter. `run collection` retains JSON as its default for automation. Select an explicit format with `--reporter` (or `-r`):

```sh
node bin/brunomnia.cjs run test workspace.json "Collection" --reporter tap
node bin/brunomnia.cjs run test workspace.json "Collection" --reporter junit --output report.xml
node bin/brunomnia.cjs run collection workspace.json "Collection" --reporter json --output report.json
```

Supported names are `dot`, `list`, `min`, `progress`, `spec`, and `tap`, matching the names in the current Inso `run test` reference, plus machine-readable `json` and `junit`. `--output`/`-o` writes the selected artifact to a file; without it, the report goes to standard output. A failed attempt still makes the process exit non-zero regardless of reporter or destination.

The text reporters provide compatible roles and stable plain text, not byte-identical Mocha formatting. JSON and JUnit are Brunomnia portability formats and do not claim to be upstream Inso formats.

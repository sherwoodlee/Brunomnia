# Import and export

Brunomnia converts API artifacts locally. Import/export does not require a Brunomnia account, hosted service, subscription, or premium entitlement.

## Import sources

- Choose one or more files, or choose a folder recursively. A batch accepts at most 100 supported files and 100 MB total; each file is limited to 20 MB.
- Paste text or fetch one HTTP(S) artifact URL through Brunomnia's ordinary bounded request transport.
- Enter an HTTP(S) MCP server URL to create a first-class disabled client. Embedded URL credentials are refused, imported credential/runtime fields are cleared, and the client must be reviewed before enablement.
- Supported formats are Brunomnia JSON, Insomnia v1–v5, Postman Collection 2.0/2.1, Postman environments and data-dump ZIPs, HAR 1.2, OpenAPI 3.x, Swagger 2, WSDL, and cURL.

Every successful artifact receives its own format/resource summary and conversion warnings. Multi-file imports retain successful conversions when another file fails. A full Brunomnia workspace replacement must be imported by itself.

## Postman archives

Postman data-dump ZIP import reads the archive manifest and listed collection/environment JSON files without writing archive paths to disk. Archives are limited to 20 MB compressed, 50 MB extracted JSON, and 1,000 entries. Stored and deflate entries receive CRC and declared/actual-size checks; encrypted, ZIP64, multidisk, malformed, and unsupported-compression archives fail closed.

## Export scopes

- **All workspace data** exports the complete supported local project scope.
- **Selected collection** can export every request or an explicit subset. Ancestor folders, mixed resource order, and matching or unbound standalone tests are retained; unrelated request references are removed.
- **Selected API design** exports the design and its compatible generated collection context where the target format supports it.

Formats are Brunomnia JSON, Insomnia v4 JSON, Insomnia v5 YAML, HAR 1.2, and raw OpenAPI. Compatibility warnings appear before download.

## Private values

Effectively private environment trees are excluded by default. A separate checkbox is required to include them, and the resulting artifact carries a warning because downloaded files can contain secrets. Runtime OAuth registration state and other device-local integration credentials remain outside compatibility exports.

## Compatibility boundaries

Insomnia v5 database-only proto references cannot carry missing database blobs. Deprecated scripts can be translated only where their operation has a safe local equivalent. External local-file paths and WSDL sample placeholders remain source metadata or warnings, and formats without binary embedding cannot preserve payload bytes. These are explicit representation boundaries; the original workspace is not silently mutated.

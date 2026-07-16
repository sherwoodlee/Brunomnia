# Insomnia feature-parity ledger

Last reconciled: **2026-07-16** against the current Kong Developer documentation for Insomnia.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Baseline | Versioned local workspace with atomic native persistence and no account requirement. Multiple projects/vault management and recovery UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Baseline | Editable collections/requests, environment templates, and the last 100 results exist. Nested resource models, environment inheritance, dynamic variables, and collected-data breadth remain. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/) |
| REST/HTTP execution | Baseline | Native request execution, headers, methods, auth subset, response body/headers/timeline, redirects, timeouts, TLS validation, proxy, and PEM identity. Cookie-jar and several transport details remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| GraphQL | Baseline | Query, variables, operation name, templating, native execution, and response inspection. Schema fetching/browsing, persisted queries, and richer GraphQL tooling remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| WebSocket | Baseline | Native text sessions with headers and ordered incoming/outgoing/system events. Binary composition, custom proxy/client identity, and runner semantics remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Server-Sent Events | Baseline | Native incremental parser covers chunking, CRLF, comments, event names, and multiline data. Long-run controls and runner semantics remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| gRPC | Baseline | Reflection, pasted proto compilation, dynamic JSON/protobuf mapping, and all four call shapes. Importable proto trees and additional metadata/schema workflows remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Request bodies | Baseline | JSON, text, URL-encoded, multipart text/files, and binary payloads work in the app; CLI supports the same finite HTTP body modes. Edge-case encoding compatibility remains. | [Collections](https://developer.konghq.com/insomnia/collections/) |
| Request authentication | Baseline | None, Basic, Bearer, and header/query API key exist. Digest, OAuth 1/2, NTLM, AWS IAM v4, Hawk, Atlassian ASAP, and Netrc are missing. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Not started | Response cookie UI is an explicit empty state. Persistent cookies, request chaining, response-derived values, and the broader dynamic-variable/template-tag system remain. | [Insomnia documentation](https://developer.konghq.com/insomnia/) |
| API specification design | Baseline | OpenAPI 3.x YAML/JSON editor, formatter, structural linter, preview, and request generation. Custom rulesets, full Spectral compatibility, and richer design tooling remain. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Baseline | Permission-bounded worker/VM execution, environment/request mutation, response helpers, console capture, tests, and focused expectations. Full Insomnia script API/module compatibility remains. | [Scripts](https://developer.konghq.com/insomnia/scripts/) |
| Collection runner and automated tests | Baseline | Ordered iterations, JSON/CSV data, retries, delay, cancellation, environment propagation, assertions, and reports. Stream-aware runs, additional reporting/export, and compatibility details remain. | [Collections and runner](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Real native loopback mock server with routes, parameters, headers, delays, CORS, and three dynamic tokens. Liquid/Faker breadth, response-to-mock generation, hosted/self-host deployment workflows, and AI generation remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/) |
| Headless CLI and CI | Baseline | Bundled CLI lints/generates/exports OpenAPI and runs HTTP/GraphQL collections/tests with shared runner logic. Inso command/flag/report breadth and signed containers remain. | [Inso CLI](https://developer.konghq.com/inso-cli/), [CLI reference](https://developer.konghq.com/inso-cli/reference/) |
| Import and export formats | Baseline | File, pasted-text, and HTTP(S) URL imports cover Insomnia v4/v5, Postman 2.0/2.1 and environments, HAR, OpenAPI 3.x, Swagger 2, WSDL, and cURL. Scoped exports cover Brunomnia JSON, Insomnia v4/v5, HAR, and raw OpenAPI. Folder flattening, script translation, external files, WSDL placeholders, Socket.IO/MCP downgrade warnings, and omitted binary bytes are explicit compatibility bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Not started | Standard repository storage, Git operations, branches, commits, pull/push, diff, history, and conflict resolution remain. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/) |
| Plugins and extension API | Not started | Permission model, installation, hooks/actions, template tags, themes, request/response contexts, and compatibility tooling remain. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/) |
| Secrets and external vaults | Not started | OS credential storage and AWS/GCP/Azure/HashiCorp secret adapters remain; current environment values are ordinary workspace data. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/) |
| Cloud sync and collaboration | Not started | Self-hostable E2EE sync, sharing, branches, cross-device versioning, presence/comments, and offline reconciliation remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| MCP clients | Not started | HTTP/STDIO connections, discovery, cached tools/prompts/resources, execution, and project serialization remain. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Not started | User-selected hosted/custom/local model configuration, mock generation, and Git commit grouping remain. These must be optional and usable without a Brunomnia subscription. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Not started | Konnect/Gateway testing and other product-specific adapters in the current documentation remain. | [Insomnia documentation](https://developer.konghq.com/insomnia/) |
| SSO, RBAC, SCIM, audit, and organization controls | Not started | Free self-hosted governance and administrative capabilities remain; local single-user use will continue to require no identity provider. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [documentation index](https://developer.konghq.com/index/insomnia/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Early baseline | Responsive keyboard-accessible core UI and a macOS Tauri app bundle exist. Full preferences/shortcut/theme compatibility, accessibility audit, updater, signing, and Windows/Linux release artifacts remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

## Milestone 3 acceptance evidence

- Shared design and generation engine: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Permission-bounded browser runtime: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Shared runner and data parser: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Native loopback server and integration test: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
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

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).

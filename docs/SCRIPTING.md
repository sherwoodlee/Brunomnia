# Permission-bounded scripting

Milestone 12 expands Brunomnia's clean-room compatibility with the current [Insomnia scripting contract](https://developer.konghq.com/insomnia/scripts/) while keeping host capabilities explicit. Every feature in this document is local and free; the controls are safety grants, not account or subscription gates.

## Runtime model

Desktop pre-request and after-response JavaScript runs in a disposable browser Worker with a configurable 1–60 second deadline. The default is 10 seconds. Direct `fetch`, XHR, WebSocket, EventSource, DOM access, IndexedDB, Cache Storage, dynamic `import()`, `eval`, nested workers, and ambient host objects are unavailable. Function-constructor paths are hardened, and only typed results or mediated secondary-request messages cross back to the app.

The runtime exposes:

- `insomnia.environment`, `baseEnvironment`, `collectionVariables`, `variables`, `localVars`, and `iterationData` with `get`, `set`, `unset`, `has`, `clear`, `toObject`, and `replaceIn`;
- `insomnia.parentFolders.get()`, `getById()`, and `getByName()`, with parent folders ordered nearest-first and mutable folder environments;
- request method, URL, header, body, authentication, proxy, and certificate mutation helpers;
- `request.url.addQueryParams()` and `getQueryString()` for ordinary or templated URLs;
- raw, URL-encoded, text-only multipart, and GraphQL `request.body.update()` modes;
- Basic, Bearer, API-key, and disabled `request.auth.update()` modes;
- response status, text/JSON, timing, headers, and response-cookie helpers;
- captured console output, `insomnia.test`, `insomnia.expect`, global `expect`, and the existing Jest/Chai-style matcher subset;
- top-level `await`; and
- selected local `require()` adapters: `assert`, `atob`, `btoa`, `chai`, lightweight `lodash`, `querystring`, `timers`, `url`, `util`, and `uuid`.

Environment changes are persisted to the selected environment without flattening inherited values. Collection and parent-folder script changes are also persisted. Runner iterations carry collection/folder mutations forward in memory. `baseEnvironment` currently aliases the resolved active environment rather than exposing a separately persisted base layer; this remains an explicit compatibility gap.

## Secondary requests

**Preferences → General → Request scripts → Allow scripts to send secondary HTTP requests** grants `insomnia.sendRequest()` on this device. It is off by default and is neither exported nor accepted from imports, Git projects, or encrypted sync.

The bridge accepts an absolute HTTP(S) URL string or a request object. It supports headers, raw/URL-encoded/text-only multipart/GraphQL bodies, Basic/Bearer/API-key auth, inline proxy configuration, and inline PEM client-certificate material. File paths and non-HTTP schemes are rejected. Each script is limited to five secondary requests, 256 KB of request description data, a 10-second per-request transport deadline, a 5 MB response passed back to the Worker, and the overall script deadline. Responses use the same status/text/JSON/header/cookie facade as after-response scripts.

Secondary requests do not run nested request scripts or plugin hooks. They can use the script's resolved environment/collection/folder/local/iteration values. They receive vault values only when the separate vault grant is enabled. Response-cookie persistence from secondary requests is not implemented yet.

## Vault access

**Expose the unlocked local vault through `insomnia.vault`** grants `insomnia.vault.get(name)` on this device. It is off by default. Only the current in-memory unlocked entries are copied into the disposable Worker, and they are excluded from script results, workspaces, logs, project files, and synchronization payloads. Locking the vault removes the values available to later runs.

The grant does not expose external-vault provider adapters. Scripts cannot enumerate local vault names through this API; a script must already know the requested key.

## CLI trust boundary

The bundled CLI uses Node's `vm` compatibility runtime, which is not a security boundary for hostile JavaScript. For that reason, workspace scripts are disabled by default. Run scripts only for a workspace you trust:

```sh
brunomnia run test workspace.json "Collection" --allow-scripts
```

Secondary script requests require both `--allow-scripts` and `--allow-script-requests`. The CLI does not expose the desktop local vault. These invocation flags are intentionally not read from workspace preference data, preventing an imported workspace from granting itself script authority.

## Remaining compatibility limits

The runtime does not yet bundle AJV, Cheerio, CryptoJS, CSV Parse, Moment, Postman Collection, TV4, XML2JS, or the complete Node built-in surface. File-backed body/certificate helpers remain editor-only. Advanced auth mutation, async test callbacks, complete Chai/Lodash behavior, separately persisted base-environment mutation, secondary response-cookie storage, and broader Postman-global compatibility remain in the [parity ledger](PARITY.md).

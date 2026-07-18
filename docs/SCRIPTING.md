# Permission-bounded scripting

Milestones 12–19 expand Brunomnia's clean-room compatibility with the current [Insomnia scripting contract](https://developer.konghq.com/insomnia/scripts/) while keeping host capabilities explicit. Every feature in this document is local and free; the controls are safety grants, not account or subscription gates.

## Runtime model

Desktop pre-request and after-response JavaScript runs in a disposable browser Worker with a configurable 1–60 second deadline. The default is 10 seconds. Direct `fetch`, XHR, WebSocket, EventSource, DOM access, IndexedDB, Cache Storage, dynamic `import()`, `eval`, nested workers, and ambient host objects are unavailable. Function-constructor paths are hardened, and only typed results or mediated secondary-request messages cross back to the app.

The runtime exposes:

- `insomnia.baseGlobals`, `globals`, `environment`, `baseEnvironment`, `CollectionVariables`, `collectionVariables`, `variables`, `localVars`, and `iterationData` with `get`, `set`, `unset`, `has`, `clear`, `toObject`, and `replaceIn`;
- generic `insomnia.variables` lookup in local → iteration → nearest folder → selected collection → collection base → selected global → global base priority, with new values written to the request-local scope;
- `insomnia.parentFolders.get(nameOrId)`, `getById()`, `getByName()`, and `getEnvironments()`, with duplicate names searched nearest-first and mutable folder environments;
- request method, URL, header, body, authentication, proxy, and certificate mutation helpers;
- `request.url.addQueryParams()` with query strings, repeated rows, or objects, plus `getQueryString()` for ordinary or templated URLs;
- raw, URL-encoded, text-only multipart, and GraphQL `request.body.update()` modes;
- Basic, Bearer, API-key, and disabled `request.auth.update()` modes, including the documented keyed-array shape and explicit second type argument;
- response status, text/JSON, timing, headers, and response-cookie helpers;
- captured console output, ordered sync/async `insomnia.test` results, `insomnia.expect`, global `expect`, and the shared `require('chai').assert` adapter described below;
- top-level `await`; and
- local `require()` adapters for every external-library and Node-module name in the current Insomnia scripts reference.

`insomnia.baseGlobals` changes persist to the root global environment, while `insomnia.globals` changes persist to the selected global sub-environment without flattening inherited enabled values. `insomnia.baseEnvironment`, `CollectionVariables`, lowercase `collectionVariables`, and `variables.collectionVars` mutate the collection base. `insomnia.environment` and `variables.environmentVars` mutate the selected collection sub-environment. When no sub-environment is selected, the selected API aliases the corresponding base store. Parent-folder changes also persist. Direct sends, runner iterations, and trusted CLI runs keep all stores separate and carry mutations forward in memory; disabled rows mask lower scopes until a script explicitly sets or unsets that name in the owning store.

## Bundled module adapters

The external-library names are `ajv`, `atob`, `btoa`, `chai`, `cheerio`, `crypto-js`, `csv-parse`, `lodash`, `moment`, `postman-collection`, `tv4`, `uuid`, and `xml2js`. The Node-module names are `assert`, `buffer`, `events`, `path`, `querystring`, `punycode`, `stream`, `string-decoder`, `timers`, `url`, and `util`. Compatibility aliases for the synchronous CSV parser are also available.

Desktop and trusted CLI scripts use the same self-contained adapter factory. It provides common local operations: a bounded JSON Schema subset through AJV/TV4-style APIs; quoted/column CSV parsing; SHA-256 plus CryptoJS WordArray and Hex/UTF-8/Base64 encoders; basic tag, ID, class, attribute, and descendant HTML selection; basic XML object parsing/building; common Moment parsing/format/add/subtract/diff operations; core Postman collection model classes; common Lodash collection/object/case helpers; and finite Buffer, EventEmitter, POSIX path, query-string, stream, string-decoder, URL, timer, util, UUID, and Punycode helpers. Inputs handled by these adapters are capped at 5 MB where text expansion or parsing is involved.

These are clean-room compatibility adapters, not copies of the npm packages. They do not claim every package version, option, locale, parser edge case, cryptographic primitive, JSON Schema draft feature, DOM method, stream behavior, or Postman SDK interface. Unknown modules remain denied and scripts cannot load packages from disk or the network.

## Chai assertion compatibility

`require('chai').assert` comes from the same self-contained module factory in desktop Workers and the trusted CLI. Every public method name currently listed in Chai's [`assert` API](https://www.chaijs.com/api/assert/) resolves through the Milestone 17 adapter. The covered families include equality and deep equality; truth, null, `NaN`, existence, and defined checks; JavaScript types, finite numbers, arrays, and instances; ordinary, nested, own, and deep inclusion; regular-expression matching; ordinary, nested, and deep properties; length and size; ordinary/deep/all/any key sets; numeric operators and approximation; ordinary/deep/ordered member sets; getter/property changes, increases, and decreases; thrown-error and no-throw checks; and extensible, sealed, frozen, and empty object state.

Milestone 18 supplies `insomnia.expect`, global `expect`, and `require('chai').expect` from one separate self-contained chain factory. Every language chain, modifier, assertion name, and documented alias currently listed in Chai's [`expect`/BDD API](https://www.chaijs.com/api/bdd/) resolves. This includes negated/deep/nested/own/ordered/any/all flags; value/type/state getters; inclusion, equality, numeric/date, property/descriptor, length, matching, key, throw, response, predicate, approximate, member, one-of, mutation/`by`, and object-state assertions; custom messages; and `expect.fail`. Existing Postman/Jest-style `toBe`, `toEqual`, `toContain`, `toBeTruthy`, `toBeLessThan`, and `toBeGreaterThan` compatibility remains available.

These adapters do not load Chai plugins, expose `should`, support assertion overwrite/extension hooks, or claim Chai's exact error metadata and every overloaded semantic nuance. Deep comparison is intended for ordinary script data and remains bounded rather than reproducing Chai's complete treatment of exotic prototypes, non-enumerable/symbol identity, accessors, and cyclic graphs. Nested-path escaping, duplicate-member handling, negated mutation chains, and unusual thrown values are likewise compatibility baselines rather than package-internal equivalence.

## File-backed bodies and certificates

Desktop file reads require two device-local choices under **Preferences → General → Request scripts**: add one absolute root per line to **Allowed data folders**, then enable **Allow scripts to attach local body and certificate files**. Together they grant the documented `insomnia.request.body.update()` and `insomnia.sendRequest()` file modes plus PEM certificate source paths. Both controls are off/empty by default, available only in the Tauri desktop app, omitted from folder/Git projects and encrypted revisions, and reset on workspace import.

Before reading bytes, the Rust host canonicalizes the requested file and every existing directory root. The file must remain under at least one canonical root, so `..` traversal and symlinks resolving outside the root are rejected. Empty, missing, or non-directory roots do not grant access. Brunomnia does not automatically allow the OS temporary or application-data directories, and this grant is read-only; unlike current Insomnia's broader data-folder description, script file writes are not implemented.

Supported body inputs are:

- `{ mode: 'file', file: '/path/to/payload.bin' }` for a binary primary-request body; and
- `{ mode: 'formdata', formdata: [{ key: 'upload', type: 'file', value: '/path/to/payload.csv' }] }` for multipart file parts, including optional `fileName` and `contentType` overrides.

`insomnia.request.certificate.update()` accepts `cert: { src: '/path/to/client.crt' }` and `key: { src: '/path/to/client.key' }`, or the `certPath`/`keyPath` aliases. Certificate files must be UTF-8 PEM text. For primary requests, the Rust host reads files after the disposable Worker finishes. For secondary requests, the host reads only while fulfilling that one mediated request. The Worker receives no filesystem function or file contents in either path. Paths can use ordinary `{{ variable }}` substitution. Reads are limited to 5 MB per regular file, 20 files, and 20 MB across all primary and secondary attachments in one script execution. PFX/PKCS#12 sources remain unsupported by the current native PEM transport.

## Secondary requests

**Preferences → General → Request scripts → Allow scripts to send secondary HTTP requests** grants `insomnia.sendRequest()` on this device. It is off by default and is neither exported nor accepted from imports, Git projects, or encrypted sync.

The bridge accepts an HTTP(S) URL, a bare hostname that defaults to HTTPS, or a request object. It supports headers, raw/URL-encoded/GraphQL bodies, text-and-file multipart bodies, binary `file` bodies, Basic/Bearer/API-key auth, inline proxy configuration, and inline or permission-bounded PEM client-certificate material. File-backed inputs additionally require the separate file grant; non-HTTP schemes remain rejected. Each script is limited to five secondary requests, 256 KB of request description data, a 10-second per-request transport deadline, a 5 MB response passed back to the Worker, and the overall script deadline. Responses use the same `status`/`code`/text/JSON/header/cookie facade as after-response scripts.

Secondary requests do not run nested request scripts or plugin hooks. They can use the script's resolved global/collection/folder/local/iteration values and receive vault values only when the separate vault grant is enabled. Their responses are retained for request chaining, and their `Set-Cookie` values enter the same request/runner cookie state before later secondary or primary requests.

## Vault access

**Expose the unlocked local vault through `insomnia.vault`** grants `insomnia.vault.get(name)` on this device. It is off by default. Only the current in-memory unlocked entries are copied into the disposable Worker, and they are excluded from script results, workspaces, logs, project files, and synchronization payloads. Locking the vault removes the values available to later runs.

The grant does not expose external-vault provider adapters. Scripts cannot enumerate local vault names through this API; a script must already know the requested key.

## CLI trust boundary

The bundled CLI uses Node's `vm` compatibility runtime, which is not a security boundary for hostile JavaScript. For that reason, workspace scripts are disabled by default. Run scripts only for a workspace you trust:

```sh
brunomnia run test workspace.json "Collection" --allow-scripts
```

Local attachments additionally require `--allow-script-files`; secondary script requests require `--allow-script-requests`. A file-backed secondary request therefore requires all three flags, including `--allow-scripts`. The trusted CLI does not consume the desktop allowed-folder list or expose the desktop local vault. These invocation flags are intentionally not read from workspace preference data, preventing an imported workspace from granting itself script authority.

## Remaining compatibility limits

Every module name currently documented by Insomnia is available, but full npm-package behavioral equivalence remains open. In particular, exact Chai internals, complete Lodash behavior, arbitrary/local-reference JSON Schema behavior, the full Cheerio/XML parsers, additional CryptoJS algorithms, Moment locales/time zones, complete Node built-in semantics, and the complete Postman Collection SDK are not claimed. PFX, external-vault scripts, and stronger portable CLI isolation remain in the [parity ledger](PARITY.md). The official scripts reference says deprecated Postman interfaces are not supported by Insomnia, so they are not treated as an upstream parity requirement.

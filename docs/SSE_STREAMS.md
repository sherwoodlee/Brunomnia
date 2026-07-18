# Server-Sent Events streams

Brunomnia runs Event Stream requests through its native Rust transport. An active response has no total request-duration deadline. Initial and reconnect handshakes use the effective inherited/custom request timeout when it is positive; `0` leaves response-header establishment without a deadline.

## Reconnect settings

Select an SSE request and use the reconnect section below the URL and headers:

- **Reconnect automatically** retries after a remote close or read/connection error.
- **Reconnect delay** accepts 100–60,000 milliseconds and defaults to 1,000.
- **Reconnect limit** accepts 0–1,000 attempts. Zero keeps retrying until **Disconnect** is selected.
- **Respect server `retry:`** lets a valid numeric SSE retry field replace the local delay, clamped to the same range.
- **Resume with `Last-Event-ID`** retains the most recent valid event ID and adds it to later reconnect requests. Empty IDs clear the stored value; IDs containing a null character are ignored.

These settings are saved with the request. Existing and imported requests receive the safe defaults above, with automatic reconnect, server retry hints, and event-ID resume enabled.

## Session behavior

The event log keeps incoming named events and system records in order. System records distinguish the initial open, scheduled reconnect attempt, successful reopen, transport error, and final close. Selecting **Disconnect** cancels an active read, a pending delay, or an in-progress reconnect.

The browser development build provides deterministic sample events only. Persistent reconnect execution requires the Tauri desktop build.

## Current boundary

Parser and policy tests cover chunk boundaries, CRLF frames, comments, multiline data, event IDs, retry hints, and bounded/unlimited reconnect decisions. The repository's sandbox cannot bind a loopback test listener, so no live forced-disconnect fixture is claimed. Event search/export, streaming plugin hooks, and reconnect-aware collection-run sampling remain in the [parity ledger](PARITY.md).

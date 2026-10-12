# Message Contracts

All cross-context messages are untrusted input. TypeScript types describe them; hand-written runtime guards in `src/messaging/validate.ts` enforce them.

## Envelopes

```ts
type ExtensionMessage =
  | { type: 'SESSION_START'; sessionId: string } // camera host → SW
  | { type: 'SESSION_END'; sessionId: string } // camera host → SW
  | {
      type: 'CONTROL_STATE_CHANGED';
      sessionId: string;
      enabled: boolean;
      targetTabId: number | null;
    }
  | {
      type: 'EXECUTE_COMMAND';
      sessionId: string;
      commandId: string;
      targetTabId: number;
      command: BrowserCommand;
      issuedAt: number;
    }
  | { type: 'COMMAND_RESULT'; sessionId: string; commandId: string; result: CommandResult }
  | {
      type: 'TARGET_CHANGED';
      targetTabId: number | null;
      reason: 'closed' | 'navigated' | 'unsupported' | 'user';
    };
```

`sessionId` is a random UUID (`crypto.randomUUID()`) created by the camera host on each Start Control. `commandId` correlates results and latency measurements.

## Flow

```mermaid
sequenceDiagram
  participant H as Camera host
  participant SW as Service worker
  participant CS as YouTube content script
  H->>SW: EXECUTE_COMMAND {sessionId, targetTabId, command}
  SW->>SW: validate shape, sender, session, enabled, target
  alt valid
    SW->>CS: chrome.tabs.sendMessage(targetTabId, command)
    CS->>CS: validate again, execute via YouTubeAdapter
    CS-->>SW: CommandResult
  else invalid
    SW-->>H: COMMAND_RESULT {ok:false, reason}
  end
  SW-->>H: COMMAND_RESULT
```

Routing through the service worker keeps session validation in one place. **[To verify in spike]** if the extra hop materially affects P95 latency, the camera host may call `chrome.tabs.sendMessage` directly; the content script's own validation remains mandatory either way.

## Validation rules

Service worker, before forwarding:

1. Message matches a known `type` and exact shape; unknown fields rejected.
2. `sender.id === chrome.runtime.id` and sender URL is the camera host page.
3. `sessionId` equals the active session in `chrome.storage.session`; control is enabled.
4. `targetTabId` equals the stored target tab; tab still exists and its URL matches `https://www.youtube.com/watch*`.
5. `command.type` is allowlisted; `deltaSeconds ∈ {-10, 10}`.

Content script, before executing:

1. Message came from the extension (`sender.id === chrome.runtime.id`, no `sender.tab`).
2. Same shape and allowlist checks.
3. Never reads instructions from the page DOM, `window.postMessage`, or page scripts.

## Prohibited

- Messages carrying JavaScript, CSS selectors, URLs to fetch, or free-form instructions.
- `externally_connectable` or any listener for web-page-originated messages.
- Sending camera frames or landmarks outside the camera host (landmarks may go to a worker in the same context).
- Silent failure: every `EXECUTE_COMMAND` receives exactly one `COMMAND_RESULT`.

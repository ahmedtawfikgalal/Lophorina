# ADR-005: Permissions, message security, and build

Status: Accepted (manifest finalized after ADR-001 spike)

## Permissions

| Permission                                        | Decision                      | Reason                                                                                                                        |
| ------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                         | Yes                           | Settings (`local`) and session state (`session`)                                                                              |
| `host_permissions: ["https://www.youtube.com/*"]` | Yes                           | Static content script; reliable across SPA navigation                                                                         |
| `sidePanel`                                       | If ADR-001 selects Side Panel | Camera host                                                                                                                   |
| `offscreen`                                       | If ADR-001 selects offscreen  | Camera host                                                                                                                   |
| `activeTab`                                       | **No**                        | Grants access to the tab where the action was clicked, not durably to the controlled tab; fragile with a separate camera host |
| `tabs`                                            | No                            | Host permission already exposes YouTube tab URLs; revisit only if needed                                                      |
| `scripting`                                       | No                            | Content script is declared statically                                                                                         |
| `webRequest`, `cookies`, `history`, `<all_urls>`  | No                            | No requirement                                                                                                                |

Camera access is requested by the camera host via `getUserMedia` after a user action.

## Illustrative manifest (Side Panel variant)

```json
{
  "manifest_version": 3,
  "name": "Lophorina",
  "version": "0.1.0",
  "minimum_chrome_version": "116",
  "permissions": ["storage", "sidePanel"],
  "host_permissions": ["https://www.youtube.com/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "side_panel": { "default_path": "control-panel.html" },
  "action": { "default_title": "Open Lophorina" },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["youtube-content.js"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "toggle-control": {
      "suggested_key": { "default": "Alt+Shift+G" },
      "description": "Start / stop gesture control"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self'"
  }
}
```

The content script matches all of `youtube.com` (SPA navigation into `/watch` does not reload the page); the adapter itself enforces the `/watch` restriction.

## Messaging

Specified in [../message-contracts.md](../message-contracts.md): runtime validation at every boundary, sender and session checks, strict command allowlist, explicit results.

## Build

1. Vite with explicit entries: camera host page, service worker, content script (content script built as a classic script/IIFE).
2. MediaPipe WASM and model copied into `dist/` and referenced by extension-local URLs.
3. No remotely hosted code; production build loaded unpacked and tested every week, not only in Week 6.
4. TypeScript strict mode, ESLint, Prettier, Vitest.

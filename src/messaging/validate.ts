import {
  COMMAND_FAILURES,
  type BrowserCommand,
  type CommandResult,
  type ExtensionMessage,
  type SpikeMessage,
  type YouTubeProbeResult,
} from './contracts';

// Hand-written runtime guards. Messages with unknown fields are rejected so that
// nothing unexpected can ride along a valid-looking envelope.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const hasExactKeys = (o: Obj, required: readonly string[], optional: readonly string[] = []) => {
  const keys = Object.keys(o);
  return (
    required.every((k) => k in o) && keys.every((k) => required.includes(k) || optional.includes(k))
  );
};

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 128;
const isTabId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isBrowserCommand(v: unknown): v is BrowserCommand {
  if (!isObj(v)) return false;
  switch (v.type) {
    case 'MEDIA_TOGGLE':
      return hasExactKeys(v, ['type']);
    case 'MEDIA_SEEK':
      return (
        hasExactKeys(v, ['type', 'deltaSeconds']) &&
        (v.deltaSeconds === -10 || v.deltaSeconds === 10)
      );
    default:
      return false;
  }
}

export function isCommandResult(v: unknown): v is CommandResult {
  if (!isObj(v)) return false;
  if (v.ok === true) {
    return (
      hasExactKeys(v, ['ok'], ['state', 'currentTime']) &&
      (v.state === undefined || v.state === 'playing' || v.state === 'paused') &&
      (v.currentTime === undefined || isFiniteNumber(v.currentTime))
    );
  }
  if (v.ok === false) {
    return (
      hasExactKeys(v, ['ok', 'reason']) &&
      (COMMAND_FAILURES as readonly unknown[]).includes(v.reason)
    );
  }
  return false;
}

export function isExtensionMessage(v: unknown): v is ExtensionMessage {
  if (!isObj(v)) return false;
  switch (v.type) {
    case 'SESSION_START':
    case 'SESSION_END':
      return hasExactKeys(v, ['type', 'sessionId']) && isNonEmptyString(v.sessionId);
    case 'CONTROL_STATE_CHANGED':
      return (
        hasExactKeys(v, ['type', 'sessionId', 'enabled', 'targetTabId']) &&
        isNonEmptyString(v.sessionId) &&
        typeof v.enabled === 'boolean' &&
        (v.targetTabId === null || isTabId(v.targetTabId))
      );
    case 'EXECUTE_COMMAND':
      return (
        hasExactKeys(v, ['type', 'sessionId', 'commandId', 'targetTabId', 'command', 'issuedAt']) &&
        isNonEmptyString(v.sessionId) &&
        isNonEmptyString(v.commandId) &&
        isTabId(v.targetTabId) &&
        isBrowserCommand(v.command) &&
        isFiniteNumber(v.issuedAt)
      );
    case 'COMMAND_RESULT':
      return (
        hasExactKeys(v, ['type', 'sessionId', 'commandId', 'result']) &&
        isNonEmptyString(v.sessionId) &&
        isNonEmptyString(v.commandId) &&
        isCommandResult(v.result)
      );
    case 'TARGET_CHANGED':
      return (
        hasExactKeys(v, ['type', 'targetTabId', 'reason']) &&
        (v.targetTabId === null || isTabId(v.targetTabId)) &&
        ['closed', 'navigated', 'unsupported', 'user'].includes(v.reason as string)
      );
    default:
      return false;
  }
}

export function isSpikeMessage(v: unknown): v is SpikeMessage {
  return (
    isObj(v) &&
    (v.type === 'SPIKE_TOGGLE_CONTROL' || v.type === 'YT_PROBE') &&
    hasExactKeys(v, ['type'])
  );
}

export function isYouTubeProbeResult(v: unknown): v is YouTubeProbeResult {
  return (
    isObj(v) &&
    v.type === 'YT_PROBE_RESULT' &&
    hasExactKeys(v, ['type', 'onWatchPage', 'hasMainVideo', 'paused', 'adShowing']) &&
    typeof v.onWatchPage === 'boolean' &&
    typeof v.hasMainVideo === 'boolean' &&
    (v.paused === null || typeof v.paused === 'boolean') &&
    typeof v.adShowing === 'boolean'
  );
}

/** True when a message was sent by this extension's own pages/workers (not a content script). */
export function isFromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.tab === undefined;
}

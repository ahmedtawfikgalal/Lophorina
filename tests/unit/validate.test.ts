import { describe, expect, it } from 'vitest';
import {
  isBrowserCommand,
  isCommandResult,
  isExtensionMessage,
  isSpikeMessage,
  isYouTubeProbeResult,
} from '../../src/messaging/validate';

const execute = {
  type: 'EXECUTE_COMMAND',
  sessionId: 's-1',
  commandId: 'c-1',
  targetTabId: 42,
  command: { type: 'MEDIA_SEEK', deltaSeconds: 10 },
  issuedAt: 123.4,
};

describe('isBrowserCommand', () => {
  it('accepts the allowlisted commands', () => {
    expect(isBrowserCommand({ type: 'MEDIA_TOGGLE' })).toBe(true);
    expect(isBrowserCommand({ type: 'MEDIA_SEEK', deltaSeconds: -10 })).toBe(true);
    expect(isBrowserCommand({ type: 'MEDIA_SEEK', deltaSeconds: 10 })).toBe(true);
  });

  it('rejects unbounded seeks, unknown commands and extra fields', () => {
    expect(isBrowserCommand({ type: 'MEDIA_SEEK', deltaSeconds: 30 })).toBe(false);
    expect(isBrowserCommand({ type: 'MEDIA_SEEK', deltaSeconds: '10' })).toBe(false);
    expect(isBrowserCommand({ type: 'MEDIA_SEEK' })).toBe(false);
    expect(isBrowserCommand({ type: 'PRESENTATION_NEXT' })).toBe(false);
    expect(isBrowserCommand({ type: 'MEDIA_TOGGLE', selector: '#x' })).toBe(false);
    expect(isBrowserCommand(null)).toBe(false);
    expect(isBrowserCommand([])).toBe(false);
  });
});

describe('isCommandResult', () => {
  it('accepts success and known failures', () => {
    expect(isCommandResult({ ok: true })).toBe(true);
    expect(isCommandResult({ ok: true, state: 'paused', currentTime: 12 })).toBe(true);
    expect(isCommandResult({ ok: false, reason: 'NO_VIDEO' })).toBe(true);
  });

  it('rejects unknown reasons and malformed results', () => {
    expect(isCommandResult({ ok: false, reason: 'whatever' })).toBe(false);
    expect(isCommandResult({ ok: true, state: 'stopped' })).toBe(false);
    expect(isCommandResult({ ok: true, currentTime: Number.NaN })).toBe(false);
    expect(isCommandResult({ ok: 'yes' })).toBe(false);
  });
});

describe('isExtensionMessage', () => {
  it('accepts a well-formed EXECUTE_COMMAND', () => {
    expect(isExtensionMessage(execute)).toBe(true);
  });

  it('rejects EXECUTE_COMMAND with bad parts', () => {
    expect(isExtensionMessage({ ...execute, targetTabId: -1 })).toBe(false);
    expect(isExtensionMessage({ ...execute, targetTabId: 1.5 })).toBe(false);
    expect(isExtensionMessage({ ...execute, sessionId: '' })).toBe(false);
    expect(isExtensionMessage({ ...execute, command: { type: 'EVAL', code: 'x' } })).toBe(false);
    expect(isExtensionMessage({ ...execute, extra: true })).toBe(false);
    const { issuedAt, ...missing } = execute;
    expect(isExtensionMessage(missing)).toBe(false);
  });

  it('validates the remaining envelopes', () => {
    expect(isExtensionMessage({ type: 'SESSION_START', sessionId: 'a' })).toBe(true);
    expect(isExtensionMessage({ type: 'SESSION_END', sessionId: 'a' })).toBe(true);
    expect(
      isExtensionMessage({
        type: 'CONTROL_STATE_CHANGED',
        sessionId: 'a',
        enabled: true,
        targetTabId: null,
      }),
    ).toBe(true);
    expect(
      isExtensionMessage({
        type: 'COMMAND_RESULT',
        sessionId: 'a',
        commandId: 'c',
        result: { ok: false, reason: 'STALE_SESSION' },
      }),
    ).toBe(true);
    expect(isExtensionMessage({ type: 'TARGET_CHANGED', targetTabId: 3, reason: 'closed' })).toBe(
      true,
    );
    expect(isExtensionMessage({ type: 'TARGET_CHANGED', targetTabId: 3, reason: 'hacked' })).toBe(
      false,
    );
    expect(isExtensionMessage({ type: 'UNKNOWN' })).toBe(false);
  });
});

describe('spike messages', () => {
  it('accepts only exact spike envelopes', () => {
    expect(isSpikeMessage({ type: 'YT_PROBE' })).toBe(true);
    expect(isSpikeMessage({ type: 'SPIKE_TOGGLE_CONTROL' })).toBe(true);
    expect(isSpikeMessage({ type: 'YT_PROBE', run: 'alert(1)' })).toBe(false);
  });

  it('validates probe results', () => {
    const ok = {
      type: 'YT_PROBE_RESULT',
      onWatchPage: true,
      hasMainVideo: true,
      paused: null,
      adShowing: false,
    };
    expect(isYouTubeProbeResult(ok)).toBe(true);
    expect(isYouTubeProbeResult({ ...ok, paused: 'no' })).toBe(false);
  });
});

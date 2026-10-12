// Message contracts — see docs/architecture/message-contracts.md.
// Types describe messages; validate.ts enforces them at runtime.

export type BrowserCommand =
  { type: 'MEDIA_TOGGLE' } | { type: 'MEDIA_SEEK'; deltaSeconds: -10 | 10 };

export const COMMAND_FAILURES = [
  'NO_VIDEO',
  'UNSUPPORTED_PAGE',
  'AD_PLAYING',
  'PLAY_REJECTED',
  'STALE_SESSION',
  'TARGET_MISMATCH',
  'CONTROL_DISABLED',
  'INVALID_MESSAGE',
] as const;
export type CommandFailure = (typeof COMMAND_FAILURES)[number];

export type CommandResult =
  | { ok: true; state?: 'playing' | 'paused'; currentTime?: number }
  | { ok: false; reason: CommandFailure };

export type TargetChangeReason = 'closed' | 'navigated' | 'unsupported' | 'user';

/** Production message set (Week 4+). Defined now so module boundaries are fixed early. */
export type ExtensionMessage =
  | { type: 'SESSION_START'; sessionId: string }
  | { type: 'SESSION_END'; sessionId: string }
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
  | { type: 'TARGET_CHANGED'; targetTabId: number | null; reason: TargetChangeReason };

/** Week 1 spike messages. Read-only probes; no command execution. */
export type SpikeMessage = { type: 'SPIKE_TOGGLE_CONTROL' } | { type: 'YT_PROBE' };

export type YouTubeProbeResult = {
  type: 'YT_PROBE_RESULT';
  onWatchPage: boolean;
  hasMainVideo: boolean;
  paused: boolean | null;
  adShowing: boolean;
};

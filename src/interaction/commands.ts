import type { BrowserCommand, CommandFailure, CommandResult } from '../messaging/contracts';
import type { Pose } from './gesture-engine';

/** Gesture → command mapping (ADR-006). */
export function commandFor(pose: Pose): BrowserCommand {
  switch (pose) {
    case 'OPEN_PALM':
      return { type: 'MEDIA_TOGGLE' };
    case 'THUMB_UP':
      return { type: 'MEDIA_SEEK', deltaSeconds: 10 };
    case 'THUMB_DOWN':
      return { type: 'MEDIA_SEEK', deltaSeconds: -10 };
  }
}

export function commandLabel(command: BrowserCommand): string {
  if (command.type === 'MEDIA_TOGGLE') return 'Play/Pause';
  return command.deltaSeconds > 0 ? 'Seek +10 s' : 'Seek −10 s';
}

const FAILURE_TEXT: Record<CommandFailure, string> = {
  NO_VIDEO: 'No video found on this tab.',
  UNSUPPORTED_PAGE: 'Open a YouTube video (a watch page) to control it.',
  AD_PLAYING: 'Can’t seek while an ad is playing.',
  PLAY_REJECTED: 'Chrome blocked playback. Click the video once, then try again.',
  STALE_SESSION: 'Control was restarted. Try again.',
  TARGET_MISMATCH: 'The YouTube tab changed. Try again.',
  CONTROL_DISABLED: 'Control is off.',
  INVALID_MESSAGE: 'The YouTube tab did not respond. Reload it and try again.',
};

/** Short, user-facing outcome, e.g. "Video paused" or the reason it failed. */
export function describeResult(command: BrowserCommand, result: CommandResult): string {
  if (!result.ok) return FAILURE_TEXT[result.reason];
  if (command.type === 'MEDIA_TOGGLE')
    return result.state === 'paused' ? 'Video paused' : 'Playing';
  return command.deltaSeconds > 0 ? '+10 s' : '−10 s';
}

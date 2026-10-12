// Executes allowlisted commands on the YouTube watch page (ADR-004). DOM access is passed in,
// so the rules are unit-testable without a browser.
import type { BrowserCommand, CommandResult } from '../../messaging/contracts';

export type MediaElement = Pick<
  HTMLVideoElement,
  'paused' | 'currentTime' | 'duration' | 'pause'
> & {
  play(): Promise<void>;
};

export type YouTubePage = {
  pathname: string;
  /** The main player's video, not hover previews or the miniplayer. */
  mainVideo(): MediaElement | null;
  adShowing(): boolean;
};

const MAIN_VIDEO_SELECTORS = ['#movie_player video.html5-main-video', '#movie_player video'];

export function domPage(doc: Document, loc: Location): YouTubePage {
  return {
    pathname: loc.pathname,
    mainVideo() {
      for (const selector of MAIN_VIDEO_SELECTORS) {
        const el = doc.querySelector(selector);
        if (el instanceof HTMLVideoElement) return el;
      }
      return null;
    },
    adShowing: () => doc.querySelector('#movie_player.ad-showing') !== null,
  };
}

export async function execute(command: BrowserCommand, page: YouTubePage): Promise<CommandResult> {
  // YouTube keeps #movie_player in the page after leaving a video (Week 1, S10), so the page
  // type is checked on every command, not just whether a video exists.
  if (page.pathname !== '/watch') return { ok: false, reason: 'UNSUPPORTED_PAGE' };
  const video = page.mainVideo(); // re-resolved each time: YouTube replaces it on navigation
  if (!video) return { ok: false, reason: 'NO_VIDEO' };

  if (command.type === 'MEDIA_TOGGLE') {
    if (!video.paused) {
      video.pause();
      return { ok: true, state: 'paused', currentTime: video.currentTime };
    }
    try {
      await video.play();
    } catch {
      return { ok: false, reason: 'PLAY_REJECTED' };
    }
    return { ok: true, state: 'playing', currentTime: video.currentTime };
  }

  if (page.adShowing()) return { ok: false, reason: 'AD_PLAYING' };
  const end = Number.isFinite(video.duration) ? video.duration : Infinity;
  video.currentTime = Math.min(end, Math.max(0, video.currentTime + command.deltaSeconds));
  return {
    ok: true,
    state: video.paused ? 'paused' : 'playing',
    currentTime: video.currentTime,
  };
}

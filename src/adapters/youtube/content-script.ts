// YouTube content script — Week 1 spike: read-only probe used to confirm the content-script
// build and messaging path. Command execution (ADR-004) arrives in Week 4.
import type { YouTubeProbeResult } from '../../messaging/contracts';
import { isSpikeMessage } from '../../messaging/validate';

const MAIN_VIDEO_SELECTORS = ['#movie_player video.html5-main-video', '#movie_player video'];

function findMainVideo(): HTMLVideoElement | null {
  for (const selector of MAIN_VIDEO_SELECTORS) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLVideoElement) return el;
  }
  return null;
}

function probe(): YouTubeProbeResult {
  const video = findMainVideo();
  return {
    type: 'YT_PROBE_RESULT',
    onWatchPage: location.pathname === '/watch',
    hasMainVideo: video !== null,
    paused: video ? video.paused : null,
    adShowing: document.querySelector('#movie_player.ad-showing') !== null,
  };
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Only this extension's own pages may talk to the adapter; nothing from the page itself.
  if (sender.id !== chrome.runtime.id || sender.tab !== undefined) return;
  if (!isSpikeMessage(message) || message.type !== 'YT_PROBE') return;
  sendResponse(probe());
});

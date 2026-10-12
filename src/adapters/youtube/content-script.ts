// YouTube content script: answers read-only probes and executes validated commands (ADR-004).
import type { CommandResult, YouTubeProbeResult } from '../../messaging/contracts';
import { isExtensionMessage, isSpikeMessage } from '../../messaging/validate';
import { domPage, execute } from './youtube-adapter';

function probe(): YouTubeProbeResult {
  const page = domPage(document, location);
  const video = page.mainVideo();
  return {
    type: 'YT_PROBE_RESULT',
    onWatchPage: page.pathname === '/watch',
    hasMainVideo: video !== null,
    paused: video ? video.paused : null,
    adShowing: page.adShowing(),
  };
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Only this extension's own pages may talk to the adapter; nothing from the page itself.
  if (sender.id !== chrome.runtime.id || sender.tab !== undefined) return;

  if (isSpikeMessage(message) && message.type === 'YT_PROBE') {
    sendResponse(probe());
    return;
  }
  if (isExtensionMessage(message) && message.type === 'EXECUTE_COMMAND') {
    void execute(message.command, domPage(document, location)).then((result: CommandResult) =>
      sendResponse(result),
    );
    return true; // keeps the channel open for the async response
  }
  // A command that fails validation still gets exactly one result (message-contracts.md).
  if ((message as { type?: unknown } | null)?.type === 'EXECUTE_COMMAND') {
    const invalid: CommandResult = { ok: false, reason: 'INVALID_MESSAGE' };
    sendResponse(invalid);
  }
});

// Tracks whether a YouTube tab is the focused tab, so spike metrics can show recognition
// continuing while YouTube is in the foreground (AC-8). Read-only.
import type { SpikeMessage, YouTubeProbeResult } from '../../messaging/contracts';
import { isYouTubeProbeResult } from '../../messaging/validate';

export type YouTubeTarget = {
  focused: boolean;
  tabId: number | null;
  title: string | null;
  probe: YouTubeProbeResult | null;
};

const isYouTubeUrl = (url?: string) => !!url && /^https:\/\/www\.youtube\.com\//.test(url);

async function probeTab(tabId: number): Promise<YouTubeProbeResult | null> {
  const message: SpikeMessage = { type: 'YT_PROBE' };
  try {
    const res: unknown = await chrome.tabs.sendMessage(tabId, message);
    return isYouTubeProbeResult(res) ? res : null;
  } catch {
    // Content script not injected yet (e.g. tab opened before the extension was loaded).
    return null;
  }
}

async function currentTarget(): Promise<YouTubeTarget> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  // tab.url is only visible for hosts we have permission for, i.e. YouTube.
  if (!tab?.id || !isYouTubeUrl(tab.url)) {
    return { focused: false, tabId: null, title: null, probe: null };
  }
  return { focused: true, tabId: tab.id, title: tab.title ?? null, probe: await probeTab(tab.id) };
}

/** Calls `onChange` on every relevant tab/window change and every 5 s. Returns a disposer. */
export function watchYouTubeTarget(onChange: (t: YouTubeTarget) => void): () => void {
  let disposed = false;
  const refresh = () => {
    void currentTarget().then((t) => {
      if (!disposed) onChange(t);
    });
  };
  const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
    if (info.status === 'complete' || info.url !== undefined || info.title !== undefined) refresh();
  };

  chrome.tabs.onActivated.addListener(refresh);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.windows.onFocusChanged.addListener(refresh);
  const timer = setInterval(refresh, 5_000);
  refresh();

  return () => {
    disposed = true;
    chrome.tabs.onActivated.removeListener(refresh);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.windows.onFocusChanged.removeListener(refresh);
    clearInterval(timer);
  };
}

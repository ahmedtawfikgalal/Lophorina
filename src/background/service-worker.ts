// MV3 service worker: browser events and routing only. Never owns the camera, and never
// restarts it — a restart of this worker must not reactivate control (ADR-001).
import type { SpikeMessage } from '../messaging/contracts';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-control') return;
  const message: SpikeMessage = { type: 'SPIKE_TOGGLE_CONTROL' };
  // Reaches the Side Panel only if it is open; otherwise there is nothing to toggle.
  chrome.runtime.sendMessage(message).catch(() => undefined);
});

import type { GestureObservation } from '../recognition/types';
import type { SessionView } from './camera-session';

type Versions = { tasksVision?: string; model?: string; modelSha256?: string };

async function loadVersions(): Promise<Versions> {
  try {
    return (await (
      await fetch(chrome.runtime.getURL('mediapipe/versions.json'))
    ).json()) as Versions;
  } catch {
    return {};
  }
}

function environment() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: nav.userAgent,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemoryGb: nav.deviceMemory ?? null,
    extensionVersion: chrome.runtime.getManifest().version,
  };
}

/** Session evidence for the Week 1 gate. Contains metrics only — never frames or landmarks. */
export async function buildSpikeReport(view: SessionView) {
  return {
    kind: 'lophorina-spike-report',
    createdAt: new Date().toISOString(),
    environment: environment(),
    versions: await loadVersions(),
    settings: view.settings,
    lifecycle: view.lifecycle,
    lastStopLatencyMs: view.lastStopLatencyMs,
    trackSettings: view.trackSettings,
    metrics: view.metrics,
    events: view.events,
    // Filled in by the tester: lighting, distance, laptop model, webcam.
    notes: '',
  };
}

/** Labeled landmark recording for replay tests (docs/testing/test-plan.md). Spike builds only. */
export async function buildRecording(observations: GestureObservation[], label: string) {
  return {
    kind: 'lophorina-landmark-recording',
    createdAt: new Date().toISOString(),
    label,
    environment: environment(),
    versions: await loadVersions(),
    expectedIntents: [] as string[],
    observations,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

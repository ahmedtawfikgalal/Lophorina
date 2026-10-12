/** Owns the MediaStream. Knows nothing about gestures. */
export class CameraManager {
  private stream: MediaStream | null = null;

  async start(): Promise<MediaStream> {
    if (this.stream) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    });
    return this.stream;
  }

  /** Stops every track. Returns how long it took until all tracks reported "ended". */
  stop(): number {
    const t0 = performance.now();
    this.stream?.getTracks().forEach((t) => t.stop());
    const ended = this.stream?.getTracks().every((t) => t.readyState === 'ended') ?? true;
    this.stream = null;
    return ended ? performance.now() - t0 : Number.NaN;
  }

  get active(): boolean {
    return this.stream?.active ?? false;
  }
}

export type PermissionProbe = PermissionState | 'unsupported';

export async function cameraPermissionState(): Promise<PermissionProbe> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

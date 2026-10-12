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

/** Reports the camera permission now and on every change (e.g. granted in the permission tab). */
export async function watchCameraPermission(
  onChange: (state: PermissionProbe) => void,
): Promise<void> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    onChange(status.state);
    status.addEventListener('change', () => onChange(status.state));
  } catch {
    onChange('unsupported');
  }
}

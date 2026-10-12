import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { toObservation, type Delegate, type GestureObservation } from './types';

export type RecognizerConfig = {
  /** Extension-local base URL of public/mediapipe/, e.g. chrome-extension://<id>/mediapipe/ */
  assetBase: string;
  delegate: Delegate;
};

/**
 * Thin wrapper around MediaPipe's GestureRecognizer. Loads wasm and model only from
 * bundled extension assets (ADR-002) and emits normalized observations.
 */
export class LocalGestureRecognizer {
  private constructor(private readonly recognizer: GestureRecognizer) {}

  static async create({ assetBase, delegate }: RecognizerConfig): Promise<LocalGestureRecognizer> {
    const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
    const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`, false);
    const recognizer = await GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/gesture_recognizer.task`, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    return new LocalGestureRecognizer(recognizer);
  }

  /** `timestamp` must be monotonically increasing milliseconds. */
  recognize(frame: TexImageSource, timestamp: number): GestureObservation {
    return toObservation(this.recognizer.recognizeForVideo(frame, timestamp), timestamp);
  }

  close(): void {
    this.recognizer.close();
  }
}

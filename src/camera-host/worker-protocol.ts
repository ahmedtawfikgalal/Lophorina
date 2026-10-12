import type { Delegate, GestureObservation } from '../recognition/types';

export type WorkerInbound = {
  type: 'init';
  assetBase: string;
  delegate: Delegate;
  targetFps: number;
  source:
    | { kind: 'readable'; readable: ReadableStream<VideoFrame> }
    | { kind: 'track'; track: MediaStreamTrack };
};

export type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'observation'; observation: GestureObservation; inferenceMs: number; frames: number }
  | { type: 'error'; message: string };

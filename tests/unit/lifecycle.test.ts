import { describe, expect, it } from 'vitest';
import {
  cameraIsOn,
  commandsPermitted,
  transition,
  type LifecycleState,
} from '../../src/camera-host/lifecycle';

const ALL: LifecycleState[] = [
  'OFF',
  'REQUESTING_PERMISSION',
  'INITIALIZING',
  'READY',
  'TRACKING',
  'ERROR',
];

describe('camera lifecycle', () => {
  it('follows the happy path', () => {
    let s: LifecycleState = 'OFF';
    for (const e of ['START', 'PERMISSION_GRANTED', 'INIT_SUCCEEDED', 'ARM'] as const) {
      s = transition(s, e) ?? s;
    }
    expect(s).toBe('TRACKING');
  });

  it('allows Stop from every active state', () => {
    for (const s of ALL.filter((x) => x !== 'OFF')) expect(transition(s, 'STOP')).toBe('OFF');
  });

  it('only starts the camera from OFF via an explicit START', () => {
    expect(transition('OFF', 'PERMISSION_GRANTED')).toBeNull();
    expect(transition('OFF', 'INIT_SUCCEEDED')).toBeNull();
    expect(transition('OFF', 'ARM')).toBeNull();
    expect(transition('OFF', 'RETRY')).toBeNull();
  });

  it('cannot arm without a ready camera and model', () => {
    expect(transition('INITIALIZING', 'ARM')).toBeNull();
    expect(transition('ERROR', 'ARM')).toBeNull();
  });

  it('recovers from errors only through an explicit retry', () => {
    expect(transition('ERROR', 'RETRY')).toBe('REQUESTING_PERMISSION');
    expect(transition('ERROR', 'INIT_SUCCEEDED')).toBeNull();
  });

  it('permits commands only while tracking', () => {
    expect(ALL.filter(commandsPermitted)).toEqual(['TRACKING']);
    expect(ALL.filter(cameraIsOn)).toEqual(['INITIALIZING', 'READY', 'TRACKING']);
  });
});

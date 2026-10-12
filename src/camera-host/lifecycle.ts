// Camera lifecycle state machine — docs/architecture/execution-contexts.md.

export type LifecycleState =
  'OFF' | 'REQUESTING_PERMISSION' | 'INITIALIZING' | 'READY' | 'TRACKING' | 'ERROR';

export type LifecycleEvent =
  | 'START'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'INIT_SUCCEEDED'
  | 'INIT_FAILED'
  | 'ARM'
  | 'DISARM'
  | 'FAILURE'
  | 'RETRY'
  | 'STOP';

const TRANSITIONS: Record<LifecycleState, Partial<Record<LifecycleEvent, LifecycleState>>> = {
  OFF: { START: 'REQUESTING_PERMISSION' },
  REQUESTING_PERMISSION: {
    PERMISSION_GRANTED: 'INITIALIZING',
    PERMISSION_DENIED: 'ERROR',
    STOP: 'OFF',
  },
  INITIALIZING: { INIT_SUCCEEDED: 'READY', INIT_FAILED: 'ERROR', STOP: 'OFF' },
  READY: { ARM: 'TRACKING', FAILURE: 'ERROR', STOP: 'OFF' },
  TRACKING: { DISARM: 'READY', FAILURE: 'ERROR', STOP: 'OFF' },
  ERROR: { RETRY: 'REQUESTING_PERMISSION', STOP: 'OFF' },
};

/** Returns the next state, or null if the event is not allowed in the current state. */
export function transition(state: LifecycleState, event: LifecycleEvent): LifecycleState | null {
  return TRANSITIONS[state][event] ?? null;
}

export const cameraIsOn = (s: LifecycleState) =>
  s === 'INITIALIZING' || s === 'READY' || s === 'TRACKING';
export const commandsPermitted = (s: LifecycleState) => s === 'TRACKING';

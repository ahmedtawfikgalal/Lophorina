import { describe, expect, it } from 'vitest';
import {
  execute,
  type MediaElement,
  type YouTubePage,
} from '../../src/adapters/youtube/youtube-adapter';

function video(init: Partial<MediaElement> & { rejectPlay?: boolean } = {}) {
  const v = {
    paused: true,
    currentTime: 50,
    duration: 100,
    pause() {
      v.paused = true;
    },
    async play() {
      if (init.rejectPlay) throw new DOMException('blocked', 'NotAllowedError');
      v.paused = false;
    },
    ...init,
  };
  return v;
}

function page(v: MediaElement | null, opts: { pathname?: string; ad?: boolean } = {}): YouTubePage {
  return { pathname: opts.pathname ?? '/watch', mainVideo: () => v, adShowing: () => !!opts.ad };
}

const toggle = { type: 'MEDIA_TOGGLE' } as const;
const fwd = { type: 'MEDIA_SEEK', deltaSeconds: 10 } as const;
const back = { type: 'MEDIA_SEEK', deltaSeconds: -10 } as const;

describe('YouTube adapter', () => {
  it('toggles playback both ways', async () => {
    const v = video({ paused: true });
    expect(await execute(toggle, page(v))).toMatchObject({ ok: true, state: 'playing' });
    expect(await execute(toggle, page(v))).toMatchObject({ ok: true, state: 'paused' });
  });

  it('seeks and clamps to the video bounds', async () => {
    const v = video({ currentTime: 95, duration: 100 });
    expect(await execute(fwd, page(v))).toMatchObject({ ok: true, currentTime: 100 });
    v.currentTime = 4;
    expect(await execute(back, page(v))).toMatchObject({ ok: true, currentTime: 0 });
  });

  it('seeks forward on a stream with unknown duration', async () => {
    const v = video({ currentTime: 30, duration: Infinity });
    expect(await execute(fwd, page(v))).toMatchObject({ currentTime: 40 });
  });

  it('only acts on watch pages, even if a player is still in the page', async () => {
    const v = video();
    expect(await execute(toggle, page(v, { pathname: '/' }))).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_PAGE',
    });
    expect(v.paused).toBe(true);
  });

  it('reports a missing video, a blocked play(), and seeking during ads', async () => {
    expect(await execute(toggle, page(null))).toEqual({ ok: false, reason: 'NO_VIDEO' });
    expect(await execute(toggle, page(video({ rejectPlay: true })))).toEqual({
      ok: false,
      reason: 'PLAY_REJECTED',
    });
    const v = video({ currentTime: 20 });
    expect(await execute(fwd, page(v, { ad: true }))).toEqual({ ok: false, reason: 'AD_PLAYING' });
    expect(v.currentTime).toBe(20);
    // Play/Pause is still allowed during an ad.
    expect(await execute(toggle, page(v, { ad: true }))).toMatchObject({ ok: true });
  });
});

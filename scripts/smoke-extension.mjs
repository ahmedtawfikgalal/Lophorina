// Automated smoke test for the Week 1 spike: loads dist/ as an unpacked extension in
// Chromium with a fake camera, starts each frame-loop strategy, and checks that the model
// loads under the extension CSP and produces observations. Not a substitute for the manual
// Side Panel / real-webcam tests in docs/delivery/week-1-spike.md.
//
// Usage: npm run build && node scripts/smoke-extension.mjs [--seconds=10] [--long]
//   --long  also waits past MediaPipe's 60 s logging flush to confirm the CSP blocks it.
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const seconds = Number(args.get('seconds') ?? 10);
const long = args.has('long');
const dist = resolve(import.meta.dirname, '..', 'dist');

function findChromium() {
  if (process.env.LOPHORINA_CHROMIUM) return process.env.LOPHORINA_CHROMIUM;
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  // Fall back to the newest Playwright-managed Chromium. Branded Google Chrome ignores
  // --load-extension, so it cannot be used here.
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const dirs = existsSync(cache)
    ? readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    : [];
  for (const d of dirs) {
    const p = join(cache, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error(
    'No Chromium found. Set LOPHORINA_CHROMIUM or run `npx playwright install chromium`.',
  );
}

/** Minimal watch page: the player markup the adapter looks for, fed by a canvas stream. */
const FAKE_WATCH_PAGE = `<!doctype html><title>Fake video - YouTube</title>
<div id="movie_player"><video class="html5-main-video" muted></video></div>
<script>
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 36 });
  const ctx = c.getContext('2d');
  setInterval(() => { ctx.fillStyle = '#' + Math.floor(Math.random() * 1e6); ctx.fillRect(0, 0, 64, 36); }, 50);
  const v = document.querySelector('video');
  v.srcObject = c.captureStream(15);
  v.play();
</script>`;

async function checkYouTubeAdapter(panel) {
  await context.route('https://www.youtube.com/**', (route) => {
    routed.add(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: FAKE_WATCH_PAGE });
  });
  const yt = await context.newPage();
  await yt.goto('https://www.youtube.com/watch?v=smoke');
  await yt.waitForFunction(() => !document.querySelector('video')?.paused);

  // Send real EXECUTE_COMMAND messages from the extension page, as the panel does.
  const send = (command) =>
    panel.evaluate(async (cmd) => {
      const [tab] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      return chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_COMMAND',
        sessionId: 'smoke',
        commandId: crypto.randomUUID(),
        targetTabId: tab.id,
        command: cmd,
        issuedAt: performance.now(),
      });
    }, command);

  const paused = await send({ type: 'MEDIA_TOGGLE' });
  const pausedInPage = await yt.evaluate(() => document.querySelector('video').paused);
  const playing = await send({ type: 'MEDIA_TOGGLE' });
  const rejected = await send({ type: 'MEDIA_SEEK', deltaSeconds: 30 });

  await yt.goto('https://www.youtube.com/');
  const home = await send({ type: 'MEDIA_TOGGLE' });
  await yt.close();

  const ok =
    paused?.state === 'paused' &&
    pausedInPage === true &&
    playing?.state === 'playing' &&
    rejected?.reason === 'INVALID_MESSAGE' &&
    home?.reason === 'UNSUPPORTED_PAGE';
  console.log(
    `${ok ? '✓' : '✗'} YouTube adapter: pause ${paused?.state}, play ${playing?.state}, invalid seek ${rejected?.reason}, home page ${home?.reason}`,
  );
  return ok;
}

if (!existsSync(join(dist, 'manifest.json'))) throw new Error('dist/ missing — run npm run build');

const profile = await mkdtemp(join(tmpdir(), 'lophorina-smoke-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: findChromium(),
  headless: true,
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});

const external = [];
/** URLs answered locally by context.route (the fake YouTube page), not real network. */
const routed = new Set();
const consoleErrors = [];
context.on('request', (req) => {
  const url = req.url();
  if (
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('data:') &&
    !url.startsWith('blob:')
  ) {
    external.push(url);
  }
});

let failed = false;
try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(sw.url()).host;
  console.log(`extension loaded: ${extensionId}`);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  // Same first-run flow as a real user: grant the camera once on the permission page.
  await page.goto(`chrome-extension://${extensionId}/pages/permission/index.html`);
  await page.getByRole('button', { name: 'Allow camera' }).click();
  await page.getByText('Camera access granted').waitFor({ timeout: 10_000 });
  console.log('✓ permission page granted camera access');

  await page.goto(`chrome-extension://${extensionId}/pages/control-panel/index.html`);
  await page.locator('summary', { hasText: 'Diagnostics' }).click();

  const strategies = [
    ['worker-mstp', 'Worker + MediaStreamTrackProcessor'],
    ['main-rvfc', 'Main thread + requestVideoFrameCallback'],
  ];
  for (const [i, [value, label]] of strategies.entries()) {
    await page.getByLabel('Frame loop').selectOption(value);
    await page.getByRole('button', { name: 'Start Control' }).click();
    const status = page.getByRole('status').first();
    await page.waitForFunction(
      () =>
        /Camera on|Camera error/.test(document.querySelector('[role=status]')?.textContent ?? ''),
      null,
      { timeout: 30_000 },
    );
    const statusText = (await status.textContent())?.trim();
    if (!statusText?.includes('Camera on')) {
      const alert = await page
        .getByRole('alert')
        .textContent()
        .catch(() => '');
      console.log(`✗ ${label}: ${statusText} — ${alert}`);
      failed = true;
      continue;
    }
    const runFor = long && i === 0 ? 70 : seconds;
    await page.waitForTimeout(runFor * 1000);
    const read = (term) =>
      page.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]').textContent();
    const rate = Number(await read('Observations/s'));
    const latency = await read('Inference P50 / P95');
    const stalls = await read('Stalls');
    const delegate = await read('Delegate in use');
    await page.getByRole('button', { name: 'Stop Control' }).click();
    const stop = await read('Last stop');
    const ok = rate > 0;
    failed ||= !ok;
    console.log(
      `${ok ? '✓' : '✗'} ${label} [${delegate}]: ${rate} obs/s, inference ${latency}, stalls ${stalls}, stop ${stop} (${runFor}s)`,
    );
  }

  // YouTube adapter end to end, against a local stand-in for a watch page (no network).
  failed ||= !(await checkYouTubeAdapter(page));
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}

const cspBlocked = consoleErrors.filter((e) =>
  /odml\.pa\.googleapis\.com|Content Security Policy/.test(e),
);
const otherErrors = consoleErrors.filter(
  (e) => !cspBlocked.includes(e) && !e.startsWith('INFO: Created TensorFlow Lite'),
);
console.log(`external requests: ${external.filter((u) => !routed.has(u)).join(', ') || 'none'}`);
if (cspBlocked.length) {
  console.log(`CSP blocked (expected for MediaPipe logging): ${cspBlocked.length}`);
  if (args.has('verbose')) console.log(`  ${cspBlocked.join('\n  ')}`);
}
if (otherErrors.length) console.log(`console errors:\n  ${otherErrors.join('\n  ')}`);
const network = external.filter((u) => !routed.has(u));
if (network.length) failed = true;
process.exit(failed ? 1 : 0);

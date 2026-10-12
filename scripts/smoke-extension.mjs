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
console.log(`external requests: ${external.length === 0 ? 'none' : external.join(', ')}`);
if (cspBlocked.length) {
  console.log(`CSP blocked (expected for MediaPipe logging): ${cspBlocked.length}`);
  if (args.has('verbose')) console.log(`  ${cspBlocked.join('\n  ')}`);
}
if (otherErrors.length) console.log(`console errors:\n  ${otherErrors.join('\n  ')}`);
if (external.length) failed = true;
process.exit(failed ? 1 : 0);

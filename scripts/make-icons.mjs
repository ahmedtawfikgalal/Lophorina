// Renders assets/icon.svg to the PNG sizes the manifest and the Chrome Web Store need.
// Run after changing the icon: node scripts/make-icons.mjs (needs Playwright Chromium).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'assets', 'icon.svg'), 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.LOPHORINA_CHROMIUM || undefined,
});
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({
    path: join(root, 'public', 'icons', `icon-${size}.png`),
    omitBackground: true,
  });
}
await browser.close();
console.log('icons written to public/icons/');

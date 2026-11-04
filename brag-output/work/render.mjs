// Usage: node render.mjs <stills|frames> [times...]
// stills: writes work/stills/t<time>.png for the given times
// frames: writes work/frames/f00000.png ... for 0..DURATION at FPS
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(process.env.PW_DIR + '/package.json');
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const FPS = 30, DURATION = 20;
const [mode = 'stills', ...rest] = process.argv.slice(2);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'composition.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
});
const fontOk = await page.evaluate(() => document.fonts.check('700 40px "IBM Plex Sans Thai"', 'อิ่มทัน'));
console.log('font loaded:', fontOk);

async function shot(t, file) {
  await page.evaluate((tt) => window.render(tt), t);
  await page.screenshot({ path: file, type: 'png' });
}

if (mode === 'stills') {
  const dir = join(here, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const t of rest.map(Number)) await shot(t, join(dir, `t${t.toFixed(2)}.png`));
} else {
  const dir = join(here, 'frames');
  mkdirSync(dir, { recursive: true });
  const n = FPS * DURATION;
  for (let i = 0; i < n; i++) {
    await shot(i / FPS, join(dir, `f${String(i).padStart(5, '0')}.png`));
    if (i % 60 === 0) console.log(`frame ${i}/${n}`);
  }
}
await browser.close();

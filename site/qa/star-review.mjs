import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4322';
const browser = await chromium.launch({ executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('response', response => { if(response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`); });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
try {
  for (const [name, width, height, suffix] of [['star-desktop',1440,900,''],['star-selected',1440,900,'&node=AI-BND-001'],['star-mobile',390,844,'']]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/?view=star${suffix}`);
    await page.locator('#graph-loading').waitFor({state:'hidden'});
    await page.waitForTimeout(1800);
    if (name === 'star-selected') {
      if (await page.locator('[data-node-label="BIZ-NED-001"]').isVisible()) throw new Error('Unrelated label remains visible');
      if (!await page.locator('[data-node-label="AI-BND-001"]').isVisible()) throw new Error('Selected label is hidden');
    }
    await page.screenshot({path:`qa/${name}.png`});
  }
  const paths = await page.locator('script[src]').evaluateAll(scripts => scripts.map(script => new URL(script.src).pathname));
  for (const path of paths.filter(path => path.startsWith('/_astro/'))) {
    const served = await (await page.request.get(base + path)).body();
    if (!served.equals(await readFile('dist' + path))) throw new Error(`Stale bundle: ${path}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Three screenshots captured; selection labels verified; served bundles match dist; no browser errors.');
} finally { await browser.close(); }

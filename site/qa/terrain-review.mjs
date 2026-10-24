import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4322';
const browser = await chromium.launch({executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined});
const page = await browser.newPage();
const errors=[];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {if(response.status()>=400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`)});
page.on('console', message => {if(message.type()==='error' && !message.text().includes('404')) errors.push(message.text())});
try {
  for(const [name,width,height] of [['terrain-waterfall-desktop',1440,900],['terrain-waterfall-mobile',390,844],['terrain-waterfall-tablet',1024,800],['terrain-waterfall-closeup',1440,900]]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/?view=terrain&v=waterfall-20261024`);
    await page.locator('#graph-loading').waitFor({state:'hidden'});
    await page.waitForTimeout(2500);
    if(name.endsWith('closeup')) {await page.mouse.move(760,285);await page.mouse.wheel(0,-500);await page.waitForTimeout(1500)}
    await page.screenshot({path:new URL(`./${name}.png`,import.meta.url).pathname});
  }
  const paths=await page.locator('script[src]').evaluateAll(scripts=>scripts.map(s=>new URL(s.src).pathname));
  for(const path of [...paths.filter(p=>p.startsWith('/_astro/'))]) {
    const served=await (await page.request.get(base+path)).body();
    if(!served.equals(await readFile(new URL('../dist'+path,import.meta.url))))throw new Error(`Stale resource: ${path}`);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Four terrain screenshots captured; served scripts match dist; no browser errors.');
} finally {await browser.close()}

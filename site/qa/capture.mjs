import { chromium } from '@playwright/test';
const browser=await chromium.launch({executablePath:process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`)});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error' && !message.text().includes('404')) errors.push(message.text())});
for(const [name,width,height,view,node] of [
 ['star-desktop',1440,900,'star',null],['terrain-desktop',1440,900,'terrain',null],
 ['star-selected',1440,900,'star','AI-BND-001'],['terrain-selected',1440,900,'terrain','AI-BND-001'],
 ['star-mobile',390,844,'star',null],['terrain-mobile',390,844,'terrain',null],
 ['terrain-mobile-selected',390,844,'terrain','AI-BND-001'],['terrain-tablet',1024,800,'terrain',null]
]) {
 await page.setViewportSize({width,height});
 await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4321"}/?view=${view}${node?'&node='+node:''}`);await page.locator('#graph-loading').waitFor({state:'hidden'});await page.waitForTimeout(2200);await page.screenshot({path:`qa/${name}.png`});
}
await browser.close();
if(errors.length) { console.error(errors.join('\n'));process.exitCode=1; }

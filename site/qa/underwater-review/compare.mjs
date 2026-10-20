import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('./',import.meta.url);
const asset=name=>'data:image/png;base64,'+readFileSync(new URL(name,root)).toString('base64');
const ref=asset('../concepts/terrain-marine-life-2026-10-19.png');
const before=asset('baseline-desktop.png'),after=asset('final-desktop.png');
const html=`<!doctype html><meta charset="utf-8"><title>水下场景 · 静态稿与实际页面对照</title>
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#efeee9;color:#202321;font:16px/1.6 system-ui}h1{font-size:25px;margin:0 0 8px}p{margin:0 0 18px;color:#565e59}figure{margin:0}figcaption{font-weight:600;padding:9px 0}img{display:block;width:100%;height:auto}.reference{width:900px;margin:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}</style>
<h1>水下场景 · 静态稿与实际页面对照</h1><p>上：目标静态稿。下：同为 1440 × 900 的实际页面截图；默认相机已调整，以完整展示海床。没有把静态稿用作网页背景。</p>
<figure class="reference"><img src="${ref}"><figcaption>参考静态稿</figcaption></figure>
<div class="pair"><figure><img src="${before}"><figcaption>修改前 · 835d97c</figcaption></figure><figure><img src="${after}"><figcaption>本地新版 · 未提交、未推送</figcaption></figure></div>`;
const browser=await chromium.launch({executablePath:process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined,headless:true});
try {
 const page=await browser.newPage({viewport:{width:1680,height:1200},deviceScaleFactor:1});
 await page.setContent(html);await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.screenshot({path:new URL('comparison.png',root).pathname,fullPage:true});
 // Confirm the preview serves these exact built bytes, not a stale running build.
 const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4322';
 const index=await(await fetch(base)).text();
 const scripts=[...index.matchAll(/src="(\/_astro\/[^\"]+\.js)"/g)].map(match=>match[1]);
 const matches=[];
 for(const src of scripts){const remote=Buffer.from(await(await fetch(base+src)).arrayBuffer());const local=readFileSync(new URL('../../dist'+src,root));matches.push({src,identical:remote.equals(local),sha256:createHash('sha256').update(remote).digest('hex')});}
 if(!matches.length||matches.some(item=>!item.identical))throw new Error('Preview is not serving the current build');
 writeFileSync(new URL('served-build.json',root),JSON.stringify({checkedAt:new Date().toISOString(),scripts:matches},null,2)+'\n');
 console.log(JSON.stringify({comparison:'qa/underwater-review/comparison.png',servedBuildMatches:true}));
} finally {await browser.close();}

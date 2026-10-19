import { test,expect } from '@playwright/test';

test('water moves in terrain and stays still with reduced motion',async({page})=>{
  await page.setViewportSize({width:900,height:700});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?view=terrain');
  await expect(page.locator('#graph-loading')).toBeHidden();
  const canvas=page.locator('#graph-canvas');
  // Texture decoding and GPU uploads can finish after the loading overlay.
  // Require stable frames instead of assuming a machine-dependent startup time.
  let previous=await canvas.screenshot();
  await expect.poll(async()=>{
    const current=await canvas.screenshot();
    const stable=current.equals(previous);previous=current;return stable;
  },{timeout:15000,intervals:[750]}).toBe(true);
  const still=await canvas.screenshot();
  await page.waitForTimeout(500);
  expect((await canvas.screenshot()).equals(still)).toBe(true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload();
  await expect(page.locator('#graph-loading')).toBeHidden();
  await page.waitForTimeout(4000);
  const moving=await canvas.screenshot();
  await page.waitForTimeout(500);
  expect((await canvas.screenshot()).equals(moving)).toBe(false);
});

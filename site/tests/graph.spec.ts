import { expect, test } from "@playwright/test";

test("switches views and preserves the selected competency", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#graph-loading")).toBeHidden();
  await expect(page.locator("#node-index-list button")).toHaveCount(60);

  await page.getByText("使用文本方式浏览能力", { exact: true }).click();
  await page.locator("#accessible-index").getByText("识别 AI 能力边界", { exact: true }).click();
  await expect(page.locator("#detail-title")).toHaveText("识别 AI 能力边界");
  await expect(page).toHaveURL(/node=AI-BND-001/);

  await page.getByRole("button", { name: "地形" }).click();
  await expect(page).toHaveURL(/view=terrain/);
  await expect(page.locator("#detail-title")).toHaveText("识别 AI 能力边界");
  await expect(page.locator("#node-details")).toHaveAttribute("aria-hidden", "false");
});

test("filters domains while keeping one domain enabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#graph-loading")).toBeHidden();
  const filters = page.locator("[data-domain-filter]");
  await expect(filters).toHaveCount(4);
  for (let index = 0; index < 3; index += 1) await filters.nth(index).click();
  await expect(filters.nth(3)).toHaveAttribute("aria-pressed", "true");
  await filters.nth(3).click();
  await expect(filters.nth(3)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#graph-announcer")).toContainText("至少需要保留一个能力领域");
});

test("adapts node details to a mobile bottom sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=terrain&node=AI-BND-001");
  await expect(page.locator("#graph-loading")).toBeHidden();
  const box = await page.locator("#node-details").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThan(12);
  expect(box!.width).toBeGreaterThan(360);
  expect(box!.y).toBeGreaterThan(200);
  await expect(page.getByRole("button", { name: "地形" })).toHaveAttribute("aria-pressed", "true");
});

test('detail tabs support arrow keys and retain panel state across views', async ({ page }) => {
  await page.goto('/?node=AI-BND-001');
  await expect(page.locator('#graph-loading')).toBeHidden();
  const tabs=page.getByRole('tab');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'地形',exact:true}).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
  await tabs.nth(1).focus();
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toBeFocused();
});

test('mobile selected competency stays visible above the details sheet', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?view=terrain&node=AI-BND-001');
  await expect(page.locator('#graph-loading')).toBeHidden();
  const label=page.locator('[data-node-label="AI-BND-001"]');
  await expect(label).toBeVisible();
  await expect.poll(async()=>{
    const [node,panel]=await Promise.all([label.boundingBox(),page.locator('#node-details').boundingBox()]);
    return !!node&&!!panel&&node.y+node.height<panel.y&&node.y>240;
  }).toBe(true);
});

test('each view restores its camera and touch pinch changes zoom', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#graph-loading')).toBeHidden();
  const label=page.locator('[data-node-label="AI-BND-001"]');
  const canvas=page.locator('#graph-canvas');
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.58,box.y+box.height*.7);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.58+80,box.y+box.height*.7+25,{steps:8});await page.mouse.up();
  await page.waitForTimeout(1700);
  const before=(await label.boundingBox())!;
  await page.getByRole('button',{name:'地形',exact:true}).click();
  await page.waitForTimeout(1800);
  await page.getByRole('button',{name:'星图',exact:true}).click();
  await expect.poll(async()=>Math.abs((await label.boundingBox())!.x-before.x)).toBeLessThan(3);
  const client=await page.context().newCDPSession(page);
  const x=Math.round(box.x+box.width*.6),y=Math.round(box.y+box.height*.5);
  const stable=(await label.boundingBox())!;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:0},{x:x+40,y,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-75,y,id:0},{x:x+75,y,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Math.abs((await label.boundingBox())!.x-stable.x)).toBeGreaterThan(8);
});

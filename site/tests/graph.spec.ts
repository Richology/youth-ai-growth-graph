import { expect, test } from "@playwright/test";

test("switches views and preserves the selected competency", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#graph-loading")).toBeHidden();
  await expect(page.locator("#node-index-list button")).toHaveCount(60);

  await page.getByText("使用文本方式浏览能力", { exact: true }).click();
  await page.getByText("识别 AI 能力边界", { exact: true }).click();
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

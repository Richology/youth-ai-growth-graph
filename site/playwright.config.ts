import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4321",
    browserName: "chromium",
    launchOptions: process.platform === "darwin" ? {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.CI ? {
    command: "npm run dev -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: true,
    timeout: 120_000,
  } : undefined,
});

import { defineConfig, devices } from "@playwright/test";

/** E2E against the real Go API on :8080 through the Vite dev proxy. */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "reduced-motion", use: { ...devices["Desktop Chrome"], contextOptions: { reducedMotion: "reduce" } }, grep: /landing|anonymous reader/ },
  ],
  webServer: { command: "bunx --bun vite --config vite.ms.config.ts --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: false },
});

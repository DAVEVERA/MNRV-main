import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce'
  },
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: 'http://127.0.0.1:4173/?retro=1',
    reuseExistingServer: true,
    timeout: 15_000
  }
});

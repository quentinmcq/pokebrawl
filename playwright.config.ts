import { defineConfig, devices } from '@playwright/test'

const PORT = 8788
const isCI = !!process.env.CI
const E2E_STATE_DIR = '.wrangler/e2e-state'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    // The offline cache would otherwise answer requests from an older build.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `bun scripts/e2e-server.ts ${PORT} ${E2E_STATE_DIR}`,
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})

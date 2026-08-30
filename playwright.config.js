import { execSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 8010);
const baseURL = `http://127.0.0.1:${port}/`;

function resolveChannel() {
  if (process.env.PLAYWRIGHT_CHANNEL) return process.env.PLAYWRIGHT_CHANNEL;
  try {
    const value = execSync('git config --get fiestas.playwrightChannel', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    return value || undefined;
  } catch (_) {
    return undefined;
  }
}

const channel = resolveChannel();

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'mobile', use: { ...devices['Pixel 5'], channel } }
  ],
  webServer: {
    command: `PORT=${port} npm run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});

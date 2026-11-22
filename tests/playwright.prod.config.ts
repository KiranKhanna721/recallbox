import { defineConfig } from '@playwright/test'
import { chromiumLaunchOptions } from 'deepspace/testing'

/**
 * Post-deploy verification against the live app (no local server).
 *   npx playwright test -c tests/playwright.prod.config.ts recallbox
 * Override the target with PROD_URL.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['recallbox.spec.ts', 'smoke.spec.ts'],
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.PROD_URL ?? 'https://recallbox.app.space',
    headless: true,
    launchOptions: chromiumLaunchOptions(),
  },
})

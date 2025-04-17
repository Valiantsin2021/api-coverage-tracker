// @ts-check
import { defineConfig } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    // baseURL: 'https://petstore.swagger.io/v2/',
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'chromium',
      use: { channel: 'chrome' }
    }
  ]
})

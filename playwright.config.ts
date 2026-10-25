import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5174', viewport: { width: 1280, height: 720 } },
  webServer: { command: 'npx vite web --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true },
})

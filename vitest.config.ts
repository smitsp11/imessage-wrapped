process.env.TZ = 'UTC' // the fake chat and time tests are written in UTC
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})

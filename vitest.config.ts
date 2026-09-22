import { configDefaults, defineConfig } from 'vitest/config'

// Firestore rules tests need a running emulator (see vitest.rules.config.ts /
// `npm run test:rules`) and must never be picked up by the plain unit-test run.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/rules/**'],
  },
})

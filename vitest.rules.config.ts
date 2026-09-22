import { defineConfig } from 'vitest/config'

// Run only via `npm run test:rules`, which wraps this in `firebase emulators:exec`
// so FIRESTORE_EMULATOR_HOST is set before these tests connect.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // All rules test files share one Firestore emulator project, and each
    // file's beforeEach does a project-wide clearFirestore() — running files
    // in parallel lets one file's cleanup wipe another's fixtures mid-test.
    fileParallelism: false,
  },
})

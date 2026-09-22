import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RULES_PATH = resolve(__dirname, '../../firestore.rules')

function emulatorHostPort(): { host: string; port: number } {
  const raw = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080'
  const [host, port] = raw.split(':')
  return { host, port: Number(port) }
}

/**
 * Spins up a fresh rules-test environment against the running Firestore
 * emulator (started by `firebase emulators:exec`, see package.json's
 * `test:rules` script), loaded with the project's real firestore.rules.
 */
export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const { host, port } = emulatorHostPort()
  return initializeTestEnvironment({
    projectId: 'demo-divvy',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host,
      port,
    },
  })
}

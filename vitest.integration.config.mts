import process from 'node:process';
import { defineConfig } from 'vitest/config';
import { customPool } from './tests/integration/pool.ts';

// Optional per-developer overrides (FOUNDRY_URL, FOUNDRY_WORLD, FOUNDRY_TEST_USER,
// HEADLESS, ...) — see tests/integration/README.md.
try {
	process.loadEnvFile('.env.local');
} catch {
	// .env.local is optional.
}

/**
 * Second Vitest project: integration tests against a live Foundry V14 world.
 *
 * Runs LOCALLY ONLY (needs a running Foundry instance + license) — never in CI.
 * The unit test project in vite.config.mts is untouched and remains the
 * default for `pnpm test`.
 */
export default defineConfig({
	test: {
		name: 'integration',
		include: ['tests/integration/**/*.test.ts'],
		pool: customPool,
		maxWorkers: 1,
		isolate: false,
		testTimeout: 30_000,
		hookTimeout: 120_000,
	},
});

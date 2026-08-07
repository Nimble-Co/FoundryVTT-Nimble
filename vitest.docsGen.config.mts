import { mergeConfig } from 'vitest/config';
import baseConfig from './vite.config.mts';

// Runs the docs reference generator (scripts/docs/*.gen.ts) under the same
// Foundry mock bootstrap as the test suite (tests/setup.ts). Invoked via
// `pnpm docs:generate`.
const config = mergeConfig(baseConfig, {});
config.test = {
	...config.test,
	include: ['scripts/docs/**/*.gen.ts'],
};

export default config;

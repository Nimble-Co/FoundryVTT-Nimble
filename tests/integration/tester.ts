/**
 * In-page Vitest runner, imported into the live Foundry page by the pool
 * (tests/integration/pool.ts) through the harness's Vite dev server.
 *
 * Ported from the `foundry-vtt-types` fork's runtime harness
 * (github:Fronix/foundry-vtt-types#v14.363.0, tests/tester.ts).
 *
 * Exposes `window.__foundry_vitest__` so the pool can drive test setup,
 * collection, and execution via `page.evaluate`.
 */

import { collectTests, startTests } from '@vitest/runner';
import type { SerializedConfig, WorkerGlobalState } from 'vitest';
import { VitestTestRunner } from 'vitest/runners';

let runner: Runner | undefined;

function setup(config: SerializedConfig) {
	// The snapshot environment will not be set up by a real worker, so stub it.
	config.snapshotOptions.snapshotEnvironment = {
		getVersion(): string {
			return '1';
		},

		getHeader(): string {
			return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`;
		},

		async readSnapshotFile(_filepath: string): Promise<string | null> {
			return null;
		},

		async saveSnapshotFile(_filepath: string, _snapshot: string): Promise<void> {
			// Noop, for now.
		},

		async resolvePath(filepath: string): Promise<string> {
			return filepath;
		},

		async resolveRawPath(_testPath: string, rawPath: string): Promise<string> {
			return rawPath;
		},

		async removeSnapshotFile(_filepath: string): Promise<void> {
			// Noop, for now.
		},
	};

	const state = {
		ctx: {
			pool: 'browser',
			workerId: 1,
			config,
			projectName: config.name ?? '',
			files: [],
			environment: {
				name: 'browser',
				options: null,
			},
			// This is populated before tests run.
			providedContext: {},
			invalidates: [],
		},
		config,
		environment: {
			name: 'browser',
			viteEnvironment: 'client',
			setup() {
				throw new Error('Not called in the browser');
			},
		},
		onCleanup: () => {
			// Noop, for now.
		},
		moduleExecutionInfo: new Map(),
		durations: {
			environment: 0,
			prepare: performance.now(),
		},
		providedContext: {},
	} as unknown as WorkerGlobalState;

	globalThis.__vitest_browser__ = true;
	globalThis.__vitest_worker__ = state;

	runner = new Runner(config);
}

class Runner extends VitestTestRunner {
	// Not declared on VitestTestRunner in vitest 4.0.8; newer versions (4.0.15+)
	// call it during runs, so keep it for a future vitest bump.
	trace = <T>(_name: string, attributes: Record<string, unknown> | (() => T), cb?: () => T): T => {
		return typeof attributes === 'function' ? attributes() : cb!();
	};

	override async importFile(filePath: string) {
		// `/@fs/` requires posix-style absolute paths, even on Windows.
		await import(/* @vite-ignore */ `/@fs/${filePath.replaceAll('\\', '/')}`);
	}

	override async onAfterRunSuite() {
		// Noop: the base runner reports through worker RPC that doesn't exist here.
	}
}

function getRunner() {
	if (runner == null) {
		throw new Error('Could not get runner! Setup must be run first.');
	}

	return runner;
}

window.__foundry_vitest__ = {
	setup,
	run: (context) => startTests(context.files, getRunner()),
	collect: (context) => collectTests(context.files, getRunner()),
};

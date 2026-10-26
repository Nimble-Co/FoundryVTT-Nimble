import { glob } from 'glob';
import { describe, expect, it } from 'vitest';

const TEST_FILE_GLOBS = [
	'{src,build}/**/*.{test,spec}.{ts,js,mjs}',
	'{src,build}/**/*.testHarness.svelte',
];

describe('test layout', () => {
	it('keeps every unit test and test harness in a __tests__ folder', async () => {
		const files = await glob(TEST_FILE_GLOBS, { posix: true });
		const misplaced = files.filter((file) => !file.split('/').includes('__tests__')).sort();

		expect(
			misplaced,
			`Move these files into a __tests__ folder next to the code they test. Run \`pnpm tests:relocate\` to move them and fix their imports.`,
		).toEqual([]);
	});
});

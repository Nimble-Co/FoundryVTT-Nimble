import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { compile, preprocess } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const filename = path.resolve(process.cwd(), 'src/view/chat/components/GrantedActionOffers.svelte');
const nodeRequire = createRequire(import.meta.url);
const { sveltePreprocess } = nodeRequire('svelte-preprocess') as typeof import('svelte-preprocess');

async function compileWarnings() {
	const source = readFileSync(filename, 'utf8');
	const preprocessed = await preprocess(
		source,
		sveltePreprocess({
			scss: {
				prependData: '@use "src/scss/base/functions" as *;',
			},
		}),
		{ filename },
	);

	return compile(preprocessed.code, {
		filename,
		css: 'external',
	}).warnings;
}

describe('GrantedActionOffers styles', () => {
	it('does not leave an unused CSS selector', async () => {
		const codes = (await compileWarnings()).map((warning) => warning.code);

		expect(codes).not.toContain('css_unused_selector');
	});
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const reactions = readFileSync(
	path.resolve(process.cwd(), 'src/utils/heroicActions/reactions.ts'),
	'utf8',
);

describe('the defend window module in the production bundle', () => {
	it('is imported statically from chat reactions, matching the sheet panels', () => {
		expect(reactions).not.toMatch(
			/import\s*\(\s*['"]#utils\/defend\/openDefendWindow\.js['"]\s*\)/,
		);
		expect(reactions).toMatch(
			/import\s*\{[^}]*openDefendWindowOnNewestCard[^}]*\}\s*from\s*['"]#utils\/defend\/openDefendWindow\.js['"]/,
		);
	});
});

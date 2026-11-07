import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

function findNoneReactionCosts(node: unknown, at: string, hits: string[]): void {
	if (Array.isArray(node)) {
		for (const [index, child] of node.entries()) {
			findNoneReactionCosts(child, `${at}[${index}]`, hits);
		}
		return;
	}
	if (!node || typeof node !== 'object') return;

	const record = node as Record<string, unknown>;
	if (record.isReaction === true && record.type === 'none') hits.push(at);

	for (const [key, child] of Object.entries(record)) {
		findNoneReactionCosts(child, `${at}.${key}`, hits);
	}
}

describe('reaction cost shape in packs', () => {
	it('has no pack item with isReaction true and type none', () => {
		const hits: string[] = [];

		for (const file of globSync('packs/**/*.json')) {
			const source = JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));
			findNoneReactionCosts(source, file, hits);
		}

		expect(hits).toEqual([]);
	});
});

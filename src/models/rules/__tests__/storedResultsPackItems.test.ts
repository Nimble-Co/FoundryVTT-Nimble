import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRules = (file: string) =>
	JSON.parse(readFileSync(resolve(file), 'utf8')).system.rules as Array<Record<string, unknown>>;

describe('stored result pack items', () => {
	it('Rampage keeps the amount of a hit', () => {
		const rules = readRules('packs/classFeatures/core/berserker/savage-arsenal/rampage.json');
		expect(rules).toHaveLength(1);
		expect(rules[0]).toMatchObject({ type: 'keepAmount', label: 'Rampage' });
	});
});

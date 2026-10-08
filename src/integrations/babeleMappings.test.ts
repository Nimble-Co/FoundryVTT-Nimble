import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Loads `public/lang/babele/mappings.json` and walks each declared path
 * against a representative fixture document for each Foundry document type.
 *
 * The goal is to catch silent typos like `system.descrption` — Babele would
 * happily register such a mapping and then translate nothing at runtime
 * because the path never resolves on a real document.
 */
type MappingSpec = string | { path: string; converter?: string };
type Mappings = Record<string, Record<string, MappingSpec>>;

function loadMappings(): Mappings {
	const raw = readFileSync(join(process.cwd(), 'public/lang/babele/mappings.json'), 'utf8');
	return JSON.parse(raw) as Mappings;
}

function resolvePath(doc: unknown, dottedPath: string): unknown {
	return dottedPath.split('.').reduce<unknown>((acc, key) => {
		if (acc === null || typeof acc !== 'object') return undefined;
		return (acc as Record<string, unknown>)[key];
	}, doc);
}

const itemFixture = {
	name: 'Test Item',
	system: {
		description: 'desc',
		activation: {
			cost: { details: 'cd' },
			duration: { details: 'dd' },
			targets: { restrictions: 'tr' },
		},
		rules: [{ id: 'r1', label: 'l' }],
	},
};

const actorFixture = {
	name: 'Test Actor',
	system: {
		description: 'desc',
		details: { creatureType: 'Undead' },
	},
	prototypeToken: { name: 'Token' },
	items: [{ name: 'Bite' }],
};

const rollTableFixture = {
	name: 'Test Table',
	description: 'table desc',
	results: [{ _id: 'r1', name: 'A' }],
};

const fixtures: Record<string, unknown> = {
	Item: itemFixture,
	Actor: actorFixture,
	RollTable: rollTableFixture,
};

describe('public/lang/babele/mappings.json', () => {
	const mappings = loadMappings();

	it('declares mappings for Item, Actor, and RollTable', () => {
		expect(Object.keys(mappings).sort()).toEqual(['Actor', 'Item', 'RollTable']);
	});

	for (const [docType, mapping] of Object.entries(mappings)) {
		describe(`${docType} paths`, () => {
			const fixture = fixtures[docType];
			for (const [field, spec] of Object.entries(mapping)) {
				const dottedPath = typeof spec === 'string' ? spec : spec.path;

				it(`"${field}" → "${dottedPath}" resolves on a representative document`, () => {
					expect(fixture, `no fixture defined for document type ${docType}`).toBeDefined();
					const resolved = resolvePath(fixture, dottedPath);
					expect(
						resolved,
						`mapping "${docType}.${field}" path "${dottedPath}" does not resolve on the fixture — likely a typo`,
					).not.toBeUndefined();
				});
			}
		});
	}
});

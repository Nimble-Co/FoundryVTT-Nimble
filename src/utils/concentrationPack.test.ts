import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { CONCENTRATION_PACK_FIXES } from '../migration/migrations/Migration062ConcentrationAppliesToCaster.js';

type ItemSource = {
	_id: string;
	name: string;
	system?: {
		activation?: {
			duration?: { quantity?: number; type?: string };
			effects?: { type?: string; condition?: string; children?: unknown }[];
		};
		properties?: { selected?: string[] };
	};
};

function readSources(...globs: string[]): ItemSource[] {
	return globs
		.flatMap((pattern) => globSync(pattern))
		.map((file) => JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8')));
}

function readSpellSources(): ItemSource[] {
	return readSources('packs/spells/**/*.json', 'packs/secretSpells/**/*.json');
}

function readFixedSources(): ItemSource[] {
	return readSources(
		'packs/spells/**/*.json',
		'packs/secretSpells/**/*.json',
		'packs/magicItems/**/*.json',
	);
}

function hasConcentrationNode(effects: unknown): boolean {
	if (!Array.isArray(effects)) return false;

	return effects.some(
		(effect) =>
			(effect?.type === 'condition' && effect?.condition === 'concentration') ||
			hasConcentrationNode(effect?.children),
	);
}

/** The fix table is keyed by compendium source id, whose last segment is the document id. */
const FIXES_BY_DOCUMENT_ID = new Map(
	Object.entries(CONCENTRATION_PACK_FIXES).map(([sourceId, fix]) => [
		sourceId.split('.').at(-1) as string,
		fix,
	]),
);

describe('concentration pack data', () => {
	it('leaves no concentration condition node on a spell that carries the property', () => {
		const spellsWithRedundantNodes = readSpellSources()
			.filter((spell) => spell.system?.properties?.selected?.includes('concentration'))
			.filter((spell) => hasConcentrationNode(spell.system?.activation?.effects))
			.map((spell) => spell.name);

		expect(spellsWithRedundantNodes).toEqual([]);
	});

	it('ships every item Migration062 fixes, under the id the fix is keyed by', () => {
		const shipped = readFixedSources()
			.filter((item) => FIXES_BY_DOCUMENT_ID.has(item._id))
			.map((item) => item.name)
			.sort();

		expect(shipped).toEqual([...FIXES_BY_DOCUMENT_ID.values()].map((fix) => fix.name).sort());
	});

	it('ships the durations Migration062 corrects existing copies to', () => {
		const durations = readFixedSources()
			.map((item) => [item, FIXES_BY_DOCUMENT_ID.get(item._id)] as const)
			.filter(([, fix]) => fix?.duration)
			.map(([item, fix]) => [
				fix!.name,
				{
					quantity: item.system?.activation?.duration?.quantity,
					type: item.system?.activation?.duration?.type,
				},
			]);

		expect(Object.fromEntries(durations)).toEqual(
			Object.fromEntries(
				[...FIXES_BY_DOCUMENT_ID.values()]
					.filter((fix) => fix.duration)
					.map((fix) => [fix.name, fix.duration]),
			),
		);
	});

	it('ships the concentration property Migration062 ticks on existing copies', () => {
		const missingProperty = readFixedSources()
			.filter((item) => FIXES_BY_DOCUMENT_ID.get(item._id)?.addsProperty)
			.filter((item) => !item.system?.properties?.selected?.includes('concentration'))
			.map((item) => item.name);

		expect(missingProperty).toEqual([]);
	});
});

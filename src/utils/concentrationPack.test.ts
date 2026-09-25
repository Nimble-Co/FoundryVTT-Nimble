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

/** The compendium each pack directory ships as, so a file resolves to its source id. */
const PACK_NAMES: Record<string, string> = {
	spells: 'nimble-spells',
	secretSpells: 'nimble-secret-spells',
	magicItems: 'nimble-magic-items',
};

interface PackFile {
	sourceId: string;
	item: ItemSource;
}

function readPackFiles(): PackFile[] {
	return Object.entries(PACK_NAMES).flatMap(([directory, packName]) =>
		globSync(`packs/${directory}/**/*.json`).map((file) => {
			const item = JSON.parse(
				readFileSync(path.resolve(process.cwd(), file), 'utf-8'),
			) as ItemSource;

			return { sourceId: `Compendium.nimble.${packName}.Item.${item._id}`, item };
		}),
	);
}

function readSpellSources(): ItemSource[] {
	return readPackFiles()
		.filter(({ sourceId }) => !sourceId.includes('nimble-magic-items'))
		.map(({ item }) => item);
}

function hasConcentrationNode(effects: unknown): boolean {
	if (!Array.isArray(effects)) return false;

	return effects.some(
		(effect) =>
			(effect?.type === 'condition' && effect?.condition === 'concentration') ||
			hasConcentrationNode(effect?.children),
	);
}

/** The pack files Migration062 names, resolved by full compendium source id. */
function readFixedFiles(): Array<PackFile & { fix: (typeof CONCENTRATION_PACK_FIXES)[string] }> {
	return readPackFiles()
		.map((file) => ({ ...file, fix: CONCENTRATION_PACK_FIXES[file.sourceId] }))
		.filter((file) => file.fix !== undefined);
}

describe('concentration pack data', () => {
	it('leaves no concentration condition node on a spell that carries the property', () => {
		const spellsWithRedundantNodes = readSpellSources()
			.filter((spell) => spell.system?.properties?.selected?.includes('concentration'))
			.filter((spell) => hasConcentrationNode(spell.system?.activation?.effects))
			.map((spell) => spell.name);

		expect(spellsWithRedundantNodes).toEqual([]);
	});

	it('ships every item Migration062 fixes, at the source id the fix is keyed by', () => {
		const shipped = readFixedFiles()
			.map(({ item }) => item.name)
			.sort();

		expect(shipped).toEqual(
			Object.values(CONCENTRATION_PACK_FIXES)
				.map((fix) => fix.name)
				.sort(),
		);
	});

	it('ships the durations Migration062 corrects existing copies to', () => {
		const durations = readFixedFiles()
			.filter(({ fix }) => fix.duration)
			.map(({ item, fix }) => [
				fix.name,
				{
					quantity: item.system?.activation?.duration?.quantity,
					type: item.system?.activation?.duration?.type,
				},
			]);

		expect(Object.fromEntries(durations)).toEqual(
			Object.fromEntries(
				Object.values(CONCENTRATION_PACK_FIXES)
					.filter((fix) => fix.duration)
					.map((fix) => [fix.name, fix.duration]),
			),
		);
	});

	it('ships the concentration property Migration062 ticks on existing copies', () => {
		const missingProperty = readFixedFiles()
			.filter(({ fix }) => fix.addsProperty)
			.filter(({ item }) => !item.system?.properties?.selected?.includes('concentration'))
			.map(({ item }) => item.name);

		expect(missingProperty).toEqual([]);
	});
});

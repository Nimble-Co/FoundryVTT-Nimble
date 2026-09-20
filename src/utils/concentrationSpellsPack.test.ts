import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { RULEBOOK_CONCENTRATION_DURATIONS } from '../migration/migrations/Migration062ConcentrationAppliesToCaster.js';

type SpellSource = {
	name: string;
	system?: {
		activation?: {
			duration?: { quantity?: number; type?: string };
			effects?: { type?: string; condition?: string; children?: unknown }[];
		};
		properties?: { selected?: string[] };
	};
};

function readSpellSources(): SpellSource[] {
	return [...globSync('packs/spells/**/*.json'), ...globSync('packs/secretSpells/**/*.json')].map(
		(file) => JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8')) as SpellSource,
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

describe('concentration spell pack data', () => {
	it('leaves no concentration condition node on a spell that carries the property', () => {
		const spellsWithRedundantNodes = readSpellSources()
			.filter((spell) => spell.system?.properties?.selected?.includes('concentration'))
			.filter((spell) => hasConcentrationNode(spell.system?.activation?.effects))
			.map((spell) => spell.name);

		expect(spellsWithRedundantNodes).toEqual([]);
	});

	it('ships the durations Migration062 corrects existing copies to', () => {
		const durations = Object.fromEntries(
			readSpellSources()
				.filter((spell) => spell.name in RULEBOOK_CONCENTRATION_DURATIONS)
				.map((spell) => [
					spell.name,
					{
						quantity: spell.system?.activation?.duration?.quantity,
						type: spell.system?.activation?.duration?.type,
					},
				]),
		);

		expect(durations).toEqual(RULEBOOK_CONCENTRATION_DURATIONS);
	});
});

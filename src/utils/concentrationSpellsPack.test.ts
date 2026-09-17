import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

type SpellSource = {
	name: string;
	system: {
		activation: {
			duration: { quantity: number; type: string };
			effects: { type: string; condition?: string }[];
		};
		properties: { selected: string[] };
	};
};

const RULEBOOK_TEN_MINUTE_DURATIONS: Record<string, { quantity: number; type: string }> = {
	Fly: { quantity: 10, type: 'minute' },
	'Greater Windform': { quantity: 10, type: 'minute' },
	'Lesser Windform': { quantity: 10, type: 'minute' },
	'Radiant Bond': { quantity: 10, type: 'minute' },
};

function readSpellSources(): SpellSource[] {
	return [...globSync('packs/spells/**/*.json'), ...globSync('packs/secretSpells/**/*.json')].map(
		(file) => JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8')) as SpellSource,
	);
}

describe('concentration spell pack data', () => {
	it('leaves no concentration condition node on a spell that carries the property', () => {
		const spellsWithRedundantNodes = readSpellSources()
			.filter((spell) => spell.system.properties.selected.includes('concentration'))
			.filter((spell) =>
				spell.system.activation.effects.some(
					(effect) => effect.type === 'condition' && effect.condition === 'concentration',
				),
			)
			.map((spell) => spell.name);

		expect(spellsWithRedundantNodes).toEqual([]);
	});

	it('stores the rulebook duration for the spells that concentrate for ten minutes', () => {
		const durations = Object.fromEntries(
			readSpellSources()
				.filter((spell) => spell.name in RULEBOOK_TEN_MINUTE_DURATIONS)
				.map((spell) => [
					spell.name,
					{
						quantity: spell.system.activation.duration.quantity,
						type: spell.system.activation.duration.type,
					},
				]),
		);

		expect(durations).toEqual(RULEBOOK_TEN_MINUTE_DURATIONS);
	});
});

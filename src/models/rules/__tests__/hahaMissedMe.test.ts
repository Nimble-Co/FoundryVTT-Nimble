import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const GOBLINS = [
	'packs/monsters/core/goblins/goblin.json',
	'packs/monsters/core/goblins/goblin-minion.json',
	'packs/monsters/core/goblins/goblin-ratrider.json',
	'packs/monsters/core/goblins/goblin-taskmaster.json',
];

function hahaRules(file: string): Record<string, unknown>[] {
	const actor = JSON.parse(readFileSync(resolve(file), 'utf8')) as {
		items?: { name?: string; system?: { rules?: Record<string, unknown>[] } }[];
	};
	const feature = actor.items?.find((item) => item.name === 'Haha, Missed Me!');
	if (!feature) throw new Error(`${file} has no Haha, Missed Me!`);
	return feature.system?.rules ?? [];
}

describe('Haha, Missed Me!', () => {
	it('deals 1 psychic damage back when an attack misses, on each goblin', () => {
		for (const file of GOBLINS) {
			expect(hahaRules(file), file).toEqual([
				expect.objectContaining({
					type: 'damageBack',
					trigger: 'missed',
					attackDelivery: 'any',
					amount: 'formula',
					formula: '1',
					damageType: 'psychic',
					ignoreArmor: true,
				}),
			]);
		}
	});
});

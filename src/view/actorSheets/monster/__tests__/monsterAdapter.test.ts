import { describe, expect, it } from 'vitest';
import { type MonsterDocument, monsterActorLike } from '../monsterAdapter.ts';

function monsterDocument(system: Record<string, unknown>): MonsterDocument {
	const source = {
		id: 'ogre000000000001',
		name: 'Ogre',
		img: 'ogre.webp',
		type: 'npc',
		system: {
			savingThrows: {},
			attributes: { hp: { value: 30, max: 30, temp: 0 }, movement: { walk: 6 } },
			details: { level: '3' },
			...system,
		},
		flags: {},
		items: [],
	};
	return { reactive: source, allApplicableEffects: () => [] } as unknown as MonsterDocument;
}

describe('monsterActorLike', () => {
	it('reads the armor from system.attributes.armor, not system.armor', () => {
		const monster = monsterDocument({
			armor: 'none',
			attributes: { hp: { value: 30, max: 30, temp: 0 }, armor: 'heavy', movement: {} },
		});

		expect(monsterActorLike(monster).system.attributes.armor).toBe('heavy');
	});

	it('gives no armor when the monster has none', () => {
		expect(monsterActorLike(monsterDocument({})).system.attributes.armor).toBe('none');
	});
});

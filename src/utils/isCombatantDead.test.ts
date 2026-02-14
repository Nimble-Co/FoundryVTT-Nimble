import { describe, expect, it } from 'vitest';
import { isCombatantDead } from './isCombatantDead.js';

function createActor({
	hp,
	woundsValue,
	woundsMax,
}: {
	hp?: number;
	woundsValue?: number;
	woundsMax?: number;
}) {
	return {
		system: {
			attributes: {
				hp: { value: hp },
				wounds: { value: woundsValue, max: woundsMax },
			},
		},
	} as unknown as Actor.Implementation;
}

function createCombatant({
	type,
	defeated = false,
	actor,
}: {
	type: string;
	defeated?: boolean;
	actor?: Actor.Implementation | null;
}) {
	return {
		type,
		defeated,
		actor: actor ?? null,
	} as unknown as Combatant.Implementation;
}

describe('isCombatantDead', () => {
	it('marks a character dead only when wounds reach max', () => {
		const character = createCombatant({
			type: 'character',
			actor: createActor({ hp: 0, woundsValue: 6, woundsMax: 6 }),
		});

		expect(isCombatantDead(character)).toBe(true);
	});

	it('does not mark a character dead at 0 HP when wounds are below max', () => {
		const character = createCombatant({
			type: 'character',
			actor: createActor({ hp: 0, woundsValue: 2, woundsMax: 6 }),
		});

		expect(isCombatantDead(character)).toBe(false);
	});

	it('does not mark a character dead when wounds data is missing', () => {
		const character = createCombatant({
			type: 'character',
			actor: createActor({ hp: 0 }),
		});

		expect(isCombatantDead(character)).toBe(false);
	});

	it('marks a non-character dead when defeated is true', () => {
		const npc = createCombatant({
			type: 'npc',
			defeated: true,
			actor: createActor({ hp: 10 }),
		});

		expect(isCombatantDead(npc)).toBe(true);
	});

	it('marks a non-character dead when HP is 0', () => {
		const npc = createCombatant({
			type: 'npc',
			actor: createActor({ hp: 0 }),
		});

		expect(isCombatantDead(npc)).toBe(true);
	});

	it('keeps a non-character alive when not defeated and HP is above 0', () => {
		const npc = createCombatant({
			type: 'npc',
			actor: createActor({ hp: 8 }),
		});

		expect(isCombatantDead(npc)).toBe(false);
	});
});

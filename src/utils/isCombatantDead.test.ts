import { describe, expect, it } from 'vitest';
import { createCombatActorFixture, createCombatantFixture } from '../../tests/fixtures/combat.js';
import { isCombatantDead } from './isCombatantDead.js';

describe('isCombatantDead', () => {
	it('marks a character dead only when wounds reach max', () => {
		const character = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ hp: 0, woundsValue: 6, woundsMax: 6 }),
		});

		expect(isCombatantDead(character)).toBe(true);
	});

	it('does not mark a character dead at 0 HP when wounds are below max', () => {
		const character = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ hp: 0, woundsValue: 2, woundsMax: 6 }),
		});

		expect(isCombatantDead(character)).toBe(false);
	});

	it('does not mark a character dead when wounds data is missing', () => {
		const character = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ hp: 0 }),
		});

		expect(isCombatantDead(character)).toBe(false);
	});

	it('marks a non-character dead when defeated is true', () => {
		const npc = createCombatantFixture({
			type: 'npc',
			defeated: true,
			actor: createCombatActorFixture({ hp: 10 }),
		});

		expect(isCombatantDead(npc)).toBe(true);
	});

	it('marks a non-character dead when HP is 0', () => {
		const npc = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ hp: 0 }),
		});

		expect(isCombatantDead(npc)).toBe(true);
	});

	it('keeps a non-character alive when not defeated and HP is above 0', () => {
		const npc = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ hp: 8 }),
		});

		expect(isCombatantDead(npc)).toBe(false);
	});
});

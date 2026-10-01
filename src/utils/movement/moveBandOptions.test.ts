import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
import { getMoveBandOptions } from './moveBandOptions.js';

const hero = {
	id: 't1',
	parent: { id: 's1' },
	actor: { type: 'character', system: { attributes: { movement: { walk: 6, fly: 8, swim: 0 } } } },
};

function combatOnTurnOf(tokenId: string, { started = true, sceneId = 's1' } = {}) {
	return { started, combatant: { tokenId, sceneId } };
}

describe('getMoveBandOptions', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses the Speed of the movement action when the character has one, and walking Speed otherwise', () => {
		const options = getMoveBandOptions(hero, [combatOnTurnOf('t1')]);
		expect(options?.speedFor('walk')).toBe(6);
		expect(options?.speedFor('fly')).toBe(8);
		expect(options?.speedFor('swim')).toBe(6);
		expect(options?.speedFor('crawl')).toBe(6);
	});

	it('finds the turn in a later started combat', () => {
		const combats = [combatOnTurnOf('other'), combatOnTurnOf('t1')];
		expect(getMoveBandOptions(hero, combats)).not.toBeNull();
	});

	it('has no Moves on another creature turn, in a combat not started, or on another scene', () => {
		expect(getMoveBandOptions(hero, [combatOnTurnOf('other')])).toBeNull();
		expect(getMoveBandOptions(hero, [combatOnTurnOf('t1', { started: false })])).toBeNull();
		expect(getMoveBandOptions(hero, [combatOnTurnOf('t1', { sceneId: 's2' })])).toBeNull();
	});

	it('has no Moves for a creature that is not a character', () => {
		const monster = { ...hero, actor: { ...hero.actor, type: 'npc' } };
		expect(getMoveBandOptions(monster, [combatOnTurnOf('t1')])).toBeNull();
	});

	it('shows the Moves while Movement Tracking is off', () => {
		vi.stubGlobal('game', {
			...game,
			settings: {
				get: (_namespace: string, key: string) =>
					key === AUTOMATION_SETTING_KEYS.movementTracking ? false : undefined,
			},
		});
		expect(getMoveBandOptions(hero, [combatOnTurnOf('t1')])).not.toBeNull();
	});
});

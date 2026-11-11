import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	effectsInactiveAt,
	inactiveThisRound,
	noteActivity,
} from '#utils/lastsUntil/inactiveRound.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';

const inactiveMoment: Moment = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'holder',
	event: 'inactiveRound',
	effectName: '',
};

interface TestEffect {
	id: string;
	active: boolean;
	origin: string | null;
	isOwner: boolean;
	start: { combat: string | null; round: number | null };
	lastsUntil: Moment[];
	flags: Record<string, Record<string, unknown>>;
	getFlag(scope: string, key: string): unknown;
	update: Mock<(data: Record<string, unknown>) => Promise<void>>;
}

function effect(overrides: Partial<TestEffect> = {}): TestEffect {
	const made: TestEffect = {
		id: 'raging',
		active: true,
		origin: 'Actor.hero.Item.rage',
		isOwner: true,
		start: { combat: 'c1', round: 1 },
		lastsUntil: [inactiveMoment],
		flags: {},
		getFlag: (scope, key) => made.flags[scope]?.[key],
		update: vi.fn(async (data: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(data)) {
				const [, scope, key] = path.split('.');
				made.flags[scope] = { ...(made.flags[scope] ?? {}), [key]: value };
			}
		}),
		...overrides,
	};
	return made;
}

const gameGlobal = globalThis as unknown as { game: { combat?: unknown; combats?: unknown } };

function fight(holder: object, round: number) {
	const combatant = { id: 'cHero', type: 'character', actor: holder, flags: {} };
	const combat = {
		id: 'c1',
		round,
		started: true,
		combatants: { contents: [combatant] },
	};
	gameGlobal.game.combat = combat;
	gameGlobal.game.combats = [combat];
	return { combat, seat: { combatantId: 'cHero', groupId: null, isHero: true } };
}

/** Whether the effect ends as its holder's turn in `round` ends. */
function endsAtTurnEnd(target: TestEffect, round: number): boolean {
	const { combat, seat } = fight({ uuid: 'Actor.hero', effects: [target] }, round);
	return effectsInactiveAt(combat as unknown as Combat, seat, round).includes(
		target as unknown as ActiveEffect,
	);
}

describe('the inactiveRound moment', () => {
	let saved: { combat?: unknown; combats?: unknown };

	beforeEach(() => {
		saved = { combat: gameGlobal.game.combat, combats: gameGlobal.game.combats };
	});

	afterEach(() => {
		gameGlobal.game.combat = saved.combat;
		gameGlobal.game.combats = saved.combats;
	});

	it('ends the effect at the turn end of a round with no activity', () => {
		expect(endsAtTurnEnd(effect(), 2)).toBe(true);
	});

	it('keeps the effect when its holder attacked this round', () => {
		const target = effect();
		const holder = { uuid: 'Actor.hero', effects: [target] };
		const { combat, seat } = fight(holder, 2);

		noteActivity(holder, { attack: true });

		expect(target.update).toHaveBeenCalledWith({
			'flags.nimble.lastActivity': { combatId: 'c1', round: 2 },
		});
		expect(effectsInactiveAt(combat as unknown as Combat, seat, 2)).toEqual([]);
		expect(effectsInactiveAt(combat as unknown as Combat, seat, 3)).toEqual([target]);
	});

	it('keeps the effect when its holder used the origin item again this round', () => {
		const target = effect();
		const holder = { uuid: 'Actor.hero', effects: [target] };
		const { combat, seat } = fight(holder, 2);

		noteActivity(holder, { attack: false, itemUuid: 'Actor.hero.Item.other' });
		expect(target.update).not.toHaveBeenCalled();

		noteActivity(holder, { attack: false, itemUuid: 'Actor.hero.Item.rage' });

		expect(effectsInactiveAt(combat as unknown as Combat, seat, 2)).toEqual([]);
	});

	it('keeps the effect in the round it started', () => {
		expect(endsAtTurnEnd(effect({ start: { combat: 'c1', round: 2 } }), 2)).toBe(false);
		expect(endsAtTurnEnd(effect({ start: { combat: 'other', round: 2 } }), 2)).toBe(true);
	});

	it('reads only effects with the moment, that are on', () => {
		expect(inactiveThisRound(effect({ lastsUntil: [] }), 'c1', 2)).toBe(false);
		expect(inactiveThisRound(effect({ active: false }), 'c1', 2)).toBe(false);
		expect(
			inactiveThisRound(effect({ lastsUntil: [{ ...inactiveMoment, who: 'source' }] }), 'c1', 2),
		).toBe(false);
	});

	it('counts activity of another combat as none', () => {
		const target = effect({ flags: { nimble: { lastActivity: { combatId: 'old', round: 2 } } } });
		expect(inactiveThisRound(target, 'c1', 2)).toBe(true);
	});

	it('notes no activity out of combat, nor on an effect this user does not own', () => {
		const target = effect();
		const other = effect({ isOwner: false });
		gameGlobal.game.combat = null;
		gameGlobal.game.combats = [];

		noteActivity({ uuid: 'Actor.hero', effects: [target] }, { attack: true });
		fight({ uuid: 'Actor.hero', effects: [other] }, 2);
		noteActivity({ uuid: 'Actor.hero', effects: [other] }, { attack: true });

		expect(target.update).not.toHaveBeenCalled();
		expect(other.update).not.toHaveBeenCalled();
	});

	it('writes the same round only once', () => {
		const target = effect();
		const holder = { uuid: 'Actor.hero', effects: [target] };
		fight(holder, 2);

		noteActivity(holder, { attack: true });
		noteActivity(holder, { attack: true });

		expect(target.update).toHaveBeenCalledTimes(1);
	});
});

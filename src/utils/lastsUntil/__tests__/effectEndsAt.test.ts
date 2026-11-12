import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import registerConditionsConfig from '../../../config/registerConditionsConfig.js';
import { effectEndsAt, turnsSeenAfter } from '../effectEndsAt.js';
import { seatOf } from '../effectSubject.js';
import type { LastsUntilCheck, Moment } from '../momentReached.js';

const COMBAT = 'combat1';

function makeActor(uuid: string, type = 'npc') {
	return new Actor({ uuid, type, inCombat: true } as never);
}

const goblin = makeActor('Actor.goblin');
const tessa = makeActor('Actor.tessa', 'character');

function makeCombatant(id: string, actor: object, type = 'npc') {
	return Object.assign(Object.create(Combatant.prototype), { id, actor, type, flags: {} });
}

const goblinCombatant = makeCombatant('cGoblin', goblin);
const tessaCombatant = makeCombatant('cTessa', tessa, 'character');
const combatants = [tessaCombatant, goblinCombatant];

const combat = {
	id: COMBAT,
	combatants: {
		contents: combatants,
		get: (id: string) => combatants.find((each) => each.id === id),
	},
} as unknown as Combat;

const spell = new Item({ uuid: 'Actor.tessa.Item.sand', actor: tessa } as never);

function moment(fields: Partial<Moment>): Moment {
	return {
		kind: 'turn',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: null,
		event: null,
		effectName: '',
		...fields,
	};
}

function makeEffect(fields: Record<string, unknown> = {}) {
	return Object.assign(Object.create(ActiveEffect.prototype), {
		parent: goblin,
		active: true,
		origin: spell.uuid,
		statuses: new Set<string>(),
		isTemporary: false,
		isMinor: false,
		lastsUntil: [] as Moment[],
		start: { combat: COMBAT, combatant: 'cTessa', round: 1, turn: 0, time: 0 },
		...fields,
	}) as ActiveEffect;
}

const turnEnd = (combatant: Combatant.Implementation, round: number): LastsUntilCheck => ({
	type: 'turnEnd',
	combatId: COMBAT,
	seat: seatOf(combatant),
	round,
});

let coreIsExpiryEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === spell.uuid ? spell : null)),
	);
	coreIsExpiryEvent = vi.fn(() => true);
	Object.assign(ActiveEffect.prototype, { isExpiryEvent: coreIsExpiryEvent });
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete (ActiveEffect.prototype as { isExpiryEvent?: unknown }).isExpiryEvent;
});

describe('effectEndsAt', () => {
	const endOfTheirNextTurn = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' });

	it('finds the turns of the holder in the combat', () => {
		const effect = makeEffect({ lastsUntil: [endOfTheirNextTurn] });

		expect(effectEndsAt(effect, turnEnd(tessaCombatant, 1), combat)).toBe(false);
		expect(effectEndsAt(effect, turnEnd(goblinCombatant, 1), combat)).toBe(true);
	});

	it('reads a prepared start, whose combat is the Combat document', () => {
		const effect = makeEffect({
			lastsUntil: [endOfTheirNextTurn],
			start: { combat, combatant: 'cGoblin', round: 1, turn: 1, time: 0 },
		});

		expect(effectEndsAt(effect, turnEnd(goblinCombatant, 1), combat)).toBe(false);
		expect(effectEndsAt(effect, turnEnd(goblinCombatant, 2), combat)).toBe(true);
	});

	it('finds the source from the origin item', () => {
		const startOfYourNextTurn = moment({ boundary: 'start', clock: 'source', span: 'nextTurn' });
		const effect = makeEffect({ lastsUntil: [startOfYourNextTurn] });
		const check = (combatant: Combatant.Implementation): LastsUntilCheck => ({
			type: 'turnStart',
			combatId: COMBAT,
			seat: seatOf(combatant),
			round: 2,
		});

		expect(effectEndsAt(effect, check(goblinCombatant), combat)).toBe(false);
		expect(effectEndsAt(effect, check(tessaCombatant), combat)).toBe(true);
	});

	it('an effect on an item, or one that is off, does not end', () => {
		const onItem = makeEffect({ parent: spell, lastsUntil: [endOfTheirNextTurn] });
		const off = makeEffect({ active: false, lastsUntil: [endOfTheirNextTurn] });

		expect(effectEndsAt(onItem, turnEnd(goblinCombatant, 1), combat)).toBe(false);
		expect(effectEndsAt(off, turnEnd(goblinCombatant, 1), combat)).toBe(false);
	});

	it('a Minor Status ends at the end of its combat', () => {
		const minor = makeEffect({ isMinor: true });
		const other = makeEffect({ isMinor: false });
		const end: LastsUntilCheck = { type: 'combatEnd', combatId: COMBAT };

		expect(effectEndsAt(minor, end, combat)).toBe(true);
		expect(effectEndsAt(other, end, combat)).toBe(false);
	});

	describe('a core duration', () => {
		const legacy = (remaining: number) =>
			makeEffect({
				isTemporary: true,
				duration: { remaining },
				updateDuration: () => ({ remaining }),
			});

		it('ends by core rule once the duration is reached', () => {
			expect(effectEndsAt(legacy(0), turnEnd(goblinCombatant, 1), combat)).toBe(true);
			expect(coreIsExpiryEvent).toHaveBeenCalledWith('turnEnd', { combat });
		});

		it('at a turn end, reads what is left without counting again, as core does', () => {
			const updateDuration = vi.fn(() => ({ remaining: 1 }));
			const effect = makeEffect({ isTemporary: true, duration: { remaining: 0 }, updateDuration });

			expect(effectEndsAt(effect, turnEnd(goblinCombatant, 1), combat)).toBe(true);
			expect(updateDuration).not.toHaveBeenCalled();
		});

		it('can end as combat starts', () => {
			const start: LastsUntilCheck = { type: 'combatStart', combatId: COMBAT };

			expect(effectEndsAt(legacy(0), start, combat)).toBe(true);
			expect(coreIsExpiryEvent).toHaveBeenCalledWith('combatStart', { combat });
		});

		it('does not end before the duration is reached', () => {
			expect(effectEndsAt(legacy(1), turnEnd(goblinCombatant, 1), combat)).toBe(false);
			expect(coreIsExpiryEvent).not.toHaveBeenCalled();
		});

		it('a Nimble event in its expiry ends it only for the holder', () => {
			const attack = (actor: object): LastsUntilCheck => ({
				type: 'event',
				event: 'attack',
				actor,
			});

			expect(effectEndsAt(legacy(Number.POSITIVE_INFINITY), attack(tessa), combat)).toBe(false);
			expect(effectEndsAt(legacy(Number.POSITIVE_INFINITY), attack(goblin), combat)).toBe(true);
			expect(coreIsExpiryEvent).toHaveBeenCalledWith('attack', { combat });
		});
	});

	describe('Despair', () => {
		const despair = () =>
			makeEffect({
				statuses: new Set(['despair']),
				lastsUntil: registerConditionsConfig().conditionLastsUntil.despair,
			});
		const attack = (actor: object): LastsUntilCheck => ({ type: 'event', event: 'attack', actor });

		it("ends at the holder's attack, and not at another creature's", () => {
			expect(effectEndsAt(despair(), attack(goblin), combat)).toBe(true);
			expect(effectEndsAt(despair(), attack(tessa), combat)).toBe(false);
		});

		it('ends when the combat ends', () => {
			expect(effectEndsAt(despair(), { type: 'combatEnd', combatId: COMBAT }, combat)).toBe(true);
		});

		it('does not end at a turn end', () => {
			expect(effectEndsAt(despair(), turnEnd(goblinCombatant, 2), combat)).toBe(false);
		});
	});
});

describe('turnsSeenAfter', () => {
	const second = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn', value: 2 });

	it('counts a turn of the holder that does not yet end a "2nd next turn"', () => {
		const effect = makeEffect({ lastsUntil: [second] });

		expect(turnsSeenAfter(effect as never, turnEnd(goblinCombatant, 1), combat)).toEqual([1]);
		expect(turnsSeenAfter(effect as never, turnEnd(tessaCombatant, 1), combat)).toBeNull();
	});

	it('the turn that reaches the count ends the effect and counts nothing', () => {
		const effect = makeEffect({ lastsUntil: [second], flags: { nimble: { turnsSeen: [1] } } });

		expect(effectEndsAt(effect as never, turnEnd(goblinCombatant, 2), combat)).toBe(true);
		expect(turnsSeenAfter(effect as never, turnEnd(goblinCombatant, 2), combat)).toBeNull();
	});

	it('an effect with no counted moment counts nothing', () => {
		const next = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' });
		expect(
			turnsSeenAfter(
				makeEffect({ lastsUntil: [next] }) as never,
				turnEnd(goblinCombatant, 1),
				combat,
			),
		).toBeNull();
	});
});

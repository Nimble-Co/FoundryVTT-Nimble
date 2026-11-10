import { describe, expect, it } from 'vitest';
import localize from '#utils/localize.js';
import {
	CARD_SELF_READER,
	CARD_TARGETS_READER,
	type DescribeInput,
	describeLastsUntil,
	holderReader,
	usedUpOf,
} from '../describeLastsUntil.js';
import type { Moment } from '../momentReached.js';

const blank: Moment = {
	kind: 'turn',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

const turn = (fields: Partial<Moment>): Moment => ({ ...blank, kind: 'turn', ...fields });
const time = (value: number, units: Moment['units']): Moment => ({
	...blank,
	kind: 'time',
	value,
	units,
});
const event = (who: Moment['who'], name: Moment['event'], effectName = ''): Moment => ({
	...blank,
	kind: 'event',
	who,
	event: name,
	effectName,
});

function read(moments: Moment[], reader: DescribeInput['reader'], hasEscape = false): string {
	return describeLastsUntil({ moments, escape: hasEscape, reader, localize, format: localize });
}

describe('describeLastsUntil', () => {
	const endOfTheirNextTurn = turn({ boundary: 'end', clock: 'holder', span: 'nextTurn' });

	it('reads a turn moment from the card and from the holder', () => {
		expect(read([endOfTheirNextTurn], CARD_TARGETS_READER)).toBe(
			'Until the end of their next turn',
		);
		expect(read([endOfTheirNextTurn], holderReader('Goblin Boss'))).toBe(
			'Until the end of your next turn',
		);
		const sourceTurn = turn({ boundary: 'start', clock: 'source', span: 'currentTurn' });
		expect(read([sourceTurn], CARD_TARGETS_READER)).toBe('Until the start of your turn');
		expect(read([sourceTurn], holderReader('Goblin Boss'))).toBe(
			"Until the start of Goblin Boss's turn",
		);
	});

	it('reads a round and the next hero without a person', () => {
		expect(read([turn({ boundary: 'end', span: 'currentRound' })], CARD_TARGETS_READER)).toBe(
			'Until the end of this round',
		);
		expect(
			read([turn({ boundary: 'start', clock: 'nextHero', span: 'nextTurn' })], CARD_SELF_READER),
		).toBe("Until the start of the next hero's turn");
	});

	it('reads time with one and many units', () => {
		expect(read([time(1, 'minutes')], CARD_TARGETS_READER)).toBe('For 1 minute');
		expect(read([time(10, 'rounds')], CARD_TARGETS_READER)).toBe('For 10 rounds');
	});

	it('uses the base verb for you and they, and the third person for a name', () => {
		const zeroHp = event('source', 'zeroHp');
		expect(read([zeroHp], CARD_TARGETS_READER)).toBe('Until you drop to 0 HP');
		expect(read([zeroHp], holderReader('Goblin Boss'))).toBe('Until Goblin Boss drops to 0 HP');
		expect(read([event('holder', 'attack')], CARD_TARGETS_READER)).toBe('Until they attack');
		expect(read([event('holder', 'healed')], CARD_SELF_READER)).toBe('Until you are Healed');
		expect(read([event('source', 'healed')], holderReader('Kobold'))).toBe(
			'Until Kobold is Healed',
		);
	});

	it('reads the source as you on a sheet with no source name', () => {
		expect(read([event('source', 'die')], holderReader(null))).toBe('Until you die');
	});

	it('reads another effect and the end of combat', () => {
		expect(read([event(null, 'effectEnds', 'Rage')], CARD_SELF_READER)).toBe('Until Rage ends');
		expect(read([event(null, 'effectEnds')], CARD_SELF_READER)).toBe('Until another effect ends');
		expect(read([event(null, 'combatEnd')], CARD_SELF_READER)).toBe('Until combat ends');
	});

	it('joins the moments with "or"', () => {
		expect(
			read(
				[endOfTheirNextTurn, event('source', 'zeroHp'), time(1, 'minutes')],
				CARD_TARGETS_READER,
			),
		).toBe('Until the end of their next turn, or until you drop to 0 HP, or for 1 minute');
	});

	it('reads an Escape only when no moment ends the effect', () => {
		expect(read([], CARD_TARGETS_READER, true)).toBe('Until they Escape');
		expect(read([], holderReader('Worg'), true)).toBe('Until you Escape');
		expect(read([time(1, 'minutes')], holderReader('Worg'), true)).toBe('For 1 minute');
		expect(read([], holderReader('Worg'))).toBe('');
	});

	it('reads a core duration after the moments', () => {
		const coreDuration = { rounds: 2, turns: null, seconds: null };
		expect(
			describeLastsUntil({
				moments: [],
				coreDuration,
				reader: CARD_TARGETS_READER,
				localize,
				format: localize,
			}),
		).toBe('For 2 rounds');
		expect(
			describeLastsUntil({
				moments: [event('source', 'zeroHp')],
				coreDuration: { turns: 1 },
				reader: CARD_TARGETS_READER,
				localize,
				format: localize,
			}),
		).toBe('Until you drop to 0 HP, or for 1 turn');
	});
});

describe('describeLastsUntil with a used-up Held Roll', () => {
	const namedHolder: DescribeInput['reader'] = {
		holder: { kind: 'named', name: 'Kobold' },
		source: { kind: 'you' },
	};

	const own = { by: 'holderAttacks', melee: false, fromSource: false } as const;
	const against = { by: 'attacksOnHolder', melee: false, fromSource: false } as const;

	function readUsedUp(
		usedUp: DescribeInput['usedUp'],
		reader: DescribeInput['reader'],
		moments: Moment[] = [],
	): string {
		return describeLastsUntil({ moments, usedUp, reader, localize, format: localize });
	}

	it("reads the holder's next attack for each reader", () => {
		expect(readUsedUp(own, CARD_SELF_READER)).toBe('Until your next attack');
		expect(readUsedUp(own, CARD_TARGETS_READER)).toBe('Until their next attack');
		expect(readUsedUp(own, namedHolder)).toBe("Until Kobold's next attack");
	});

	it('reads the next attack against the holder for each reader', () => {
		expect(readUsedUp(against, CARD_SELF_READER)).toBe('Until the next attack against you');
		expect(readUsedUp(against, CARD_TARGETS_READER)).toBe('Until the next attack against them');
		expect(readUsedUp(against, namedHolder)).toBe('Until the next attack against Kobold');
	});

	it('reads the used-up phrase before the moments', () => {
		const endOfTurn = turn({ boundary: 'end', clock: 'holder', span: 'currentTurn' });
		expect(readUsedUp(own, CARD_SELF_READER, [endOfTurn])).toBe(
			'Until your next attack, or until the end of your turn',
		);
	});

	it('reads a melee attack by the source against the holder', () => {
		const advance = { by: 'attacksOnHolder', melee: true, fromSource: true } as const;
		expect(readUsedUp(advance, CARD_TARGETS_READER)).toBe(
			'Until your next melee attack against them',
		);
		expect(readUsedUp({ ...advance, fromSource: false }, CARD_TARGETS_READER)).toBe(
			'Until the next melee attack against them',
		);
	});

	it('reads no used-up phrase when usedUp is null', () => {
		expect(readUsedUp(null, CARD_SELF_READER)).toBe('');
	});
});

describe('usedUpOf', () => {
	const heldRoll = (fields: Record<string, unknown> = {}) => ({
		type: 'heldRoll',
		appliesTo: 'attacksOnHolder',
		usedUp: true,
		...fields,
	});

	it('gives the appliesTo of a used-up Held Roll rule', () => {
		expect(usedUpOf({ rules: [heldRoll()] })).toEqual({
			by: 'attacksOnHolder',
			melee: false,
			fromSource: false,
		});
	});

	it('gives melee and source when the rule says so', () => {
		expect(usedUpOf({ rules: [heldRoll({ meleeOnly: true, fromSourceOnly: true })] })).toEqual({
			by: 'attacksOnHolder',
			melee: true,
			fromSource: true,
		});
	});

	it("gives the holder's attacks when the rule has no appliesTo", () => {
		expect(usedUpOf({ rules: [heldRoll({ appliesTo: undefined })] })?.by).toBe('holderAttacks');
	});

	it('gives null for a Held Roll rule that is not used up', () => {
		expect(usedUpOf({ rules: [heldRoll({ usedUp: false })] })).toBeNull();
	});

	it('gives null for a disabled Held Roll rule', () => {
		expect(usedUpOf({ rules: [heldRoll({ disabled: true })] })).toBeNull();
	});

	it('gives null for other rules and for no rules', () => {
		expect(usedUpOf({ rules: [{ type: 'speedBonus' }] })).toBeNull();
		expect(usedUpOf({})).toBeNull();
		expect(usedUpOf(null)).toBeNull();
	});
});

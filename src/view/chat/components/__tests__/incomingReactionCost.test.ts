import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import { getIncomingReactionCost } from '../incomingReactionCost.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
	fromUuidSync: unknown;
};

function useRule(actionCost: number) {
	const rule = {
		type: 'reroll',
		id: 'rule-1',
		disabled: false,
		rollUseCost: {
			chargePoolIdentifier: '',
			chargeCost: 1,
			manaCost: 0,
			woundCost: 0,
			heroicReaction: '',
			actionCost,
		},
	};
	testGlobals.fromUuidSync = () => ({ rules: new Map([['rule-1', rule]]) });
}

const entry = {
	kind: 'reroll',
	itemUuid: 'Item.feature',
	ruleId: 'rule-1',
} as IncomingReactionEntry;

describe('getIncomingReactionCost', () => {
	let previousFromUuid: unknown;

	beforeEach(() => {
		previousFromUuid = testGlobals.fromUuidSync;
	});

	afterEach(() => {
		testGlobals.fromUuidSync = previousFromUuid;
		delete testGlobals.game.settings;
	});

	it("names the Heroic Reaction for a hero's Interpose that a rule gives a longer range", () => {
		const interpose = { kind: 'redirectToSelf', source: 'rule' } as IncomingReactionEntry;
		expect(getIncomingReactionCost(interpose, { type: 'character' } as Actor)).toBe(
			'Heroic Reaction',
		);
	});

	it('names the action a rule costs', () => {
		testGlobals.game.settings = { get: () => true };
		useRule(1);
		expect(getIncomingReactionCost(entry, null)).toBe('1 action');
	});

	it('says how many uses are left, and that a Wound is gained', () => {
		testGlobals.game.settings = { get: () => true };
		const rule = {
			type: 'reroll',
			id: 'rule-1',
			disabled: false,
			rollUseCost: {
				chargePoolIdentifier: 'sand',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 1,
				heroicReaction: '',
			},
		};
		testGlobals.fromUuidSync = () => ({ rules: new Map([['rule-1', rule]]) });
		const pool = {
			type: 'chargePool',
			disabled: false,
			id: 'sand',
			identifier: 'sand',
			scope: 'item',
			max: '2',
			initial: 'max',
			recoveries: [],
		};
		const item = {
			id: 'item-1',
			flags: { nimble: { chargePools: { sand: { current: 1, max: 2 } } } },
			rules: new Map([['pool', pool]]),
		};
		const actor = {
			type: 'character',
			flags: {},
			getRollData: () => ({}),
			items: { contents: [item], get: () => item },
		} as unknown as Actor;

		expect(getIncomingReactionCost(entry, actor)).toBe('1 left, Gain 1 Wound');
	});

	it('names no action while resource spending automation is off', () => {
		testGlobals.game.settings = { get: (_scope, key) => key !== 'automation.resourceSpending' };
		useRule(1);
		expect(getIncomingReactionCost(entry, null)).toBe('');
	});
});

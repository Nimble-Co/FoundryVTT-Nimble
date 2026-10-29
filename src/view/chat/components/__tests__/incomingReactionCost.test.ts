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
		rerollCost: {
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

	it('names the action a rule costs', () => {
		testGlobals.game.settings = { get: () => true };
		useRule(1);
		expect(getIncomingReactionCost(entry, null)).toBe('1 action');
	});

	it('names no action while resource spending automation is off', () => {
		testGlobals.game.settings = { get: (_scope, key) => key !== 'automation.resourceSpending' };
		useRule(1);
		expect(getIncomingReactionCost(entry, null)).toBe('');
	});
});

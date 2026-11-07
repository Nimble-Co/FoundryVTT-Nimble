import { afterEach, describe, expect, it, vi } from 'vitest';
import { paysForInterpose } from '../spendInterpose.ts';

function entry(fields: Record<string, unknown>) {
	return { kind: 'redirectToSelf', source: 'rule', actorUuid: 'Actor.a', ...fields } as never;
}

describe('paysForInterpose', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('pays for the baseline Interpose', () => {
		expect(paysForInterpose(entry({ source: 'baseline' }))).toBe(true);
	});

	it("pays for a hero's Interpose that a rule gives a longer range", () => {
		vi.stubGlobal('fromUuidSync', () => ({ type: 'character' }));
		expect(paysForInterpose(entry({}))).toBe(true);
	});

	it("leaves a monster's rule Interpose free", () => {
		vi.stubGlobal('fromUuidSync', () => ({ type: 'npc' }));
		expect(paysForInterpose(entry({}))).toBe(false);
	});

	it('pays nothing for an entry that is not an Interpose', () => {
		expect(paysForInterpose(entry({ kind: 'reroll', source: 'baseline' }))).toBe(false);
	});
});

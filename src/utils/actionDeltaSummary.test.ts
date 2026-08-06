import { describe, expect, it } from 'vitest';
import { buildActionDeltaSummary } from './actionDeltaSummary.js';

const NAMES: Record<string, string> = {
	'combatant-a': 'Ally A',
	'combatant-b': 'Ally B',
};

function resolveName(combatantId: string): string | null {
	return NAMES[combatantId] ?? null;
}

describe('buildActionDeltaSummary', () => {
	it('returns nothing when no adjustment was requested', () => {
		expect(buildActionDeltaSummary(new Map(), resolveName)).toEqual([]);
	});

	it('labels each recipient with the adjustment requested for them', () => {
		const applications = new Map([
			['combatant-a', { currentDelta: 1, pendingDelta: 0 }],
			['combatant-b', { currentDelta: 0, pendingDelta: 2 }],
		]);

		expect(buildActionDeltaSummary(applications, resolveName)).toEqual([
			{ combatantId: 'combatant-a', name: 'Ally A', currentDelta: 1, pendingDelta: 0 },
			{ combatantId: 'combatant-b', name: 'Ally B', currentDelta: 0, pendingDelta: 2 },
		]);
	});

	it('keeps both halves of a paired adjustment on one entry', () => {
		const applications = new Map([['combatant-a', { currentDelta: 1, pendingDelta: -1 }]]);

		expect(buildActionDeltaSummary(applications, resolveName)).toEqual([
			{ combatantId: 'combatant-a', name: 'Ally A', currentDelta: 1, pendingDelta: -1 },
		]);
	});

	it('drops recipients whose adjustments cancelled out to nothing', () => {
		const applications = new Map([['combatant-a', { currentDelta: 0, pendingDelta: 0 }]]);

		expect(buildActionDeltaSummary(applications, resolveName)).toEqual([]);
	});

	it('drops recipients that can no longer be named', () => {
		const applications = new Map([['combatant-gone', { currentDelta: 1, pendingDelta: 0 }]]);

		expect(buildActionDeltaSummary(applications, resolveName)).toEqual([]);
	});

	it('normalizes non-integer deltas', () => {
		const applications = new Map([
			['combatant-a', { currentDelta: 1.8, pendingDelta: Number.NaN }],
		]);

		expect(buildActionDeltaSummary(applications, resolveName)).toEqual([
			{ combatantId: 'combatant-a', name: 'Ally A', currentDelta: 1, pendingDelta: 0 },
		]);
	});
});

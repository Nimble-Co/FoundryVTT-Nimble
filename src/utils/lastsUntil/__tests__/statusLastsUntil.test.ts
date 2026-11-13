import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appliedLastsUntil, statusLastsUntil } from '../statusLastsUntil.js';

const endOfNextTurn = { kind: 'turn', boundary: 'end', clock: 'holder', span: 'nextTurn' };
const oneMinute = { kind: 'time', value: 1, units: 'minutes' };

describe('statusLastsUntil', () => {
	let saved: unknown;
	beforeEach(() => {
		saved = (CONFIG as { statusEffects?: unknown }).statusEffects;
		(CONFIG as { statusEffects?: unknown }).statusEffects = [
			{ id: 'prone', system: {} },
			{ id: 'dazed', system: { lastsUntil: [endOfNextTurn] } },
		];
	});
	afterEach(() => {
		(CONFIG as { statusEffects?: unknown }).statusEffects = saved;
	});

	it('finds the first status that has moments', () => {
		expect(statusLastsUntil(['prone', 'dazed'])).toEqual({
			status: 'dazed',
			moments: [endOfNextTurn],
		});
		expect(statusLastsUntil(['prone'])).toBeNull();
	});

	it('an effect with moments of its own keeps them', () => {
		const effect = { system: { lastsUntil: [oneMinute] }, statuses: ['dazed'] };
		expect(appliedLastsUntil(effect as never)).toEqual([oneMinute]);
	});

	it('an effect with no moments gets the moments of its status', () => {
		expect(appliedLastsUntil({ system: { lastsUntil: [] }, statuses: ['dazed'] })).toEqual([
			endOfNextTurn,
		]);
	});

	it('an effect that stays until someone removes it gets none', () => {
		const effect = { system: { lastsUntil: [], untilRemoved: true }, statuses: ['dazed'] };
		expect(appliedLastsUntil(effect)).toEqual([]);
	});
});

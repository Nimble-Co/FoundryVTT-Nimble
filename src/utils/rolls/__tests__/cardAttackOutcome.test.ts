import { describe, expect, it } from 'vitest';
import { cardAttackOutcome } from '../cardAttackOutcome.ts';

const damage = (extra: Record<string, unknown> = {}) => ({
	id: 'd',
	type: 'damage',
	parentContext: null,
	parentNode: null,
	...extra,
});

function card(system: Record<string, unknown>, effects: unknown[] = [damage()]) {
	return { system: { activation: { effects }, ...system } };
}

describe('cardAttackOutcome', () => {
	it('reads a hit, a crit and a miss from the card', () => {
		expect(cardAttackOutcome(card({}))).toEqual({ isCritical: false, isMiss: false });
		expect(cardAttackOutcome(card({ isCritical: true }))).toEqual({
			isCritical: true,
			isMiss: false,
		});
		expect(cardAttackOutcome(card({ isMiss: true }))).toEqual({ isCritical: false, isMiss: true });
	});

	it('reads a discarded crit that keeps its triggers as a crit', () => {
		expect(cardAttackOutcome(card({ isMiss: true, discardedCritTriggers: true }))).toEqual({
			isCritical: true,
			isMiss: false,
		});
	});

	it('finds a damage step at any depth', () => {
		const save = {
			id: 's',
			type: 'savingThrow',
			parentContext: null,
			parentNode: null,
			on: { failedSave: [damage()] },
		};

		expect(cardAttackOutcome(card({ isMiss: true }, [save]))?.isMiss).toBe(true);
	});

	it('has no outcome with no damage roll, a damage roll left for later, or a waiting Keep a Result', () => {
		expect(cardAttackOutcome(card({}, []))).toBeNull();
		expect(cardAttackOutcome(card({}, [damage({ deferredRoll: true })]))).toBeNull();
		expect(cardAttackOutcome(card({ pendingKeep: { id: 'k' } }))).toBeNull();
		expect(cardAttackOutcome(null)).toBeNull();
	});
});

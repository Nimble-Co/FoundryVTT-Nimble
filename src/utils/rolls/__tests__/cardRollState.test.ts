import { describe, expect, it } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import {
	noDamageTargetsOf,
	owesCritTriggers,
	pendingKeepOf,
	resultRemovalRefusal,
} from '../cardRollState.js';

function change(overrides: Partial<ResultChange> = {}): ResultChange {
	return {
		id: 'c1',
		lineId: 'c1',
		entryId: 'e1',
		itemUuid: 'Item.soul',
		ruleId: 'r1',
		label: 'Mighty Soul',
		actorUuid: 'Actor.hero',
		change: 'add',
		value: 2,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		...overrides,
	} as ResultChange;
}

const KEEP_FIRST = 'NIMBLE.chat.incomingReactions.keepFirst';
const USE_FAILED = 'NIMBLE.chat.incomingReactions.useFailed';

describe('pendingKeepOf', () => {
	it('reads the waiting Keep a Result, or null', () => {
		const pending = { entryId: 'e1' };
		expect(pendingKeepOf({ pendingKeep: pending })).toBe(pending);
		expect(pendingKeepOf({ pendingKeep: null })).toBeNull();
		expect(pendingKeepOf(undefined)).toBeNull();
	});
});

describe('noDamageTargetsOf', () => {
	it('maps each target of a standing no-damage change to it', () => {
		const shielded = change({ change: 'noDamage', targetTokenUuid: 'Token.a' });
		const retired = change({
			id: 'c2',
			change: 'noDamage',
			targetTokenUuid: 'Token.b',
			retired: true,
		});
		const covered = noDamageTargetsOf({ resultChanges: [shielded, retired, change({ id: 'c3' })] });
		expect([...covered.keys()]).toEqual(['Token.a']);
		expect(covered.get('Token.a')).toBe(shielded);
	});
});

describe('resultRemovalRefusal', () => {
	it('lets a standing click go', () => {
		expect(resultRemovalRefusal({}, change())).toBeNull();
	});

	it('asks for the Keep a Result first while one waits', () => {
		expect(resultRemovalRefusal({ pendingKeep: { entryId: 'e1' } }, change())).toBe(KEEP_FIRST);
	});

	it('refuses an automatic or a retired change', () => {
		expect(resultRemovalRefusal({}, change({ automatic: true }))).toBe(USE_FAILED);
		expect(resultRemovalRefusal({}, change({ retired: true }))).toBe(USE_FAILED);
	});

	it('refuses no damage once the damage is applied, and only then', () => {
		const noDamage = change({ change: 'noDamage', targetTokenUuid: 'Token.a' });
		expect(resultRemovalRefusal({ damageApplied: true }, noDamage)).toBe(USE_FAILED);
		expect(resultRemovalRefusal({ damageApplied: false }, noDamage)).toBeNull();
		expect(resultRemovalRefusal({ damageApplied: true }, change())).toBeNull();
	});
});

describe('owesCritTriggers', () => {
	it('is true only for kept crit triggers that have not fired', () => {
		expect(owesCritTriggers({ discardedCritTriggers: true })).toBe(true);
		expect(
			owesCritTriggers({ discardedCritTriggers: true, discardedCritTriggersFired: true }),
		).toBe(false);
		expect(owesCritTriggers({ discardedCritTriggers: false })).toBe(false);
		expect(owesCritTriggers(null)).toBe(false);
	});
});

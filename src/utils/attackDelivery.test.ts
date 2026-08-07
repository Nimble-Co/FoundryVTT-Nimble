import { describe, expect, it } from 'vitest';
import { attackDeliveryFromAttackType, matchesAttackDelivery } from './attackDelivery.js';

describe('attackDeliveryFromAttackType', () => {
	it('maps the two attack types to their delivery channels', () => {
		expect(attackDeliveryFromAttackType('reach')).toBe('melee');
		expect(attackDeliveryFromAttackType('range')).toBe('ranged');
	});

	it('returns null for an activation with no attack type', () => {
		expect(attackDeliveryFromAttackType('')).toBeNull();
		expect(attackDeliveryFromAttackType(undefined)).toBeNull();
		expect(attackDeliveryFromAttackType(null)).toBeNull();
		expect(attackDeliveryFromAttackType('melee')).toBeNull();
	});
});

describe('matchesAttackDelivery', () => {
	it('treats an absent filter as unrestricted', () => {
		expect(matchesAttackDelivery(null, 'melee')).toBe(true);
		expect(matchesAttackDelivery(undefined, 'ranged')).toBe(true);
		expect(matchesAttackDelivery('any', null)).toBe(true);
	});

	it('requires an exact match when the filter is set', () => {
		expect(matchesAttackDelivery('melee', 'melee')).toBe(true);
		expect(matchesAttackDelivery('melee', 'ranged')).toBe(false);
		expect(matchesAttackDelivery('ranged', 'ranged')).toBe(true);
		expect(matchesAttackDelivery('ranged', 'melee')).toBe(false);
	});

	it('fails a set filter against an activation with no delivery', () => {
		expect(matchesAttackDelivery('melee', null)).toBe(false);
		expect(matchesAttackDelivery('ranged', null)).toBe(false);
	});
});

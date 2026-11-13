import { describe, expect, it } from 'vitest';
import { deliveryOfAttack, matchesAttackDelivery } from '../attackDelivery.js';

describe('deliveryOfAttack', () => {
	const hero = { type: 'character' };
	const attack = (attackType: string | null | undefined, extra: Record<string, unknown> = {}) => ({
		targets: { attackType },
		...extra,
	});
	const area = { acquireTargetsFromTemplate: true, template: { shape: 'cone' } };

	it('maps the two attack types to their delivery channels', () => {
		expect(deliveryOfAttack(attack('reach'), hero)).toBe('melee');
		expect(deliveryOfAttack(attack('range'), hero)).toBe('ranged');
		expect(deliveryOfAttack(attack('range'), { type: 'npc' })).toBe('ranged');
	});

	it('gives no delivery to a hero activation with no attack type', () => {
		expect(deliveryOfAttack(attack(''), hero)).toBeNull();
		expect(deliveryOfAttack(attack(undefined), hero)).toBeNull();
		expect(deliveryOfAttack(null, null)).toBeNull();
		expect(deliveryOfAttack(attack('melee'), hero)).toBeNull();
	});

	it('makes a monster attack with no attack type melee (Reach 1)', () => {
		for (const type of ['npc', 'minion', 'soloMonster']) {
			expect(deliveryOfAttack(attack(''), { type })).toBe('melee');
			expect(deliveryOfAttack({}, { type })).toBe('melee');
		}
	});

	it('gives no delivery to a monster area attack with no attack type', () => {
		expect(deliveryOfAttack(attack('', area), { type: 'soloMonster' })).toBeNull();
	});

	it('keeps the melee default when only a stale template shape is left', () => {
		const stale = { acquireTargetsFromTemplate: false, template: { shape: 'cone' } };
		expect(deliveryOfAttack(attack('', stale), { type: 'npc' })).toBe('melee');
	});

	it('keeps the attack type of an area attack that has one', () => {
		expect(deliveryOfAttack(attack('reach', area), { type: 'npc' })).toBe('melee');
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

import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	currentDamageCard,
	damageCardIdOf,
	damageCardOption,
	withDamageCard,
} from '../damageCard.js';

describe('damage card', () => {
	it('names the card only while its damage is applied', () => {
		let seen: string | null = null;
		withDamageCard('card-1', () => {
			seen = currentDamageCard();
		});
		expect(seen).toBe('card-1');
		expect(currentDamageCard()).toBeNull();
	});

	it('reads the card back from the update options', () => {
		expect(damageCardOption('card-1')).toEqual({ [SYSTEM_ID]: { damageCardId: 'card-1' } });
		expect(damageCardIdOf(damageCardOption('card-1'))).toBe('card-1');
		expect(damageCardOption(null)).toEqual({});
		expect(damageCardIdOf({})).toBeNull();
		expect(damageCardIdOf(undefined)).toBeNull();
	});
});

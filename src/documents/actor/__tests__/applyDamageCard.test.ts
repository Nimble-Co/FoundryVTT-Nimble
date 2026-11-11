import { describe, expect, it, vi } from 'vitest';
import { damageCardIdOf, withDamageCard } from '#utils/damage/damageCard.js';
import { NimbleBaseActor } from '../base.svelte.js';

function woundedActor() {
	const actor = new NimbleBaseActor({
		_id: 'hero',
		name: 'Hero',
		type: 'character',
		system: { attributes: { hp: { value: 10, max: 10, temp: 0 } } },
	} as never);
	return Object.assign(actor, { update: vi.fn(async () => undefined) });
}

describe('NimbleBaseActor.applyDamage from a damage card', () => {
	it('names the card in the options of the HP update', async () => {
		const actor = woundedActor();

		await withDamageCard('attack-card', () => actor.applyDamage(4));

		const [changes, options] = actor.update.mock.calls[0] as unknown as [object, unknown];
		expect(changes).toEqual({ 'system.attributes.hp.value': 6 });
		expect(damageCardIdOf(options)).toBe('attack-card');
	});

	it('names no card when the damage does not come from a card', async () => {
		const actor = woundedActor();

		await actor.applyDamage(4);

		const [, options] = actor.update.mock.calls[0] as unknown as [object, unknown];
		expect(damageCardIdOf(options)).toBeNull();
	});
});

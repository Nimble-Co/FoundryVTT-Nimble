import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { damageCardIdOf, withDamageCard } from '#utils/damage/damageCard.js';
import { NimbleBaseActor } from '../base.svelte.js';

function woundedActor(hp: { value: number; temp: number } = { value: 10, temp: 0 }) {
	const actor = new NimbleBaseActor({
		_id: 'hero',
		name: 'Hero',
		type: 'character',
		system: { attributes: { hp: { ...hp, max: 10 } } },
	} as never);
	return Object.assign(actor, { update: vi.fn(async () => undefined) });
}

describe('NimbleBaseActor.applyDamage from a damage card', () => {
	it('names the card in the options of the HP update', async () => {
		const actor = woundedActor();

		await withDamageCard('attack-card', () => actor.applyDamage(4));

		const [changes, options] = actor.update.mock.calls[0] as unknown as [object, unknown];
		expect(changes).toEqual({
			'system.attributes.hp.value': 6,
			[`flags.${SYSTEM_ID}.damageTaken`]: 4,
		});
		expect(damageCardIdOf(options)).toBe('attack-card');
	});

	it('names no card when the damage does not come from a card', async () => {
		const actor = woundedActor();

		await actor.applyDamage(4);

		const [, options] = actor.update.mock.calls[0] as unknown as [object, unknown];
		expect(damageCardIdOf(options)).toBeNull();
	});
});

describe('NimbleBaseActor damage taken', () => {
	it('writes the damage before temp HP in the same update as the HP', async () => {
		const actor = woundedActor({ value: 10, temp: 3 });

		await actor.applyDamage(5);

		expect(actor.update).toHaveBeenCalledTimes(1);
		expect((actor.update.mock.calls as unknown[][])[0]?.[0]).toEqual({
			'system.attributes.hp.temp': 0,
			'system.attributes.hp.value': 8,
			[`flags.${SYSTEM_ID}.damageTaken`]: 5,
		});
	});

	it('writes nothing for 0 damage', async () => {
		const actor = woundedActor();

		await actor.applyDamage(0);

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('gives @damageTaken 0 with no hit, and the newest hit after one', () => {
		const actor = woundedActor();
		expect(actor.getRollData().damageTaken).toBe(0);

		(actor as unknown as { flags: object }).flags = { [SYSTEM_ID]: { damageTaken: 14 } };
		expect(actor.getRollData().damageTaken).toBe(14);
	});
});

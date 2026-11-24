import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import * as giveWoundsModule from '../../../utils/actor/giveWounds.js';
import { withDamageCard } from '../../../utils/damage/damageCard.js';
import { NimbleBaseActor } from '../base.svelte.js';

const give = vi.spyOn(giveWoundsModule, 'giveWounds').mockResolvedValue(null);

if (typeof Math.clamp !== 'function') {
	Math.clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
}

function hero(hp: { value: number; max?: number; temp?: number } = { value: 8 }) {
	const actor = new NimbleBaseActor({
		_id: 'hero',
		name: 'Hero',
		type: 'character',
		system: { attributes: { hp: { max: 10, temp: 0, ...hp } } },
	} as never);
	actor.rules = [];
	return Object.assign(actor, { update: vi.fn(async () => undefined) });
}

function prevent(extra: Record<string, unknown> = {}) {
	return {
		type: 'wouldDropToZero',
		choice: 'automatic',
		watch: 'self',
		appliesTo: () => true,
		matchesDrop: () => true,
		planDrop: () => ({ response: 'prevent' as const, woundInstead: 0, moveDistance: 0 }),
		...extra,
	};
}

beforeEach(() => {
	give.mockClear();
});

describe('dropping to 0 HP', () => {
	it('writes 0 HP and grants the Wound that drop causes', async () => {
		const actor = hero();

		await actor.applyDamage(8);

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 0,
			[`flags.${SYSTEM_ID}.damageTaken`]: 8,
		});
		expect(give).toHaveBeenCalledTimes(1);
		expect(give).toHaveBeenCalledWith(actor, 1, { cause: 'dropToZero', source: null });
	});

	it('writes nothing and grants no Wound when the drop is prevented', async () => {
		const actor = hero();
		actor.rules = [prevent()] as unknown as typeof actor.rules;

		await actor.applyDamage(8);

		expect(actor.update).not.toHaveBeenCalled();
		expect(give).not.toHaveBeenCalled();
	});

	it('leaves the creature at 1 HP and does not grant the drop’s Wound', async () => {
		const actor = hero({ value: 8, temp: 2 });
		actor.rules = [
			prevent({
				planDrop: () => ({ response: 'floor' as const, woundInstead: 0, moveDistance: 0 }),
			}),
		] as unknown as typeof actor.rules;

		await actor.applyDamage(10);

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.temp': 0,
			'system.attributes.hp.value': 1,
			[`flags.${SYSTEM_ID}.damageTaken`]: 10,
		});
		expect(give).not.toHaveBeenCalled();
	});

	it('grants a separate Wound when the prevented drop says so, and not the drop’s own', async () => {
		const actor = hero();
		actor.rules = [
			prevent({
				planDrop: () => ({ response: 'prevent' as const, woundInstead: 1, moveDistance: 0 }),
			}),
		] as unknown as typeof actor.rules;

		await actor.applyDamage(8);

		expect(actor.update).not.toHaveBeenCalled();
		expect(give).toHaveBeenCalledTimes(1);
		expect(give).toHaveBeenCalledWith(actor, 1, { cause: 'direct', source: null });
	});

	it('grants 2 Wounds for damage taken while Dying', async () => {
		const actor = hero({ value: 0 });

		await actor.applyDamage(5);

		expect(give).toHaveBeenCalledTimes(1);
		expect(give).toHaveBeenCalledWith(actor, 2, {
			cause: 'dyingDamage',
			critical: false,
			source: null,
		});
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('grants 3 Wounds for a crit taken while Dying, with the card as the source', async () => {
		const actor = hero({ value: 0 });
		const card = {
			system: { isCritical: true },
			speakerActor: { uuid: 'Actor.ogre', name: 'Ogre' },
		};
		const messages = (game as unknown as { messages?: unknown }).messages;
		(game as unknown as { messages: unknown }).messages = { get: () => card };

		await withDamageCard('card', () => actor.applyDamage(5));
		(game as unknown as { messages: unknown }).messages = messages;

		expect(give).toHaveBeenCalledWith(actor, 3, {
			cause: 'dyingDamage',
			critical: true,
			source: { uuid: 'Actor.ogre', name: 'Ogre' },
		});
	});

	it('still grants the Wounds when temp HP take all the damage while Dying', async () => {
		const actor = hero({ value: 0, temp: 4 });

		await actor.applyDamage(3);

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.temp': 1,
			[`flags.${SYSTEM_ID}.damageTaken`]: 3,
		});
		expect(give).toHaveBeenCalledWith(actor, 2, expect.objectContaining({ cause: 'dyingDamage' }));
	});

	it('gives no Wounds for damage at 0 HP to a creature that is not a hero', async () => {
		const actor = hero({ value: 0 });
		Object.defineProperty(actor, 'type', { value: 'npc', configurable: true });

		await actor.applyDamage(5);

		expect(give).not.toHaveBeenCalled();
	});

	it('does not treat damage that temp HP fully absorbs as a drop', async () => {
		const actor = hero({ value: 8, temp: 5 });

		await actor.applyDamage(3);

		expect(give).not.toHaveBeenCalled();
		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.temp': 2,
			[`flags.${SYSTEM_ID}.damageTaken`]: 3,
		});
	});

	it('uses the same drop when HP is set to 0', async () => {
		const actor = hero();
		actor.rules = [prevent()] as unknown as typeof actor.rules;

		await actor.setCurrentHP(0);

		expect(actor.update).not.toHaveBeenCalled();
		expect(give).not.toHaveBeenCalled();
	});
});

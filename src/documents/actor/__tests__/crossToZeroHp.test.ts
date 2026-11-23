import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import * as giveWoundsModule from '../../../utils/actor/giveWounds.js';
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

	it('does not grant a Wound for damage taken while already at 0 HP', async () => {
		const actor = hero({ value: 0 });

		await actor.applyDamage(5);

		expect(give).not.toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
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

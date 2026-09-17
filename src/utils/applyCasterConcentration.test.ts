import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import applyCasterConcentration from './applyCasterConcentration.js';

function createConditionEffect() {
	const source: Record<string, unknown> = { _id: 'concentration-effect' };

	return {
		id: 'concentration-effect',
		statuses: new Set<string>(),
		source,
		updateSource: (data: Record<string, unknown>) => Object.assign(source, data),
		toObject: () => ({ ...source }),
	};
}

function createCaster() {
	return {
		uuid: 'Actor.caster',
		statuses: new Set<string>(),
		effects: { get: () => undefined, [Symbol.iterator]: () => [].values() },
		toggleStatusEffect: vi.fn(async () => undefined),
	};
}

function createItem(properties: string[], caster: ReturnType<typeof createCaster> | null) {
	return {
		uuid: 'Item.spell',
		tags: new Set(properties.map((property) => `property:${property}`)),
		actor: caster,
	};
}

beforeEach(() => {
	fromStatusEffect.mockReset().mockImplementation(async () => createConditionEffect());
	createEffect.mockReset().mockImplementation(async (effect: unknown) => effect);
	(CONFIG as { statusEffects?: unknown }).statusEffects = [{ id: 'concentration' }];
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe('applyCasterConcentration', () => {
	it('applies the condition to the caster whatever the spell targets, crediting the item', async () => {
		const caster = createCaster();

		await applyCasterConcentration(createItem(['concentration'], caster));

		expect(fromStatusEffect).toHaveBeenCalledWith('concentration', { parent: caster });
		expect(createEffect).toHaveBeenCalledWith(expect.objectContaining({ origin: 'Item.spell' }), {
			parent: caster,
			keepId: true,
		});
	});

	it('applies nothing for a spell without the concentration property', async () => {
		const caster = createCaster();

		await applyCasterConcentration(createItem(['reach'], caster));

		expect(createEffect).not.toHaveBeenCalled();
		expect(caster.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('applies nothing when the item has no owner', async () => {
		await applyCasterConcentration(createItem(['concentration'], null));

		expect(createEffect).not.toHaveBeenCalled();
	});

	it('applies nothing to an item carrying no tags at all', async () => {
		const result = await applyCasterConcentration({ actor: createCaster() });

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('reports nothing applied when a preApplyCondition listener refuses', async () => {
		(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const result = await applyCasterConcentration(createItem(['concentration'], createCaster()));

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('ends the previous concentration so the caster holds exactly one', async () => {
		const caster = createCaster();
		caster.statuses.add('concentration');
		caster.toggleStatusEffect.mockImplementation(async () => {
			caster.statuses.delete('concentration');
			return undefined;
		});

		await applyCasterConcentration(createItem(['concentration'], caster));

		expect(caster.toggleStatusEffect).toHaveBeenCalledWith('concentration', { active: false });
		expect(createEffect).toHaveBeenCalledTimes(1);
	});
});

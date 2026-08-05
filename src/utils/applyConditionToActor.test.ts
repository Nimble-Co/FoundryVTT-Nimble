import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import applyConditionToActor from './applyConditionToActor.js';

interface FakeEffect {
	id: string;
	statuses: Set<string>;
	/** What `updateSource` has folded in, standing for the effect's own source data. */
	sourceData: Record<string, unknown>;
	updateSource(data: Record<string, unknown>): void;
}

function createFakeEffect(id = 'effect-1', statuses: string[] = []): FakeEffect {
	const sourceData: Record<string, unknown> = {};

	return {
		id,
		statuses: new Set(statuses),
		sourceData,
		updateSource: (data: Record<string, unknown>) => {
			Object.assign(sourceData, data);
		},
	};
}

function createEffectsCollection(effects: FakeEffect[]) {
	return {
		get: (id: string) => effects.find((effect) => effect.id === id),
		[Symbol.iterator]: () => effects[Symbol.iterator](),
	};
}

function createTargetActor(
	options: { statuses?: string[]; effects?: FakeEffect[]; uuid?: string } = {},
) {
	return {
		uuid: options.uuid ?? 'Actor.target',
		statuses: new Set(options.statuses ?? []),
		effects: createEffectsCollection(options.effects ?? []),
	};
}

beforeEach(() => {
	hooksCall.mockReset().mockReturnValue(true);
	hooksCallAll.mockReset();
	fromStatusEffect.mockReset().mockImplementation(async () => createFakeEffect());
	createEffect.mockReset().mockImplementation(async (effect: FakeEffect) => effect);

	// Conditions with linked statuses are registered with a static `_id`; the
	// rest are registered without one. Both shapes matter to the dedupe.
	(CONFIG as { statusEffects?: unknown }).statusEffects = [
		{ id: 'dazed' },
		{ id: 'restrained', _id: 'restrained0000000' },
	];
});

describe('applyConditionToActor dedupe', () => {
	it('does nothing when the target already has the condition', async () => {
		const target = createTargetActor({ statuses: ['dazed'] });

		const result = await applyConditionToActor(target, 'dazed');

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
		expect(hooksCall).not.toHaveBeenCalled();
		expect(hooksCallAll).not.toHaveBeenCalled();
	});

	it('does nothing when a disabled effect already holds the condition', async () => {
		// `statuses` only lists active effects, so this effect is invisible there.
		const target = createTargetActor({ effects: [createFakeEffect('effect-1', ['dazed'])] });

		const result = await applyConditionToActor(target, 'dazed');

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('does nothing when an effect already holds the reserved id of a linked-status condition', async () => {
		const target = createTargetActor({
			effects: [createFakeEffect('restrained0000000', ['restrained', 'prone'])],
		});

		const result = await applyConditionToActor(target, 'restrained');

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('applies when an unrelated effect is present', async () => {
		const target = createTargetActor({ effects: [createFakeEffect('effect-1', ['bloodied'])] });

		await applyConditionToActor(target, 'dazed');

		expect(createEffect).toHaveBeenCalledTimes(1);
	});
});

describe('applyConditionToActor blocking hook', () => {
	it('does not apply the condition when a listener returns false', async () => {
		hooksCall.mockReturnValue(false);
		const target = createTargetActor();

		const result = await applyConditionToActor(target, 'dazed');

		expect(hooksCall).toHaveBeenCalledWith(
			'nimble.preApplyCondition',
			expect.objectContaining({ target, condition: 'dazed' }),
		);
		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
		expect(hooksCallAll).not.toHaveBeenCalled();
	});

	it('passes the item as the hook source so immunity listeners can inspect it', async () => {
		const target = createTargetActor();
		const sourceItem = { uuid: 'Item.feature' };

		await applyConditionToActor(target, 'dazed', { sourceItem });

		expect(hooksCall).toHaveBeenCalledWith(
			'nimble.preApplyCondition',
			expect.objectContaining({ source: sourceItem }),
		);
	});
});

describe('applyConditionToActor origin', () => {
	it('records the item uuid when an item caused the condition', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			sourceItem: { uuid: 'Item.feature' },
			sourceActor: { uuid: 'Actor.attacker' },
		});

		expect(effect.sourceData.origin).toBe('Item.feature');
	});

	it('falls back to the actor uuid when no item is known', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			sourceActor: { uuid: 'Actor.attacker' },
		});

		expect(effect.sourceData.origin).toBe('Actor.attacker');
	});

	it('records no origin when neither an item nor an actor is known', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed');

		expect(effect.sourceData).not.toHaveProperty('origin');
	});

	it('creates the effect on the target while preserving its reserved id', async () => {
		const target = createTargetActor();
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(target, 'dazed');

		expect(createEffect).toHaveBeenCalledWith(effect, { parent: target, keepId: true });
	});
});

describe('applyConditionToActor duration', () => {
	it('stamps the requested duration on the created effect', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			duration: { rounds: 3, turns: null, seconds: null },
		});

		expect(effect.sourceData.duration).toEqual({ rounds: 3 });
	});

	it('leaves the duration alone when every field is empty', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			duration: { rounds: null, turns: null, seconds: null },
		});

		expect(effect.sourceData).not.toHaveProperty('duration');
	});
});

describe('applyConditionToActor applied hook', () => {
	it('fires once the effect exists, carrying the effect and its source', async () => {
		const target = createTargetActor();
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);
		const sourceItem = { uuid: 'Item.feature' };

		const result = await applyConditionToActor(target, 'dazed', { sourceItem });

		expect(result).toBe(effect);
		expect(hooksCallAll).toHaveBeenCalledWith(
			'nimble.conditionApplied',
			expect.objectContaining({ target, condition: 'dazed', effect, source: sourceItem }),
		);
	});
});

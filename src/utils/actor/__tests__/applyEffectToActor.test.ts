import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';
import { CONDITION_REPLACED_OPTION } from '../applyConditionToActor.js';

const createEffect = vi.fn();
const deleteDocuments = vi.fn();
const query = vi.fn();

import {
	applyEffectToActor,
	type EffectPayload,
	payloadFromEffect,
} from '../applyEffectToActor.js';

const turnMoment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
} as const;

function plainPayload(lastsUntil: object[] = [turnMoment]): EffectPayload {
	return {
		data: { name: 'Snowblind', statuses: [], system: { lastsUntil } },
		sourceItemUuid: 'Actor.hero.Item.spell',
		sourceActorUuid: 'Actor.hero',
	};
}

function holder(fields: { isOwner?: boolean; effects?: object[] } = {}) {
	return { uuid: 'Actor.goblin', name: 'Goblin', isOwner: true, effects: [], ...fields };
}

beforeEach(() => {
	createEffect.mockReset().mockResolvedValue({ uuid: 'Actor.goblin.ActiveEffect.new' });
	deleteDocuments.mockReset();
	query
		.mockReset()
		.mockResolvedValue({ effectUuid: 'Actor.goblin.ActiveEffect.gm', actorName: 'Goblin' });
	vi.stubGlobal(
		'fromUuid',
		vi.fn(async (uuid: string) => ({ uuid })),
	);
	vi.stubGlobal('Roll', {
		replaceFormulaData: (formula: string, data: Record<string, number>) =>
			formula.replace('@intelligence', String(data.intelligence)),
		safeEval: (formula: string) => Function(`return ${formula}`)(),
	});
	(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
		documentClass: { create: createEffect, deleteDocuments },
	};
	(game as unknown as { users: object }).users = { activeGM: { query } };
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('payloadFromEffect', () => {
	it('copies the effect without its place on the item, and works out the Escape DC', () => {
		const effect = {
			toObject: () => ({
				_id: 'abc',
				name: 'Grappled',
				origin: 'Item.x',
				transfer: false,
				start: { round: 1 },
				statuses: ['grappled'],
				system: { escape: { dc: '10 + @intelligence', saves: 'strOrDex' } },
			}),
		};
		const user = { type: 'npc', uuid: 'Actor.worg', getRollData: () => ({ intelligence: 3 }) };

		const payload = payloadFromEffect(effect, { itemUuid: 'Actor.worg.Item.bite', user });

		expect(payload).toEqual({
			data: {
				name: 'Grappled',
				statuses: ['grappled'],
				system: { escape: { dc: '13', saves: 'strOrDex' } },
			},
			sourceItemUuid: 'Actor.worg.Item.bite',
			sourceActorUuid: 'Actor.worg',
		});
	});
});

describe('applyEffectToActor', () => {
	it('creates an effect with no status on an owned target, with the item as origin', async () => {
		const result = await applyEffectToActor(holder(), plainPayload());

		expect(createEffect).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Snowblind',
				origin: 'Actor.hero.Item.spell',
				type: NIMBLE_EFFECT_TYPE,
			}),
			{ parent: expect.objectContaining({ uuid: 'Actor.goblin' }) },
		);
		expect(result).toEqual({ effectUuid: 'Actor.goblin.ActiveEffect.new', actorName: 'Goblin' });
		expect(query).not.toHaveBeenCalled();
	});

	it('asks the active GM for a target the user does not own', async () => {
		const payload = plainPayload();

		const result = await applyEffectToActor(holder({ isOwner: false }), payload);

		expect(query).toHaveBeenCalledWith('nimble.applyEffect', {
			targetUuid: 'Actor.goblin',
			payload,
		});
		expect(createEffect).not.toHaveBeenCalled();
		expect(result?.effectUuid).toBe('Actor.goblin.ActiveEffect.gm');
	});

	it('keeps the same effect from the same item when it lasts longer', async () => {
		const current = {
			id: 'old',
			name: 'Snowblind',
			origin: 'Actor.hero.Item.spell',
			statuses: new Set(),
			system: { lastsUntil: [{ ...turnMoment, kind: 'time', value: 10, units: 'rounds' }] },
		};

		const result = await applyEffectToActor(holder({ effects: [current] }), plainPayload());

		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('replaces the same effect from the same item when the new one lasts longer', async () => {
		const current = {
			id: 'old',
			name: 'Snowblind',
			origin: 'Actor.hero.Item.spell',
			statuses: new Set(),
			system: { lastsUntil: [{ ...turnMoment, span: 'currentTurn' }] },
		};

		await applyEffectToActor(holder({ effects: [current] }), plainPayload());

		expect(deleteDocuments).toHaveBeenCalledWith(['old'], {
			parent: expect.anything(),
			[CONDITION_REPLACED_OPTION]: true,
		});
		expect(createEffect).toHaveBeenCalled();
	});
});

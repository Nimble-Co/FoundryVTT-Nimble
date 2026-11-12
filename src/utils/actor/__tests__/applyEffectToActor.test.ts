import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';
import { CONDITION_REPLACED_OPTION, EFFECT_RECREATED_OPTION } from '../applyConditionToActor.js';

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

function holder(fields: { isOwner?: boolean; effects?: object[]; temp?: number } = {}) {
	const { temp = 0, ...rest } = fields;
	return {
		uuid: 'Actor.goblin',
		name: 'Goblin',
		isOwner: true,
		effects: [],
		system: { attributes: { hp: { temp } } },
		update: vi.fn(async () => undefined),
		...rest,
	};
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
				system: { escape: { dc: '10 + @intelligence', saves: ['strength', 'dexterity'] } },
			}),
		};
		const user = { type: 'npc', uuid: 'Actor.worg', getRollData: () => ({ intelligence: 3 }) };

		const payload = payloadFromEffect(effect, { itemUuid: 'Actor.worg.Item.bite', user });

		expect(payload).toEqual({
			data: {
				name: 'Grappled',
				statuses: ['grappled'],
				system: { escape: { dc: '13', saves: ['strength', 'dexterity'] } },
			},
			sourceItemUuid: 'Actor.worg.Item.bite',
			sourceActorUuid: 'Actor.worg',
		});
	});

	it('replaces the @ references of every rule formula with the roll data of the source', () => {
		vi.stubGlobal('Roll', {
			replaceFormulaData: (formula: string, data: { pools: Record<string, { faces: number }> }) =>
				formula.replace('@pools.judgment.faces', String(data.pools.judgment.faces)),
		});
		const rules = [
			{ type: 'heldRoll', heldKind: 'extraDamage', formula: '1d@pools.judgment.faces' },
			{ type: 'heldRoll', heldKind: 'advantage', formula: '@pools.judgment.faces' },
			{ type: 'heldRoll', heldKind: 'extraDamage', formula: '2' },
			{ type: 'note', label: 'Judge @pools.judgment.faces', formula: '@pools.judgment.faces' },
		];
		const effect = { toObject: () => ({ name: 'Shining Mandate', system: { rules } }) };
		const user = {
			type: 'character',
			uuid: 'Actor.paladin',
			getRollData: vi.fn(() => ({ pools: { judgment: { faces: 10 } } })),
		};

		const payload = payloadFromEffect(effect, { itemUuid: 'Actor.paladin.Item.decree', user });
		const copied = (payload.data.system as { rules: { formula: string; label?: string }[] }).rules;

		expect(copied.map((rule) => rule.formula)).toEqual(['1d10', '10', '2', '10']);
		expect(copied[3].label).toBe('Judge @pools.judgment.faces');
		expect(rules[0].formula).toBe('1d@pools.judgment.faces');
		expect(user.getRollData).toHaveBeenCalledTimes(1);
	});

	it('keeps the text of a rule and its links as they are', () => {
		vi.stubGlobal('Roll', {
			replaceFormulaData: (formula: string, data: Record<string, number>) =>
				formula.replace(/@(\w+)/g, (_, key: string) => String(data[key] ?? 0)),
		});
		const effect = {
			toObject: () => ({
				name: 'Marked',
				system: {
					rules: [
						{
							id: 'n1',
							type: 'note',
							title: 'See @UUID[Item.x]',
							description: 'Roll @Check[strength]',
							formula: '@level',
						},
					],
				},
			}),
		};
		const user = { type: 'character', uuid: 'Actor.hero', getRollData: () => ({ level: 4 }) };
		const { data } = payloadFromEffect(effect, { itemUuid: null, user });
		const [rule] = (data.system as { rules: Record<string, string>[] }).rules;

		expect(rule).toMatchObject({
			title: 'See @UUID[Item.x]',
			description: 'Roll @Check[strength]',
			formula: '4',
		});
	});

	it('keeps an extra damage formula as it is with no source', () => {
		const rules = [
			{ type: 'heldRoll', heldKind: 'extraDamage', formula: '1d@pools.judgment.faces' },
		];
		const effect = { toObject: () => ({ name: 'Shining Mandate', system: { rules } }) };

		const payload = payloadFromEffect(effect, { itemUuid: null, user: null });

		expect((payload.data.system as { rules: { formula: string }[] }).rules[0].formula).toBe(
			'1d@pools.judgment.faces',
		);
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

	it('names the card of the use in the create options', async () => {
		await applyEffectToActor(holder(), { ...plainPayload(), cardId: 'card1' });

		expect(createEffect).toHaveBeenCalledWith(expect.anything(), {
			parent: expect.objectContaining({ uuid: 'Actor.goblin' }),
			[SYSTEM_ID]: { effectCardId: 'card1' },
		});
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

	it('keeps the same effect from the same item when it lasts longer, and says that it stays', async () => {
		const current = {
			id: 'old',
			name: 'Snowblind',
			origin: 'Actor.hero.Item.spell',
			statuses: new Set(),
			system: { lastsUntil: [{ ...turnMoment, kind: 'time', value: 10, units: 'rounds' }] },
		};

		const result = await applyEffectToActor(holder({ effects: [current] }), plainPayload());

		expect(result).toEqual({
			effectUuid: 'Actor.goblin.ActiveEffect.old',
			actorName: 'Goblin',
			stays: true,
		});
		expect(createEffect).not.toHaveBeenCalled();
		expect(deleteDocuments).not.toHaveBeenCalled();
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
		expect(createEffect).toHaveBeenCalledWith(expect.anything(), {
			parent: expect.anything(),
			[EFFECT_RECREATED_OPTION]: true,
		});
	});

	it('gives the temp HP of the card and records them on the effect', async () => {
		const target = holder({ temp: 2 });
		const update = vi.fn(async () => undefined);
		createEffect.mockResolvedValueOnce({ uuid: 'Actor.goblin.ActiveEffect.new', update });

		const applied = await applyEffectToActor(target, { ...plainPayload(), tempHp: 6 });

		expect(target.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 6 });
		expect(update).toHaveBeenCalledWith({ 'system.tempHp': 6 });
		expect(applied).not.toHaveProperty('tempHpRefused');
	});

	it('gives no temp HP when the holder has as many already, and says so to the caller', async () => {
		const target = holder({ temp: 8 });
		const update = vi.fn(async () => undefined);
		createEffect.mockResolvedValueOnce({ uuid: 'Actor.goblin.ActiveEffect.new', update });

		const applied = await applyEffectToActor(target, { ...plainPayload(), tempHp: 6 });

		expect(target.update).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(applied?.tempHpRefused).toEqual({ temp: 8, amount: 6 });
	});

	it('takes over the temp HP of a copy it replaces, when it gives none of its own', async () => {
		const old = {
			id: 'old',
			origin: 'Actor.hero.Item.spell',
			name: 'Snowblind',
			statuses: new Set(),
			system: { lastsUntil: [{ ...turnMoment, span: 'currentTurn' }], tempHp: 6 },
		};
		const target = holder({ temp: 6, effects: [old] });
		deleteDocuments.mockImplementation(async () => {
			target.effects.splice(0);
		});
		const update = vi.fn(async () => undefined);
		createEffect.mockResolvedValueOnce({ uuid: 'Actor.goblin.ActiveEffect.new', update });

		await applyEffectToActor(target, { ...plainPayload(), tempHp: 6 });

		expect(deleteDocuments).toHaveBeenCalled();
		expect(target.update).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith({ 'system.tempHp': 6 });
	});
});

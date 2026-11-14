import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import applyConditionToActor, {
	CONDITION_REPLACED_OPTION,
	replacedWithoutEnd,
} from '../applyConditionToActor.js';

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

	it('creates a Nimble effect on the target while preserving its reserved id', async () => {
		const target = createTargetActor();
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(target, 'dazed');

		expect(createEffect).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'effect-1', type: NIMBLE_EFFECT_TYPE }),
			{ parent: target, keepId: true },
		);
	});
});

describe('applyConditionToActor duration', () => {
	it('writes a rounds duration in the core shape with a turn start expiry', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			duration: { rounds: 3, turns: null, seconds: null },
		});

		expect(effect.sourceData.duration).toEqual({ value: 3, units: 'rounds', expiry: 'turnStart' });
	});

	it('counts the duration from the start it is given', async () => {
		const START = { combat: 'c1', combatant: 'c-ogre', initiative: 30, round: 2, turn: 1, time: 0 };
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'blinded', {
			duration: { rounds: 1 },
			start: START,
		});

		expect(effect.sourceData.start).toEqual(START);
	});

	it('gives a seconds duration the same turn start expiry core gives any numeric duration', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', { duration: { seconds: 60 } });

		expect(effect.sourceData.duration).toEqual({
			value: 60,
			units: 'seconds',
			expiry: 'turnStart',
		});
	});

	it('keeps one unit when several are set, preferring seconds, then turns, then rounds', async () => {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			duration: { rounds: 2, turns: 1, seconds: null },
		});

		expect(effect.sourceData.duration).toEqual({ value: 1, units: 'turns', expiry: 'turnStart' });
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
		fromStatusEffect.mockResolvedValue(createFakeEffect());
		const created = createFakeEffect('created-1');
		createEffect.mockResolvedValue(created);
		const sourceItem = { uuid: 'Item.feature' };

		const result = await applyConditionToActor(target, 'dazed', { sourceItem });

		expect(result).toBe(created);
		expect(hooksCallAll).toHaveBeenCalledWith(
			'nimble.conditionApplied',
			expect.objectContaining({
				target,
				condition: 'dazed',
				effect: created,
				source: sourceItem,
			}),
		);
	});
});

describe('applyConditionToActor effect creation', () => {
	// V14 replaces a prepared effect's `duration` with a derived object carrying `label`,
	// `remaining` and an `Infinity` default. Creating from the document rather than its source
	// would clean that derived data into storage, which is why core creates from `toObject()`.
	it('creates the effect from its stored source, not its prepared state', async () => {
		const sourceData: Record<string, unknown> = { _id: 'effect-1' };
		const effect = {
			id: 'effect-1',
			statuses: new Set<string>(),
			duration: { rounds: 1, label: '1 Round', remaining: Infinity, seconds: Infinity },
			updateSource: (data: Record<string, unknown>) => Object.assign(sourceData, data),
			toObject: () => ({ ...sourceData }),
		};
		fromStatusEffect.mockResolvedValue(effect);

		await applyConditionToActor(createTargetActor(), 'dazed', {
			sourceItem: { uuid: 'Item.feature' },
			duration: { rounds: 1 },
		});

		const created = createEffect.mock.calls[0][0] as Record<string, unknown>;
		expect(created).not.toBe(effect);
		expect(created.type).toBe(NIMBLE_EFFECT_TYPE);
		expect(created.origin).toBe('Item.feature');
		expect(created.duration).toEqual({ value: 1, units: 'rounds', expiry: 'turnStart' });
	});

	it('passes the target as the parent when building from the status entry', async () => {
		const target = createTargetActor();
		fromStatusEffect.mockResolvedValue(createFakeEffect());

		await applyConditionToActor(target, 'dazed', {});

		expect(fromStatusEffect).toHaveBeenCalledWith('dazed', { parent: target });
	});
});

describe('applyConditionToActor same condition again', () => {
	const moment = (fields: Record<string, unknown>) => ({
		kind: 'turn',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: null,
		event: null,
		effectName: '',
		...fields,
	});
	const endOfTheirNextTurn = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' });
	const oneMinute = moment({ kind: 'time', value: 1, units: 'minutes' });

	let deleteDocuments: ReturnType<typeof vi.fn>;
	let previousTime: unknown;

	function existing(id: string, statuses: string[], lastsUntil: object[]) {
		return { ...createFakeEffect(id, statuses), system: { lastsUntil }, start: { time: 0 } };
	}

	beforeEach(() => {
		deleteDocuments = vi.fn(async () => []);
		Object.assign((ActiveEffect as unknown as { implementation: object }).implementation, {
			deleteDocuments,
		});
		const g = globalThis as unknown as { game: { time?: unknown } };
		previousTime = g.game.time;
		g.game.time = {
			worldTime: 0,
			calendar: { componentsToTime: ({ minute = 0 }: { minute?: number }) => minute * 60 },
		};
	});

	afterEach(() => {
		(globalThis as unknown as { game: { time?: unknown } }).game.time = previousTime;
	});

	it('a longer application replaces a shorter one', async () => {
		const old = existing('old', ['dazed'], [endOfTheirNextTurn]);
		const target = createTargetActor({ statuses: ['dazed'], effects: [old] });

		const result = await applyConditionToActor(target, 'dazed', {
			lastsUntil: [oneMinute] as never,
		});

		expect(result).not.toBeNull();
		expect(deleteDocuments).toHaveBeenCalledWith(['old'], {
			parent: target,
			nimbleConditionReplaced: true,
		});
		expect(createEffect).toHaveBeenCalledTimes(1);
	});

	it('tells the caller the source data of what it replaced, so a take-back can put it back', async () => {
		const old = {
			...existing('old', ['dazed'], [endOfTheirNextTurn]),
			toObject: () => ({ _id: 'old', name: 'Dazed' }),
		};
		const target = createTargetActor({ statuses: ['dazed'], effects: [old] });
		const onReplaced = vi.fn();

		await applyConditionToActor(target, 'dazed', { lastsUntil: [oneMinute] as never, onReplaced });

		expect(onReplaced).toHaveBeenCalledWith([{ _id: 'old', name: 'Dazed' }]);
	});

	it('a shorter application does not replace a longer one', async () => {
		const old = existing('old', ['dazed'], [oneMinute]);
		const target = createTargetActor({ statuses: ['dazed'], effects: [old] });

		const result = await applyConditionToActor(target, 'dazed', {
			lastsUntil: [endOfTheirNextTurn] as never,
		});

		expect(result).toBeNull();
		expect(deleteDocuments).not.toHaveBeenCalled();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('an application with no end is not replaced', async () => {
		const old = existing('old', ['dazed'], []);
		const target = createTargetActor({ statuses: ['dazed'], effects: [old] });

		expect(
			await applyConditionToActor(target, 'dazed', { lastsUntil: [oneMinute] as never }),
		).toBeNull();
	});

	it('a second Taunted takes the place of the first', async () => {
		const old = existing('old', ['taunted'], []);
		const target = createTargetActor({ statuses: ['taunted'], effects: [old] });

		const result = await applyConditionToActor(target, 'taunted', {
			lastsUntil: [endOfTheirNextTurn] as never,
		});

		expect(result).not.toBeNull();
		expect(deleteDocuments).toHaveBeenCalledWith(['old'], {
			parent: target,
			nimbleConditionReplaced: true,
		});
	});

	it('stamps the moments on the created effect', async () => {
		const created = createFakeEffect();
		fromStatusEffect.mockResolvedValue(created);

		await applyConditionToActor(createTargetActor(), 'dazed', { lastsUntil: [oneMinute] as never });

		expect(created.sourceData['system.lastsUntil']).toEqual([oneMinute]);
	});
});

describe('applyConditionToActor effectData', () => {
	it('puts the authored effect on the status effect, and the patch after it', async () => {
		const target = createTargetActor();
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValueOnce(effect);

		await applyConditionToActor(target, 'dazed', {
			sourceItem: { uuid: 'Item.source' },
			effectData: { name: 'Face Me!', statuses: ['dazed'], origin: 'Item.other' },
		});

		expect(effect.sourceData).toMatchObject({ name: 'Face Me!', origin: 'Item.source' });
	});

	it('keeps the statuses that the condition carries with it', async () => {
		const target = createTargetActor();
		const effect = createFakeEffect('effect-1', ['petrified', 'incapacitated']);
		fromStatusEffect.mockResolvedValueOnce(effect);

		await applyConditionToActor(target, 'petrified', {
			effectData: { name: 'Stone Gaze', statuses: ['petrified'] },
		});

		expect(effect.sourceData.statuses).toEqual(['petrified', 'incapacitated']);
	});

	it('asks preApplyCondition for each status of the effect', async () => {
		const target = createTargetActor();
		hooksCall.mockImplementation(
			(_name: string, data: { condition: string }) => data.condition !== 'prone',
		);

		const result = await applyConditionToActor(target, 'dazed', {
			effectData: { statuses: ['dazed', 'prone'] },
		});

		expect(hooksCall.mock.calls.map(([, data]) => data.condition)).toEqual(['dazed', 'prone']);
		expect(result).toBeNull();
		expect(createEffect).not.toHaveBeenCalled();
	});

	describe("the status entry's rules", () => {
		const swallowedDamage = { id: 'swallowedDamage', type: 'turnDamage', formula: '20' };

		beforeEach(() => {
			(CONFIG as { statusEffects?: unknown }).statusEffects = [
				{ id: 'swallowed', system: { rules: [swallowedDamage] } },
			];
		});

		async function rulesAfter(effectData: Record<string, unknown>) {
			const effect = createFakeEffect();
			fromStatusEffect.mockResolvedValueOnce(effect);
			await applyConditionToActor(createTargetActor(), 'swallowed', { effectData });
			return effect.sourceData['system.rules'];
		}

		it('stay on an authored effect that has no rules', async () => {
			expect(await rulesAfter({ name: 'Swallow', system: { rules: [] } })).toEqual([
				swallowedDamage,
			]);
		});

		it('come after the authored rules, and an authored rule with the same id wins', async () => {
			const own = { id: 'swallowedDamage', type: 'turnDamage', formula: '30' };
			const other = { id: 'other', type: 'note' };

			expect(await rulesAfter({ system: { rules: [own, other] } })).toEqual([own, other]);
			expect(await rulesAfter({ system: { rules: [other] } })).toEqual([other, swallowedDamage]);
		});
	});
});

describe("applyConditionToActor the status entry's Lasts Until", () => {
	const event = (name: string, who: string | null) => ({
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who,
		event: name,
		effectName: '',
	});
	const entryMoments = [event('attack', 'holder'), event('combatEnd', null)];
	const oneMinute = {
		...event('attack', 'holder'),
		kind: 'time',
		who: null,
		event: null,
		value: 1,
		units: 'minutes',
	};

	beforeEach(() => {
		(CONFIG as { statusEffects?: unknown }).statusEffects = [
			{ id: 'despair', system: { lastsUntil: entryMoments } },
		];
	});

	async function applied(options: Parameters<typeof applyConditionToActor>[2] = {}) {
		const effect = createFakeEffect();
		fromStatusEffect.mockResolvedValue(effect);
		await applyConditionToActor(createTargetActor(), 'despair', options);
		return effect.sourceData['system.lastsUntil'];
	}

	it('keeps the moments when the caller gives no moments and no duration', async () => {
		expect(await applied()).toEqual(entryMoments);
		expect(await applied({ lastsUntil: [] })).toEqual(entryMoments);
	});

	it('keeps them when the authored effect has no moments', async () => {
		expect(await applied({ effectData: { system: { lastsUntil: [] } } })).toEqual(entryMoments);
	});

	it('uses the moments the caller gives', async () => {
		expect(await applied({ lastsUntil: [oneMinute] as never })).toEqual([oneMinute]);
	});

	it("uses the authored effect's moments", async () => {
		expect(await applied({ effectData: { system: { lastsUntil: [oneMinute] } } })).toEqual([
			oneMinute,
		]);
	});

	it('drops them when the caller gives a core duration', async () => {
		expect(await applied({ duration: { rounds: 1 } })).toEqual([]);
	});

	it('drops them when the authored effect stays until someone removes it', async () => {
		expect(
			await applied({ effectData: { system: { lastsUntil: [], untilRemoved: true } } }),
		).toEqual([]);
	});
});

describe('applyConditionToActor stacks', () => {
	const stacks = (on: boolean, count = 1) => ({ on, count, at: null, effectId: '' });
	const effectData = (on = true) => ({
		name: 'Flesh to Stone',
		statuses: ['dazed'],
		system: { stacks: stacks(on), lastsUntil: [] },
	});
	function heldDazed(on = true) {
		return Object.assign(createFakeEffect('dazed1', ['dazed']), {
			name: 'Flesh to Stone',
			system: { stacks: stacks(on, 2), lastsUntil: [] },
			update: vi.fn(async () => undefined),
		});
	}

	beforeEach(() => {
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { getEffectStart: () => ({ time: 0 }) },
		};
	});

	it('adds a stack to the same stacking effect, and the holder gains it again', async () => {
		const copy = heldDazed();
		const target = createTargetActor({ statuses: ['dazed'], effects: [copy] });

		const result = await applyConditionToActor(target, 'dazed', {
			effectData: effectData(),
			createOptions: { card: 'c1' },
		});

		expect(result).toBe(copy);
		expect(createEffect).not.toHaveBeenCalled();
		expect(copy.update).toHaveBeenCalledWith(
			{ 'system.stacks.count': 3 },
			expect.objectContaining({ nimbleEffectStacked: true, card: 'c1' }),
		);
		expect(hooksCallAll).toHaveBeenCalledWith(
			'nimble.conditionApplied',
			expect.objectContaining({ condition: 'dazed', effect: copy }),
		);
	});

	it('an immune creature gets no stack', async () => {
		hooksCall.mockReturnValue(false);
		const copy = heldDazed();
		const target = createTargetActor({ statuses: ['dazed'], effects: [copy] });

		expect(await applyConditionToActor(target, 'dazed', { effectData: effectData() })).toBeNull();
		expect(copy.update).not.toHaveBeenCalled();
	});

	it('a plain effect on either side keeps the one that lasts longer', async () => {
		const plain = heldDazed(false);
		const target = createTargetActor({ statuses: ['dazed'], effects: [plain] });

		expect(await applyConditionToActor(target, 'dazed', { effectData: effectData() })).toBeNull();
		expect(plain.update).not.toHaveBeenCalled();

		const copy = heldDazed();
		const other = createTargetActor({ statuses: ['dazed'], effects: [copy] });
		expect(
			await applyConditionToActor(other, 'dazed', { effectData: effectData(false) }),
		).toBeNull();
		expect(copy.update).not.toHaveBeenCalled();
	});
});

describe('replacedWithoutEnd', () => {
	const replaced = { [CONDITION_REPLACED_OPTION]: true };

	it('is true for a replaced copy: it only starts again', () => {
		expect(replacedWithoutEnd({ statuses: new Set(['dazed']) }, replaced)).toBe(true);
		expect(replacedWithoutEnd({}, replaced)).toBe(true);
	});

	it('is false for a replaced Concentration, and for a delete that is not a replacement', () => {
		expect(replacedWithoutEnd({ statuses: new Set(['concentration']) }, replaced)).toBe(false);
		expect(replacedWithoutEnd({ statuses: new Set(['dazed']) }, {})).toBe(false);
		expect(replacedWithoutEnd({}, undefined)).toBe(false);
	});
});

import { describe, expect, it, vi } from 'vitest';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';
import { toggleEffectData, turnToggleOn } from '../toggleEffectData.js';

function moment(event: Moment['event']): Moment {
	return {
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: 'holder',
		event,
		effectName: '',
	};
}

const roundEnd: Moment = {
	kind: 'turn',
	boundary: 'end',
	clock: null,
	span: 'currentRound',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

function itemEffect(transfer = false) {
	const source = {
		_id: 'raging',
		name: 'Raging',
		img: 'raging.webp',
		transfer,
		disabled: true,
		origin: 'Compendium.x',
		start: { round: 9 },
		changes: [{ key: 'system.x', value: '1' }],
		flags: { other: { keep: 1 } },
		system: { lastsUntil: [moment('zeroHp'), moment('die'), roundEnd] },
	};
	return { transfer, toObject: () => structuredClone(source) };
}

function setup(modifiers: Record<string, unknown>[] = [], effect = itemEffect()) {
	const actor = {
		type: 'character',
		uuid: 'Actor.hero',
		getRollData: () => ({}),
		items: { contents: [{ rules: { values: () => modifiers } }] },
	};
	const item = {
		id: 'rage',
		name: 'Rage',
		img: 'rage.webp',
		uuid: 'Actor.hero.Item.rage',
		actor,
		effects: { get: (id: string) => (id === 'raging' ? effect : undefined) },
	};
	return { actor, item };
}

const rule = { id: 'rageToggle', identifier: 'rage', label: '', effectId: 'raging' };
const modifier = (fields: Record<string, unknown>) => ({
	type: 'modifyToggle',
	toggleIdentifier: 'rage',
	...fields,
});

const eventsOf = (data: Record<string, unknown>) =>
	((data.system as { lastsUntil: Moment[] }).lastsUntil ?? []).map(
		(each) => each.event ?? each.span,
	);

describe('toggleEffectData', () => {
	it('copies the item effect, with the toggle flags, the item as origin and type nimble', () => {
		const { item } = setup();

		const data = toggleEffectData(item, rule);

		expect(data).toMatchObject({
			name: 'Raging',
			img: 'raging.webp',
			type: NIMBLE_EFFECT_TYPE,
			origin: 'Actor.hero.Item.rage',
			disabled: false,
			changes: [{ key: 'system.x', value: '1' }],
			flags: {
				other: { keep: 1 },
				nimble: { toggleEffectRuleId: 'rageToggle', toggleEffectItemId: 'rage' },
			},
		});
		expect(data).not.toHaveProperty('_id');
		expect(data).not.toHaveProperty('start');
		expect(data).not.toHaveProperty('transfer');
		expect(eventsOf(data)).toEqual(['zeroHp', 'die', 'currentRound']);
	});

	it('makes the blank effect when the rule names no effect, or one that goes to the actor', () => {
		const blank = {
			type: NIMBLE_EFFECT_TYPE,
			name: 'Rage',
			img: 'rage.webp',
			disabled: false,
			origin: 'Actor.hero.Item.rage',
			flags: { nimble: { toggleEffectRuleId: 'rageToggle', toggleEffectItemId: 'rage' } },
		};

		expect(toggleEffectData(setup().item, { ...rule, effectId: '' })).toEqual(blank);
		expect(toggleEffectData(setup([], itemEffect(true)).item, rule)).toEqual(blank);
		expect(
			toggleEffectData(setup().item, { ...rule, effectId: '', label: 'Raging' }),
		).toMatchObject({ name: 'Raging' });
	});

	it('takes out the event moments that the live Modify Toggle rules for this toggle drop', () => {
		const { item } = setup([
			modifier({ dropMoments: ['zeroHp'] }),
			modifier({ dropMoments: ['die'], disabled: true }),
			modifier({ dropMoments: ['die'], appliesTo: () => false }),
			modifier({ dropMoments: ['die'], toggleIdentifier: 'other' }),
		]);

		expect(eventsOf(toggleEffectData(item, rule))).toEqual(['die', 'currentRound']);
	});

	it('stacks the drops of more than one Modify Toggle rule, and matches the rule id', () => {
		const { item } = setup([
			modifier({ dropMoments: ['zeroHp'] }),
			modifier({ dropMoments: ['die'], toggleIdentifier: 'rageToggle' }),
		]);

		expect(eventsOf(toggleEffectData(item, rule))).toEqual(['currentRound']);
	});
});

describe('turnToggleOn', () => {
	function holder(effects: Array<{ id: string; disabled: boolean }>) {
		const flagged = effects.map((effect) => ({
			...effect,
			getFlag: (scope: string, key: string) =>
				scope === 'nimble' && key === 'toggleEffectRuleId' ? 'rageToggle' : undefined,
		}));
		return {
			effects: flagged,
			createEmbeddedDocuments: vi.fn(async () => []),
			deleteEmbeddedDocuments: vi.fn(async () => []),
		};
	}

	it('makes the effect when the toggle has none', async () => {
		const actor = holder([]);

		expect(await turnToggleOn(actor, setup().item, rule)).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			expect.objectContaining({ name: 'Raging' }),
		]);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('replaces a disabled effect: deletes it as a replace, then makes a new copy', async () => {
		const actor = holder([{ id: 'old', disabled: true }]);

		expect(await turnToggleOn(actor, setup().item, rule)).toBe(true);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['old'], {
			nimbleConditionReplaced: true,
		});
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		const [deleted] = actor.deleteEmbeddedDocuments.mock.invocationCallOrder;
		const [created] = actor.createEmbeddedDocuments.mock.invocationCallOrder;
		expect(deleted).toBeLessThan(created);
	});

	it('does nothing when the toggle is already on', async () => {
		const actor = holder([{ id: 'on', disabled: false }]);

		expect(await turnToggleOn(actor, setup().item, rule)).toBe(false);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

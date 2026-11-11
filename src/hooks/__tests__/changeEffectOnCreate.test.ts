import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';
import { changeNewEffect } from '../changeEffectOnCreate.js';

const NO_MOMENT: Moment = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'holder',
	event: null,
	effectName: '',
};

function eventMoment(event: Moment['event']): Moment {
	return { ...NO_MOMENT, event };
}

const minute: Moment = { ...NO_MOMENT, kind: 'time', who: null, value: 1, units: 'minutes' };

interface RuleStub {
	type: string;
	removeMoments: string[];
	addMoments: string[];
	changesEffectsOf(identifier: string): boolean;
}

function changeRule(
	identifier: string,
	removeMoments: string[],
	addMoments: string[] = [],
	live = true,
): RuleStub {
	return {
		type: 'changeEffect',
		removeMoments,
		addMoments,
		changesEffectsOf: (named) => live && named === identifier,
	};
}

function holderWith(rules: RuleStub[]) {
	return Object.assign(Object.create(Actor.prototype), { rules });
}

const rage = Object.assign(Object.create(Item.prototype), {
	identifier: 'rage',
	system: { identifier: '' },
});

function newEffect(parent: unknown, lastsUntil: Moment[], origin = 'Actor.a.Item.rage') {
	const updateSource = vi.fn();
	return { parent, origin, system: { lastsUntil }, updateSource };
}

describe('changeNewEffect', () => {
	beforeEach(() => {
		vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === 'Actor.a.Item.rage' ? rage : null));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('takes out the event moments the rules name, and keeps the others', () => {
		const effect = newEffect(holderWith([changeRule('rage', ['zeroHp'])]), [
			minute,
			eventMoment('zeroHp'),
			eventMoment('inactiveRound'),
		]);

		changeNewEffect(effect);

		expect(effect.updateSource).toHaveBeenCalledWith({
			'system.lastsUntil': [minute, eventMoment('inactiveRound')],
		});
	});

	it('adds an event moment for each id that is not there yet, never "another effect ends"', () => {
		const effect = newEffect(
			holderWith([changeRule('rage', [], ['attack', 'zeroHp', 'effectEnds'])]),
			[eventMoment('zeroHp')],
		);

		changeNewEffect(effect);

		expect(effect.updateSource).toHaveBeenCalledWith({
			'system.lastsUntil': [eventMoment('zeroHp'), eventMoment('attack')],
		});
	});

	it('stacks the changes of several rules for the same item', () => {
		const effect = newEffect(
			holderWith([changeRule('rage', ['zeroHp']), changeRule('rage', ['inactiveRound'], ['rest'])]),
			[eventMoment('zeroHp'), eventMoment('inactiveRound')],
		);

		changeNewEffect(effect);

		expect(effect.updateSource).toHaveBeenCalledWith({
			'system.lastsUntil': [eventMoment('rest')],
		});
	});

	it('changes nothing for another item, a rule that is not live, or no rule', () => {
		const moments = [eventMoment('zeroHp')];
		const effects = [
			newEffect(holderWith([changeRule('frenzy', ['zeroHp'])]), moments),
			newEffect(holderWith([changeRule('rage', ['zeroHp'], [], false)]), moments),
			newEffect(holderWith([]), moments),
			newEffect(holderWith([changeRule('rage', ['attack'])]), moments),
		];

		for (const effect of effects) changeNewEffect(effect);

		for (const effect of effects) expect(effect.updateSource).not.toHaveBeenCalled();
	});

	it('changes nothing for an effect that is not made on a creature, or has no item origin', () => {
		const rules = [changeRule('rage', ['zeroHp'])];
		const onItem = newEffect(rage, [eventMoment('zeroHp')]);
		const noOrigin = newEffect(holderWith(rules), [eventMoment('zeroHp')], 'Actor.a');

		changeNewEffect(onItem);
		changeNewEffect(noOrigin);

		expect(onItem.updateSource).not.toHaveBeenCalled();
		expect(noOrigin.updateSource).not.toHaveBeenCalled();
	});

	it('runs from the preCreateActiveEffect hook', async () => {
		vi.resetModules();
		const callbacks = createHookCapture(
			getTestGlobals<{ Hooks: { on: unknown } }>().Hooks.on as never,
		);
		const { default: register } = await import('../changeEffectOnCreate.js');
		register();
		const effect = newEffect(holderWith([changeRule('rage', ['zeroHp'])]), [eventMoment('zeroHp')]);

		(callbacks.get('preCreateActiveEffect') as (effect: unknown) => void)(effect);

		expect(effect.updateSource).toHaveBeenCalledWith({ 'system.lastsUntil': [] });
	});
});

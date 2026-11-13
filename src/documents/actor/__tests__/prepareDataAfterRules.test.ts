import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeedBonusRule } from '../../../models/rules/speedBonus.js';
import { NimbleActiveEffect } from '../../activeEffect/activeEffect.js';
import {
	AFTER_RULES_PHASE,
	applyMultiplyDown,
	MULTIPLY_DOWN_CHANGE,
} from '../../activeEffect/multiplyDownChange.js';
import { NimbleBaseActor } from '../base.svelte.js';

type Movement = Record<'walk' | 'fly' | 'climb' | 'swim' | 'burrow', number>;
type Change = { key: string; type: string; value: string; phase: string };

const halving = (key: string, phase = 'initial'): Change => ({
	key: `system.attributes.movement.${key}`,
	type: MULTIPLY_DOWN_CHANGE,
	value: '0.5',
	phase,
});

const core = Object.getPrototypeOf(NimbleActiveEffect.prototype) as {
	shouldApplyChange?: (change: Change, options: { phase: string }) => boolean;
};
let coreShouldApply: typeof core.shouldApplyChange;

beforeEach(() => {
	coreShouldApply = core.shouldApplyChange;
	core.shouldApplyChange = (change, options) => change.phase === options.phase;
});

afterEach(() => {
	core.shouldApplyChange = coreShouldApply;
});

/**
 * An actor through the real `prepareData`. Its `applyActiveEffects` stands in for core's: it
 * applies each change the effect lets into the phase.
 */
function makeActor(movement: Partial<Movement>, changes: Change[], formulaBonus: string | null) {
	const effect = new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)(
		{},
	);
	const phases: string[] = [];
	const seenAfterRules: number[] = [];
	const actor = {
		initialized: false,
		system: {
			attributes: { movement: { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0, ...movement } },
		},
		rules: [] as { afterPrepareData(): void }[],
		reset: vi.fn(),
		getRollData: () => ({ level: 3, attributes: actor.system.attributes }),
		getDomain: () => new Set<string>(),
		_onBeforePrepareData: vi.fn(),
		_onAfterPrepareData: () => seenAfterRules.push(actor.system.attributes.movement.walk),
		applyActiveEffects(phase: string) {
			phases.push(phase);
			for (const change of changes) {
				if (effect.shouldApplyChange(change as never, { phase })) {
					applyMultiplyDown(actor, change);
				}
			}
		},
	};
	if (formulaBonus) actor.rules.push(speedBonus(formulaBonus, actor));
	return { actor, phases, seenAfterRules };
}

function speedBonus(value: string, actor: object): SpeedBonusRule {
	const item = {
		isEmbedded: true,
		actor,
		name: 'Boots',
		uuid: 'Item.boots',
		getDomain: () => new Set(),
	};
	const rule = new SpeedBonusRule({ type: 'speedBonus', value } as never, {
		parent: item as never,
		strict: false,
	});
	Object.assign(rule, { value, movementType: null, disabled: false, label: '' });
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
	return rule;
}

function prepare(actor: object): void {
	NimbleBaseActor.prototype.prepareData.call(actor as InstanceType<typeof NimbleBaseActor>);
}

describe('prepareData: the phase after the rules', () => {
	it('halves the walk after a formula Speed Bonus, before the subclass hook', () => {
		const { actor, phases, seenAfterRules } = makeActor({}, [halving('walk')], '@level');

		prepare(actor);

		expect(phases).toEqual([AFTER_RULES_PHASE]);
		expect(actor.system.attributes.movement.walk).toBe(4);
		expect(seenAfterRules).toEqual([4]);
	});

	it('applies two halvings from two effects one after the other', () => {
		const { actor } = makeActor({}, [halving('walk'), halving('walk', 'final')], '@level');

		prepare(actor);

		expect(actor.system.attributes.movement.walk).toBe(2);
	});

	it('halves every movement type, and leaves a speed of 0 at 0', () => {
		const keys = ['walk', 'fly', 'climb', 'swim', 'burrow'] as const;
		const { actor } = makeActor(
			{ walk: 7, fly: 9, climb: 5, swim: 3, burrow: 0 },
			keys.map((key) => halving(key)),
			null,
		);

		prepare(actor);

		expect(actor.system.attributes.movement).toEqual({
			walk: 3,
			fly: 4,
			climb: 2,
			swim: 1,
			burrow: 0,
		});
	});
});

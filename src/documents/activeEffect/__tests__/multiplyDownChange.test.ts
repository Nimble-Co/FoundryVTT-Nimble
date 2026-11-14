import { describe, expect, it, onTestFinished } from 'vitest';
import { NimbleActiveEffect } from '../activeEffect.js';
import {
	AFTER_RULES_PHASE,
	applyMultiplyDown,
	MULTIPLY_DOWN_CHANGE,
	registerMultiplyDownChange,
} from '../multiplyDownChange.js';

const actorWithWalk = (walk: number) => ({ system: { attributes: { movement: { walk } } } });
const KEY = 'system.attributes.movement.walk';

describe('applyMultiplyDown', () => {
	it('halves an odd speed and rounds down', () => {
		const actor = actorWithWalk(7);
		expect(applyMultiplyDown(actor, { key: KEY, value: '0.5' })).toBe(3);
		expect(actor.system.attributes.movement.walk).toBe(3);
	});

	it('keeps a whole result that float error puts just under it', () => {
		const actor = actorWithWalk(100);
		expect(applyMultiplyDown(actor, { key: KEY, value: 0.29 })).toBe(29);
	});

	it('reads the value through the field, so a formula works', () => {
		const actor = actorWithWalk(6);
		const field = { _castChangeDelta: (raw: unknown) => (raw === '1/2' ? 0.5 : Number(raw)) };
		expect(applyMultiplyDown(actor, { key: KEY, value: '1/2' }, { field })).toBe(3);
	});

	it('changes nothing for a value that is not a number', () => {
		const actor = actorWithWalk(6);
		expect(applyMultiplyDown(actor, { key: KEY, value: 'half' })).toBeUndefined();
		expect(actor.system.attributes.movement.walk).toBe(6);
	});

	it('leaves the target as it is when told not to change it', () => {
		const actor = actorWithWalk(5);
		expect(applyMultiplyDown(actor, { key: KEY, value: 0.5 }, { modifyTarget: false })).toBe(2);
		expect(actor.system.attributes.movement.walk).toBe(5);
	});
});

describe('registerMultiplyDownChange', () => {
	it('adds the type to the change types core reads', () => {
		const config = CONFIG.ActiveEffect as { changeTypes?: Record<string, unknown> };
		const before = config.changeTypes;
		onTestFinished(() => {
			config.changeTypes = before;
		});
		config.changeTypes = { ...before };
		registerMultiplyDownChange();
		const types = (CONFIG.ActiveEffect as { changeTypes?: Record<string, { handler?: unknown }> })
			.changeTypes;
		expect(types?.[MULTIPLY_DOWN_CHANGE]?.handler).toBe(applyMultiplyDown);
	});
});

describe('the phase after the rules', () => {
	it('is registered with a label and a hint', () => {
		const config = CONFIG.ActiveEffect as {
			phases?: Record<string, { label: string; hint?: string }>;
		};
		const before = config.phases;
		onTestFinished(() => {
			config.phases = before;
		});
		config.phases = {};
		registerMultiplyDownChange();

		expect(config.phases[AFTER_RULES_PHASE]).toEqual({
			label: 'NIMBLE.effectSheet.phases.afterRules.label',
			hint: 'NIMBLE.effectSheet.phases.afterRules.hint',
		});
	});

	it('takes every Multiply, round down change, whatever phase it holds', () => {
		const core = Object.getPrototypeOf(NimbleActiveEffect.prototype) as {
			shouldApplyChange?: (change: { phase: string }, options: { phase: string }) => boolean;
		};
		const before = core.shouldApplyChange;
		onTestFinished(() => {
			core.shouldApplyChange = before;
		});
		core.shouldApplyChange = (change, options) => change.phase === options.phase;
		const effect = new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)(
			{},
		);
		const applies = (type: string, phase: string, during: string) =>
			effect.shouldApplyChange({ type, phase } as never, { phase: during } as never);

		for (const stored of ['initial', 'final']) {
			expect(applies(MULTIPLY_DOWN_CHANGE, stored, stored)).toBe(false);
			expect(applies(MULTIPLY_DOWN_CHANGE, stored, AFTER_RULES_PHASE)).toBe(true);
			expect(applies('add', stored, stored)).toBe(true);
			expect(applies('add', stored, AFTER_RULES_PHASE)).toBe(false);
		}
		expect(applies('multiply', 'initial', 'initial')).toBe(true);
	});
});

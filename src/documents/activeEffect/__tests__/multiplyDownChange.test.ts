import { describe, expect, it, onTestFinished } from 'vitest';
import {
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	stackAtUpdate,
	stackCountUpdate,
	stackEffectItem,
	stackFieldsOf,
} from '../effectStackFields.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('stackFieldsOf', () => {
	it('reads the stack fields, with the defaults of an older effect', () => {
		expect(stackFieldsOf({ stacks: { on: true, count: 3, at: 3, effectId: 'stone' } })).toEqual({
			on: true,
			count: 3,
			at: 3,
			effectId: 'stone',
		});
		expect(stackFieldsOf({})).toEqual({ on: false, count: 1, at: null, effectId: '' });
	});
});

describe('the number fields', () => {
	it('"At" takes a whole number of 2 or more, and blank is no count', () => {
		expect(stackAtUpdate('3')).toEqual({ 'system.stacks.at': 3 });
		expect(stackAtUpdate('4.7')).toEqual({ 'system.stacks.at': 4 });
		expect(stackAtUpdate('')).toEqual({ 'system.stacks.at': null });
		expect(stackAtUpdate('1')).toEqual({ 'system.stacks.at': null });
	});

	it('"Stacks now" takes a whole number of 1 or more', () => {
		expect(stackCountUpdate('5')).toEqual({ 'system.stacks.count': 5 });
		expect(stackCountUpdate('0')).toEqual({ 'system.stacks.count': 1 });
		expect(stackCountUpdate('x')).toEqual({ 'system.stacks.count': 1 });
	});
});

describe('stackEffectItem', () => {
	it('is the item of an item effect, and the origin item of an effect on a creature', () => {
		const item = Object.create(Item.prototype);
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === 'Actor.basilisk.Item.gaze' ? item : null)),
		);
		const onItem = { documentName: 'Item' };

		expect(stackEffectItem({ parent: onItem, origin: null })).toBe(onItem);
		expect(
			stackEffectItem({ parent: { documentName: 'Actor' }, origin: 'Actor.basilisk.Item.gaze' }),
		).toBe(item);
		expect(stackEffectItem({ parent: { documentName: 'Actor' }, origin: 'Actor.gone' })).toBeNull();
	});
});

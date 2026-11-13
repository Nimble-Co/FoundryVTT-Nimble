import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import {
	STACKED_OPTION,
	stackFieldsOf,
	stackingCopyOf,
	stacksOf,
	stackUp,
	takeBackStack,
} from '../effectStacks.js';

const endOfNextTurn: Moment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};
const healed: Moment = {
	...endOfNextTurn,
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	who: 'holder',
	event: 'healed',
};

const stacking = (count = 1) => ({ on: true, count, at: null, effectId: '' });

function held(fields: Record<string, unknown> = {}) {
	return {
		id: 'dazed1',
		uuid: 'Actor.goblin.ActiveEffect.dazed1',
		name: 'Flesh to Stone',
		statuses: new Set(['dazed']),
		system: { stacks: stacking(), lastsUntil: [endOfNextTurn] },
		duration: { value: null, units: 'seconds' },
		start: { time: 0 },
		update: vi.fn(async () => undefined),
		...fields,
	};
}

const holderWith = (...effects: object[]) => ({ effects });

const application = (fields: Record<string, unknown> = {}) => ({
	name: 'Flesh to Stone',
	statuses: ['dazed'],
	system: { stacks: stacking(), lastsUntil: [endOfNextTurn] },
	...fields,
});

beforeEach(() => {
	(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
		documentClass: { getEffectStart: () => ({ time: 600, combat: 'c1', round: 2 }) },
	};
	(game as unknown as { time: object }).time = { worldTime: 600 };
	(CONFIG.NIMBLE as unknown as Record<string, unknown>).conditionLinkedConditions = {
		petrified: ['incapacitated'],
	};
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('stacksOf', () => {
	it('gives the stack fields of a stacking effect only', () => {
		expect(stacksOf({ stacks: stacking(2) })).toEqual(stacking(2));
		expect(stacksOf({ stacks: { ...stacking(), on: false } })).toBeNull();
		expect(stacksOf({})).toBeNull();
		expect(stacksOf(undefined)).toBeNull();
	});
});

describe('stackingCopyOf', () => {
	it('finds a stacking effect with the same name and conditions, from any source', () => {
		const copy = held({ origin: 'Actor.basilisk2.Item.gaze' });

		expect(stackingCopyOf(holderWith(copy), application())).toBe(copy);
	});

	it('counts the conditions a condition brings with it as the same conditions', () => {
		const copy = held({ name: 'Ray', statuses: new Set(['petrified', 'incapacitated']) });

		expect(
			stackingCopyOf(holderWith(copy), application({ name: 'Ray', statuses: ['petrified'] })),
		).toBe(copy);
	});

	it('finds nothing for another name, other conditions, or a plain effect on either side', () => {
		const plain = held({ system: { stacks: { ...stacking(), on: false }, lastsUntil: [] } });

		expect(stackingCopyOf(holderWith(held()), application({ name: 'Warping Ray' }))).toBeNull();
		expect(
			stackingCopyOf(holderWith(held()), application({ statuses: ['dazed', 'prone'] })),
		).toBeNull();
		expect(stackingCopyOf(holderWith(held()), application({ statuses: [] }))).toBeNull();
		expect(stackingCopyOf(holderWith(plain), application())).toBeNull();
		expect(
			stackingCopyOf(holderWith(held()), application({ system: { lastsUntil: [endOfNextTurn] } })),
		).toBeNull();
	});
});

describe('stackUp', () => {
	it('adds one stack and keeps the timing when the new application does not last longer', async () => {
		const copy = held({ system: { stacks: stacking(2), lastsUntil: [healed] } });

		const count = await stackUp(copy, { lastsUntil: [endOfNextTurn] }, { cardOption: true });

		expect(count).toBe(3);
		expect(copy.update).toHaveBeenCalledWith(
			{ 'system.stacks.count': 3 },
			{ [STACKED_OPTION]: true, cardOption: true },
		);
	});

	it('takes the new timing when the new application lasts longer, and its turn counts start again', async () => {
		const tenMinutes: Moment = {
			...endOfNextTurn,
			kind: 'time',
			boundary: null,
			clock: null,
			span: null,
			value: 10,
			units: 'minutes',
		};
		const copy = held({
			start: { time: 0 },
			system: { stacks: stacking(), lastsUntil: [tenMinutes] },
		});

		await stackUp(copy, { lastsUntil: [tenMinutes], duration: null });

		expect(copy.update).toHaveBeenCalledWith(
			{
				'system.stacks.count': 2,
				start: { time: 600, combat: 'c1', round: 2 },
				'system.lastsUntil': [tenMinutes],
				'duration.value': null,
				[`flags.${SYSTEM_ID}.turnsSeen`]: [],
			},
			{ [STACKED_OPTION]: true },
		);
	});
});

describe('takeBackStack', () => {
	it('takes one stack off, and takes the effect off at its last stack', async () => {
		const deletable = (fields: Record<string, unknown> = {}) =>
			Object.assign(held(fields), { delete: vi.fn(async () => undefined) });
		const three = deletable({ system: { stacks: stacking(3), lastsUntil: [] } });
		const one = deletable();

		await takeBackStack(three);
		await takeBackStack(one);

		expect(three.update).toHaveBeenCalledWith({ 'system.stacks.count': 2 });
		expect(three.delete).not.toHaveBeenCalled();
		expect(one.delete).toHaveBeenCalled();
	});

	it('takes off an effect that does not stack', async () => {
		const plain = Object.assign(held({ system: { lastsUntil: [] } }), {
			delete: vi.fn(async () => undefined),
		});

		await takeBackStack(plain);

		expect(plain.delete).toHaveBeenCalled();
	});
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

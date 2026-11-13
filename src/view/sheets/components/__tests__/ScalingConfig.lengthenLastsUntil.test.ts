import { fireEvent, render, screen } from '@testing-library/svelte';
import localize from '#utils/localize.js';
import ScalingConfig from '../ScalingConfig.svelte';

const WORDS = 'NIMBLE.spellConfig.scaling';

const turnMoment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: 2,
	units: null,
	who: null,
	event: null,
	effectName: '',
};
const damageMoment = {
	...turnMoment,
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	who: 'holder',
	event: 'takeDamage',
};

function makeItem(delta: Record<string, unknown>) {
	const effect = {
		id: 'fx',
		name: 'Asleep',
		transfer: false,
		system: {
			lastsUntil: [damageMoment, turnMoment],
			rules: [{ id: 'bonus', type: 'damageBonus', label: 'Bonus', value: '@key' }],
		},
	};
	const system = {
		scaling: { mode: 'upcast', deltas: [delta], choices: null },
		activation: {
			effects: [
				{
					id: 'apply1',
					type: 'applyEffect',
					effectId: 'fx',
					recipient: 'targets',
					parentContext: null,
					parentNode: null,
				},
			],
		},
	};
	return {
		id: 'item1',
		reactive: { system },
		system,
		effects: {
			get: (id: string) => (id === 'fx' ? effect : undefined),
			[Symbol.iterator]: () => [effect][Symbol.iterator](),
		},
		update: vi.fn(async () => undefined),
	};
}

function selectNamed(key: string) {
	return screen.getByRole('combobox', { name: localize(`${WORDS}.${key}`) }) as HTMLSelectElement;
}

const delta = {
	operation: 'addFlatDamage',
	value: 1,
	dice: null,
	condition: null,
	targetEffectId: null,
	durationType: null,
	maxDieFaces: null,
	ruleId: null,
	ruleField: null,
	formula: null,
	momentIndex: null,
};

describe('ScalingConfig extendLastsUntil', () => {
	it('starts on the first step and moment with a number', async () => {
		const item = makeItem(delta);
		render(ScalingConfig, { context: new Map([['document', item]]) });

		await fireEvent.change(selectNamed('operation'), { target: { value: 'extendLastsUntil' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [
				expect.objectContaining({
					operation: 'extendLastsUntil',
					targetEffectId: 'apply1',
					momentIndex: 1,
					value: 1,
				}),
			],
		});
	});

	it('lists only the moments with a number, in Lasts Until words, and picks one', async () => {
		const item = makeItem({ ...delta, operation: 'extendLastsUntil', targetEffectId: 'apply1' });
		render(ScalingConfig, { context: new Map([['document', item]]) });

		const momentSelect = selectNamed('moment');
		expect([...momentSelect.options].map((option) => option.textContent?.trim())).toEqual([
			localize(`${WORDS}.chooseOne`),
			'Until the end of their 2nd next turn',
		]);

		await fireEvent.change(momentSelect, { target: { value: '1' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [
				expect.objectContaining({ operation: 'extendLastsUntil', momentIndex: 1 }),
			],
		});
	});
});

describe('ScalingConfig raiseEffectRule on a formula field', () => {
	const raise = {
		...delta,
		operation: 'raiseEffectRule',
		targetEffectId: 'apply1',
		ruleId: 'bonus',
		ruleField: 'value',
	};

	it('shows a Formula input for a formula field and writes the formula', async () => {
		const item = makeItem(raise);
		render(ScalingConfig, { context: new Map([['document', item]]) });

		const input = screen.getByRole('textbox', {
			name: localize(`${WORDS}.formula`),
		}) as HTMLInputElement;
		expect(input.placeholder).toBe('@key');

		await fireEvent.change(input, { target: { value: '@key' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [{ ...raise, formula: '@key' }],
		});
	});

	it('empties the formula when the author picks another rule field', async () => {
		const item = makeItem({ ...raise, formula: '@key' });
		render(ScalingConfig, { context: new Map([['document', item]]) });

		await fireEvent.change(selectNamed('ruleField'), { target: { value: '' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [{ ...raise, ruleField: null, formula: null }],
		});
	});
});

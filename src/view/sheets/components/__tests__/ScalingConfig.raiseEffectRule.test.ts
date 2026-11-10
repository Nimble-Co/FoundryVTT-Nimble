import { fireEvent, render, screen } from '@testing-library/svelte';
import localize from '#utils/localize.js';
import ScalingConfig from '../ScalingConfig.svelte';

const WORDS = 'NIMBLE.spellConfig.scaling';

function makeItem(delta: Record<string, unknown>) {
	const effect = {
		id: 'fx',
		name: 'Condemned',
		transfer: false,
		system: { rules: [{ id: 'held1', type: 'heldRoll', label: 'Condemn' }] },
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

const raise = {
	operation: 'raiseEffectRule',
	value: 1,
	dice: null,
	condition: null,
	targetEffectId: 'apply1',
	durationType: null,
	maxDieFaces: null,
	ruleId: 'held1',
	ruleField: null,
};

describe('ScalingConfig raiseEffectRule', () => {
	it('picks a number field of the rule of the Apply Effect node', async () => {
		const item = makeItem(raise);
		render(ScalingConfig, { context: new Map([['document', item]]) });

		const [, nodeSelect, ruleSelect, fieldSelect] = screen.getAllByRole(
			'combobox',
		) as HTMLSelectElement[];
		expect(nodeSelect.selectedOptions[0].textContent?.trim()).toBe('Condemned');
		expect(ruleSelect.selectedOptions[0].textContent?.trim()).toBe('Condemn');
		const fieldLabel = localize('NIMBLE.rules.heldRoll.value.label');
		expect([...fieldSelect.options].map((option) => option.textContent?.trim())).toEqual([
			localize(`${WORDS}.chooseOne`),
			fieldLabel,
		]);

		await fireEvent.change(fieldSelect, { target: { value: 'value' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [{ ...raise, ruleField: 'value' }],
		});
	});

	it('empties the rule and field when the author picks another operation', async () => {
		const item = makeItem({ ...raise, ruleField: 'value' });
		render(ScalingConfig, { context: new Map([['document', item]]) });

		const [operationSelect] = screen.getAllByRole('combobox') as HTMLSelectElement[];
		await fireEvent.change(operationSelect, { target: { value: 'addDC' } });

		expect(item.update).toHaveBeenCalledWith({
			'system.scaling.deltas': [
				expect.objectContaining({ operation: 'addDC', ruleId: null, ruleField: null }),
			],
		});
	});
});

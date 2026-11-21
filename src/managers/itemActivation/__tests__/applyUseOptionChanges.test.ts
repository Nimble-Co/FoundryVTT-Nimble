import { noChosenUseOptions } from '../../../utils/spell/spellUseOptions.js';
import { applyUseOptionChanges } from '../applyUseOptionChanges.js';

describe('the effects of the chosen options', () => {
	it('gives each effect step its own id, also when two items share an effect id', () => {
		const activation: { effects?: unknown[] } = { effects: [] };
		applyUseOptionChanges(activation, {
			...noChosenUseOptions(),
			effects: [
				{ itemUuid: 'Item.first', effectId: 'aura' },
				{ itemUuid: 'Item.second', effectId: 'aura' },
			],
		});

		const steps = activation.effects as Array<{ id: string; effectItemUuid: string }>;
		expect(steps.map((step) => step.effectItemUuid)).toEqual(['Item.first', 'Item.second']);
		expect(new Set(steps.map((step) => step.id)).size).toBe(2);
	});
});

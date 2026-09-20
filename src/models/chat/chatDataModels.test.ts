import chatDataModels from './chatDataModels.js';

/**
 * `NimbleBaseItem` writes `system.concentration` onto the spell and object cards
 * only, because Foundry drops the key without a word on a card type whose schema
 * has no such field.
 */
describe('chat card concentration field', () => {
	it('is declared by exactly the card types the activation card writes it onto', () => {
		const withConcentration = Object.entries(chatDataModels)
			.filter(([, model]) => 'concentration' in model.defineSchema())
			.map(([type]) => type);

		expect(withConcentration.sort()).toEqual(['object', 'spell']);
	});
});

import { hotbarDrop } from './hotBarDrop.js';

describe('hotbarDrop', () => {
	beforeEach(() => {
		(
			globalThis as unknown as {
				game: {
					nimble: {
						macros: {
							createMacro: ReturnType<typeof vi.fn>;
							createHeroicActionMacro: ReturnType<typeof vi.fn>;
						};
					};
				};
			}
		).game.nimble = {
			macros: {
				createMacro: vi.fn(),
				createHeroicActionMacro: vi.fn(),
			},
		};
	});

	it('delegates item drops to createMacro and cancels the default handling', () => {
		const data = { type: 'Item', uuid: 'Item.item-id' };

		const result = hotbarDrop(null, data, 3);

		expect(game.nimble.macros.createMacro).toHaveBeenCalledWith(data, 3);
		expect(game.nimble.macros.createHeroicActionMacro).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	it('delegates heroic action drops to createHeroicActionMacro and cancels the default handling', () => {
		const data = {
			type: 'HeroicAction',
			actionId: 'defend',
			actionType: 'reaction',
			name: 'Defend',
		};

		const result = hotbarDrop(null, data, 5);

		expect(game.nimble.macros.createHeroicActionMacro).toHaveBeenCalledWith(data, 5);
		expect(game.nimble.macros.createMacro).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	it('ignores unsupported drop payloads', () => {
		const result = hotbarDrop(null, { type: 'Folder' }, 7);

		expect(game.nimble.macros.createMacro).not.toHaveBeenCalled();
		expect(game.nimble.macros.createHeroicActionMacro).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});
});

import { createHeroicActionMacro } from './createHeroicActionMacro.ts';

function globals() {
	return globalThis as unknown as {
		game: {
			macros: Macro[];
			user: {
				id: string;
				assignHotbarMacro: ReturnType<typeof vi.fn>;
			};
		};
		Macro: {
			create: ReturnType<typeof vi.fn>;
		};
	};
}

describe('createHeroicActionMacro', () => {
	beforeEach(() => {
		globals().game.macros = [];
		globals().game.user.id = 'test-user-id';
		globals().game.user.assignHotbarMacro = vi.fn().mockResolvedValue(undefined);
		globals().Macro = {
			create: vi.fn(),
		};
	});

	it('creates a new heroic action macro with the expected command, icon, and flags', async () => {
		const macro = {
			id: 'macro-defend',
			name: 'Defend',
		} as unknown as Macro;
		globals().Macro.create.mockResolvedValue(macro);

		await createHeroicActionMacro(
			{
				actionId: 'defend',
				actionType: 'reaction',
				name: 'Defend',
			},
			4,
		);

		expect(globals().Macro.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Defend',
				type: 'script',
				scope: 'actor',
				img: 'icons/svg/shield.svg',
				command: 'game.nimble.macros.activateHeroicActionMacro("defend", "reaction")',
				flags: {
					nimble: {
						heroicActionMacro: true,
						actionId: 'defend',
						actionType: 'reaction',
					},
				},
			}),
		);
		expect(globals().game.user.assignHotbarMacro).toHaveBeenCalledWith(macro, 4);
	});

	it('reuses an existing owned macro with the same command', async () => {
		const macro = {
			id: 'macro-help',
			command: 'game.nimble.macros.activateHeroicActionMacro("help", "reaction")',
			ownership: {
				[globals().game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			},
			img: 'icons/svg/upgrade.svg',
			isOwner: true,
			update: vi.fn(),
		} as unknown as Macro;
		globals().game.macros = [macro];

		await createHeroicActionMacro(
			{
				actionId: 'help',
				actionType: 'reaction',
				name: 'Help',
			},
			2,
		);

		expect(globals().Macro.create).not.toHaveBeenCalled();
		expect(globals().game.user.assignHotbarMacro).toHaveBeenCalledWith(macro, 2);
	});

	it('repairs the icon for an existing owned macro before assigning it', async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const macro = {
			id: 'macro-opportunity',
			command: 'game.nimble.macros.activateHeroicActionMacro("opportunity", "reaction")',
			ownership: {
				default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			},
			img: 'systems/nimble/assets/icons/d20.svg',
			isOwner: true,
			update,
		} as unknown as Macro;
		globals().game.macros = [macro];

		await createHeroicActionMacro(
			{
				actionId: 'opportunity',
				actionType: 'reaction',
				name: 'Opportunity Attack',
			},
			8,
		);

		expect(update).toHaveBeenCalledWith({ img: 'icons/svg/target.svg' });
		expect(globals().game.user.assignHotbarMacro).toHaveBeenCalledWith(macro, 8);
	});
});

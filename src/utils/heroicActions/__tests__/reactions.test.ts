import {
	createHeroicCharacter,
	createHeroicCombatant,
	heroicGlobals,
	resetHeroicGlobals,
	setActionTracking,
	setHeroicCombat,
	targetToken,
} from '../../../../tests/fixtures/heroicActions.js';

const rollUnarmedStrikeMock = vi.fn();

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let reactions: typeof import('../reactions.ts');

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../unarmedStrike.js', () => ({ rollUnarmedStrike: rollUnarmedStrikeMock }));
	reactions = await import('../reactions.ts');
});

function inCombat(options: Parameters<typeof createHeroicCombatant>[1] = {}) {
	const activateItem = vi.fn().mockResolvedValue({ id: 'weapon-card' });
	const actor = createHeroicCharacter({ activateItem });
	const combatant = createHeroicCombatant(actor, options);
	const useHeroicReactions = vi.fn().mockResolvedValue(true);
	setHeroicCombat(combatant, { useHeroicReactions });
	return { actor, combatant, activateItem, useHeroicReactions };
}

describe('heroic reactions', () => {
	let restore: () => void;

	beforeEach(() => {
		restore = resetHeroicGlobals();
		rollUnarmedStrikeMock.mockReset();
	});

	afterEach(() => restore());

	describe('useChatReaction', () => {
		it('uses Defend and posts the defend card with the armor value', async () => {
			const { actor, combatant, useHeroicReactions } = inCombat();

			expect(await reactions.useChatReaction(actor, 'defend')).toBe(true);

			expect(useHeroicReactions).toHaveBeenCalledWith(combatant.id, ['defend'], undefined);
			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'reaction',
					system: expect.objectContaining({ reactionType: 'defend', armorValue: 15, targets: [] }),
				}),
			);
		});

		it('posts interpose before defend for the combined reaction', async () => {
			const { actor, useHeroicReactions } = inCombat();
			heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.ally')]);

			expect(await reactions.useChatReaction(actor, 'interposeAndDefend')).toBe(true);

			expect(useHeroicReactions).toHaveBeenCalledWith(
				'heroic-combatant',
				['interpose', 'defend'],
				undefined,
			);
			expect(ChatMessage.create).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					system: expect.objectContaining({
						reactionType: 'interpose',
						targets: ['Scene.s.Token.ally'],
					}),
				}),
			);
			expect(ChatMessage.create).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					system: expect.objectContaining({ reactionType: 'defend' }),
				}),
			);
		});

		it('posts the help card with the targets', async () => {
			const { actor } = inCombat();
			heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.ally')]);

			expect(await reactions.useChatReaction(actor, 'help')).toBe(true);

			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({
					system: expect.objectContaining({
						reactionType: 'help',
						targets: ['Scene.s.Token.ally'],
					}),
				}),
			);
		});

		it('warns and posts nothing outside combat', async () => {
			const actor = createHeroicCharacter();

			expect(await reactions.useChatReaction(actor, 'defend')).toBe(false);

			expect(ui.notifications.warn).toHaveBeenCalled();
			expect(ChatMessage.create).not.toHaveBeenCalled();
		});

		it('does not ask about actions with action tracking off', async () => {
			setActionTracking(false);
			const { actor, combatant, useHeroicReactions } = inCombat({ currentActions: 0 });

			expect(await reactions.useChatReaction(actor, 'defend')).toBe(true);

			expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
			expect(useHeroicReactions).toHaveBeenCalledWith(combatant.id, ['defend'], undefined);
		});
	});

	describe('useOpportunityAttack', () => {
		it('rolls the weapon at disadvantage, then uses the reaction', async () => {
			const { actor, combatant, activateItem, useHeroicReactions } = inCombat();

			expect(await reactions.useOpportunityAttack(actor, 'weapon-1')).toBe(true);

			expect(activateItem).toHaveBeenCalledWith('weapon-1', {
				rollMode: -1,
				skipActionDeduction: true,
			});
			expect(useHeroicReactions).toHaveBeenCalledWith(
				combatant.id,
				['opportunityAttack'],
				undefined,
			);
			expect(activateItem.mock.invocationCallOrder[0]).toBeLessThan(
				useHeroicReactions.mock.invocationCallOrder[0],
			);
		});

		it('does not use the reaction when the weapon roll is cancelled', async () => {
			const { actor, activateItem, useHeroicReactions } = inCombat();
			activateItem.mockResolvedValue(null);

			expect(await reactions.useOpportunityAttack(actor, 'weapon-1')).toBe(false);

			expect(useHeroicReactions).not.toHaveBeenCalled();
		});

		it('rolls an unarmed strike at disadvantage with no weapon', async () => {
			const { actor, combatant, activateItem, useHeroicReactions } = inCombat();
			rollUnarmedStrikeMock.mockResolvedValue(true);

			expect(await reactions.useOpportunityAttack(actor, null)).toBe(true);

			expect(activateItem).not.toHaveBeenCalled();
			expect(rollUnarmedStrikeMock).toHaveBeenCalledWith(actor, { rollMode: -1 });
			expect(useHeroicReactions).toHaveBeenCalledWith(
				combatant.id,
				['opportunityAttack'],
				undefined,
			);
		});

		it('forces a confirmed soft-blocked reaction', async () => {
			const { actor, combatant, useHeroicReactions } = inCombat({
				opportunityAttackAvailable: false,
			});

			expect(await reactions.useOpportunityAttack(actor, 'weapon-1')).toBe(true);

			expect(foundry.applications.api.DialogV2.confirm).toHaveBeenCalledTimes(1);
			expect(useHeroicReactions).toHaveBeenCalledWith(combatant.id, ['opportunityAttack'], {
				force: true,
			});
		});

		it('stops before the roll when the confirmation is declined', async () => {
			const { actor, activateItem, useHeroicReactions } = inCombat({
				opportunityAttackAvailable: false,
			});
			heroicGlobals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);

			expect(await reactions.useOpportunityAttack(actor, 'weapon-1')).toBe(false);

			expect(activateItem).not.toHaveBeenCalled();
			expect(useHeroicReactions).not.toHaveBeenCalled();
		});

		it('warns and rolls nothing outside combat', async () => {
			const activateItem = vi.fn();
			const actor = createHeroicCharacter({ activateItem });

			expect(await reactions.useOpportunityAttack(actor, 'weapon-1')).toBe(false);

			expect(ui.notifications.warn).toHaveBeenCalledWith(
				expect.stringContaining(
					game.i18n.localize('NIMBLE.ui.heroicActions.reactions.opportunity.label'),
				),
			);
			expect(activateItem).not.toHaveBeenCalled();
		});
	});
});

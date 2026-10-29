import {
	createHeroicCharacter,
	createHeroicCombatant,
	heroicGlobals,
	resetHeroicGlobals,
	setActionTracking,
	setHeroicCombat,
	targetToken,
} from '../../../../tests/fixtures/heroicActions.js';
import { ASSESS_DC } from '../../assessOptions.js';
import { runAssess } from '../assess.js';

function actorRolling(total: number | null) {
	const rollSkillCheck = vi.fn().mockResolvedValue({ roll: total === null ? null : { total } });
	return { actor: createHeroicCharacter({ rollSkillCheck }), rollSkillCheck };
}

describe('runAssess', () => {
	let restore: () => void;

	beforeEach(() => {
		restore = resetHeroicGlobals();
	});

	afterEach(() => restore());

	it('rolls the skill, spends 1 action and posts the assess card', async () => {
		const { actor, rollSkillCheck } = actorRolling(ASSESS_DC);
		const combatant = createHeroicCombatant(actor, { currentActions: 2 });
		setHeroicCombat(combatant);

		const result = await runAssess(actor, { optionId: 'ask-question', skillKey: 'insight' });

		expect(result).toBe(true);
		expect(rollSkillCheck).toHaveBeenCalledWith('insight');
		expect(combatant.update).toHaveBeenCalledWith({ 'system.actions.base.current': 1 });
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'assessAction',
				rolls: [{ total: ASSESS_DC }],
				system: expect.objectContaining({
					skillKey: 'insight',
					dc: ASSESS_DC,
					isSuccess: true,
					optionTitle: game.i18n.localize('NIMBLE.ui.heroicActions.assess.askQuestion.chatTitle'),
					target: null,
					targetName: null,
				}),
			}),
		);
	});

	it('posts a failure and names no target for an option that needs none', async () => {
		const { actor } = actorRolling(ASSESS_DC - 1);
		heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.goblin')]);

		await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' });

		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.objectContaining({
					isSuccess: false,
					target: null,
					targetName: null,
				}),
			}),
		);
	});

	it('spends no action with action tracking off', async () => {
		setActionTracking(false);
		const { actor } = actorRolling(ASSESS_DC);
		const combatant = createHeroicCombatant(actor, { currentActions: 2 });
		setHeroicCombat(combatant);

		expect(await runAssess(actor, { optionId: 'ask-question', skillKey: 'insight' })).toBe(true);

		expect(combatant.update).not.toHaveBeenCalled();
		expect(ChatMessage.create).toHaveBeenCalled();
	});

	it('returns false and spends nothing when the roll is cancelled', async () => {
		const { actor } = actorRolling(null);
		const combatant = createHeroicCombatant(actor, { currentActions: 2 });
		setHeroicCombat(combatant);

		expect(await runAssess(actor, { optionId: 'ask-question', skillKey: 'insight' })).toBe(false);

		expect(combatant.update).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});
});

import {
	createHeroicCharacter,
	createHeroicCombatant,
	heroicGlobals,
	resetHeroicGlobals,
	setActionTracking,
	setHeroicCombat,
	targetToken,
} from '../../../../tests/fixtures/heroicActions.js';
import { AUTOMATION_SETTING_KEYS } from '../../../settings/automationSettings.js';
import { ASSESS_DC } from '../../assessOptions.js';
import { runAssess } from '../assess.js';

function d20Roll(total: number, d20: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

function actorRolling(total: number | null, d20 = 10) {
	const roll = total === null ? null : d20Roll(total, d20);
	const rollSkillCheck = vi.fn().mockResolvedValue({ roll });
	return { actor: createHeroicCharacter({ rollSkillCheck }), rollSkillCheck };
}

describe('runAssess', () => {
	const globals = globalThis as unknown as Record<string, unknown>;
	let restore: () => void;
	let savedFromUuidSync: unknown;

	beforeEach(() => {
		restore = resetHeroicGlobals();
		savedFromUuidSync = globals.fromUuidSync;
	});

	afterEach(() => {
		globals.fromUuidSync = savedFromUuidSync;
		restore();
	});

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
				rolls: [d20Roll(ASSESS_DC, 10)],
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

		await runAssess(actor, { optionId: 'ask-question', skillKey: 'perception' });

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

	it('takes the disadvantage off a paid Assess while the character holds Nullify', async () => {
		const rollSkillCheck = vi.fn().mockResolvedValue({ roll: d20Roll(ASSESS_DC, 10) });
		const nullify = {
			id: 'nullify',
			name: 'Nullify',
			origin: null,
			system: {
				rules: [
					{
						id: 'nullify-rule',
						type: 'heldRoll',
						heldKind: 'ignoreDisadvantage',
						whichRoll: 'holderAttacks',
						usedUp: true,
						value: 0,
					},
				],
			},
			flags: {},
		};
		const deleteEmbeddedDocuments = vi.fn(async () => []);
		const actor = createHeroicCharacter({
			uuid: 'Actor.hero',
			rollSkillCheck,
			system: { skills: { insight: { defaultRollMode: -1 } } },
			effects: [nullify],
			deleteEmbeddedDocuments,
		});
		setHeroicCombat(createHeroicCombatant(actor));
		globals.fromUuidSync = vi.fn(() => actor);

		await runAssess(actor, { optionId: 'ask-question', skillKey: 'insight' });

		expect(rollSkillCheck).toHaveBeenCalledWith('insight', { rollMode: 0 });
		expect(deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['nullify']);
	});

	describe('what a success holds', () => {
		function holder() {
			return {
				uuid: 'Actor.ogre',
				isOwner: true,
				createEmbeddedDocuments: vi.fn(async () => []),
			};
		}

		function target(actor: ReturnType<typeof holder>) {
			return { ...targetToken('Scene.s.Token.ogre'), actor };
		}

		function inCombat(actor: ReturnType<typeof actorRolling>['actor']) {
			setHeroicCombat(createHeroicCombatant(actor));
		}

		const effectOf = (creature: { createEmbeddedDocuments: ReturnType<typeof vi.fn> }) =>
			creature.createEmbeddedDocuments.mock.calls[0]?.[1]?.[0];
		const heldOf = (creature: { createEmbeddedDocuments: ReturnType<typeof vi.fn> }) =>
			effectOf(creature)?.system?.rules?.[0];

		it('Create an Opening holds +1 for one roll on the target, and the card shows it', async () => {
			const { actor } = actorRolling(ASSESS_DC);
			Object.assign(actor, { uuid: 'Actor.hero' });
			inCombat(actor);
			const ogre = holder();
			heroicGlobals().game.user.targets = new Set([target(ogre)]);

			await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' });

			expect(heldOf(ogre)).toMatchObject({
				heldKind: 'primaryDie',
				value: 1,
				whichRoll: 'attacksOnHolder',
				usedUp: true,
				label: 'Create an Opening',
			});
			expect(effectOf(ogre)).toMatchObject({
				origin: 'Actor.hero',
				system: { lastsUntil: [expect.objectContaining({ span: 'currentRound' })] },
			});
			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({
					system: expect.objectContaining({ primaryDieChange: 1 }),
				}),
			);
		});

		it('Anticipate Danger holds -1 on every roll against the assessor', async () => {
			const createEmbeddedDocuments = vi.fn(async () => []);
			const rollSkillCheck = vi.fn().mockResolvedValue({ roll: d20Roll(ASSESS_DC, 10) });
			const actor = createHeroicCharacter({ rollSkillCheck, createEmbeddedDocuments });
			inCombat(actor);

			await runAssess(actor, { optionId: 'anticipate-danger', skillKey: 'perception' });

			expect(heldOf({ createEmbeddedDocuments })).toMatchObject({
				value: -1,
				whichRoll: 'attacksOnHolder',
				usedUp: false,
			});
			expect(effectOf({ createEmbeddedDocuments })?.system?.lastsUntil).toEqual([
				expect.objectContaining({ span: 'currentRound' }),
			]);
		});

		it('a failed check holds nothing', async () => {
			const { actor } = actorRolling(ASSESS_DC - 1);
			inCombat(actor);
			const ogre = holder();
			heroicGlobals().game.user.targets = new Set([target(ogre)]);

			await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' });

			expect(ogre.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('outside combat nothing is held', async () => {
			const { actor } = actorRolling(ASSESS_DC);
			const ogre = holder();
			heroicGlobals().game.user.targets = new Set([target(ogre)]);

			await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' });

			expect(ogre.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(ChatMessage.create).toHaveBeenCalled();
		});

		it('with Feature Effects off nothing is held, and the card still has its text', async () => {
			const { actor } = actorRolling(ASSESS_DC);
			inCombat(actor);
			const ogre = holder();
			heroicGlobals().game.user.targets = new Set([target(ogre)]);
			heroicGlobals().game.settings = {
				get: vi.fn(
					(_scope: string, key: string) => key !== AUTOMATION_SETTING_KEYS.applyRuleEffects,
				),
			};

			await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' });

			expect(ogre.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(ChatMessage.create).toHaveBeenCalled();
		});

		it('Create an Opening asks for a target, and rolls nothing without one', async () => {
			const { actor, rollSkillCheck } = actorRolling(ASSESS_DC);

			expect(await runAssess(actor, { optionId: 'create-opening', skillKey: 'perception' })).toBe(
				false,
			);

			expect(rollSkillCheck).not.toHaveBeenCalled();
		});
	});

	it.each([
		['fails on a natural 1, whatever the total', 13, 1, false],
		['succeeds on a natural 20, whatever the total', 11, 20, true],
	])('%s', async (_name, total, d20, isSuccess) => {
		const { actor } = actorRolling(total, d20);

		await runAssess(actor, { optionId: 'ask-question', skillKey: 'insight' });

		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({ system: expect.objectContaining({ isSuccess }) }),
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

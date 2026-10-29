import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import type { HeroIntent } from '../heroIntent.ts';

const adjustPool = vi.fn();
const rollChargeDie = vi.fn();
const rollDieIntoPool = vi.fn();
const setPoolFaces = vi.fn();
const updateDocumentImage = vi.fn();
const requestAdvanceCombatTurn = vi.fn();
const getActiveCombatForCurrentScene = vi.fn();
const toggleEffectAE = vi.fn();
const findToggleEffectRuleById = vi.fn();
const getDicePools = vi.fn();
const getDicePoolConsumers = vi.fn();
const spendDicePool = vi.fn();
const runAssess = vi.fn();
const runMoveAction = vi.fn();
const useChatReaction = vi.fn();
const useOpportunityAttack = vi.fn();
const strikeUnarmed = vi.fn();

let createHeroPerform: typeof import('../heroPerform.ts').createHeroPerform;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/chargePool/chargePoolRecover.js', () => ({ adjustPool }));
	vi.doMock('#utils/chargePool/chargePoolRoll.js', () => ({ rollChargeDie }));
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ rollDieIntoPool, setPoolFaces }));
	vi.doMock('#view/handlers/updateDocumentImage.js', () => ({ default: updateDocumentImage }));
	vi.doMock('#utils/combat/combatTurnActions.js', () => ({
		requestAdvanceCombatTurn,
	}));
	vi.doMock('#utils/actor/toggleEffectControl.js', () => ({
		toggleEffectAE,
		findToggleEffectRuleById,
	}));
	vi.doMock('#utils/dicePool/dicePoolSync.js', () => ({ getPools: getDicePools }));
	vi.doMock('#utils/dicePool/dicePoolConsumers.js', () => ({ getDicePoolConsumers }));
	vi.doMock('#utils/dicePool/spendDicePool.js', () => ({ spendDicePool }));
	vi.doMock('#utils/heroicActions/assess.js', () => ({ runAssess }));
	vi.doMock('#utils/heroicActions/move.js', () => ({ runMoveAction }));
	vi.doMock('#utils/heroicActions/reactions.js', () => ({ useChatReaction, useOpportunityAttack }));
	vi.doMock('#utils/heroicActions/unarmedStrike.js', () => ({ strikeUnarmed }));
	vi.doMock('#utils/combat/combatState.js', () => ({ getActiveCombatForCurrentScene }));
	vi.doMock('#utils/combat/queueCombatantMutationWithFreshDocument.js', () => ({
		queueCombatantMutationWithFreshDocument: async (params: {
			combat: { combatants: { get(id: string): unknown } };
			combatantId: string;
			mutation: (combatant: unknown) => Promise<void>;
		}) => params.mutation(params.combat.combatants.get(params.combatantId)),
	}));
	({ createHeroPerform } = await import('../heroPerform.ts'));
});

const ACTOR_METHODS = [
	'setCurrentHP',
	'setTempHP',
	'update',
	'updateCurrentHitDice',
	'rollHitDice',
	'editCurrentHitDice',
	'configureHitPoints',
	'configureHitDice',
	'configureMana',
	'configureMovement',
	'editMetadata',
	'configureAbilityScores',
	'configureSavingThrows',
	'configureSkills',
	'configureDamageDefenses',
	'configureLanguageProficiencies',
	'configureArmorProficiencies',
	'configureWeaponProficiencies',
	'triggerLevelUp',
	'triggerLevelDown',
	'triggerLevelCorrection',
	'triggerRest',
	'rollInitiativeToChat',
	'rollAbilityCheckToChat',
	'rollSavingThrowToChat',
	'rollSkillCheckToChat',
	'activateItem',
	'createItem',
	'setFlag',
] as const;

const item = { id: 'rage', sheet: { render: vi.fn() } };

function mockActor() {
	const actor: Record<string, unknown> = {
		id: 'hero1',
		items: { get: (id: string) => (id === item.id ? item : undefined) },
	};
	for (const method of ACTOR_METHODS) actor[method] = vi.fn();
	return actor as Record<(typeof ACTOR_METHODS)[number], ReturnType<typeof vi.fn>> & {
		id: string;
	};
}

function mockCombat(combatant: Record<string, unknown>) {
	const all = [combatant];
	return {
		scene: { id: 'scene1' },
		rollInitiative: vi.fn(),
		combatants: Object.assign(all, { get: (id: string) => all.find((c) => c.id === id) }),
	};
}

let actor: ReturnType<typeof mockActor>;
const perform = (intent: HeroIntent) =>
	createHeroPerform(actor as unknown as NimbleCharacter)(intent);

beforeEach(() => {
	actor = mockActor();
	getActiveCombatForCurrentScene.mockReturnValue(null);
});

describe('createHeroPerform', () => {
	it.each([
		[{ kind: 'setHp', value: 7 }, 'setCurrentHP', [7]],
		[{ kind: 'setTempHp', value: 3 }, 'setTempHP', [3]],
		[{ kind: 'setWounds', value: 2 }, 'update', [{ 'system.attributes.wounds.value': 2 }]],
		[{ kind: 'setMana', value: 4 }, 'update', [{ 'system.resources.mana.current': 4 }]],
		[{ kind: 'setHitDice', value: 2 }, 'updateCurrentHitDice', [2]],
		[{ kind: 'rollHitDice' }, 'rollHitDice', []],
		[{ kind: 'editHitDice' }, 'editCurrentHitDice', []],
		[{ kind: 'rename', name: 'Ash' }, 'update', [{ name: 'Ash' }]],
		[{ kind: 'levelUp' }, 'triggerLevelUp', []],
		[{ kind: 'revertLevelUp' }, 'triggerLevelDown', []],
		[{ kind: 'correctLevels' }, 'triggerLevelCorrection', []],
		[{ kind: 'rest', restType: 'safe' }, 'triggerRest', [{ restType: 'safe' }]],
		[{ kind: 'rollAbilityCheck', ability: 'will' }, 'rollAbilityCheckToChat', ['will']],
		[{ kind: 'rollSave', save: 'dexterity' }, 'rollSavingThrowToChat', ['dexterity']],
		[{ kind: 'rollSkill', skill: 'stealth' }, 'rollSkillCheckToChat', ['stealth']],
	] as const)('%o calls actor.%s', async (intent, method, args) => {
		await perform(intent as HeroIntent);

		expect(actor[method]).toHaveBeenCalledWith(...args);
	});

	it.each([
		['hitPoints', 'configureHitPoints'],
		['hitDice', 'configureHitDice'],
		['mana', 'configureMana'],
		['movement', 'configureMovement'],
		['metadata', 'editMetadata'],
		['abilities', 'configureAbilityScores'],
		['saves', 'configureSavingThrows'],
		['skills', 'configureSkills'],
		['damageDefenses', 'configureDamageDefenses'],
		['languages', 'configureLanguageProficiencies'],
		['armorProficiencies', 'configureArmorProficiencies'],
		['weaponProficiencies', 'configureWeaponProficiencies'],
	] as const)('configure %s opens actor.%s', async (target, method) => {
		await perform({ kind: 'configure', target });

		expect(actor[method]).toHaveBeenCalledOnce();
	});

	it('sets the charges of a pool', async () => {
		await perform({ kind: 'setPoolCharges', poolId: 'p', value: 2 });

		expect(adjustPool).toHaveBeenCalledWith(actor, 'p', 'set', 2);
	});

	it('rolls and spends one charge die', async () => {
		await perform({ kind: 'rollPoolCharge', poolId: 'p', label: 'Combat Dice' });

		expect(rollChargeDie).toHaveBeenCalledWith(actor, 'p', { flavor: 'Combat Dice' });
	});

	it('rolls one more die into a dice pool', async () => {
		await perform({ kind: 'rollIntoDicePool', poolId: 'fury', label: 'Fury Dice' });

		expect(rollDieIntoPool).toHaveBeenCalledWith(actor, 'fury', { flavor: 'Fury Dice' });
	});

	it('sets the faces of a dice pool', async () => {
		await perform({ kind: 'setDiceFaces', poolId: 'fury', faces: [6] });

		expect(setPoolFaces).toHaveBeenCalledWith(actor, 'fury', [6]);
	});

	it('changes the portrait, and Shift skips the Tokenizer', async () => {
		await perform({ kind: 'changePortrait', skipTokenizer: true });

		expect(updateDocumentImage).toHaveBeenCalledWith(actor, { shiftKey: true });
	});

	describe('rollInitiative', () => {
		it('rolls to chat when the hero is in no combat', async () => {
			vi.stubGlobal('canvas', { scene: { id: 'scene1' } });

			await perform({ kind: 'rollInitiative' });
			vi.unstubAllGlobals();

			expect(actor.rollInitiativeToChat).toHaveBeenCalledOnce();
		});

		it('ignores a second click while the first roll is on its way', async () => {
			vi.stubGlobal('canvas', { scene: { id: 'scene1' } });
			let finish = () => {};
			actor.rollInitiativeToChat.mockReturnValueOnce(
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
			);

			const first = perform({ kind: 'rollInitiative' });
			await perform({ kind: 'rollInitiative' });
			finish();
			await first;
			await perform({ kind: 'rollInitiative' });
			vi.unstubAllGlobals();

			expect(actor.rollInitiativeToChat).toHaveBeenCalledTimes(2);
		});

		it('rolls in the viewed combat of this scene', async () => {
			const combat = mockCombat({ id: 'c1', actorId: 'hero1', initiative: null });
			vi.stubGlobal('canvas', { scene: { id: 'scene1' } });
			vi.stubGlobal('game', { ...game, combats: { viewed: combat } });

			await perform({ kind: 'rollInitiative' });

			expect(combat.rollInitiative).toHaveBeenCalledWith(['c1'], { promptRollDialog: true });
			expect(actor.rollInitiativeToChat).not.toHaveBeenCalled();
			vi.unstubAllGlobals();
		});

		it('adds the hero to the combat first when the auto-add setting is on', async () => {
			const combat = {
				...mockCombat({ id: 'other', actorId: 'someone', initiative: null }),
				ensureCharacterCombatantForActorInCurrentScene: vi.fn(async () => ({
					id: 'c2',
					initiative: null,
				})),
			};
			vi.stubGlobal('canvas', { scene: { id: 'scene1' } });
			vi.stubGlobal('game', {
				...game,
				combats: { viewed: combat },
				settings: { get: () => true },
			});

			await perform({ kind: 'rollInitiative' });
			vi.unstubAllGlobals();

			expect(combat.ensureCharacterCombatantForActorInCurrentScene).toHaveBeenCalledWith(actor);
			expect(combat.rollInitiative).toHaveBeenCalledWith(['c2'], { promptRollDialog: true });
		});

		it('says so, and rolls nothing, when the hero has an initiative', async () => {
			const combat = mockCombat({ id: 'c1', actorId: 'hero1', initiative: 14 });
			vi.stubGlobal('canvas', { scene: { id: 'scene1' } });
			vi.stubGlobal('game', { ...game, combats: { viewed: combat } });

			await perform({ kind: 'rollInitiative' });
			vi.unstubAllGlobals();

			expect(combat.rollInitiative).not.toHaveBeenCalled();
			expect(ui.notifications?.info).toHaveBeenCalledOnce();
		});
	});

	describe('turn', () => {
		const combatant = (base: object) => ({
			id: 'c1',
			actorId: 'hero1',
			system: { actions: { base } },
			update: vi.fn(),
		});

		it('sets the actions left', async () => {
			const c = combatant({ current: 3, max: 3 });
			getActiveCombatForCurrentScene.mockReturnValue(mockCombat(c));

			await perform({ kind: 'setActions', value: 2 });

			expect(c.update).toHaveBeenCalledWith({ 'system.actions.base.current': 2 });
		});

		it('adds an extra action', async () => {
			const c = combatant({ current: 2, max: 3, additional: 0 });
			getActiveCombatForCurrentScene.mockReturnValue(mockCombat(c));

			await perform({ kind: 'addAction' });

			expect(c.update).toHaveBeenCalledWith({
				'system.actions.base.additional': 1,
				'system.actions.base.current': 3,
			});
		});

		it('adds no action past 10 in a turn', async () => {
			const c = combatant({ current: 3, max: 3, additional: 7 });
			getActiveCombatForCurrentScene.mockReturnValue(mockCombat(c));

			await perform({ kind: 'addAction' });

			expect(c.update).not.toHaveBeenCalled();
		});

		it('ends the turn, and warns when Foundry does not allow it', async () => {
			const combat = mockCombat(combatant({ current: 0, max: 3 }));
			getActiveCombatForCurrentScene.mockReturnValue(combat);
			requestAdvanceCombatTurn.mockResolvedValueOnce(false);

			await perform({ kind: 'endTurn' });

			expect(requestAdvanceCombatTurn).toHaveBeenCalledWith({ combat });
			expect(ui.notifications?.warn).toHaveBeenCalledOnce();
		});
	});

	describe('items', () => {
		it('uses an item through activateItem', async () => {
			await perform({ kind: 'activate', itemId: 'rage' });

			expect(actor.activateItem).toHaveBeenCalledWith('rage');
		});

		it('ends a toggle through toggleEffectAE', async () => {
			const rule = { id: 'rageToggle' };
			findToggleEffectRuleById.mockReturnValueOnce(rule);

			await perform({ kind: 'endToggle', itemId: 'rage', ruleId: 'rageToggle' });

			expect(findToggleEffectRuleById).toHaveBeenCalledWith(item, 'rageToggle');
			expect(toggleEffectAE).toHaveBeenCalledWith(actor, item, rule);
		});

		it('opens the window of an item', async () => {
			await perform({ kind: 'openItem', itemId: 'rage' });

			expect(item.sheet.render).toHaveBeenCalledWith(true);
		});

		it('creates a spell', async () => {
			await perform({ kind: 'createItem', itemType: 'spell' });

			expect(actor.createItem).toHaveBeenCalledWith({
				name: 'New Spell',
				type: 'spell',
			});
		});

		it('saves how the Spells tab groups the spells', async () => {
			await perform({ kind: 'setSpellsBy', value: 'school' });

			expect(actor.setFlag).toHaveBeenCalledWith('nimble', 'spellsBy', 'school');
		});

		it('spends the picked dice through the consumer of the row', async () => {
			const pool = { id: 'fury', label: 'Fury Dice', faces: [5, 2] };
			const consumer = { itemId: 'bloodlust', ruleId: 'bloodlustDice' };
			getDicePools.mockReturnValueOnce([pool]);
			getDicePoolConsumers.mockReturnValueOnce([{ itemId: 'other', ruleId: 'x' }, consumer]);

			await perform({
				kind: 'spendDice',
				itemId: 'bloodlust',
				ruleId: 'bloodlustDice',
				poolId: 'fury',
				indices: [1],
			});

			expect(spendDicePool).toHaveBeenCalledWith({
				actor,
				pool,
				consumer,
				selectedIndices: [1],
			});
		});
	});

	describe('heroic actions', () => {
		it('strikes unarmed through strikeUnarmed', async () => {
			await perform({ kind: 'unarmedStrike' });

			expect(strikeUnarmed).toHaveBeenCalledWith(actor);
		});

		it.each([
			[{ kind: 'move' }, runMoveAction, []],
			[
				{ kind: 'assess', option: 'create-opening', skill: 'perception' },
				runAssess,
				[{ optionId: 'create-opening', skillKey: 'perception' }],
			],
			[{ kind: 'reaction', reaction: 'help' }, useChatReaction, ['help']],
			[{ kind: 'opportunityAttack', weaponId: 'greataxe' }, useOpportunityAttack, ['greataxe']],
			[{ kind: 'opportunityAttack', weaponId: null }, useOpportunityAttack, [null]],
		] as const)('%o runs the shared heroic action code', async (intent, run, args) => {
			await perform(intent as HeroIntent);

			expect(run).toHaveBeenCalledWith(actor, ...args);
		});
	});
});

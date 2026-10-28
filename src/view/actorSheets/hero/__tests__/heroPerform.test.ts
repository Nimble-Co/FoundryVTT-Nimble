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

let createHeroPerform: typeof import('../heroPerform.ts').createHeroPerform;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/chargePool/chargePoolRecover.js', () => ({ adjustPool }));
	vi.doMock('#utils/chargePool/chargePoolRoll.js', () => ({ rollChargeDie }));
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ rollDieIntoPool, setPoolFaces }));
	vi.doMock('#view/handlers/updateDocumentImage.js', () => ({ default: updateDocumentImage }));
	vi.doMock('#utils/combat/combatTurnActions.js', () => ({ requestAdvanceCombatTurn }));
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
] as const;

function mockActor() {
	const actor: Record<string, unknown> = { id: 'hero1' };
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
});

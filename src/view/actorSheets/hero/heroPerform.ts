import type { NimbleCharacter } from '#documents/actor/character.js';
import {
	getCombatantAdditionalActions,
	getCombatantBaseActions,
} from '#documents/combat/combatantSystem.js';
import type { RestManager } from '#managers/RestManager.js';
import { SYSTEM_ID } from '#system';
import type { PromptedInitiativeOptions } from '#types/combat.js';
import { adjustPool } from '#utils/chargePool/chargePoolRecover.js';
import { rollChargeDie } from '#utils/chargePool/chargePoolRoll.js';
import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';
import { requestAdvanceCombatTurn } from '#utils/combat/combatTurnActions.js';
import { initiativeRollLock } from '#utils/combat/initiativeRollLock.js';
import { queueCombatantMutationWithFreshDocument } from '#utils/combat/queueCombatantMutationWithFreshDocument.js';
import { rollDieIntoPool, setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import localize from '#utils/localize.js';
import updateDocumentImage from '#view/handlers/updateDocumentImage.js';
import { AUTO_ADD_CHARACTER_TO_COMBAT_ON_INITIATIVE_ROLL_SETTING_KEY } from '../../../settings/initiativeSettings.js';
import type { HeroConfigureTarget, HeroIntent, HeroPerform } from './heroIntent.ts';

type CombatWithLateJoin = Combat & {
	ensureCharacterCombatantForActorInCurrentScene?: (
		actor: Actor.Implementation,
	) => Promise<Combatant | null>;
};

/** The most actions a turn can have, as the old action tracker. */
const MAX_ACTIONS = 10;

function configure(actor: NimbleCharacter, target: HeroConfigureTarget): Promise<unknown> {
	switch (target) {
		case 'hitPoints':
			return actor.configureHitPoints();
		case 'hitDice':
			return actor.configureHitDice();
		case 'mana':
			return actor.configureMana();
		case 'movement':
			return actor.configureMovement();
		case 'metadata':
			return actor.editMetadata();
		case 'abilities':
			return actor.configureAbilityScores();
		case 'saves':
			return actor.configureSavingThrows();
		case 'skills':
			return actor.configureSkills();
		case 'damageDefenses':
			return actor.configureDamageDefenses();
		case 'languages':
			return actor.configureLanguageProficiencies();
		case 'armorProficiencies':
			return actor.configureArmorProficiencies();
		case 'weaponProficiencies':
			return actor.configureWeaponProficiencies();
		default: {
			const unknown: never = target;
			throw new Error(`No configure window for ${String(unknown)}`);
		}
	}
}

function combatantOf(actor: NimbleCharacter): { combat: Combat; combatant: Combatant } | null {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((entry) => entry.actorId === actor.id);
	return combat && combatant ? { combat, combatant } : null;
}

async function mutateActions(
	actor: NimbleCharacter,
	change: (combatant: Combatant.Implementation) => Record<string, unknown> | null,
): Promise<void> {
	const found = combatantOf(actor);
	if (!found?.combatant.id) return;
	await queueCombatantMutationWithFreshDocument({
		combat: found.combat,
		combatantId: found.combatant.id,
		mutation: async (current) => {
			const data = change(current);
			if (data) await current.update(data);
		},
	});
}

/** As the Initiative button of the old Core tab: the viewed combat, the auto-add setting, else chat. */
async function rollInitiative(actor: NimbleCharacter): Promise<void> {
	const combat = game.combats?.viewed as CombatWithLateJoin | null | undefined;
	const sceneId = canvas?.scene?.id;
	const inThisScene = !!combat && !!sceneId && combat.scene?.id === sceneId;
	let combatant = inThisScene
		? (combat.combatants.find((entry) => entry.actorId === actor.id) ?? null)
		: null;

	const autoAdd = Boolean(
		game.settings?.get?.(
			SYSTEM_ID as 'core',
			AUTO_ADD_CHARACTER_TO_COMBAT_ON_INITIATIVE_ROLL_SETTING_KEY as 'rollMode',
		),
	);
	if (
		!combatant &&
		autoAdd &&
		inThisScene &&
		combat.ensureCharacterCombatantForActorInCurrentScene
	) {
		combatant = (await combat.ensureCharacterCombatantForActorInCurrentScene(
			actor as unknown as Actor.Implementation,
		)) as typeof combatant;
	}

	if (!combatant) {
		await actor.rollInitiativeToChat();
		return;
	}
	if (initiativeRollLock.hasActiveLock(combatant)) return;
	if (combatant.initiative !== null) {
		ui.notifications?.info(localize('NIMBLE.ui.heroicActions.initiativeAlreadyRolled'));
		return;
	}
	if (!combat || !combatant.id) return;
	try {
		await combat.rollInitiative([combatant.id], {
			promptRollDialog: true,
		} as PromptedInitiativeOptions);
	} catch (_error) {
		ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionRollInitiative'));
	}
}

async function endTurn(actor: NimbleCharacter): Promise<void> {
	const found = combatantOf(actor);
	if (!found) return;
	try {
		const advanced = await requestAdvanceCombatTurn({ combat: found.combat });
		if (advanced) return;
	} catch (_error) {
		// the warning below says it
	}
	ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionEndTurn'));
}

/** The one place where the character sheet acts on Foundry. */
export function createHeroPerform(actor: NimbleCharacter): HeroPerform {
	const document = actor as unknown as Actor.Implementation;
	return async (intent: HeroIntent): Promise<void> => {
		switch (intent.kind) {
			case 'setHp':
				await actor.setCurrentHP(intent.value);
				return;
			case 'setTempHp':
				await actor.setTempHP(intent.value);
				return;
			case 'setWounds':
				await actor.update({ 'system.attributes.wounds.value': intent.value } as Record<
					string,
					unknown
				>);
				return;
			case 'setMana':
				await actor.update({ 'system.resources.mana.current': intent.value } as Record<
					string,
					unknown
				>);
				return;
			case 'setHitDice':
				await actor.updateCurrentHitDice(intent.value);
				return;
			case 'rollHitDice':
				await actor.rollHitDice();
				return;
			case 'editHitDice':
				await actor.editCurrentHitDice();
				return;
			case 'setPoolCharges':
				await adjustPool(document, intent.poolId, 'set', intent.value);
				return;
			case 'rollPoolCharge':
				await rollChargeDie(document, intent.poolId, { flavor: intent.label });
				return;
			case 'rollIntoDicePool':
				await rollDieIntoPool(document, intent.poolId, { flavor: intent.label });
				return;
			case 'setDiceFaces':
				await setPoolFaces(document, intent.poolId, intent.faces);
				return;
			case 'configure':
				await configure(actor, intent.target);
				return;
			case 'rename':
				await actor.update({ name: intent.name });
				return;
			case 'changePortrait':
				await updateDocumentImage(document, { shiftKey: intent.skipTokenizer });
				return;
			case 'levelUp':
				await actor.triggerLevelUp();
				return;
			case 'revertLevelUp':
				await actor.triggerLevelDown();
				return;
			case 'correctLevels':
				await actor.triggerLevelCorrection();
				return;
			case 'rest':
				await actor.triggerRest({ restType: intent.restType } as RestManager.Data);
				return;
			case 'rollInitiative':
				await rollInitiative(actor);
				return;
			case 'setActions':
				await mutateActions(actor, () => ({ 'system.actions.base.current': intent.value }));
				return;
			case 'addAction':
				await mutateActions(actor, (combatant) => {
					const base = getCombatantBaseActions(combatant);
					const additional = getCombatantAdditionalActions(combatant);
					if ((base.max || 3) + additional >= MAX_ACTIONS) return null;
					return {
						'system.actions.base.additional': additional + 1,
						'system.actions.base.current': base.current + 1,
					};
				});
				return;
			case 'endTurn':
				await endTurn(actor);
				return;
			case 'rollAbilityCheck':
				await actor.rollAbilityCheckToChat(intent.ability as never);
				return;
			case 'rollSave':
				await actor.rollSavingThrowToChat(intent.save as never);
				return;
			case 'rollSkill':
				await actor.rollSkillCheckToChat(intent.skill as never);
				return;
			default: {
				const unknown: never = intent;
				throw new Error(`No perform for ${JSON.stringify(unknown)}`);
			}
		}
	};
}

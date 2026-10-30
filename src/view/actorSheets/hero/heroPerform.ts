import type { NimbleCharacter } from '#documents/actor/character.js';
import {
	getCombatantAdditionalActions,
	getCombatantBaseActions,
} from '#documents/combat/combatantSystem.js';
import type { RestManager } from '#managers/RestManager.js';
import { SYSTEM_ID } from '#system';
import type { PromptedInitiativeOptions } from '#types/combat.js';
import { findToggleEffectRuleById, toggleEffectAE } from '#utils/actor/toggleEffectControl.js';
import { adjustPool } from '#utils/chargePool/chargePoolRecover.js';
import { rollChargeDie } from '#utils/chargePool/chargePoolRoll.js';
import { requestAdvanceCombatTurn } from '#utils/combat/combatTurnActions.js';
import { initiativeRollLock } from '#utils/combat/initiativeRollLock.js';
import { queueCombatantMutationWithFreshDocument } from '#utils/combat/queueCombatantMutationWithFreshDocument.js';
import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { rollDieIntoPool, setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { spendDicePool } from '#utils/dicePool/spendDicePool.js';
import { exportCharacterToJson } from '#utils/documents/exportCharacterToJson.ts';
import { runAssess } from '#utils/heroicActions/assess.js';
import { runMoveAction } from '#utils/heroicActions/move.js';
import { useChatReaction, useOpportunityAttack } from '#utils/heroicActions/reactions.js';
import { strikeUnarmed } from '#utils/heroicActions/unarmedStrike.js';
import localize from '#utils/localize.js';
import { openPdfExportDialog } from '#view/dialogs/openPdfExportDialog.ts';
import updateDocumentImage from '#view/handlers/updateDocumentImage.js';
import { AUTO_ADD_CHARACTER_TO_COMBAT_ON_INITIATIVE_ROLL_SETTING_KEY } from '../../../settings/initiativeSettings.js';
import { endEffect, removeEffect, setCondition } from '../shared/effectActions.ts';
import { combatantOf, mayAddAction } from './heroActions.ts';
import type {
	HeroConfigureTarget,
	HeroIntent,
	HeroPerform,
	HeroSettingsField,
} from './heroIntent.ts';

type CombatWithLateJoin = Combat & {
	ensureCharacterCombatantForActorInCurrentScene?: (
		actor: Actor.Implementation,
	) => Promise<Combatant | null>;
};

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

async function mutateActions(
	actor: NimbleCharacter,
	change: (combatant: Combatant.Implementation) => Record<string, unknown> | null,
): Promise<void> {
	const found = combatantOf(actor.id);
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

const initiativeRolling = new WeakSet<NimbleCharacter>();

/** Roll in the viewed combat of this scene (with the auto-add setting), else roll to chat. */
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

async function spendDice(
	actor: NimbleCharacter,
	intent: Extract<HeroIntent, { kind: 'spendDice' }>,
): Promise<void> {
	const document = actor as unknown as Actor.Implementation;
	const pool = getDicePools(document).find((entry) => entry.id === intent.poolId);
	if (!pool) return;
	const consumer = getDicePoolConsumers(document, pool).find(
		(entry) => entry.itemId === intent.itemId && entry.ruleId === intent.ruleId,
	);
	if (!consumer) return;
	await spendDicePool({ actor, pool, consumer, selectedIndices: intent.indices });
}

async function endToggle(actor: NimbleCharacter, itemId: string, ruleId: string): Promise<void> {
	const item = actor.items.get(itemId);
	if (!item) return;
	const rule = findToggleEffectRuleById(
		item as unknown as Parameters<typeof findToggleEffectRuleById>[0],
		ruleId,
	);
	if (!rule) return;
	await toggleEffectAE(
		actor as unknown as Parameters<typeof toggleEffectAE>[0],
		item as unknown as Parameters<typeof toggleEffectAE>[1],
		rule,
	);
}

async function endTurn(actor: NimbleCharacter): Promise<void> {
	const found = combatantOf(actor.id);
	if (!found) return;
	try {
		const advanced = await requestAdvanceCombatTurn({ combat: found.combat });
		if (advanced) return;
	} catch (_error) {
		// the warning below says it
	}
	ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionEndTurn'));
}

const SETTINGS_FIELDS: Record<HeroSettingsField, string> = {
	bonusSlots: 'system.inventory.bonusSlots',
	woundsBonus: 'system.attributes.wounds.bonus',
	highestUnlockedSpellTier: 'system.resources.highestUnlockedSpellTier',
	initiativeBonuses: 'system.attributes.initiative.bonuses',
	inspiration: 'system.resources.inspiration',
};

const NEW_ITEM_NAMES: Record<Extract<HeroIntent, { kind: 'createItem' }>['itemType'], string> = {
	spell: 'NIMBLE.actorSheet.hero.spells.newSpell',
	object: 'NIMBLE.actorSheet.hero.inventory.newObject',
	feature: 'NIMBLE.actorSheet.hero.features.newFeature',
};

/** A stored stack that grows must still fit in its container. */
async function setQuantity(actor: NimbleCharacter, itemId: string, value: number): Promise<void> {
	const item = actor.items.get(itemId);
	if (!item) return;
	if ((item.system as { containerId?: string }).containerId) {
		await actor.updateStoredObjectQuantity(itemId, value);
		return;
	}
	await actor.updateItem(itemId, { 'system.quantity': value });
}

/** What `perform` asks of the sheet that it acts for. */
export interface HeroPerformSheet {
	/** an Item drop: on the Inventory into a container (empty = loose); null = anywhere else */
	dropItem(data: Record<string, unknown>, containerId: string | null): Promise<void>;
}

/** The one place where the character sheet acts on Foundry. */
export function createHeroPerform(actor: NimbleCharacter, sheet: HeroPerformSheet): HeroPerform {
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
				if (initiativeRolling.has(actor)) return;
				initiativeRolling.add(actor);
				try {
					await rollInitiative(actor);
				} finally {
					initiativeRolling.delete(actor);
				}
				return;
			case 'setActions':
				await mutateActions(actor, () => ({ 'system.actions.base.current': intent.value }));
				return;
			case 'addAction':
				await mutateActions(actor, (combatant) => {
					const base = getCombatantBaseActions(combatant);
					const additional = getCombatantAdditionalActions(combatant);
					if (!mayAddAction(base, additional)) return null;
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
				await actor.rollAbilityCheckToChat(intent.ability);
				return;
			case 'rollSave':
				await actor.rollSavingThrowToChat(intent.save);
				return;
			case 'rollSkill':
				await actor.rollSkillCheckToChat(intent.skill);
				return;
			case 'activate':
				await actor.activateItem(intent.itemId);
				return;
			case 'endToggle':
				await endToggle(actor, intent.itemId, intent.ruleId);
				return;
			case 'openItem':
				await actor.items.get(intent.itemId)?.sheet?.render(true);
				return;
			case 'createItem':
				await actor.createItem({
					name: localize(NEW_ITEM_NAMES[intent.itemType]),
					type: intent.itemType,
				} as Item.CreateData);
				return;
			case 'deleteItem':
				await actor.deleteItem(intent.itemId);
				return;
			case 'toggleEquip':
				await (
					actor.items.get(intent.itemId) as { toggleEquipment?: () => Promise<unknown> } | undefined
				)?.toggleEquipment?.();
				return;
			case 'setQuantity':
				await setQuantity(actor, intent.itemId, intent.value);
				return;
			case 'storeIn':
				if (intent.containerId) await actor.storeItemInContainer(intent.itemId, intent.containerId);
				else await actor.removeItemFromContainer(intent.itemId);
				return;
			case 'endEffect':
				await endEffect(document, intent.effectId);
				return;
			case 'removeEffect':
				await removeEffect(document, intent.effectId, intent.itemId);
				return;
			case 'setCondition':
				await setCondition(document, intent.conditionId, intent.active);
				return;
			case 'setDetail':
				await actor.update({ [`system.details.${intent.detail}`]: intent.value } as Record<
					string,
					unknown
				>);
				return;
			case 'setFlag':
				await actor.setFlag(SYSTEM_ID as 'core', intent.flag as never, intent.value as never);
				return;
			case 'setField':
				await actor.update({ [SETTINGS_FIELDS[intent.field]]: intent.value } as Record<
					string,
					unknown
				>);
				return;
			case 'dropItem':
				await sheet.dropItem(intent.data, intent.containerId);
				return;
			case 'exportPdf':
				openPdfExportDialog(actor);
				return;
			case 'exportJson':
				try {
					exportCharacterToJson(actor);
					ui.notifications?.info(localize('NIMBLE.jsonExport.success'));
				} catch (error) {
					console.error('Character JSON export failed:', error);
					ui.notifications?.error(localize('NIMBLE.jsonExport.error'));
				}
				return;
			case 'setCurrency':
				await actor.update({ [`system.currency.${intent.coin}`]: intent.value } as Record<
					string,
					unknown
				>);
				return;
			case 'setSpellsBy':
				await actor.setFlag(SYSTEM_ID as 'core', 'spellsBy' as never, intent.value as never);
				return;
			case 'spendDice':
				await spendDice(actor, intent);
				return;
			case 'unarmedStrike':
				await strikeUnarmed(actor);
				return;
			case 'move':
				await runMoveAction(actor);
				return;
			case 'assess':
				await runAssess(actor, { optionId: intent.option, skillKey: intent.skill });
				return;
			case 'reaction':
				await useChatReaction(actor, intent.reaction);
				return;
			case 'opportunityAttack':
				await useOpportunityAttack(actor, intent.weaponId);
				return;
			default: {
				const unknown: never = intent;
				throw new Error(`No perform for ${JSON.stringify(unknown)}`);
			}
		}
	};
}

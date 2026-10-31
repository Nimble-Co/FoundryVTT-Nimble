import type { NimbleCharacter } from '#documents/actor/character.js';
import ItemActivationConfigDialog from '#documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import { attacksMadeThisTurn, recordAttack } from '#utils/combat/rushedAttacks.js';
import { attackDeliveryFromAttackType } from '#utils/damage/attackDelivery.js';
import {
	getDamageBonusFormulas,
	getDamageBonusTotal,
	getUnarmedDamageFormula,
	hasUnarmedProficiency,
} from '#utils/damage/attackUtils.js';
import { DEFAULT_MISS_THRESHOLD } from '#utils/damage/missThreshold.js';
import {
	applyPostRollIncomingBehavior,
	computeIncomingAttackPlan,
} from '#utils/incomingReactions/incomingAttackModifiers.js';
import type { OfferingActor } from '#utils/incomingReactions/poolSpendCardOffers.js';
import localize from '#utils/localize.js';
import { DamageRoll } from '../../dice/DamageRoll.js';
import { isActionTrackingAutomationEnabled } from '../../settings/automationSettings.js';

/**
 * An unarmed strike is a melee attack at reach 1. The posted card declares it
 * so anything reading the card back (the GM-side spend re-validation) agrees
 * with the card's own top-level attack type.
 */
const UNARMED_STRIKE_ATTACK_TYPE = 'reach';
const UNARMED_STRIKE_IMG = 'icons/skills/melee/unarmed-punch-fist.webp';

export interface RollUnarmedStrikeOptions {
	/** Starting roll mode of the config dialog. */
	rollMode?: number;
}

function buildRollFormula(actor: NimbleCharacter): string {
	let rollFormula = getUnarmedDamageFormula(actor);

	// Unarmed strikes are melee + weapon + bludgeoning. No targetDomain is passed,
	// so bonuses with a targetCondition are excluded.
	const meleeDamageBonus = getDamageBonusTotal(actor, 'melee', 'weapon', 'bludgeoning');
	if (meleeDamageBonus > 0) {
		rollFormula = `${rollFormula} + ${meleeDamageBonus}`;
	}
	for (const diceFormula of getDamageBonusFormulas(actor, 'melee', 'weapon', 'bludgeoning')) {
		rollFormula = `${rollFormula} + ${diceFormula}`;
	}
	return rollFormula;
}

/**
 * Rolls an Unarmed Strike and posts its card. Spends no actions; the caller
 * owns the action cost. Returns true when a card was posted.
 */
export async function rollUnarmedStrike(
	actor: NimbleCharacter,
	options: RollUnarmedStrikeOptions = {},
): Promise<boolean> {
	const rushed = options.rollMode === undefined ? attacksMadeThisTurn(actor) : 0;
	const startRollMode = options.rollMode ?? (rushed > 0 ? -rushed : 0);
	const rollFormula = buildRollFormula(actor);
	// Only characters proficient with unarmed strikes can crit.
	const canCrit = hasUnarmedProficiency(actor);
	const name = localize('NIMBLE.ui.heroicActions.unarmedStrike');

	const unarmedItem = {
		name,
		img: UNARMED_STRIKE_IMG,
		system: {
			activation: {
				effects: [
					{
						type: 'damage',
						formula: rollFormula,
						damageType: 'bludgeoning',
						canCrit,
						canMiss: true,
					},
				],
			},
		},
	};

	const dialog = new ItemActivationConfigDialog(actor, unarmedItem, name, {
		rollMode: startRollMode,
		rushedAttack: rushed > 0 ? rushed + 1 : undefined,
		spendsActions:
			options.rollMode === undefined &&
			isActionTrackingAutomationEnabled() &&
			game.combat?.started &&
			game.combat.combatants.some((entry) => entry.actorId === actor.id)
				? 1
				: 0,
	});
	await dialog.render(true);
	const result = await dialog.promise;

	if (!result) return false;

	const rollMode = result.rollMode ?? startRollMode;
	const firstTargetToken =
		(game.user?.targets?.values().next().value as Token.Implementation | undefined) ?? null;
	const incomingAttackPlan = computeIncomingAttackPlan(firstTargetToken, actor as OfferingActor, {
		delivery: attackDeliveryFromAttackType(UNARMED_STRIKE_ATTACK_TYPE),
	});

	const rollOptions: ConstructorParameters<typeof DamageRoll>[2] = {
		canCrit,
		canMiss: true,
		rollMode,
		primaryDieValue: result.primaryDieValue ?? 0,
		primaryDieModifier: Number(result.primaryDieModifier) || 0,
		damageType: 'bludgeoning',
		primaryDieAsDamage: true,
	};

	if (incomingAttackPlan.disadvantageCount > 0) {
		rollOptions.rollModeSources = [
			rollMode,
			...Array.from({ length: incomingAttackPlan.disadvantageCount }, () => -1),
		];
	}
	if (incomingAttackPlan.forceMiss) rollOptions.forceMiss = true;
	if (incomingAttackPlan.missThreshold > DEFAULT_MISS_THRESHOLD) {
		rollOptions.missThreshold = incomingAttackPlan.missThreshold;
	}
	if (incomingAttackPlan.appliedEntries.length > 0) {
		(rollOptions as { incomingAttackModifiers?: unknown }).incomingAttackModifiers =
			incomingAttackPlan.appliedEntries;
	}

	const firstRoll = new DamageRoll(rollFormula, actor.getRollData(), rollOptions);
	await firstRoll.evaluate();

	const postRoll = await applyPostRollIncomingBehavior(
		firstRoll,
		incomingAttackPlan,
		async (formula, rerollOptions) => {
			const rerolled = new DamageRoll(formula, actor.getRollData(), rerollOptions as never);
			await rerolled.evaluate();
			return rerolled;
		},
	);
	const { roll, discardedRoll } = postRoll;

	const evaluatedEffects = [
		{
			id: 'unarmed-damage',
			type: 'damage',
			formula: rollFormula,
			damageType: 'bludgeoning',
			canCrit,
			canMiss: true,
			roll: roll.toJSON(),
			...(discardedRoll ? { discardedRoll } : {}),
			parentNode: null,
			parentContext: null,
			on: {
				hit: [
					{
						id: 'unarmed-damage-hit',
						type: 'damageOutcome',
						parentNode: 'unarmed-damage',
						parentContext: 'hit',
					},
				],
			},
		},
	];

	const chatData = {
		author: game.user?.id,
		flavor: `${actor.name}: ${name}`,
		speaker: ChatMessage.getSpeaker({ actor }),
		style: CONST.CHAT_MESSAGE_STYLES.OTHER,
		sound: CONFIG.sounds.dice,
		rolls: [roll],
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: unarmedItem.img,
			permissions: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			rollMode,
			name,
			description: '',
			featureType: 'feature',
			class: '',
			attackType: UNARMED_STRIKE_ATTACK_TYPE,
			attackDistance: 1,
			isCritical: roll.isCritical,
			isMiss: roll.isMiss,
			activation: {
				effects: evaluatedEffects,
				cost: { type: 'action', quantity: 1 },
				duration: { type: 'none', quantity: 1 },
				targets: { count: 1, attackType: UNARMED_STRIKE_ATTACK_TYPE, distance: 1 },
			},
			targets: Array.from(game.user?.targets ?? [], (token) => token.document.uuid),
			incomingReactions: postRoll.stampEntries,
			rerolls: postRoll.rerollHistory?.rerolls ?? [],
			rollChanges: postRoll.rerollHistory?.rollChanges ?? [],
			discardedCritTriggers: postRoll.rerollHistory?.discardedCritTriggers ?? false,
		},
		type: 'feature',
	};

	await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	await recordAttack(actor);
	return true;
}

/** Rolls an Unarmed Strike, then spends 1 action by the same rule as `activateItem`. */
export async function strikeUnarmed(actor: NimbleCharacter): Promise<void> {
	if (!(await rollUnarmedStrike(actor))) return;
	const combat = game.combat;
	const combatant = combat?.combatants.find((entry) => entry.actorId === actor.id);
	if (combat?.started && combatant?.id) {
		await consumeCombatantAction({ combat, combatantId: combatant.id });
	}
}

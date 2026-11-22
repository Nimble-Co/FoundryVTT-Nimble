import type { NimbleCharacter } from '#documents/actor/character.js';
import ItemActivationConfigDialog from '#documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import type { DamagePart } from '#types/damagePart.d.ts';
import type { OtherCreature } from '#types/otherCreature.d.ts';
import { giveUnarmedHitRecovery } from '#utils/chargePool/itemUseRecovery.js';
import { spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import { addCardEvents } from '#utils/chat/cardEvents.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import { attacksMadeThisTurn, recordAttack } from '#utils/combat/rushedAttacks.js';
import { deliveryOfAttack } from '#utils/damage/attackDelivery.js';
import { attackOriginName, attackOriginOf } from '#utils/damage/attackOrigin.js';
import {
	getDamageBonusFormulas,
	getDamageBonusParts,
	getDamageBonusTotal,
	getUnarmedDamageFormula,
	hasUnarmedProficiency,
} from '#utils/damage/attackUtils.js';
import {
	attackOutcomeChargesToSpend,
	collectAttackOutcome,
} from '#utils/damage/collectAttackOutcome.js';
import { collectCritDice, spendCritDiceUses } from '#utils/damage/collectCritDice.js';
import { collectOfferBonuses } from '#utils/damage/collectOfferBonuses.js';
import { collectPrimaryDieBonuses } from '#utils/damage/collectPrimaryDieBonuses.js';
import { markDualWieldUse } from '#utils/damage/dualWield.js';
import { DEFAULT_MISS_THRESHOLD } from '#utils/damage/missThreshold.js';
import { UNARMED_STRIKE_ATTACK } from '#utils/damage/weaponAttack.js';
import { attackHeldPlanOf } from '#utils/heldChange/attackHeldPlan.js';
import { firstTargetActor } from '#utils/heldChange/heldChange.js';
import { heldChosenOf, keptAmountOfRoll } from '#utils/heldChange/heldChoice.js';
import {
	applyPostRollIncomingBehavior,
	computeIncomingAttackPlan,
} from '#utils/incomingReactions/incomingAttackModifiers.js';
import type { OfferingActor } from '#utils/incomingReactions/poolSpendCardOffers.js';
import { fireAttackEvents } from '#utils/lastsUntil/lastsUntilEvents.js';
import localize from '#utils/localize.js';
import { withConditionSources } from '#utils/rolls/appliedConditionRollModes.js';
import { attackRollModeOf, rollModeWith } from '#utils/rolls/attackRollMode.js';
import { freeAttackNote } from '#utils/rolls/freeAttackNote.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import { DamageRoll } from '../../dice/DamageRoll.js';
import {
	keptAmountRollOptions,
	removeDisadvantage,
} from '../../managers/itemActivation/keptAmountActivation.js';
import {
	addOfferBonuses,
	markOfferOnRollOptions,
	rollTypedOfferDamage,
} from '../../managers/itemActivation/offerBonus.js';
import { isActionTrackingAutomationEnabled } from '../../settings/automationSettings.js';
import { statsInFormula } from '../reroll/rollStat.js';

/**
 * The posted card declares the attack type so anything reading the card back (the GM-side spend
 * re-validation) agrees with the card's own top-level attack type.
 */
const UNARMED_STRIKE_ATTACK_TYPE = UNARMED_STRIKE_ATTACK.attackType;
const UNARMED_STRIKE_IMG = 'icons/skills/melee/unarmed-punch-fist.webp';

export interface RollUnarmedStrikeOptions {
	/** Starting roll mode of the config dialog. */
	rollMode?: number;
	/** The strike is an opportunity attack; its card says so. */
	opportunityAttack?: boolean;
	/** The feature the strike is made through. */
	originUuid?: string;
	/** The strike spends no action. */
	free?: boolean;
	/** The strike takes no Rushed Attack disadvantage; it still counts as an attack of the turn. */
	ignoresRushed?: boolean;
	/** Up to this many targets share one attack: one roll, each target's armor, miss and crit as normal. */
	sharedTargets?: number;
}

function buildRollFormula(
	actor: NimbleCharacter,
	origin: string | undefined,
): { formula: string; damageParts: DamagePart[] } {
	let rollFormula = getUnarmedDamageFormula(actor);

	// Unarmed strikes are melee + weapon + bludgeoning. No targetDomain is passed,
	// so bonuses with a targetCondition are excluded.
	const meleeDamageBonus = getDamageBonusTotal(
		actor,
		'melee',
		'weapon',
		'bludgeoning',
		undefined,
		undefined,
		origin,
	);
	if (meleeDamageBonus > 0) {
		rollFormula = `${rollFormula} + ${meleeDamageBonus}`;
	}
	for (const diceFormula of getDamageBonusFormulas(
		actor,
		'melee',
		'weapon',
		'bludgeoning',
		undefined,
		undefined,
		origin,
	)) {
		rollFormula = `${rollFormula} + ${diceFormula}`;
	}
	return {
		formula: rollFormula,
		damageParts: getDamageBonusParts(
			actor,
			'melee',
			'weapon',
			'bludgeoning',
			undefined,
			undefined,
			origin,
		),
	};
}

/**
 * Rolls an Unarmed Strike and posts its card. Spends no actions; the caller
 * owns the action cost. Returns true when a card was posted.
 */
export async function rollUnarmedStrike(
	actor: NimbleCharacter,
	options: RollUnarmedStrikeOptions = {},
): Promise<boolean> {
	const origin = options.originUuid ? attackOriginOf({}, options.originUuid) : null;
	const rollModeChange = attackRollModeOf(actor, origin);
	const rushed =
		options.rollMode === undefined && !options.ignoresRushed && !rollModeChange.ignoreDisadvantage
			? attacksMadeThisTurn(actor)
			: 0;
	const startRollMode = rollModeWith(
		options.rollMode ?? (rushed > 0 ? -rushed : 0),
		rollModeChange,
	);
	const offerBonuses = collectOfferBonuses(actor, origin);
	const built = buildRollFormula(actor, origin?.identifier);
	const offerAdded = addOfferBonuses(built.formula, offerBonuses, false);
	const rollFormula = offerAdded.formula;
	const damageParts = [...built.damageParts, ...offerAdded.damageParts];
	const shared = (options.sharedTargets ?? 0) > 1;
	const sharedFlag = shared ? { singleTargetAttack: true } : {};
	// Only characters proficient with unarmed strikes can crit.
	const canCrit = hasUnarmedProficiency(actor);
	const name = localize('NIMBLE.ui.heroicActions.unarmedStrike');

	const unarmedItem = {
		name,
		img: UNARMED_STRIKE_IMG,
		system: {
			activation: {
				targets: { attackType: UNARMED_STRIKE_ATTACK_TYPE, ...sharedFlag },
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
		...(rollModeChange.ignoreDisadvantage ? { ignoreDisadvantage: true } : {}),
		...(origin ? { attackOrigin: origin.identifier } : {}),
		...(options.free && origin
			? {
					attackNote: freeAttackNote(attackOriginName(origin.uuid), options.ignoresRushed === true),
				}
			: {}),
		spendsActions:
			options.rollMode === undefined &&
			!options.free &&
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
	const targets = Array.from(game.user?.targets ?? []) as Token.Implementation[];
	const multiTarget = targets.length > 1 && !shared;
	const target = soleTarget(targets, { firstDecides: shared });
	const delivery = deliveryOfAttack({ targets: { attackType: UNARMED_STRIKE_ATTACK_TYPE } }, actor);
	const incomingAttackPlan = computeIncomingAttackPlan(target, actor as OfferingActor, {
		delivery,
		stats: statsInFormula(rollFormula),
		...(origin ? { origin: origin.identifier, originUuid: origin.uuid } : {}),
	});
	const attackOutcome = collectAttackOutcome({
		attacker: actor as { rules?: unknown },
		target: (target?.actor ?? null) as { rules?: unknown } | null,
		delivery,
		itemUuid: null,
		canCrit: canCrit && !multiTarget,
		canMiss: !multiTarget,
		damageTypes: ['bludgeoning'],
	});

	const chosen = heldChosenOf(result.heldChosen);
	const { kept, toEnd } = keptAmountOfRoll(actor, unarmedItem, {
		tick: result.keptAmount,
		chosen,
	});
	const held = attackHeldPlanOf({
		attacker: actor,
		target: firstTargetActor(),
		area: false,
		attack: true,
		delivery,
		kept,
		keptToEnd: toEnd,
		noDisadvantageToIgnore: rollModeChange.ignoreDisadvantage,
		extraDamage: true,
		chosen,
	});
	const primaryDieBonuses = [
		...collectPrimaryDieBonuses(
			actor as unknown as { rules?: unknown[] },
			delivery,
			(target?.actor ?? null) as OtherCreature | null,
			origin?.identifier,
		),
		...offerAdded.primaryDieBonuses,
		...held.bonusLines(),
	];

	const rollOptions: ConstructorParameters<typeof DamageRoll>[2] = {
		canCrit: canCrit && !multiTarget,
		...attackOutcome.options,
		multiTarget,
		...(multiTarget
			? { multiTargetDetail: { targets: targets.length, couldCrit: canCrit, couldMiss: true } }
			: {}),
		rollMode,
		primaryDieValue: result.primaryDieValue ?? 0,
		primaryDieModifier:
			(Number(result.primaryDieModifier) || 0) +
			primaryDieBonuses.reduce((sum, line) => sum + line.value, 0),
		damageType: 'bludgeoning',
		primaryDieAsDamage: true,
		...(damageParts.length > 0 ? { damageParts } : {}),
		...(canCrit && !multiTarget
			? { critDice: collectCritDice(actor as { rules?: unknown }, delivery) }
			: {}),
	};

	const conditions = kept ? [] : (result.conditionRollModes ?? []);
	if (conditions.length > 0 || incomingAttackPlan.disadvantageCount > 0) {
		rollOptions.rollModeSources = [
			...withConditionSources([rollMode], conditions),
			...Array.from({ length: incomingAttackPlan.disadvantageCount }, () => -1),
		];
	}
	if (conditions.length > 0) rollOptions.conditionRollModes = conditions;
	if (incomingAttackPlan.forceMiss) rollOptions.forceMiss = true;
	if (incomingAttackPlan.missThreshold > DEFAULT_MISS_THRESHOLD) {
		rollOptions.missThreshold = incomingAttackPlan.missThreshold;
	}
	if (incomingAttackPlan.appliedEntries.length > 0) {
		(rollOptions as { incomingAttackModifiers?: unknown }).incomingAttackModifiers =
			incomingAttackPlan.appliedEntries;
	}

	if (origin) markOfferOnRollOptions(rollOptions, origin);
	if (rollModeChange.ignoreDisadvantage) removeDisadvantage(rollOptions);
	held.applyToRoll(rollOptions);
	const firstRoll = new DamageRoll(
		kept ? String(kept.value) : rollFormula,
		actor.getRollData(),
		kept ? keptAmountRollOptions(rollOptions, kept.label) : rollOptions,
	);
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
			...(attackOutcome.options.ignoreArmor ? { ignoreArmor: true } : {}),
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
	const extraDamage = [
		...(await rollTypedOfferDamage(offerBonuses)),
		...(await held.rollExtraDamage(actor.getRollData())),
	];

	const chatData = {
		author: game.user?.id,
		flavor: `${actor.name}: ${name}`,
		speaker: ChatMessage.getSpeaker({ actor }),
		style: CONST.CHAT_MESSAGE_STYLES.OTHER,
		sound: CONFIG.sounds.dice,
		rolls: [roll, ...extraDamage.map((part) => part.roll)],
		...(origin || options.opportunityAttack
			? {
					flags: {
						[SYSTEM_ID]: {
							...(origin ? { origin } : {}),
							...(options.opportunityAttack ? { opportunityAttack: true } : {}),
						},
					},
				}
			: {}),
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: unarmedItem.img,
			permissions: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			rollMode,
			primaryDieBonuses,
			name,
			description: '',
			featureType: 'feature',
			class: '',
			attackType: UNARMED_STRIKE_ATTACK_TYPE,
			attackDistance: 1,
			isCritical: roll.isCritical,
			isMiss: roll.isMiss,
			activation: {
				effects: [...evaluatedEffects, ...extraDamage.map((part) => part.node)],
				cost: { type: 'action', quantity: 1 },
				duration: { type: 'none', quantity: 1 },
				targets: {
					count: 1,
					attackType: UNARMED_STRIKE_ATTACK_TYPE,
					distance: 1,
					...sharedFlag,
				},
			},
			targets: Array.from(game.user?.targets ?? [], (token) => token.document.uuid),
			incomingReactions: postRoll.stampEntries,
			rerolls: postRoll.rerollHistory?.rerolls ?? [],
			rollChanges: postRoll.rerollHistory?.rollChanges ?? [],
			discardedCritTriggers: postRoll.rerollHistory?.discardedCritTriggers ?? false,
		},
		type: 'feature',
	};

	const card = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	void fireAttackEvents(actor, card);
	await recordAttack(actor);
	const recoveryFlags = await giveUnarmedHitRecovery(actor, roll, targets as never);
	await card?.update?.(recoveryFlags);
	await held.spend(card ? { add: (events) => addCardEvents(card as never, events) } : null);
	if (result.dualWield) await markDualWieldUse(actor as never);
	for (const identifier of attackOutcomeChargesToSpend(attackOutcome.charges, roll)) {
		await spendRuleCharge(actor, identifier);
	}
	await spendCritDiceUses(actor as unknown as Actor, roll as unknown as DamageRoll);
	return true;
}

/** Rolls an Unarmed Strike, then spends 1 action by the same rule as `activateItem`. True when rolled. */
export async function strikeUnarmed(
	actor: NimbleCharacter,
	options: Omit<RollUnarmedStrikeOptions, 'rollMode' | 'free'> = {},
): Promise<boolean> {
	if (!(await rollUnarmedStrike(actor, options))) return false;
	const combat = game.combat;
	const combatant = combat?.combatants.find((entry) => entry.actorId === actor.id);
	if (combat?.started && combatant?.id) {
		await consumeCombatantAction({ combat, combatantId: combatant.id });
	}
	return true;
}

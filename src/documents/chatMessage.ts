export type SystemChatMessageTypes = Exclude<foundry.documents.BaseChatMessage.SubType, 'base'>;

import { createSubscriber } from 'svelte/reactivity';
import { systemHookName } from '#system';
import type { DamageOutcomeNode, EffectNode } from '#types/effectTree.js';
import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { substituteSpendFormula } from '#utils/dicePool/substituteSpendFormula.js';
import {
	appendFlavoredBonusToRoll,
	foldBonusIntoPrimaryDamage,
	replaceDamageRollInRollsSource,
} from '#utils/foldBonusIntoPrimaryDamage.js';
import getDamageTypeLabel from '#utils/getDamageTypeLabel.ts';
import localize from '#utils/localize.ts';
import { getRelevantNodes } from '#view/dataPreparationHelpers/effectTree/getRelevantNodes.ts';
import { DamageRoll } from '../dice/DamageRoll.js';
import type { DamageReductionEntry } from '../models/rules/damageReduction.js';
import {
	clearBankedDamageReduction,
	getBankedDamageReduction,
	getBankedDamageReductionEntries,
} from '../utils/bankedDamageReduction.js';
import {
	type AttackOutcomeView,
	offerSurvives,
	rerollTriggerMatches,
	withRerollDisadvantage,
} from '../utils/incomingAttackModifiers.js';
import {
	type PoolSpendSelection,
	rejectIncomingAttackReaction,
} from '../utils/incomingAttackReactions.js';
import type { IncomingReactionEntry } from '../utils/incomingReactionEntry.js';
import { flattenEffectsTree } from '../utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '../utils/treeManipulation/reconstructEffectsTree.js';

/** Types for activation cards that have targets and effects */
type ActivationCardTypes = 'feature' | 'minionGroupAttack' | 'object' | 'reaction' | 'spell';

/** Record of applied healing for undo functionality */
export interface AppliedHealingRecord {
	effectId: string;
	healingType: string;
	amount: number;
	targets: Array<{
		uuid: string;
		tokenName: string;
		previousHp: number;
		previousTempHp: number;
		newHp: number;
		newTempHp: number;
	}>;
	appliedAt: number;
}

/** System data for activation cards */
interface ActivationCardSystemData {
	targets: string[];
	isCritical: boolean;
	isMiss: boolean;
	activation?: {
		effects: unknown[];
		[key: string]: unknown;
	};
	appliedHealing?: Record<string, AppliedHealingRecord>;
	[key: string]: unknown;
}

type HpMutableActor = Actor.Implementation &
	Pick<NimbleBaseActorInterface, 'applyDamage' | 'applyHealing' | 'setCurrentHP' | 'setTempHP'>;

type DamageApplyOutcome = DamageOutcomeNode['outcome'] | 'noDamage';

type DamageApplyOptions = {
	damageType?: string;
	ignoreArmor?: boolean;
	outcome?: DamageApplyOutcome;
	roll?: DamageRoll.SerializedData | null;
	rolls?: Array<DamageRoll.SerializedData | null | undefined>;
	isCritical?: boolean;
};

interface DamageApplicationTarget {
	actor: HpMutableActor;
	adjustedDamage: number;
}

/**
 * Why a damage component resolved to less (or more) than it rolled. `kind`
 * drives the badge shown on the target row; `label` is the full rule text the
 * badge carries as a tooltip.
 */
export type DamageModifierKind = 'immune' | 'vulnerable' | 'resistant' | 'reduction';

export interface DamageModifier {
	kind: DamageModifierKind;
	label: string;
}

/** One damage component of a card, resolved against a single target. */
export interface TargetDamageComponent {
	damageType?: string;
	/** Localized damage type name, or null for untyped damage */
	typeLabel: string | null;
	/**
	 * What this component would deal before the target's defenses — the rolled
	 * total already scaled by the card's outcome, so a half-damage outcome is
	 * halved here. Not the raw roll.
	 */
	damageBeforeDefenses: number;
	adjustedDamage: number;
	modifiers: DamageModifier[];
}

export interface TargetDamageBreakdown {
	components: TargetDamageComponent[];
	total: number;
}

interface DamageApplicationPlan {
	hasTargets: boolean;
	applicableTargets: DamageApplicationTarget[];
	zeroDamageTargetNames: string[];
	/** Targets whose banked one-shot reduction is consumed by this application */
	bankedReductionActors: HpMutableActor[];
}

/**
 * Only monsters carry the medium/heavy armor that reduces incoming damage, and
 * they store it as a string. A hero's `attributes.armor` is a schema object
 * whose value feeds the Defend reaction — "Armor represents your hero's ability
 * to dodge or block damage when you use the Defend reaction" — so it never
 * reduces damage on its own and always reports 'none' here. Callers must treat
 * that as a deliberate answer for heroes, not an absent one.
 */
function getActorArmorType(actor: Actor.Implementation): 'none' | 'medium' | 'heavy' {
	const armor = foundry.utils.getProperty(actor, 'system.attributes.armor');
	if (armor === 'medium' || armor === 'heavy') return armor;
	return 'none';
}

function getDamageRollTotal(serializedRoll: DamageRoll.SerializedData): number {
	const total = Number(serializedRoll.total ?? 0);
	if (!Number.isFinite(total) || total <= 0) return 0;
	return Math.floor(total);
}

function getSerializedDamageRolls(
	options: DamageApplyOptions | undefined,
): DamageRoll.SerializedData[] {
	const serializedRolls =
		options?.rolls?.filter((roll): roll is DamageRoll.SerializedData => roll != null) ?? [];
	if (options?.roll) serializedRolls.push(options.roll);
	return serializedRolls;
}

/**
 * Read a roll term's flavor from either the live term (`term.flavor` getter) or
 * its serialized shape (`term.options.flavor`). Flavored numeric terms in a
 * damage roll are banked dice-pool contributions (e.g. Berserker Fury Dice, or
 * manually-spent pool faces). Pack-authored formulas never flavor a flat
 * constant; static/situational modifiers are always added unflavored.
 */
function getTermFlavor(term: unknown): string {
	const serializedTerm = term as { flavor?: unknown; options?: { flavor?: unknown } };
	if (typeof serializedTerm.flavor === 'string' && serializedTerm.flavor.trim().length > 0) {
		return serializedTerm.flavor;
	}
	const optionsFlavor = serializedTerm.options?.flavor;
	return typeof optionsFlavor === 'string' ? optionsFlavor : '';
}

function getDiceDamageTotal(serializedRoll: DamageRoll.SerializedData): number | null {
	let diceDamage = 0;
	let hasDiceTerm = false;

	if (!Array.isArray(serializedRoll.terms)) return null;

	for (const term of serializedRoll.terms) {
		const serializedTerm = term as { faces?: unknown; results?: unknown; number?: unknown };
		const faces = Number(serializedTerm.faces);

		if (!Number.isFinite(faces) || faces <= 0) {
			// Banked dice-pool faces (Fury Dice etc.) ship as flavored numeric
			// terms. Per Nimble rules "your Fury Dice are dice when calculating
			// damage for monster armor", so they belong in the dice total, not
			// among the armor-ignored modifiers.
			if (getTermFlavor(term).length < 1) continue;
			const numericValue = Number(serializedTerm.number);
			if (!Number.isFinite(numericValue)) continue;
			hasDiceTerm = true;
			diceDamage += numericValue;
			continue;
		}

		hasDiceTerm = true;

		if (!Array.isArray(serializedTerm.results)) continue;
		for (const result of serializedTerm.results) {
			const serializedResult = result as {
				result?: unknown;
				active?: unknown;
				discarded?: unknown;
			};
			if (serializedResult.active === false || serializedResult.discarded === true) continue;

			const resultValue = Number(serializedResult.result);
			if (!Number.isFinite(resultValue)) continue;
			diceDamage += resultValue;
		}
	}

	if (!hasDiceTerm) return null;

	const excludedPrimaryDieValue = Number(serializedRoll.excludedPrimaryDieValue ?? 0);
	if (Number.isFinite(excludedPrimaryDieValue) && excludedPrimaryDieValue > 0) {
		diceDamage -= excludedPrimaryDieValue;
	}

	return Math.max(0, Math.floor(diceDamage));
}

function getNegativeModifierTotal(serializedRoll: DamageRoll.SerializedData): number {
	if (!Array.isArray(serializedRoll.terms)) return 0;

	let negativeModifierTotal = 0;
	let pendingOperator: '+' | '-' = '+';

	for (const term of serializedRoll.terms) {
		const serializedTerm = term as { operator?: unknown; number?: unknown; faces?: unknown };

		if (serializedTerm.operator === '+' || serializedTerm.operator === '-') {
			pendingOperator = serializedTerm.operator;
			continue;
		}

		const faces = Number(serializedTerm.faces);
		if (Number.isFinite(faces) && faces > 0) {
			pendingOperator = '+';
			continue;
		}

		// Flavored numeric terms are dice-pool contributions counted as dice by
		// getDiceDamageTotal, not modifiers, so skip them here to avoid
		// double-counting.
		if (getTermFlavor(term).length > 0) {
			pendingOperator = '+';
			continue;
		}

		const numericValue = Number(serializedTerm.number);
		if (!Number.isFinite(numericValue)) {
			pendingOperator = '+';
			continue;
		}

		let signedModifier = numericValue;
		if (pendingOperator === '-') signedModifier = -signedModifier;
		if (signedModifier < 0) negativeModifierTotal += signedModifier;
		pendingOperator = '+';
	}

	return Math.floor(negativeModifierTotal);
}

function calculateArmorAdjustedDamage(params: {
	actor: Actor.Implementation;
	damage: number;
	options?: DamageApplyOptions;
}): number {
	const armorType = getActorArmorType(params.actor);
	const damageOptions = params.options;

	// Vulnerability is defined in terms of armor rather than as a multiplier:
	// "that kind of damage ignores its armor; if unarmored, they take double the
	// damage instead" (Core Rules glossary), and the GM guide scopes the first
	// half to monsters — "damage type vulnerabilities ignore monster armor".
	// Heroes therefore always take the doubling branch: their Armor is a Defend
	// value, so there is no armor for the damage to ignore. The incoming value
	// has already been scaled by the outcome, so doubling it here keeps
	// half-damage outcomes halved before the vulnerability applies.
	const isVulnerable = actorIsVulnerableToDamage(params.actor, damageOptions?.damageType);

	if (armorType === 'none') return isVulnerable ? params.damage * 2 : params.damage;
	if (damageOptions?.ignoreArmor === true) return params.damage;
	if (isVulnerable) return params.damage;
	const serializedRolls = getSerializedDamageRolls(damageOptions);
	const applyOutcomeHalfDamage = damageOptions?.outcome === 'halfDamage';
	const applyHeavyArmor = armorType === 'heavy';

	if (serializedRolls.length < 1) {
		if (damageOptions?.isCritical === true) {
			if (applyOutcomeHalfDamage) return Math.ceil(params.damage * 0.5);
			return params.damage;
		}

		// Without roll metadata, the incoming value already includes outcome scaling.
		// In this fallback, only apply armor reduction.
		if (applyHeavyArmor) return Math.ceil(params.damage * 0.5);
		return params.damage;
	}

	let totalAdjustedDamage = 0;
	for (const serializedRoll of serializedRolls) {
		const rollTotal = getDamageRollTotal(serializedRoll);
		const isCritical = serializedRoll.isCritical === true;

		if (isCritical) {
			const critAdjustedDamage = applyOutcomeHalfDamage ? Math.ceil(rollTotal * 0.5) : rollTotal;
			totalAdjustedDamage += critAdjustedDamage;
			continue;
		}

		const diceDamage = getDiceDamageTotal(serializedRoll) ?? rollTotal;
		const negativeModifierTotal = getNegativeModifierTotal(serializedRoll);
		let adjustedDamage = diceDamage;
		if (applyOutcomeHalfDamage) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		if (applyHeavyArmor) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		adjustedDamage += negativeModifierTotal;
		totalAdjustedDamage += adjustedDamage;
	}

	return Math.max(0, Math.floor(totalAdjustedDamage));
}

/**
 * Sum the target's damageReduction rule entries that match the incoming damage
 * type. Untyped entries (empty damageTypes) always apply; typed entries apply
 * only when the incoming damage type is known and included — an unknown type
 * (e.g. the minion group attack card, which carries no roll metadata) must not
 * match type-scoped reductions.
 */
function getDamageReductionTotal(actor: Actor.Implementation, damageType?: string): number {
	const reductions = foundry.utils.getProperty(actor, 'system.damageReductions') as
		| DamageReductionEntry[]
		| undefined;
	if (!Array.isArray(reductions)) return 0;

	let total = 0;
	for (const reduction of reductions) {
		if (reduction?.mode === 'half') continue;
		const value = Number(reduction?.value);
		if (!Number.isFinite(value) || value <= 0) continue;

		if (!matchesDamageType(reduction.damageTypes, damageType)) continue;

		total += value;
	}

	return Math.floor(total);
}

/** Typed scopes only match a known, included damage type; empty = all. */
function matchesDamageType(damageTypes: unknown, damageType?: string): boolean {
	const types = Array.isArray(damageTypes) ? damageTypes : [];
	if (types.length === 0) return true;
	return Boolean(damageType && types.includes(damageType));
}

/**
 * Resistance check: `half`-mode damageReduction rule entries and the actor's
 * `attributes.damageResistances` both mean "take half as much damage" (Core
 * Rules glossary). Halving applies once — multiple matching sources do not
 * stack into quarters.
 */
function actorResistsDamage(actor: Actor.Implementation, damageType?: string): boolean {
	const resistances = foundry.utils.getProperty(actor, 'system.attributes.damageResistances');
	if (Array.isArray(resistances) && damageType && resistances.includes(damageType)) return true;

	const reductions = foundry.utils.getProperty(actor, 'system.damageReductions') as
		| DamageReductionEntry[]
		| undefined;
	if (!Array.isArray(reductions)) return false;
	return reductions.some(
		(reduction) =>
			reduction?.mode === 'half' && matchesDamageType(reduction.damageTypes, damageType),
	);
}

function actorIsImmuneToDamage(actor: Actor.Implementation, damageType?: string): boolean {
	const immunities = foundry.utils.getProperty(actor, 'system.attributes.damageImmunities');
	return Array.isArray(immunities) && Boolean(damageType && immunities.includes(damageType));
}

function actorIsVulnerableToDamage(actor: Actor.Implementation, damageType?: string): boolean {
	const vulnerabilities = foundry.utils.getProperty(
		actor,
		'system.attributes.damageVulnerabilities',
	);
	return (
		Array.isArray(vulnerabilities) && Boolean(damageType && vulnerabilities.includes(damageType))
	);
}

function describeBankedReduction(banked: { source: string | null; value: number }): DamageModifier {
	return {
		kind: 'reduction',
		label: banked.source
			? localize('NIMBLE.damageModifiers.bankedSource', {
					source: banked.source,
					value: String(banked.value),
				})
			: localize('NIMBLE.damageModifiers.banked', { value: String(banked.value) }),
	};
}

/**
 * Human-readable reasons one damage component resolves to something other than
 * the rolled total: immunity, vulnerability, resistance (attribute or half-mode
 * rule), and flat damageReduction rules. Armor is excluded — the target list
 * already shows it as an icon. The banked one-shot reduction is appended by the
 * caller, since only the component that consumes it should name it.
 */
function describeDamageModifiers(
	actor: Actor.Implementation,
	options?: DamageApplyOptions,
): DamageModifier[] {
	const modifiers: DamageModifier[] = [];
	const damageType = options?.damageType;
	const typeLabel = damageType ? getDamageTypeLabel(damageType) : '';

	if (actorIsImmuneToDamage(actor, damageType)) {
		modifiers.push({
			kind: 'immune',
			label: localize('NIMBLE.damageModifiers.immune', { type: typeLabel }),
		});
	}

	if (actorIsVulnerableToDamage(actor, damageType)) {
		const unarmored = getActorArmorType(actor) === 'none';

		// Against an armored target all vulnerability does is bypass the armor, so
		// a card that already ignores armor gets no badge — nothing was changed.
		if (unarmored || options?.ignoreArmor !== true) {
			modifiers.push({
				kind: 'vulnerable',
				label: unarmored
					? localize('NIMBLE.damageModifiers.vulnerableUnarmored', { type: typeLabel })
					: localize('NIMBLE.damageModifiers.vulnerable', { type: typeLabel }),
			});
		}
	}

	const resistances = foundry.utils.getProperty(actor, 'system.attributes.damageResistances');
	if (Array.isArray(resistances) && damageType && resistances.includes(damageType)) {
		modifiers.push({
			kind: 'resistant',
			label: localize('NIMBLE.damageModifiers.resistant', { type: typeLabel }),
		});
	}

	const reductions = foundry.utils.getProperty(actor, 'system.damageReductions') as
		| DamageReductionEntry[]
		| undefined;
	if (!Array.isArray(reductions)) return modifiers;

	for (const reduction of reductions) {
		if (!matchesDamageType(reduction?.damageTypes, damageType)) continue;

		if (reduction?.mode === 'half') {
			modifiers.push({
				kind: 'resistant',
				label: reduction.label
					? localize('NIMBLE.damageModifiers.resistanceSource', { label: reduction.label })
					: localize('NIMBLE.damageModifiers.resistanceGeneric'),
			});
			continue;
		}

		const value = Number(reduction?.value);
		if (!Number.isFinite(value) || value <= 0) continue;
		modifiers.push({
			kind: 'reduction',
			label: reduction.label
				? localize('NIMBLE.damageModifiers.flat', {
						label: reduction.label,
						value: String(Math.floor(value)),
					})
				: localize('NIMBLE.damageModifiers.flatGeneric', {
						value: String(Math.floor(value)),
					}),
		});
	}

	return modifiers;
}

/**
 * Order: outcome/armor halving (where vulnerability bypasses armor or doubles
 * an unarmored target) → immunity (zero) → resistance halving →
 * flat rule reductions → clamp at zero. Immunity outranks vulnerability, so a
 * target listed under both takes nothing. The banked one-shot reduction is
 * subtracted by the caller, since it is only consumed when the hit would
 * otherwise deal damage. Temp HP absorption happens later, inside
 * `actor.applyDamage`. The books don't
 * specify resistance-vs-reduction ordering; halving first keeps flat
 * reductions (Fury spends) fully effective. Halving rounds up, matching the
 * heavy-armor convention.
 */
function calculateAdjustedDamage(params: {
	actor: Actor.Implementation;
	damage: number;
	options?: DamageApplyOptions;
}): number {
	const armorAdjustedDamage = calculateArmorAdjustedDamage(params);
	const damageType = params.options?.damageType;
	if (actorIsImmuneToDamage(params.actor, damageType)) return 0;

	const resistanceAdjustedDamage = actorResistsDamage(params.actor, damageType)
		? Math.ceil(armorAdjustedDamage * 0.5)
		: armorAdjustedDamage;

	return Math.max(0, resistanceAdjustedDamage - getDamageReductionTotal(params.actor, damageType));
}

function buildDamageApplicationPlan(params: {
	targets: string[];
	damage: number;
	options?: DamageApplyOptions;
}): DamageApplicationPlan {
	const applicableTargets: DamageApplicationTarget[] = [];
	const zeroDamageTargetNames = new Set<string>();
	const bankedReductionActors = new Set<HpMutableActor>();

	for (const uuid of params.targets) {
		const tokenDocument = fromUuidSync(uuid) as TokenDocument | null;
		const actor = tokenDocument?.actor as HpMutableActor | null;
		if (!actor) continue;

		// A banked reduction is one-shot: when the same actor is targeted through
		// multiple tokens, only its first application entry gets the bank. It is
		// only consumed when the hit would otherwise deal damage — immunity or
		// armor zeroing the hit leaves the bank in place.
		const availableBank = bankedReductionActors.has(actor) ? 0 : getBankedDamageReduction(actor);
		const unbankedDamage = calculateAdjustedDamage({
			actor,
			damage: params.damage,
			options: params.options,
		});
		const bankedReduction = unbankedDamage > 0 ? availableBank : 0;
		if (bankedReduction > 0) bankedReductionActors.add(actor);

		const adjustedDamage = Math.max(0, unbankedDamage - bankedReduction);

		if (!Number.isFinite(adjustedDamage) || adjustedDamage <= 0) {
			zeroDamageTargetNames.add(
				tokenDocument?.name || actor.name || localize('NIMBLE.ui.heroicActions.unknown'),
			);
			continue;
		}

		applicableTargets.push({
			actor,
			adjustedDamage,
		});
	}

	return {
		hasTargets: params.targets.length > 0,
		applicableTargets,
		zeroDamageTargetNames: [...zeroDamageTargetNames],
		bankedReductionActors: [...bankedReductionActors],
	};
}

/**
 * Map a card picker's selection onto the pool as it stands now. Indices alone
 * are not enough: the pool can change between opening the picker and
 * confirming it (a refill trigger, another feature spending a die), so the
 * faces the player was shown must still sit at the indices they chose.
 * Returns null when the selection no longer describes the live pool.
 */
function resolvePoolSpendSelection(
	faces: number[],
	selection: PoolSpendSelection,
): { spentFaces: number[]; remainingFaces: number[] } | null {
	const pickedIndices = [...new Set(selection.faceIndices)];
	if (pickedIndices.length < 1) return null;
	if (pickedIndices.length !== selection.expectedFaces?.length) return null;

	const spentFaces: number[] = [];
	for (let position = 0; position < pickedIndices.length; position += 1) {
		const index = pickedIndices[position];
		if (!Number.isInteger(index) || index < 0 || index >= faces.length) return null;
		if (faces[index] !== selection.expectedFaces[position]) return null;
		spentFaces.push(faces[index]);
	}

	const picked = new Set(pickedIndices);
	return {
		spentFaces,
		remainingFaces: faces.filter((_, index) => !picked.has(index)),
	};
}

/**
 * Spend offers currently resolving, keyed `<messageId>:<entryId>`.
 *
 * `used` is only written at the end of a resolve, several awaits in. A second
 * request arriving inside that window passes the unused-entry check and reads
 * the same unspent pool, so the dice come out once and the damage goes on
 * twice. Every request lands on the one primary GM's client, so an in-memory
 * lock is enough to serialize them.
 */
const inFlightSpendOffers = new Set<string>();

/** In-flight reaction resolve per card, so the next one starts after it. */
const reactionWriteQueues = new Map<string, Promise<void>>();

/**
 * Run a reaction resolver with at most one in flight per card.
 *
 * Every resolver reads the card's `incomingReactions`, awaits — a roll
 * evaluation, a pool write — and then writes the whole array back. Two
 * resolvers overlapping on one card each write their own stale copy, and
 * whichever lands second drops the other's `used` flag. Routing every kind
 * through the primary GM gives us a single writing client; this gives that
 * client a single write in flight per card, which is what the routing was
 * credited with on its own.
 *
 * Keyed by message id rather than by entry, because the array is shared: two
 * *different* entries resolving at once is exactly the case an entry-level
 * lock misses.
 */
function queueReactionWrite(messageId: string, task: () => Promise<void>): Promise<void> {
	const previous = reactionWriteQueues.get(messageId) ?? Promise.resolve();
	// Both paths run the task: a predecessor that threw must not wedge the card.
	const result = previous.then(task, task);
	const settled = result.then(
		() => undefined,
		() => undefined,
	);

	reactionWriteQueues.set(messageId, settled);
	void settled.then(() => {
		if (reactionWriteQueues.get(messageId) === settled) reactionWriteQueues.delete(messageId);
	});

	return result;
}

class NimbleChatMessage extends ChatMessage {
	declare type: SystemChatMessageTypes;

	#subscribe: ReturnType<typeof createSubscriber>;

	constructor(data: ChatMessage.CreateData, context?: ChatMessage.ConstructionContext) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _change, options) => {
				if ((options as { diff?: boolean }).diff === false) return;

				let requiresUpdate = false;

				if (this.isActivationCard()) {
					const actorWithTokens = triggeringDocument as {
						getDependentTokens?(): { uuid: string }[];
					};
					const dependentTokens = actorWithTokens.getDependentTokens?.() ?? [];
					const systemData = this.system as ActivationCardSystemData;

					for (const token of dependentTokens) {
						if (systemData.targets?.includes(token.uuid)) requiresUpdate = true;
					}
				}

				if (requiresUpdate) update();
			});

			const updateChatMessageHook = Hooks.on(
				'updateChatMessage',
				(triggeringDocument, _change, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (triggeringDocument._id === this.id) update();
				},
			);

			const updateUserHook = Hooks.on('updateUser', (triggeringDocument, _change, options) => {
				if ((options as { diff?: boolean }).diff === false) return;
				if (triggeringDocument._id === this.author?.id) update();
			});

			return () => {
				Hooks.off('updateActor', updateActorHook);
				Hooks.off('updateChatMessage', updateChatMessageHook);
				Hooks.off('updateUser', updateUserHook);
			};
		});
	}

	/** ------------------------------------------------------ */
	/**                    Type Helpers                        */
	/** ------------------------------------------------------ */
	isType<TypeName extends SystemChatMessageTypes>(type: TypeName): boolean {
		return type === this.type;
	}

	isMinionGroupAttackCard(): boolean {
		return this.type === 'minionGroupAttack';
	}

	/** Check if this chat message is an activation card type (feature, object, or spell) */
	isActivationCard(): this is NimbleChatMessage & { system: ActivationCardSystemData } {
		return (
			(this.activationCardTypes as string[]).includes(this.type) || this.isMinionGroupAttackCard()
		);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get activationCardTypes(): ActivationCardTypes[] {
		return ['feature', 'minionGroupAttack', 'object', 'reaction', 'spell'];
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	get effectNodes(): EffectNode[][] {
		if (!this.isActivationCard()) return [];

		const contexts: string[] = [];
		const systemData = this.system as ActivationCardSystemData;

		if (systemData.isCritical) contexts.push('criticalHit', 'hit');
		else if (systemData.isMiss) contexts.push('miss');
		else contexts.push('hit');

		const effects = ((systemData.activation?.effects as EffectNode[] | undefined) ??
			[]) as EffectNode[];
		const nodes = getRelevantNodes(effects, contexts, {
			includeBaseDamageNodes: systemData.isMiss,
		});

		// Add a "MISS" text hint at the start if the attack missed and there isn't one already
		if (systemData.isMiss) {
			const hasMissHint = nodes.some((group) =>
				group.some(
					(node) =>
						node.type === 'note' && (node as { text?: string }).text?.toUpperCase() === 'MISS',
				),
			);

			if (!hasMissHint) {
				const missHintNode: EffectNode = {
					id: 'miss-hint',
					type: 'note',
					noteType: 'warning',
					text: 'MISS',
					parentContext: 'miss',
					parentNode: null,
				};
				// Insert as the first group
				nodes.unshift([missHintNode]);
			}
		}

		// Let rules on the speaker actor contribute nodes to the card. Each rule
		// decides independently what (if anything) to surface — chat card rendering
		// stays rule-type-agnostic.
		const ruleNodes = this.#collectRuleActivationCardNodes({
			isCritical: systemData.isCritical,
			isMiss: systemData.isMiss,
		});
		if (ruleNodes.length > 0) {
			nodes.push(ruleNodes);
		}

		return nodes;
	}

	#collectRuleActivationCardNodes(context: { isCritical: boolean; isMiss: boolean }): EffectNode[] {
		const actorId = this.speaker?.actor;
		const actor = actorId ? game.actors?.get(actorId) : null;
		const rules = (
			actor as unknown as {
				rules?: Array<{ getActivationCardNodes?: (ctx: typeof context) => EffectNode[] }>;
			} | null
		)?.rules;
		if (!rules || rules.length === 0) return [];

		const contributed: EffectNode[] = [];
		for (const rule of rules) {
			contributed.push(...(rule.getActivationCardNodes?.(context) ?? []));
		}
		return contributed;
	}

	/** ------------------------------------------------------ */
	/**                     Data Prep                          */
	/** ------------------------------------------------------ */
	override prepareDerivedData() {
		super.prepareDerivedData();
	}

	async addSelectedTokensAsTargets(): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const selectedTokens = canvas.tokens?.controlled ?? [];

		if (!selectedTokens.length) {
			ui.notifications?.error('No tokens selected');
			return;
		}

		return this.#addTargets(selectedTokens);
	}

	async addTargetedTokensAsTargets(): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const targetedTokens = Array.from(game.user?.targets ?? []);

		if (!targetedTokens.length) {
			ui.notifications?.error('No tokens targeted');
			return;
		}

		return this.#addTargets(targetedTokens);
	}

	async #addTargets(newTargets: Token[]): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) return;

		const systemData = this.system as ActivationCardSystemData;
		const existingTargets = systemData.targets || [];
		const targets = new Set([
			...existingTargets,
			...newTargets.map((token) => token.document.uuid),
		]);

		return this.update({
			system: { targets: [...targets] },
		} as Record<string, unknown>) as Promise<ChatMessage | undefined>;
	}

	async applyDamage(value: number, options?: DamageApplyOptions): Promise<void> {
		if (!this.isActivationCard()) return;
		if (!game.user?.isGM) return;

		if (options?.outcome === 'noDamage') {
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const damage = Math.floor(Number(value));
		if (!Number.isFinite(damage) || damage <= 0) {
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];
		const damageApplicationPlan = buildDamageApplicationPlan({ targets, damage, options });
		if (!damageApplicationPlan.hasTargets) {
			ui.notifications?.warn(localize('NIMBLE.chat.noTargetsSelected'));
			return;
		}

		// Banked one-shot reductions are spent by this application even when they
		// absorb the damage entirely, so consume them before the zero-damage exit.
		for (const bankedActor of damageApplicationPlan.bankedReductionActors) {
			await clearBankedDamageReduction(bankedActor);
		}

		if (damageApplicationPlan.applicableTargets.length < 1) {
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const sourceActorId = this.speaker?.actor;
		const sourceActor = sourceActorId ? (game.actors?.get(sourceActorId) ?? null) : null;
		const sourceItemId = (this.flags as Record<string, { itemId?: string } | undefined>)?.nimble
			?.itemId;
		const sourceItem = sourceItemId ? (sourceActor?.items?.get(sourceItemId) ?? null) : null;

		for (const target of damageApplicationPlan.applicableTargets) {
			const hpBefore = Number(
				foundry.utils.getProperty(target.actor, 'system.attributes.hp.value') ?? 0,
			);

			await target.actor.applyDamage(target.adjustedDamage);

			const hpAfter = Number(
				foundry.utils.getProperty(target.actor, 'system.attributes.hp.value') ?? 0,
			);
			const wasKilled = hpBefore > 0 && hpAfter === 0;

			// @ts-expect-error - nimble.damageApplied is a custom Nimble hook consumed by ruleEventDispatch
			Hooks.callAll(systemHookName('damageApplied'), {
				sourceItem,
				sourceActor,
				targetActor: target.actor,
				card: this,
				isCritical: systemData.isCritical,
				isMiss: systemData.isMiss,
			});

			if (wasKilled) {
				const attacker = (this as unknown as { actor: Actor.Implementation | null }).actor;
				if (attacker) {
					// @ts-expect-error Custom hook
					Hooks.call('nimbleKillApplied', attacker, target.actor);
				}
			}
		}

		for (const tokenName of damageApplicationPlan.zeroDamageTargetNames) {
			ui.notifications?.info(
				localize('NIMBLE.chat.targetSkippedZeroDamage', {
					tokenName,
				}),
			);
		}
	}

	canApplyDamage(value: number, options?: DamageApplyOptions): boolean {
		if (!this.isActivationCard()) return false;
		if (options?.outcome === 'noDamage') return false;

		const damage = Math.floor(Number(value));
		if (!Number.isFinite(damage) || damage <= 0) return false;

		const targets = (this.system as ActivationCardSystemData).targets || [];
		const damageApplicationPlan = buildDamageApplicationPlan({ targets, damage, options });
		if (!damageApplicationPlan.hasTargets) return true;
		// A pending banked reduction is spent by clicking Apply even when it
		// absorbs the hit entirely, so the button must stay live for it.
		return (
			damageApplicationPlan.applicableTargets.length > 0 ||
			damageApplicationPlan.bankedReductionActors.length > 0
		);
	}

	/**
	 * Collect the damage rolls currently surfaced on this card that carry an
	 * Apply Damage action: the top-level `damage` / `damageOutcome` nodes for the
	 * resolved hit/miss/crit context. Save-gated damage is intentionally excluded
	 * because its per-target outcome is unknown until each target rolls its save.
	 *
	 * Each entry mirrors what `RollSummary` forwards to `applyDamage`: the
	 * outcome-scaled value plus the options needed for armor adjustment.
	 */
	#collectApplicableDamageRolls(): Array<{ value: number; options: DamageApplyOptions }> {
		const entries: Array<{ value: number; options: DamageApplyOptions }> = [];
		const isMiss = (this.system as unknown as ActivationCardSystemData).isMiss === true;

		// Disposition-targeted damage nodes are surfaced alongside their own
		// outcome children, which carry the same roll; count only the children.
		const surfacedOutcomeParentIds = new Set<string>();
		for (const group of this.effectNodes) {
			for (const node of group) {
				if (node.type === 'damageOutcome') {
					surfacedOutcomeParentIds.add((node as DamageOutcomeNode).parentNode);
				}
			}
		}

		for (const group of this.effectNodes) {
			for (const node of group) {
				if (node.type !== 'damage' && node.type !== 'damageOutcome') continue;
				if (node.type === 'damage' && surfacedOutcomeParentIds.has(node.id)) continue;

				const roll = (node as { roll?: Record<string, unknown> }).roll;
				if (!roll || typeof roll.class !== 'string') continue;

				const outcome: DamageApplyOutcome =
					node.type === 'damageOutcome'
						? (node as DamageOutcomeNode).outcome
						: isMiss
							? 'noDamage'
							: 'fullDamage';

				const multiplier = outcome === 'halfDamage' ? 0.5 : 1;
				const rollTotal = Number(roll.total ?? 0);
				const value = Math.ceil((Number.isFinite(rollTotal) ? rollTotal : 0) * multiplier);

				entries.push({
					value,
					options: {
						damageType: (node as { damageType?: string }).damageType,
						ignoreArmor: (node as { ignoreArmor?: boolean }).ignoreArmor,
						outcome,
						roll: roll as unknown as DamageRoll.SerializedData,
						isCritical: typeof roll.isCritical === 'boolean' ? roll.isCritical : undefined,
					},
				});
			}
		}

		return entries;
	}

	/**
	 * Per damage component, what a single target actually takes and why: the
	 * rolled damage, the resolved damage after that target's armor, immunities,
	 * vulnerabilities, resistances and reductions, and the localized reasons for
	 * the difference. Returns null when the card has no applicable damage rolls
	 * (healing / condition / save-gated cards) or the target has no actor.
	 */
	getDamageBreakdownForTarget(targetUuid: string): TargetDamageBreakdown | null {
		if (!this.isActivationCard()) return null;

		const damageRolls = this.#collectApplicableDamageRolls().filter(
			({ options }) => options.outcome !== 'noDamage',
		);
		if (damageRolls.length < 1) return null;

		const tokenDocument = fromUuidSync(targetUuid) as TokenDocument | null;
		const actor = tokenDocument?.actor as Actor.Implementation | null;
		if (!actor) return null;

		// The banked one-shot reduction is consumed by the first application that
		// would otherwise deal damage, so credit it against that component only —
		// mirroring `buildDamageApplicationPlan`.
		let availableBank = getBankedDamageReduction(actor);
		const bankedEntries = getBankedDamageReductionEntries(actor);

		const components: TargetDamageComponent[] = [];
		let total = 0;

		for (const { value, options } of damageRolls) {
			const unbankedDamage = calculateAdjustedDamage({ actor, damage: value, options });
			const damageBeforeBank = Number.isFinite(unbankedDamage) ? Math.max(0, unbankedDamage) : 0;

			const consumesBank = damageBeforeBank > 0 && availableBank > 0;
			const adjustedDamage = Math.floor(Math.max(0, damageBeforeBank - availableBank));
			if (damageBeforeBank > 0) availableBank = 0;

			total += adjustedDamage;

			const modifiers = describeDamageModifiers(actor, options);
			if (consumesBank) modifiers.push(...bankedEntries.map(describeBankedReduction));

			components.push({
				damageType: options.damageType,
				typeLabel: options.damageType ? getDamageTypeLabel(options.damageType) : null,
				damageBeforeDefenses: Math.max(0, Math.floor(value)),
				adjustedDamage,
				modifiers,
			});
		}

		return { components, total };
	}

	async applyHealing(value: number, healingType?: string, effectId?: string): Promise<void> {
		if (!this.isActivationCard()) return;

		const healing = Math.floor(Math.abs(Number(value)));
		if (!Number.isFinite(healing) || healing <= 0) return;

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];

		if (!targets.length) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.noTargetsSelected'));
			return;
		}

		// Check if already applied for this effect
		if (effectId && this.isHealingApplied(effectId)) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.healingAlreadyApplied'));
			return;
		}

		const healingRecord: AppliedHealingRecord = {
			effectId: effectId || `healing-${Date.now()}`,
			healingType: healingType || 'healing',
			amount: healing,
			targets: [],
			appliedAt: Date.now(),
		};

		for (const uuid of targets) {
			const tokenDocument = fromUuidSync(uuid) as TokenDocument | null;
			const actor = tokenDocument?.actor as HpMutableActor | null;
			if (!actor) continue;

			// Get current HP values before healing
			const hpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number; max?: number }
				| undefined;
			const previousHp = typeof hpData?.value === 'number' ? hpData.value : 0;
			const previousTempHp = typeof hpData?.temp === 'number' ? hpData.temp : 0;

			await actor.applyHealing(healing, healingType);

			// Get new HP values after healing
			const newHpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number }
				| undefined;
			const newHp = typeof newHpData?.value === 'number' ? newHpData.value : previousHp;
			const newTempHp = typeof newHpData?.temp === 'number' ? newHpData.temp : previousTempHp;

			healingRecord.targets.push({
				uuid,
				tokenName: tokenDocument?.name || localize('NIMBLE.ui.heroicActions.unknown'),
				previousHp,
				previousTempHp,
				newHp,
				newTempHp,
			});
		}

		// Store the healing record on the message
		if (effectId) {
			const appliedHealing = { ...(systemData.appliedHealing || {}) };
			appliedHealing[effectId] = healingRecord;

			await this.update({
				'system.appliedHealing': appliedHealing,
			} as Record<string, unknown>);
		}
	}

	/**
	 * Reverts previously applied healing by restoring HP to the snapshot taken at apply time.
	 * Note: This is snapshot-based - if something else modified HP between apply and undo,
	 * those changes will be silently overwritten when reverting to the previous values.
	 */
	async undoHealing(effectId: string): Promise<void> {
		if (!this.isActivationCard()) return;

		const systemData = this.system as ActivationCardSystemData;
		const healingRecord = systemData.appliedHealing?.[effectId];

		if (!healingRecord) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.noHealingRecord'));
			return;
		}

		// Revert HP for each target
		for (const targetRecord of healingRecord.targets) {
			const tokenDocument = fromUuidSync(targetRecord.uuid) as TokenDocument | null;
			const actor = tokenDocument?.actor as HpMutableActor | null;
			if (!actor) continue;

			if (healingRecord.healingType === 'tempHealing') {
				await actor.setTempHP(targetRecord.previousTempHp);
			} else {
				await actor.setCurrentHP(targetRecord.previousHp);
			}
		}

		// Remove the healing record from the message using Foundry's delete syntax
		await this.update({
			[`system.appliedHealing.-=${effectId}`]: null,
		} as Record<string, unknown>);

		ui.notifications?.info(game.i18n.localize('NIMBLE.chat.healingUndone'));
	}

	isHealingApplied(effectId: string): boolean {
		if (!this.isActivationCard()) return false;
		const systemData = this.system as ActivationCardSystemData;
		return !!systemData.appliedHealing?.[effectId];
	}

	async removeTarget(targetId: string): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const systemData = this.system as ActivationCardSystemData;
		const existingTargets = systemData.targets || [];
		const targets = existingTargets.filter((id) => id !== targetId);

		return this.update({
			system: { targets },
		} as Record<string, unknown>) as Promise<ChatMessage | undefined>;
	}

	/** ------------------------------------------------------ */
	/**              Incoming Attack Reactions                 */
	/** ------------------------------------------------------ */

	/**
	 * Validate a pending incoming-attack reaction entry. Eligibility was
	 * snapshotted at card creation; this is a light revalidation only: the
	 * entry must be unused and of the expected kind, the requesting user must
	 * be a GM or own the reacting actor, and a rule-granted entry's rule must
	 * still exist and be enabled.
	 *
	 * `viaSocket` marks a player-relayed request, whose `requestingUserId` is
	 * client-supplied and therefore unauthenticated over the base socket. A
	 * genuine GM always executes on their own client (the direct path), so a
	 * relayed request that claims GM identity is a spoof and is rejected — this
	 * keeps a player from escalating past the ownership check by borrowing a
	 * GM's id.
	 */
	#validateIncomingReaction(
		entryId: string,
		kind: IncomingReactionEntry['kind'],
		requestingUserId: string,
		viaSocket: boolean,
	): IncomingReactionEntry | null {
		const entry = this.#incomingReactionEntries().find((e) => e.id === entryId);
		if (!entry || entry.used || entry.kind !== kind) return null;

		const requestingUser = game.users?.get(requestingUserId) ?? null;
		if (!requestingUser) return null;
		if (viaSocket && requestingUser.isGM) return null;
		if (!requestingUser.isGM) {
			const reactingActor = fromUuidSync(entry.actorUuid) as Actor.Implementation | null;
			const isOwner = reactingActor?.testUserPermission?.(
				requestingUser,
				CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			);
			if (!isOwner) return null;
		}

		if (entry.source === 'rule' && entry.itemUuid) {
			const item = fromUuidSync(entry.itemUuid as `Item.${string}`) as {
				rules?: Map<string, { id?: string; disabled?: boolean }>;
			} | null;
			const rule = item?.rules ? [...item.rules.values()].find((r) => r.id === entry.ruleId) : null;
			if (!rule || rule.disabled) return null;
		}

		return entry;
	}

	#incomingReactionEntries(): IncomingReactionEntry[] {
		return (
			(this.system as unknown as { incomingReactions?: IncomingReactionEntry[] })
				.incomingReactions ?? []
		);
	}

	/**
	 * Read the card's current offers and mark the matching ones used. Read here
	 * rather than reused from validation time so the array written back is the
	 * one on the card now, not the one from before this resolver's awaits.
	 */
	#markIncomingReactionsUsed(
		predicate: (entry: IncomingReactionEntry) => boolean,
		patch: Partial<IncomingReactionEntry> = {},
	): IncomingReactionEntry[] {
		return this.#incomingReactionEntries().map((e) =>
			predicate(e) ? { ...e, used: true, ...patch } : e,
		);
	}

	/**
	 * Discard the attack's primary damage roll and roll once more; the second
	 * result stands. Executes on the primary GM's client (players reach it via
	 * the incoming-attack reaction socket).
	 */
	async resolveForceRerollReaction(
		entryId: string,
		requestingUserId: string,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		if (!this.isActivationCard()) return;

		return queueReactionWrite(this.id ?? '', () =>
			this.#applyForceRerollReaction(entryId, requestingUserId, viaSocket),
		);
	}

	async #applyForceRerollReaction(
		entryId: string,
		requestingUserId: string,
		viaSocket: boolean,
	): Promise<void> {
		const entry = this.#validateIncomingReaction(
			entryId,
			'forceReroll',
			requestingUserId,
			viaSocket,
		);
		if (!entry) return;

		// The caller has already gated on `isActivationCard()`; that narrowing does
		// not survive the hop into this method.
		const systemData = this.system as unknown as ActivationCardSystemData;
		const activation = foundry.utils.deepClone(systemData.activation ?? { effects: [] });
		const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
		const damageNode = nodes.find(
			(n) =>
				n.type === 'damage' && (n as { roll?: { class?: string } }).roll?.class === 'DamageRoll',
		) as (EffectNode & { roll?: Record<string, unknown>; discardedRoll?: unknown }) | undefined;
		if (!damageNode?.roll) return;

		const serialized = damageNode.roll as unknown as DamageRoll.SerializedData;
		const formula = serialized.originalFormula ?? serialized.formula;
		// netRollMode is computed from rollModeSources; carrying the stale value
		// into the fresh roll would double-apply it.
		let options = { ...(serialized.options ?? {}) } as Record<string, unknown>;
		delete options.netRollMode;
		if (entry.rerollWithDisadvantage) options = withRerollDisadvantage(options);

		const newRoll = new DamageRoll(
			formula,
			(serialized.data ?? {}) as DamageRoll.Data,
			options as unknown as DamageRoll.Options,
		);
		await newRoll.evaluate();

		const carried = await this.#carryFoldedSpendsAcrossReroll(
			newRoll.toJSON() as Record<string, unknown>,
			this.#markIncomingReactionsUsed((e) => e.id === entry.id),
			newRoll,
		);

		damageNode.discardedRoll = serialized;
		damageNode.roll = carried.roll;
		activation.effects = reconstructEffectsTree(nodes) as unknown[];

		const rollsSource = replaceDamageRollInRollsSource(
			((this._source as { rolls?: string[] }).rolls ?? []) as string[],
			carried.roll,
		);

		await this.update({
			rolls: rollsSource,
			system: {
				activation,
				isCritical: newRoll.isCritical,
				isMiss: newRoll.isMiss,
				incomingReactions: this.#dropStaleOutcomeOffers(carried.entries, newRoll),
			},
		} as Record<string, unknown>);
	}

	/**
	 * Carry already-folded card-side spends onto the roll a reroll produced.
	 *
	 * The rebuild starts from the discarded roll's `originalFormula`, so a bonus
	 * folded into the old roll's terms is simply not in the new one. Left alone
	 * the damage silently disappears while the dice stay spent and the card's
	 * attribution line keeps claiming it. The bonus is re-appended to the fresh
	 * roll before it reaches the damage node, so the node and the message's
	 * `rolls` source pick it up together.
	 *
	 * A spend the new outcome still satisfies is folded in again. One it does
	 * not — a crit-only spend on an attack that is no longer a crit — was never
	 * owed, so the dice go back and the offer reverts to unused, which leaves it
	 * for `#dropStaleOutcomeOffers` to remove. If the dice cannot be returned
	 * (the pool or its item is gone), the bonus is re-folded instead: an
	 * unearned bonus beats charging the player for damage the card never shows.
	 */
	async #carryFoldedSpendsAcrossReroll(
		rollJson: Record<string, unknown>,
		entries: IncomingReactionEntry[],
		view: AttackOutcomeView,
	): Promise<{ roll: Record<string, unknown>; entries: IncomingReactionEntry[] }> {
		let roll = rollJson;

		const refold = (entry: IncomingReactionEntry, amount: number) => {
			const itemName = entry.itemUuid
				? ((fromUuidSync(entry.itemUuid as `Item.${string}`) as { name?: string } | null)?.name ??
					entry.label)
				: entry.label;
			roll = appendFlavoredBonusToRoll(roll, amount, itemName);
		};

		const carriedEntries: IncomingReactionEntry[] = [];
		for (const entry of entries) {
			const amount = entry.usedAmount;
			if (entry.kind !== 'spendPoolForDamage' || !entry.used || typeof amount !== 'number') {
				carriedEntries.push(entry);
				continue;
			}

			if (offerSurvives(entry, view)) {
				refold(entry, amount);
				carriedEntries.push(entry);
				continue;
			}

			if (await this.#refundSpentPoolFaces(entry)) {
				carriedEntries.push({
					...entry,
					used: false,
					usedAmount: null,
					usedPoolLabel: '',
					usedFaces: [],
				});
				continue;
			}

			refold(entry, amount);
			carriedEntries.push(entry);
		}

		return { roll, entries: carriedEntries };
	}

	/**
	 * Put a card-side spend's dice back in the pool they came from. The pool is
	 * re-resolved from the live rules rather than stored on the entry, the same
	 * way the offer's picker finds it, so a retargeted consumer does not strand
	 * the refund. `setPoolFaces` clamps to the pool's maximum, so a pool refilled
	 * since the spend never overflows.
	 */
	async #refundSpentPoolFaces(entry: IncomingReactionEntry): Promise<boolean> {
		const faces = entry.usedFaces ?? [];
		if (faces.length === 0) return false;

		const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor.Implementation | null;
		if (!actor) return false;

		const itemId = entry.itemUuid
			? ((fromUuidSync(entry.itemUuid as `Item.${string}`) as { id?: string } | null)?.id ?? null)
			: null;

		for (const pool of getDicePools(actor)) {
			const match = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
				(consumer) => consumer.ruleId === entry.ruleId && (!itemId || consumer.itemId === itemId),
			);
			if (match) return setPoolFaces(actor, pool.id, [...pool.faces, ...faces]);
		}

		return false;
	}

	/**
	 * Drop offers the card's new outcome no longer satisfies. Pending offers are
	 * filtered against the outcome once, when the card is posted; a reroll
	 * resolved afterwards can turn a crit into an ordinary hit and strand a
	 * `criticalHit` offer on a card that no longer qualifies. Dropped rather
	 * than marked used, because they never fired.
	 */
	#dropStaleOutcomeOffers(
		entries: IncomingReactionEntry[],
		view: AttackOutcomeView,
	): IncomingReactionEntry[] {
		return entries.filter((entry) => entry.used || offerSurvives(entry, view));
	}

	/**
	 * Fold a dice-pool spend into this card's primary damage roll: consume the
	 * picked faces, evaluate the consumer's effect formula against them, and add
	 * the result to the damage the GM will apply.
	 *
	 * Executes on the primary GM's client, like the other reaction resolvers,
	 * because a chat message is updatable only by its author or a GM (owning the
	 * acting actor does not imply either). That gives one writing client;
	 * `queueReactionWrite` is what keeps a concurrent reaction on the same card
	 * from clobbering `incomingReactions` on it.
	 *
	 * Adding to the existing roll rather than posting a second one is what keeps
	 * the target's armor, resistances and flat reductions from being applied a
	 * second time against the same attack.
	 *
	 * The bonus lands before the GM applies damage. Nothing enforces that
	 * ordering — a spend confirmed after Apply Damage raises the card's total
	 * without touching HP already removed — because the card keeps no
	 * applied-damage record to reconcile against.
	 */
	async resolveSpendPoolForDamageOffer(
		entryId: string,
		requestingUserId: string,
		selection: PoolSpendSelection,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		if (!this.isActivationCard()) return;
		if (!selection?.faceIndices?.length) return;

		const lockKey = `${this.id}:${entryId}`;
		if (inFlightSpendOffers.has(lockKey)) return;
		inFlightSpendOffers.add(lockKey);

		try {
			await queueReactionWrite(this.id ?? '', () =>
				this.#applySpendPoolForDamageOffer(entryId, requestingUserId, selection, viaSocket),
			);
		} finally {
			inFlightSpendOffers.delete(lockKey);
		}
	}

	async #applySpendPoolForDamageOffer(
		entryId: string,
		requestingUserId: string,
		selection: PoolSpendSelection,
		viaSocket: boolean,
	): Promise<void> {
		// Every refusal below reports back to whoever asked. The executor runs on
		// the GM's client, so a bare `return` would leave the spending player
		// watching their button come back unexplained when its hold lapses.
		const reject = (reasonKey: string) =>
			rejectIncomingAttackReaction({
				messageId: this.id ?? '',
				entryId,
				userId: requestingUserId,
				reasonKey,
			});

		const entry = this.#validateIncomingReaction(
			entryId,
			'spendPoolForDamage',
			requestingUserId,
			viaSocket,
		);
		if (!entry) return reject('NIMBLE.chat.incomingReactions.useFailed');

		const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor.Implementation | null;
		if (!actor) return reject('NIMBLE.chat.incomingReactions.poolSpendUnavailable');

		const pool = getDicePools(actor).find((p) => p.id === selection.poolId);
		if (!pool) return reject('NIMBLE.chat.incomingReactions.poolSpendUnavailable');

		// Re-resolve the consumer from the live rule rather than trusting the
		// snapshot: this picks up `modifyConsumer` rules that extend the formula,
		// and confirms the rule still targets this pool. Rule ids are only unique
		// within an item, so the owning item has to match too.
		const sourceItem = entry.itemUuid
			? (fromUuidSync(entry.itemUuid as `Item.${string}`) as Item.Implementation | null)
			: null;
		const consumer = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
			(candidate) =>
				candidate.ruleId === entry.ruleId &&
				(!sourceItem || candidate.itemId === String(sourceItem.id)),
		);
		if (!consumer?.effectFormula)
			return reject('NIMBLE.chat.incomingReactions.poolSpendUnavailable');

		// The caller has already gated on `isActivationCard()`; that narrowing does
		// not survive the hop into this method.
		const systemData = this.system as unknown as ActivationCardSystemData;

		// Re-derive every gate from the live rule and this card, never from the
		// stamped entry. A crafted socket payload can replay an offer the sheet
		// would have suppressed, and the card's own outcome can change after the
		// offer was stamped: a forced reroll turns a crit into an ordinary hit
		// while a `criticalHit` offer is still sitting on it.
		const stillOffered =
			Boolean(consumer.cardOffer) &&
			consumer.effectType === 'generic' &&
			consumer.selectionOutcome === 'consume' &&
			rerollTriggerMatches(consumer.cardOffer ?? undefined, systemData);
		if (!stillOffered) return reject('NIMBLE.chat.incomingReactions.poolSpendNoLongerOffered');

		const picked = resolvePoolSpendSelection(pool.faces, selection);
		if (!picked) return reject('NIMBLE.chat.incomingReactions.poolSpendStale');

		const effectRoll = new Roll(
			substituteSpendFormula(
				consumer.effectFormula,
				picked.spentFaces.length,
				picked.spentFaces.reduce((sum, face) => sum + face, 0),
			),
			(actor as unknown as { getRollData: () => Record<string, unknown> }).getRollData(),
		);
		await effectRoll.evaluate({ allowInteractive: false } as Parameters<Roll['evaluate']>[0]);

		const bonusDamage = Math.floor(Number(effectRoll.total ?? 0));
		if (!Number.isFinite(bonusDamage) || bonusDamage <= 0) {
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}

		const folded = foldBonusIntoPrimaryDamage(
			(systemData.activation ?? { effects: [] }) as Record<string, unknown>,
			((this._source as { rolls?: string[] }).rolls ?? []) as string[],
			bonusDamage,
			consumer.itemName,
		);
		if (!folded) return reject('NIMBLE.chat.incomingReactions.useFailed');

		// Charge the pool only once the fold is known to be possible, and only
		// if the pool actually accepted the write — otherwise the card would
		// gain damage the player never paid for.
		const spent = await setPoolFaces(actor, pool.id, picked.remainingFaces);
		if (!spent) return reject('NIMBLE.chat.incomingReactions.useFailed');

		await this.update({
			rolls: folded.rolls,
			system: {
				activation: folded.activation,
				incomingReactions: this.#markIncomingReactionsUsed((e) => e.id === entry.id, {
					usedAmount: bonusDamage,
					usedPoolLabel: pool.label,
					usedFaces: picked.spentFaces,
				}),
			},
		} as Record<string, unknown>);
	}

	/**
	 * Swap the attack's target for the reacting protector (Interpose-style
	 * redirect). Damage, armor, and reductions resolve against the new target
	 * when the GM applies damage; token movement stays manual. Executes on the
	 * primary GM's client.
	 */
	async resolveRedirectReaction(
		entryId: string,
		requestingUserId: string,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		if (!this.isActivationCard()) return;

		return queueReactionWrite(this.id ?? '', () =>
			this.#applyRedirectReaction(entryId, requestingUserId, viaSocket),
		);
	}

	async #applyRedirectReaction(
		entryId: string,
		requestingUserId: string,
		viaSocket: boolean,
	): Promise<void> {
		const entry = this.#validateIncomingReaction(
			entryId,
			'redirectToSelf',
			requestingUserId,
			viaSocket,
		);
		if (!entry) return;
		if (!entry.tokenUuid) return;

		// The caller has already gated on `isActivationCard()`; that narrowing does
		// not survive the hop into this method.
		const systemData = this.system as unknown as ActivationCardSystemData;
		const targets = (systemData.targets || []).filter((t) => t !== entry.targetTokenUuid);
		if (!targets.includes(entry.tokenUuid)) targets.push(entry.tokenUuid);

		// The ally is no longer the target, so every other offer tied to them
		// is stale: other redirect offers, and their own forceReroll offers.
		const updatedEntries = this.#markIncomingReactionsUsed(
			(e) => e.id === entry.id || e.targetTokenUuid === entry.targetTokenUuid,
		);

		await this.update({
			system: { targets, incomingReactions: updatedEntries },
		} as Record<string, unknown>);

		const tokenDoc = fromUuidSync(entry.tokenUuid) as TokenDocument | null;
		const protector = (tokenDoc?.actor ??
			fromUuidSync(entry.actorUuid)) as Actor.Implementation | null;
		if (!protector) return;

		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: protector }),
			type: 'reaction',
			system: {
				actorName: protector.name,
				actorType: protector.type,
				image: protector.img,
				permissions: protector.permission,
				rollMode: 0,
				reactionType: 'interpose',
				targets: entry.targetTokenUuid ? [entry.targetTokenUuid] : [],
			},
		} as unknown as ChatMessage.CreateData);
	}
}

export { NimbleChatMessage };

import type { EffectNode } from '#types/effectTree.js';
import { DamageRoll } from '../../dice/DamageRoll.js';
import {
	type RecoveryTriggerChange,
	rerollRecoveryChange,
} from '../chargePool/chargePoolReroll.js';
import type { AttackDelivery } from '../damage/attackDelivery.js';
import {
	appendExtraDamageToRoll,
	appendFlavoredBonusToRoll,
	findPrimaryDamageNode,
	removeFlavoredBonusesFromRoll,
	replaceDamageRollInRollsSource,
} from '../damage/foldBonusIntoPrimaryDamage.js';
import { type DicePoolConsumer, getDicePoolConsumers } from '../dicePool/dicePoolConsumers.js';
import { setPoolFaces } from '../dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '../dicePool/dicePoolSync.js';
import type { DicePoolState } from '../dicePool/types.js';
import {
	type AttackOutcomeView,
	type IncomingReactionEntry,
	type RollChange,
	termsHaveDieAtMax,
} from '../incomingReactions/incomingReactionEntry.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '../treeManipulation/reconstructEffectsTree.js';
import { alliesOnCard } from './rerollAllies.js';
import {
	offerStands,
	type RerollAlly,
	type RerollingActor,
	type RerollRollContext,
	type RerollRollOutcome,
} from './rerollEntries.js';
import type { PreparedReroll, RerollableRoll, RerollRollTarget } from './rerollRollTarget.js';

/** The fields of an activation card's system data that a reroll reads. */
interface DamageCardSystem {
	targets?: string[];
	isCritical?: boolean;
	isMiss?: boolean;
	activation?: { effects: unknown[]; [key: string]: unknown };
	incomingReactions?: IncomingReactionEntry[];
	rollChanges?: RollChange[];
}

/** The activation card the damage-card roll target reads and writes. */
interface DamageCard {
	system(): DamageCardSystem;
	/** The card's `rolls` source. */
	rollsSource(): string[];
	/** The actor that made the attack. */
	attacker(): RerollingActor | null;
	delivery(): AttackDelivery;
	/** The item the attack was made with, when the card has one. */
	itemUuid?(): string | null;
	/** The card's Movement Offers once its outcome changes. */
	movementOfferChanges(changes: Record<string, unknown>): Record<string, unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	/** Make the attacker's charge recoveries follow the roll that now stands. */
	followChargeRecovery(change: RecoveryTriggerChange): Promise<void>;
}

/** A card's primary DamageRoll node, inside a working copy of its activation. */
interface PrimaryDamageRoll {
	activation: { effects: unknown[]; [key: string]: unknown };
	nodes: EffectNode[];
	damageNode: EffectNode & { roll?: Record<string, unknown>; discardedRoll?: unknown };
}

/**
 * The kept primary die result of a serialized DamageRoll, or null. Reads a
 * copy, because `fromData` writes option defaults into the data it is given.
 */
function primaryDieResult(serialized: DamageRoll.SerializedData): number | null {
	try {
		return DamageRoll.fromData(foundry.utils.deepClone(serialized)).primaryDieValue ?? null;
	} catch {
		return null;
	}
}

/** The card's primary DamageRoll node, with a working copy of the activation. */
function findPrimaryDamageRoll(system: DamageCardSystem): PrimaryDamageRoll | null {
	const activation = foundry.utils.deepClone(system.activation ?? { effects: [] });
	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const damageNode = findPrimaryDamageNode(nodes) as PrimaryDamageRoll['damageNode'] | undefined;
	if (!damageNode?.roll) return null;
	return { activation, nodes, damageNode };
}

/** Whether the card's primary damage roll was made to miss by force. */
function isForcedMiss(found: PrimaryDamageRoll | null): boolean {
	return (
		(found?.damageNode.roll as { options?: { forceMiss?: boolean } } | undefined)?.options
			?.forceMiss === true
	);
}

type RollOptionsView = {
	options?: { canCrit?: unknown; forcedCrit?: unknown } | null;
	terms?: readonly unknown[];
} | null;

/**
 * A damage card's roll with this outcome, as the reroll gate sees it. The
 * allies are those the card was posted with, unless the caller scanned anew.
 */
function damageRollContext(
	card: DamageCard,
	outcome: AttackOutcomeView,
	forcedMiss: boolean,
	allies: RerollAlly[] = alliesOnCard(card.system().incomingReactions ?? []),
): RerollRollContext {
	// A rolled attack has its options; a card's system data reads them from its primary roll.
	const rolled = (
		(outcome as RollOptionsView)?.options
			? outcome
			: findPrimaryDamageRoll(card.system())?.damageNode.roll
	) as RollOptionsView | undefined;
	const itemUuid = card.itemUuid?.() ?? null;
	const damageType = (
		findPrimaryDamageRoll(card.system())?.damageNode as { damageType?: string } | undefined
	)?.damageType;
	return {
		attacker: card.attacker(),
		allies,
		targets: (card.system().targets ?? []).map((tokenUuid) => ({
			tokenUuid,
			actor: (fromUuidSync(tokenUuid) as { actor?: RerollingActor | null } | null)?.actor,
		})),
		roll: {
			kind: 'attack',
			delivery: card.delivery(),
			...(itemUuid ? { itemUuid } : {}),
			...(damageType ? { damageTypes: [damageType] } : {}),
		},
		outcome: {
			isCritical: outcome.isCritical,
			isMiss: outcome.isMiss,
			critStays: outcome.isCritical === true && rolled?.options?.forcedCrit === 'always',
			canCrit: rolled?.options?.canCrit === true,
			anyDieAtMax: termsHaveDieAtMax(rolled?.terms),
		},
		forcedMiss,
	};
}

/**
 * The live pool and consumer an offer's dice come from, re-resolved from the
 * rules rather than stored on the entry (the same lookup the offer's picker
 * makes), so a retargeted consumer does not strand the offer.
 */
function findOfferSource(
	entry: IncomingReactionEntry,
): { actor: Actor.Implementation; pool: DicePoolState; consumer: DicePoolConsumer } | null {
	const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor.Implementation | null;
	if (!actor) return null;

	const itemId = entry.itemUuid
		? ((fromUuidSync(entry.itemUuid as `Item.${string}`) as { id?: string } | null)?.id ?? null)
		: null;

	for (const pool of getDicePools(actor)) {
		const consumer = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
			(candidate) => candidate.ruleId === entry.ruleId && (!itemId || candidate.itemId === itemId),
		);
		if (consumer) return { actor, pool, consumer };
	}

	return null;
}

/**
 * Put a card-side spend's dice back in the pool they came from. The pool is
 * re-resolved from the live rules rather than stored on the entry, the same
 * way the offer's picker finds it, so a retargeted consumer does not strand
 * the refund. `setPoolFaces` clamps to the pool's maximum, so a pool refilled
 * since the spend never overflows.
 */
async function refundSpentPoolFaces(entry: IncomingReactionEntry): Promise<boolean> {
	const faces = entry.usedFaces ?? [];
	if (faces.length === 0) return false;

	const source = findOfferSource(entry);
	if (!source) return false;

	return setPoolFaces(source.actor, source.pool.id, [...source.pool.faces, ...faces], 'refund');
}

/**
 * A used spend whose bonus was folded into the primary damage roll. A typed
 * spend was posted as its own damage packet, on a node a reroll never
 * touches, so carrying it would pay the bonus twice. A consumer that has
 * since vanished counts as folded, which risks an unearned bonus rather than
 * silently eating a paid-for one.
 */
function isFoldedSpend(entry: IncomingReactionEntry): boolean {
	if (entry.kind !== 'spendPoolForDamage' || !entry.used || typeof entry.usedAmount !== 'number') {
		return false;
	}
	return !findOfferSource(entry)?.consumer.damageType;
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
 * not (a crit-only spend on an attack that is no longer a crit) was never
 * owed, so the dice go back and the offer reverts to unused, which leaves it
 * for the reroll flow to drop as stale. If the dice cannot be returned
 * (the pool or its item is gone), the bonus is re-folded instead: an
 * unearned bonus beats charging the player for damage the card never shows.
 */
async function carryFoldedSpendsAcrossReroll(
	rollJson: Record<string, unknown>,
	entries: IncomingReactionEntry[],
	outcome: RerollRollOutcome,
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
		if (!isFoldedSpend(entry) || typeof amount !== 'number') {
			carriedEntries.push(entry);
			continue;
		}

		if (offerStands(entry, outcome)) {
			refold(entry, amount);
			carriedEntries.push(entry);
			continue;
		}

		if (await refundSpentPoolFaces(entry)) {
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

/** The extra damage roll changes of the card, then the `added` ones it does not have yet. */
function extraDamageChanges(card: DamageCard, added: readonly RollChange[] = []): RollChange[] {
	const applied = card.system().rollChanges ?? [];
	const keys = new Set(applied.map((change) => change.key));
	return [...applied, ...added.filter((change) => !keys.has(change.key))].filter(
		(change) => change.kind === 'extraDamage',
	);
}

/**
 * Get `newRoll` ready to go on the card in place of its primary damage roll;
 * the second result stands. Crit, miss, folded spends, the charge recovery and
 * Movement Offers follow the new roll.
 */
async function preparePrimaryDamage(
	card: DamageCard,
	found: PrimaryDamageRoll,
	newRoll: DamageRoll,
	entries: IncomingReactionEntry[],
	added: readonly RollChange[],
): Promise<PreparedReroll> {
	const { activation, nodes, damageNode } = found;
	const serialized = damageNode.roll as unknown as DamageRoll.SerializedData;

	const forcedMiss = newRoll.options.forceMiss === true;
	const carried = await carryFoldedSpendsAcrossReroll(
		newRoll.toJSON() as Record<string, unknown>,
		entries,
		{ outcome: newRoll, forcedMiss },
	);

	const roll = appendExtraDamageToRoll(carried.roll, extraDamageChanges(card, added));
	damageNode.discardedRoll = serialized;
	damageNode.roll = roll;
	activation.effects = reconstructEffectsTree(nodes) as unknown[];

	const rollsSource = replaceDamageRollInRollsSource(card.rollsSource(), roll);
	const outcome = { activation, isCritical: newRoll.isCritical, isMiss: newRoll.isMiss };

	return {
		context: damageRollContext(card, newRoll, forcedMiss),
		entries: carried.entries,
		write: async (changes) => {
			const recoveryChange = rerollRecoveryChange(
				card.system(),
				newRoll,
				changes.discardedCritTriggers,
			);
			await card.update({
				rolls: rollsSource,
				system: {
					...outcome,
					incomingReactions: changes.incomingReactions,
					rerolls: changes.rerolls,
					rollChanges: changes.rollChanges,
					discardedCritTriggers: changes.discardedCritTriggers,
					pendingKeep: null,
					...card.movementOfferChanges(outcome),
				},
			});
			await card.followChargeRecovery(recoveryChange);
		},
	};
}

function primaryDamageReroll(
	card: DamageCard,
	found: PrimaryDamageRoll,
): RerollableRoll<DamageRoll> {
	const previous = found.damageNode.roll as unknown as DamageRoll.SerializedData;
	return {
		slot: found.damageNode.id,
		replaced: previous,
		previousResult: primaryDieResult(previous),
		// The new roll keeps the data of the roll it replaces.
		makeRoll: async (formula, options) => {
			const roll = new DamageRoll(
				formula,
				(previous.data ?? {}) as DamageRoll.Data,
				options as unknown as DamageRoll.Options,
			);
			await roll.evaluate();
			return roll;
		},
		// Without its folded spends and extra damage: the reroll folds them in again.
		current: () =>
			DamageRoll.fromData(
				removeFlavoredBonusesFromRoll(
					foundry.utils.deepClone(previous) as unknown as Record<string, unknown>,
					(card.system().incomingReactions ?? []).filter(isFoldedSpend).length +
						extraDamageChanges(card).length,
				) as unknown as DamageRoll.SerializedData,
			),
		keepChoice: (roll, added) => {
			const shown = roll as { total?: number; isCritical?: boolean; isMiss?: boolean };
			const folded = (card.system().incomingReactions ?? [])
				.filter(isFoldedSpend)
				.reduce((sum, entry) => sum + (entry.usedAmount ?? 0), 0);
			const extra = extraDamageChanges(card, added).reduce((sum, change) => sum + change.value, 0);
			return {
				total: (Number(shown.total) || 0) + folded + extra,
				outcome: shown.isCritical ? 'crit' : shown.isMiss ? 'miss' : 'hit',
			};
		},
		foldRollChanges: (added) => {
			const applied = new Set(extraDamageChanges(card).map((change) => change.key));
			const fresh = extraDamageChanges(card, added).filter((change) => !applied.has(change.key));
			if (fresh.length < 1) return null;
			const roll = appendExtraDamageToRoll(previous as unknown as Record<string, unknown>, fresh);
			found.damageNode.roll = roll;
			found.activation.effects = reconstructEffectsTree(found.nodes) as unknown[];
			return {
				rolls: replaceDamageRollInRollsSource(card.rollsSource(), roll),
				activation: found.activation,
			};
		},
		prepare: (roll, entries, added) =>
			preparePrimaryDamage(card, found, roll, entries, added ?? []),
	};
}

/** The roll target of an activation card: its primary damage roll. */
function damageCardRollTarget(card: DamageCard): RerollRollTarget<DamageRoll> {
	return {
		context: () => {
			const system = card.system();
			return damageRollContext(card, system, isForcedMiss(findPrimaryDamageRoll(system)));
		},
		findRoll: () => {
			const found = findPrimaryDamageRoll(card.system());
			return found ? primaryDamageReroll(card, found) : null;
		},
	};
}

export { damageCardRollTarget, damageRollContext, type DamageCard };

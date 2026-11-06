import { SYSTEM_ID } from '#system';
import type { DieChange } from '#types/dieChange.d.ts';
import type { RerollPick } from '#types/rerollPick.d.ts';
import type { ResultChange, ResultUse } from '#types/resultChange.d.ts';
import type { StatChoice } from '#types/rollStat.d.ts';
import {
	applyRerollRecoveryChange,
	RECOVERY_DOMAIN_FLAG,
	RECOVERY_GIVEN_FLAG,
	type RecoveryTriggerChange,
	rerollChargeConsumption,
} from '#utils/chargePool/chargePoolReroll.js';
import { spentPoolIdsOf } from '#utils/chargePool/itemUseRecovery.js';
import type { ChargeConsumptionDetail, ChargeRecoveryGiven } from '#utils/chargePool/types.js';
import { mayActFor, rejectCardRequest } from '#utils/chat/cardOperations.js';
import { inFlightSpendOffers, queueReactionWrite } from '#utils/chat/reactionWriteQueue.js';
import { followInitiativeCard } from '#utils/combat/followInitiativeCard.js';
import type { AttackDelivery } from '#utils/damage/attackDelivery.js';
import { openOnUser } from '#utils/demandControl/demandControl.js';
import { cardDamageTotal, keepAmount } from '#utils/heldChange/heldChange.js';
import type {
	ChangeableDie,
	IncomingReactionEntry,
	KeepChoiceRoll,
	PendingKeep,
	RerollKeep,
	RerollKept,
	RerollRecord,
	RollChange,
	RollEffect,
} from '#utils/incomingReactions/incomingReactionEntry.js';
import { CRIT_BONUS_ROLE } from '#utils/incomingReactions/incomingReactionEntry.js';
import localize from '#utils/localize.js';
import { chainAutomaticRerolls } from '#utils/reroll/automaticRerolls.js';
import { broadcastRerollRolling } from '#utils/reroll/broadcastRerollRolling.js';
import { type CheckCard, checkCardRollTarget } from '#utils/reroll/checkCardRollTarget.js';
import { type CheckRoll, checkRollOfCard } from '#utils/reroll/checkRollOfCard.js';
import {
	type DamageCard,
	damageCardRollTarget,
	damageRollContext,
	interposeEntries,
	noDamageEntries,
} from '#utils/reroll/damageCardRollTarget.js';
import { cannotFailModifier, newRollChanges } from '#utils/reroll/modifyReroll.js';
import { rollerTokenOf, scanRerollAllies } from '#utils/reroll/rerollAllies.js';
import {
	canPayRerollCost,
	costForDice,
	type PaidRerollCost,
	payRerollCost,
	refundRerollCost,
} from '#utils/reroll/rerollCost.js';
import {
	changeableFor,
	critFor,
	diceForRule,
	diceToPick,
	effectFor,
	offerBonusFor,
	rerollableFor,
	severalDiceFor,
} from '#utils/reroll/rerollDieChoice.js';
import {
	type AutomaticReroll,
	collectRerollEntries,
	findRerollRule,
	nextAutomaticReroll,
	offerStands,
	type RerollingActor,
	type RerollRollContext,
	type RerollRollOutcome,
	type RerollRuleLike,
	rollChangeKindOf,
	usableRerollEntry,
	withNewRerollEntries,
} from '#utils/reroll/rerollEntries.js';
import { cannotMissOptions } from '#utils/reroll/rerollOptions.js';
import type { RerollableRoll, RerollRollTarget } from '#utils/reroll/rerollRollTarget.js';
import {
	type RerollStepDone,
	type RerollStepInput,
	type RerollStepOutcome,
	rerollWithRule,
} from '#utils/reroll/rerollStep.js';
import { applyGrants, grantsForUse } from '#utils/reroll/rerollUseGrants.js';
import type { RollUseKind } from '#utils/reroll/rollToReroll.js';
import { pendingKeepOf, resultRemovalRefusal } from '#utils/rolls/cardRollState.js';
import {
	newResultChange,
	resultChangesOf,
	standingResultChanges,
} from '#utils/rolls/resultChanges.js';
import { rollSaveWithOwner } from '#utils/rolls/rollSaveWithOwner.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { canShowDiceAnimation, showDiceAnimation } from '#utils/rolls/showDiceAnimation.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import { DamageRoll } from '../../dice/DamageRoll.js';
import type { PickableDie } from '../../dice/oneDieReroll.js';
import {
	dualWieldEntry,
	dualWieldRecord,
	keepChoiceOfWeapon,
	otherWeaponOf,
} from '../../utils/damage/dualWield.js';

/** A row's live rule and the actor that uses it. */
interface UsableRule {
	rule: RerollRuleLike;
	actor: Actor.Implementation;
}

type Reject = (reasonKey: string) => unknown;

/** What a rule's use adds to its new roll, and the console text when that roll fails. */
interface NewRollUse extends Partial<RerollStepInput<unknown>> {
	failedLog: string;
}

function changeableDieOf(rule: RerollRuleLike): ChangeableDie {
	const die = rule.die as string | undefined;
	if (die === 'pickedDie' || die === 'critBonusDie') return die;
	return 'primaryDie';
}

/** The roll with its new attack unable to miss, whichever dice the rule rerolls. */
function withCannotMiss<TRoll>(found: RerollableRoll<TRoll>): RerollableRoll<TRoll> {
	const { current } = found;
	return {
		...found,
		makeRoll: (formula, options, changes) =>
			found.makeRoll(formula, cannotMissOptions(options), changes),
		...(current
			? {
					current: () => {
						const roll = current();
						if (roll) roll.options = cannotMissOptions(roll.options ?? {});
						return roll;
					},
				}
			: {}),
	};
}

/** The change that says a check's new roll succeeds, named by the rule that says it cannot fail. */
function cannotFailChange(
	entry: IncomingReactionEntry,
	modifier: { id?: string; item?: { name?: string; uuid?: string } | null },
): ResultChange {
	return {
		...newResultChange({
			entry: {
				...entry,
				itemUuid: modifier.item?.uuid ?? '',
				ruleId: modifier.id ?? '',
				label: modifier.item?.name ?? '',
			},
			use: { change: 'succeed', value: 0, stat: '' },
			changes: [],
			chargePoolIdentifier: '',
			paid: { charges: 0, mana: 0, wounds: 0 },
		}),
		automatic: true,
	};
}

/**
 * A reroll for the card's history. A new action starts a new list; an
 * automatic reroll it triggers is added to that list.
 */
interface CardReroll {
	reroll: RerollRecord;
	discardedCritTriggers: boolean;
	list: 'new' | 'append';
	/** A check's result change that comes with this new roll. */
	resultChange?: ResultChange;
}

/** The card after a new roll is put on it: what the next automatic Reroll reads. */
interface PlacedReroll {
	automatic: AutomaticReroll[];
	entries: IncomingReactionEntry[];
	discardedCritTriggers: boolean;
	outcome: RerollRollOutcome;
}

/** What the reroll code reads and writes on its chat card. */
export interface RerollCard {
	id(): string | null;
	type(): string;
	system(): unknown;
	rollsSource(): string[];
	isActivationCard(): boolean;
	/** The actor that made the roll; not the author's character. */
	attacker(): RerollingActor | null;
	/** The card's system flags. */
	flags(): Record<string, unknown> | undefined;
	incomingReactions(): IncomingReactionEntry[];
	validateIncomingReaction(
		entryId: string,
		kind: IncomingReactionEntry['kind'],
		requestingUserId: string,
		viaSocket: boolean,
	): IncomingReactionEntry | null;
	attackDelivery(): AttackDelivery;
	movementOfferChanges(changes: Record<string, unknown>): Record<string, unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

/** Rerolls and kept results on one chat card. */
export class CardRerolls {
	#host: RerollCard;

	constructor(host: RerollCard) {
		this.#host = host;
	}

	/** Whether a waiting reroll on this card can be used by the actor with this uuid. */
	waitsOnRerollActor(actorUuid: string | undefined): boolean {
		if (!actorUuid) return false;
		return this.#host
			.incomingReactions()
			.some((entry) => entry.kind === 'reroll' && !entry.used && entry.actorUuid === actorUuid);
	}

	/**
	 * The reroll entries a deferred roll gets when it becomes the card's
	 * primary damage roll, as an attack roll gets them when it is made. Null
	 * when there are none.
	 */
	deferredRollRerolls(
		roll: DamageRoll,
	): { entries: IncomingReactionEntry[]; automatic: AutomaticReroll[] } | null {
		const card = this.#damageCard();
		const allies = scanRerollAllies(rollerTokenOf(card.attacker()));
		const found = collectRerollEntries(damageRollContext(card, roll, false, allies));
		if (found.manual.length < 1 && found.automatic.length < 1) return null;
		return {
			entries: withNewRerollEntries(this.#host.incomingReactions(), found.manual),
			automatic: found.automatic,
		};
	}

	/** The roll target of this card, or null when its kind has no reroll. */
	#rerollTarget(): RerollRollTarget | null {
		if (this.#host.isActivationCard()) return damageCardRollTarget(this.#damageCard());
		const check = checkRollOfCard(
			this.#host.type(),
			this.#host.system() as unknown as Record<string, unknown>,
		);
		return check ? checkCardRollTarget(this.#checkCard(check)) : null;
	}

	/** This check card as the check-card roll target reads and writes it. */
	#checkCard(roll: CheckRoll): CheckCard {
		const system = () =>
			this.#host.system() as unknown as {
				actorUuid?: string | null;
				tokenUuid?: string | null;
				rollMode?: number;
				dc?: number | null;
			};
		return {
			roll,
			rollMode: () => Number(system().rollMode) || 0,
			roller: () => {
				const { actorUuid, tokenUuid } = system();
				const actor = actorUuid ? fromUuidSync(actorUuid as `Actor.${string}`) : null;
				const token = !actor && tokenUuid ? fromUuidSync(tokenUuid as `Scene.${string}`) : null;
				return (actor ??
					(token as { actor?: unknown } | null)?.actor ??
					null) as RerollingActor | null;
			},
			rollsSource: () => this.#host.rollsSource(),
			incomingReactions: () => this.#host.incomingReactions(),
			resultChanges: () => this.#resultChanges(),
			dc: () => system().dc,
			update: (changes) => this.#host.update(changes),
		};
	}

	#resultChanges(): ResultChange[] {
		return resultChangesOf(this.#host.system());
	}

	/** This card as the damage-card roll target reads and writes it. */
	#damageCard(): DamageCard {
		return {
			system: () => this.#host.system() as ReturnType<DamageCard['system']>,
			rollsSource: () => this.#host.rollsSource(),
			// Not `speakerActor`: it falls back to the author's character.
			attacker: () => this.#host.attacker(),
			delivery: () => this.#host.attackDelivery(),
			itemUuid: () => {
				const itemUuid = this.#host.flags()?.itemUuid;
				return typeof itemUuid === 'string' ? itemUuid : null;
			},
			movementOfferChanges: (changes) => this.#host.movementOfferChanges(changes),
			update: (changes) => this.#host.update(changes),
			followChargeRecovery: (change) => this.followChargeRecovery(change),
		};
	}

	/**
	 * Put `newRoll` on the card in place of `target`; the second result stands.
	 * `history` adds what the card shows about this reroll. Then the automatic
	 * Rerolls the new roll allows run, unless `chain` is false.
	 */
	async #placeReroll(
		entry: IncomingReactionEntry,
		target: RerollableRoll,
		newRoll: unknown,
		history: CardReroll,
		options: { thrown?: boolean; chain?: boolean } = {},
	): Promise<PlacedReroll> {
		const prepared = await target.prepare(
			newRoll,
			this.#withEntryUsed(entry),
			history.reroll.changes,
		);
		const systemData = this.#host.system() as unknown as { rerolls?: RerollRecord[] };
		const rerolls = collectRerollEntries(prepared.context);
		const entries = withNewRerollEntries(
			this.#dropStaleOutcomeOffers(prepared.entries, prepared.context),
			rerolls.manual,
		);
		const messageId = this.#host.id();
		const thrown = options.thrown ? null : this.#diceToThrow(target, newRoll);
		const rolling =
			messageId && thrown && canShowDiceAnimation()
				? { slot: target.slot, faces: history.reroll.faces ?? 6 }
				: null;
		if (rolling && messageId) broadcastRerollRolling(messageId, rolling);
		try {
			// The card shows the new result only after the dice land.
			if (thrown) await this.#throwDice(thrown);
			await prepared.write({
				incomingReactions: entries,
				rerolls: [...(history.list === 'append' ? (systemData.rerolls ?? []) : []), history.reroll],
				discardedCritTriggers: history.discardedCritTriggers,
				rollChanges: this.#withRollChanges(history.reroll.changes),
				...(history.resultChange ? { resultChange: history.resultChange } : {}),
			});
		} catch (error) {
			if (rolling && messageId) broadcastRerollRolling(messageId, null);
			throw error;
		}
		const placed: PlacedReroll = {
			automatic: rerolls.automatic,
			entries,
			discardedCritTriggers: history.discardedCritTriggers,
			outcome: prepared.context,
		};
		if (options.chain !== false) await this.runAutomaticReroll(placed);
		return placed;
	}

	/** The dice the 3D dice throw for a new roll: all of it, some of it, or none (null). */
	#diceToThrow(target: RerollableRoll, newRoll: unknown): unknown {
		return target.diceToThrow ? target.diceToThrow(newRoll) : newRoll;
	}

	async #throwDice(thrown: unknown): Promise<void> {
		await showDiceAnimation(thrown as foundry.dice.Roll.Any, this.#host.id() ?? undefined);
	}

	/**
	 * Show the new roll and wait for a player to keep it or the old one. The
	 * cost is paid and the entry used; the card keeps its old roll until then.
	 */
	async #waitForKeep(
		entry: IncomingReactionEntry,
		target: RerollableRoll,
		done: RerollStepDone<unknown>,
		chooserUuid: string,
	): Promise<void> {
		const describe = (roll: unknown): KeepChoiceRoll =>
			target.keepChoice?.(roll, done.reroll.changes) ?? {
				total: Number((roll as { total?: number } | null)?.total) || 0,
				outcome: null,
			};
		const messageId = this.#host.id();
		const rolling =
			messageId && canShowDiceAnimation()
				? { slot: target.slot, faces: done.reroll.faces ?? 6 }
				: null;
		if (rolling && messageId) broadcastRerollRolling(messageId, rolling);
		try {
			const thrown = this.#diceToThrow(target, done.roll);
			if (thrown) await this.#throwDice(thrown);
			const pendingKeep: PendingKeep = {
				entryId: entry.id,
				chooserUuid,
				roll: (done.roll as { toJSON(): Record<string, unknown> }).toJSON(),
				reroll: done.reroll,
				old: {
					...describe(target.current?.() ?? target.replaced),
					...(target.shownTotal ? { total: target.shownTotal() } : {}),
				},
				new: describe(done.roll),
				discardedCritTriggers: done.discardedCritTriggers,
			};
			await this.#host.update({
				system: { incomingReactions: this.#withEntryUsed(entry), pendingKeep },
			} as Record<string, unknown>);
		} catch (error) {
			if (rolling && messageId) broadcastRerollRolling(messageId, null);
			throw error;
		}
	}

	/** A whole reroll of a dual wield attack rolls the other weapon too: the choice comes again. */
	async #offerOtherWeaponAgain(rollTarget: RerollRollTarget, actor: Actor.Implementation) {
		const target = rollTarget.findRoll();
		const current = target?.current?.();
		const next = current ? otherWeaponOf(current as never) : null;
		if (!target || !current || !next) return;

		const roll = new DamageRoll(next.formula, actor.getRollData() as never, next.options as never);
		await roll.evaluate();
		const input = {
			actorUuid: actor.uuid ?? '',
			itemUuid: (next.options.dualWieldSelf as { itemUuid: string }).itemUuid,
			label: localize('NIMBLE.rollWindow.dualWield.name'),
		};
		const entry = dualWieldEntry(input) as IncomingReactionEntry;
		await this.#host.update({
			system: { incomingReactions: [...this.#host.incomingReactions(), entry] },
		} as Record<string, unknown>);
		await this.#waitForKeep(
			entry,
			{
				...target,
				diceToThrow: () => roll,
				keepChoice: (each: unknown) => keepChoiceOfWeapon(each as never),
				shownTotal: undefined,
			},
			{
				status: 'done',
				roll,
				reroll: dualWieldRecord({ ...input, entryId: entry.id }),
				discardedCritTriggers: false,
				refund: async () => {},
			},
			actor.uuid ?? '',
		);
	}

	/** The reroll result waiting for a player to choose, or null. */
	pendingKeep(): PendingKeep | null {
		return pendingKeepOf(this.#host.system());
	}

	/**
	 * Keep the new roll or the old one of the reroll that waits on this card.
	 * Runs on the primary GM's client. Keeping the new roll places it as any
	 * reroll is placed; keeping the old one only writes the history. The cost
	 * stays paid either way.
	 */
	async resolveKeepChoice(
		choice: RerollKept,
		requestingUserId: string,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		await this.#runLocked(`${this.#host.id()}:keep`, () =>
			this.#applyKeepChoice(choice, requestingUserId, viaSocket),
		);
	}

	/** Run a write in the card's queue, once at a time for each key. */
	async #runLocked(lockKey: string, task: () => Promise<void>): Promise<void> {
		if (inFlightSpendOffers.has(lockKey)) return;
		inFlightSpendOffers.add(lockKey);
		try {
			await queueReactionWrite(this.#host.id() ?? '', task);
		} finally {
			inFlightSpendOffers.delete(lockKey);
		}
	}

	async #applyKeepChoice(
		choice: RerollKept,
		requestingUserId: string,
		viaSocket: boolean,
	): Promise<void> {
		const pending = this.pendingKeep();
		if (!pending) return;
		const reject = (reasonKey: string) =>
			rejectCardRequest({
				messageId: this.#host.id() ?? '',
				entryId: pending.entryId,
				userId: requestingUserId,
				reasonKey,
			});
		if (!mayActFor(pending.chooserUuid, { userId: requestingUserId, viaSocket })) {
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}

		const kept: RerollRecord = {
			...pending.reroll,
			kept: choice,
			keptTotal: pending[choice].total,
		};
		if (choice === 'old') {
			const rollTarget = this.#rerollTarget();
			const context = rollTarget?.context();
			const found = context ? collectRerollEntries(context).manual : [];
			const folded = rollTarget?.findRoll()?.foldRollChanges?.(kept.changes ?? []) ?? null;
			await this.#host.update({
				...(folded ? { rolls: folded.rolls } : {}),
				system: {
					...(folded ? { activation: folded.activation } : {}),
					incomingReactions: withNewRerollEntries(this.#host.incomingReactions(), found),
					rerolls: [kept],
					rollChanges: this.#withRollChanges(kept.changes),
					pendingKeep: null,
				},
			} as Record<string, unknown>);
			return;
		}

		const entry = this.#host.incomingReactions().find((e) => e.id === pending.entryId);
		const target = this.#rerollTarget()?.findRoll();
		if (!entry || !target) return reject('NIMBLE.chat.incomingReactions.useFailed');
		try {
			const roll = foundry.dice.Roll.fromData(foundry.utils.deepClone(pending.roll) as never);
			await this.#placeReroll(
				entry,
				target,
				roll,
				{ reroll: kept, discardedCritTriggers: pending.discardedCritTriggers, list: 'new' },
				{ thrown: true },
			);
		} catch (error) {
			console.error('Nimble | The kept roll could not be placed.', error);
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}
	}

	/** The actor that chooses which result stands, or '' when the new result simply stands. */
	#keepChooser(
		keep: RerollKeep | undefined,
		entry: IncomingReactionEntry,
		rollTarget: RerollRollTarget,
	): string {
		if (keep === 'ownerChooses') return entry.actorUuid;
		if (keep === 'rollerChooses') return rollTarget.context().attacker?.uuid ?? '';
		return '';
	}

	/** The roll changes of Modify Reroll rules this card has applied. */
	#rollChanges(): RollChange[] {
		return (this.#host.system() as { rollChanges?: RollChange[] }).rollChanges ?? [];
	}

	#withRollChanges(added: readonly RollChange[] = []): RollChange[] {
		const applied = this.#rollChanges();
		const keys = new Set(applied.map((change) => change.key));
		return [...applied, ...added.filter((change) => !keys.has(change.key))];
	}

	/** The rule owner's Modify Reroll changes this card has not applied yet. */
	#newRollChanges(rule: RerollRuleLike, kind: RollUseKind): Promise<RollChange[]> {
		return newRollChanges(rule, kind, this.#rollChanges());
	}

	/** Put on the reroll's record what creatures get from this use. */
	async #addGrants(
		done: RerollStepDone<unknown>,
		rule: RerollRuleLike,
		rollTarget: RerollRollTarget,
	): Promise<void> {
		const grants = await grantsForUse(rule, rollTarget.context().attacker);
		if (grants.length > 0) done.reroll.grants = grants;
	}

	/** Give creatures what this use gave, once the new roll is on the card or waits for a keep. */
	async #applyGrants(reroll: RerollRecord, rule: RerollRuleLike): Promise<void> {
		if (reroll.grants?.length) await applyGrants(reroll.grants, rule.item?.uuid ?? '');
	}

	/** The card's entries with `entry` stamped used; added when the card does not have it yet. */
	#withEntryUsed(entry: IncomingReactionEntry): IncomingReactionEntry[] {
		const entries = this.#host.incomingReactions();
		if (!entries.some((e) => e.id === entry.id)) return [...entries, { ...entry, used: true }];
		return entries.map((e) => (e.id === entry.id ? { ...e, used: true } : e));
	}

	/**
	 * Run the automatic Rerolls the card's roll now allows, by the same chain
	 * as at roll time. Runs after the card is written; a failure here does not
	 * undo the reroll before it.
	 */
	async runAutomaticReroll(placed: PlacedReroll): Promise<void> {
		if (!nextAutomaticReroll(placed.automatic, placed.entries, placed.outcome)) return;
		let rollTarget: RerollRollTarget | null;
		let context: ReturnType<RerollRollTarget['context']>;
		try {
			rollTarget = this.#rerollTarget();
			if (!rollTarget) return;
			context = rollTarget.context();
		} catch (error) {
			console.error('Nimble | An automatic reroll failed.', error);
			return;
		}
		let card = placed;
		await chainAutomaticRerolls<unknown, RerollableRoll>({
			rollKind: context.roll.kind,
			roller: context.attacker,
			next: () => nextAutomaticReroll(card.automatic, card.entries, card.outcome),
			target: (next) => {
				const found = this.#rerollTarget()?.findRoll();
				return found ? rerollableFor(found, next.rule.die) : null;
			},
			appliedRollChanges: () => this.#rollChanges(),
			earlierCritTriggers: () => card.discardedCritTriggers,
			place: async (done, next, target) => {
				card = await this.#placeReroll(
					next.entry,
					target,
					done.roll,
					{
						reroll: done.reroll,
						discardedCritTriggers: done.discardedCritTriggers,
						list: 'append',
					},
					{ chain: false },
				);
			},
		});
	}

	/**
	 * Make the attacker's charge recoveries follow the roll that now stands.
	 * Runs after the card is written; a failure here does not undo the roll.
	 */
	async followChargeRecovery(change: RecoveryTriggerChange): Promise<void> {
		const flags = this.#host.flags();
		const itemUuid = flags?.itemUuid;
		// A card with no item, as an Unarmed Strike has, keeps only the recovery flags.
		if (typeof itemUuid !== 'string' && !flags?.[RECOVERY_DOMAIN_FLAG]) return;

		try {
			const item =
				typeof itemUuid === 'string'
					? (fromUuidSync(itemUuid as `Item.${string}`) as { actor?: Actor | null } | null)
					: null;
			const actor =
				typeof itemUuid === 'string' ? item?.actor : (this.#host.attacker() as Actor | null);
			const recordedGiven = flags?.[RECOVERY_GIVEN_FLAG] as ChargeRecoveryGiven | undefined;
			const result = await applyRerollRecoveryChange(actor, change, recordedGiven, {
				domain: (flags?.[RECOVERY_DOMAIN_FLAG] as string[] | undefined) ?? [],
				spentPoolIds: spentPoolIdsOf(item),
			});
			if (!result) return;

			const changes: Record<string, unknown> = {
				[`flags.${SYSTEM_ID}.${RECOVERY_GIVEN_FLAG}`]: result.given,
			};
			const consumption = Array.isArray(flags?.chargeConsumption)
				? (flags.chargeConsumption as ChargeConsumptionDetail[])
				: [];
			// A card with a refill line but no record predates the record, so its
			// lines cannot be matched to what was given.
			const predatesRecord =
				!Array.isArray(recordedGiven) && consumption.some((entry) => entry.recovery);
			if (!predatesRecord) {
				const nextConsumption = rerollChargeConsumption(consumption, result.given, result.pools);
				if (consumption.length > 0 || nextConsumption.length > 0) {
					changes[`flags.${SYSTEM_ID}.chargeConsumption`] = nextConsumption;
				}
			}
			await this.#host.update(changes);
		} catch (error) {
			console.error('Nimble | Could not change charge recovery after a new roll.', error);
		}
	}

	/**
	 * Whether a `reroll` entry on this card passes every gate again on this
	 * client, from its live rule and this card: side, delivery, outcome,
	 * predicate and cost.
	 */
	canStillUseReroll(entry: IncomingReactionEntry): boolean {
		if (entry.kind !== 'reroll' || entry.used || this.pendingKeep()) return false;
		const target = this.#rerollTarget();
		if (!target?.findRoll()) return false;
		return usableRerollEntry(entry, target.context(), this.#host.incomingReactions()).ok;
	}

	/** Give an ally reroll the scan left out its button on this card. GM only. */
	async addLeftOutReroll(entryId: string): Promise<void> {
		if (!game.user?.isGM) return;
		await queueReactionWrite(this.#host.id() ?? '', async () => {
			const entries = this.#host.incomingReactions();
			if (!entries.some((entry) => entry.id === entryId && entry.leftOut)) return;
			await this.#host.update({
				system: {
					incomingReactions: entries.map((entry) =>
						entry.id === entryId ? { ...entry, leftOut: null } : entry,
					),
				},
			} as Record<string, unknown>);
		});
	}

	/**
	 * The dice a player picks from for a `reroll` entry whose rule rerolls a
	 * picked die. Null when the rule rerolls no picked die.
	 */
	rerollDiceToPick(entry: IncomingReactionEntry): PickableDie[] | null {
		const target = this.#rerollTarget();
		const found = target?.findRoll();
		if (!target || !found) return null;
		const usable = usableRerollEntry(entry, target.context(), this.#host.incomingReactions());
		if (!usable.ok || usable.rule.die !== 'pickedDie') return null;
		return diceToPick(found);
	}

	/**
	 * The dice a player picks for a `reroll` entry whose rule rerolls several, the
	 * most they can pick, and the mana of each die. Null for another rule.
	 */
	severalDiceToPick(
		entry: IncomingReactionEntry,
	): { dice: PickableDie[]; max: number; manaPerDie: number } | null {
		const target = this.#rerollTarget();
		const found = target?.findRoll();
		if (!target || !found) return null;
		const usable = usableRerollEntry(entry, target.context(), this.#host.incomingReactions());
		if (!usable.ok || !usable.rule.maxDiceCount) return null;
		const dice = diceToPick(found);
		const cost = usable.rule.rollUseCost;
		let max = Math.min(usable.rule.maxDiceCount, dice.length);
		while (max > 1 && cost && !canPayRerollCost(usable.actor, costForDice(cost, max))) max -= 1;
		return { dice, max, manaPerDie: cost?.manaCost ?? 0 };
	}

	/**
	 * The stats a player picks from for a `reroll` entry whose rule uses another
	 * stat. Null when the rule uses none.
	 */
	rerollStatsToPick(entry: IncomingReactionEntry): StatChoice[] | null {
		const target = this.#rerollTarget();
		const found = target?.findRoll();
		if (!target || !found) return null;
		const usable = usableRerollEntry(entry, target.context(), this.#host.incomingReactions());
		if (!usable.ok || !usable.rule.usesAnotherStat) return null;
		return found.statChoices?.(usable.rule.relatedStat) ?? [];
	}

	/** These entries with the no-damage rows of these targets added. */
	withNoDamageEntries(
		targets: readonly string[],
		entries: IncomingReactionEntry[] = this.#host.incomingReactions(),
	): IncomingReactionEntry[] {
		if (!this.#host.isActivationCard()) return entries;
		return withNewRerollEntries(entries, noDamageEntries(this.#damageCard(), targets));
	}

	/** After an Interpose: these entries with the rows the new target and the other targets get. */
	withInterposeEntries(
		targets: readonly string[],
		newTarget: string,
		entries: IncomingReactionEntry[],
	): IncomingReactionEntry[] {
		if (!this.#host.isActivationCard()) return entries;
		return withNewRerollEntries(entries, interposeEntries(this.#damageCard(), targets, newTarget));
	}

	/**
	 * What a player picks for a `change` entry before it is sent: the die, and
	 * a value when the rule sets one. Null for a reroll entry, or one the card
	 * cannot use.
	 */
	changeToPick(entry: IncomingReactionEntry): { setsValue: boolean; dice: PickableDie[] } | null {
		if (entry.use !== 'change') return null;
		const target = this.#rerollTarget();
		const found = target?.findRoll();
		if (!target || !found) return null;
		const usable = usableRerollEntry(entry, target.context(), this.#host.incomingReactions());
		if (!usable.ok) return null;
		const change: DieChange = usable.rule.dieChange ?? { mode: 'set', value: 0 };
		return {
			setsValue: change.mode === 'set',
			dice: diceForRule(found, changeableDieOf(usable.rule), change),
		};
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
		outcome: RerollRollOutcome,
	): IncomingReactionEntry[] {
		return entries.filter((entry) => entry.used || offerStands(entry, outcome));
	}

	/**
	 * Use a Reroll rule's entry: pay its cost, then discard the card's roll
	 * and roll again with the rule's changes. The cost is given back when
	 * the new roll cannot be made. Executes on the primary GM's client, like
	 * the other reaction resolvers.
	 */
	async resolveRerollReaction(
		entryId: string,
		requestingUserId: string,
		viaSocket = false,
		forceHeroicReaction = false,
		pick: RerollPick = {},
	): Promise<void> {
		if (!game.user?.isGM) return;
		const target = this.#rerollTarget();
		if (!target) return;

		await this.#runLocked(`${this.#host.id()}:${entryId}`, () =>
			this.#applyRerollReaction(
				target,
				entryId,
				requestingUserId,
				viaSocket,
				forceHeroicReaction,
				pick,
			),
		);
	}

	async #applyRerollReaction(
		rollTarget: RerollRollTarget,
		entryId: string,
		requestingUserId: string,
		viaSocket: boolean,
		forceHeroicReaction: boolean,
		pick: RerollPick,
	): Promise<void> {
		const reject = (reasonKey: string) =>
			rejectCardRequest({
				messageId: this.#host.id() ?? '',
				entryId,
				userId: requestingUserId,
				reasonKey,
			});

		const entry = this.#host.validateIncomingReaction(
			entryId,
			'reroll',
			requestingUserId,
			viaSocket,
		);
		if (!entry) return reject('NIMBLE.chat.incomingReactions.useFailed');
		if (this.pendingKeep()) return reject('NIMBLE.chat.incomingReactions.keepFirst');

		// Every gate again, from the live rule and this card: the card's outcome,
		// its targets and the actor's state can all change after stamping.
		const usable = usableRerollEntry(entry, rollTarget.context(), this.#host.incomingReactions());
		if (!usable.ok) {
			return reject(
				usable.reason === 'forcedMiss'
					? 'NIMBLE.chat.incomingReactions.useFailed'
					: 'NIMBLE.chat.incomingReactions.rerollNoLongerAvailable',
			);
		}
		const found = rollTarget.findRoll();
		if (!found) return reject('NIMBLE.chat.incomingReactions.useFailed');
		const kind = rollChangeKindOf(usable.rule);
		if (kind === 'change') {
			return this.#applyChange(rollTarget, found, entry, usable, pick, forceHeroicReaction, reject);
		}
		if (kind === 'crit') {
			await this.#applyNewRoll(
				rollTarget,
				critFor(found),
				entry,
				usable,
				forceHeroicReaction,
				reject,
				{
					makesCrit: true,
					failedLog: 'Nimble | Making a crit failed; its cost is given back.',
				},
			);
			return;
		}
		if (kind === 'critDiceSave') {
			return this.#postCritDiceSave(rollTarget, entry, usable, forceHeroicReaction, reject);
		}
		if (kind === 'keepAmount') return this.#keepAmount(entry, usable, forceHeroicReaction, reject);
		if (kind === 'optionWindow') {
			await this.#host.update({
				system: { incomingReactions: this.#withEntryUsed(entry) },
			} as Record<string, unknown>);
			return openOnUser(requestingUserId, usable.actor.uuid ?? '');
		}
		if (kind === 'effect' && usable.rule.rollEffect) {
			return this.#applyRollEffect(
				rollTarget,
				found,
				entry,
				usable,
				usable.rule.rollEffect,
				forceHeroicReaction,
				reject,
			);
		}
		if (kind === 'result') {
			return this.#applyResultChange(rollTarget, entry, usable, forceHeroicReaction, reject);
		}
		return this.#applyReroll(rollTarget, found, entry, usable, pick, forceHeroicReaction, reject);
	}

	/**
	 * Use a Reroll rule's entry: roll again with the rule's changes and the
	 * Modify Reroll changes the card does not have yet. The rule can let a
	 * player keep either result, and a whole reroll of a dual wield attack
	 * offers the other weapon again.
	 */
	async #applyReroll(
		rollTarget: RerollRollTarget,
		found: RerollableRoll,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		pick: RerollPick,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		const { die = null, stat = null, dice = null } = pick;
		const rollKind = rollTarget.context().roll.kind;
		const modifier = cannotFailModifier(usable.rule);
		const cannotMiss = rollKind === 'attack' ? modifier : null;
		const maxDice = usable.rule.maxDiceCount ?? null;
		if (maxDice !== null && (!dice?.length || dice.length > maxDice)) {
			return void reject('NIMBLE.chat.incomingReactions.rerollPickADie');
		}
		const base = cannotMiss ? withCannotMiss(found) : found;
		const rolled =
			maxDice !== null && dice
				? severalDiceFor(base, dice)
				: rerollableFor(base, usable.rule.die, die);
		if (!rolled) return void reject('NIMBLE.chat.incomingReactions.rerollPickADie');
		const target = usable.rule.usesAnotherStat
			? rolled.withStat?.(rolled, stat ?? '', usable.rule.relatedStat)
			: rolled;
		if (!target) return void reject('NIMBLE.chat.incomingReactions.rerollPickAStat');
		const isMiss = (this.#host.system() as { isMiss?: boolean }).isMiss;
		// A check that cannot fail, or a miss that cannot stand, has one result to keep: the new roll.
		const cannotFail = rollKind === 'attack' ? null : modifier;
		const chooserUuid =
			cannotFail || (cannotMiss && isMiss)
				? ''
				: this.#keepChooser(usable.rule.keep, entry, rollTarget);
		const result = await this.#applyNewRoll(
			rollTarget,
			target,
			entry,
			usable,
			forceHeroicReaction,
			reject,
			{
				rollChanges: await this.#newRollChanges(usable.rule, rollKind),
				...(dice?.length ? { dieCount: dice.length } : {}),
				makeRoll: (formula, options, changes) => target.makeRoll(formula, options, changes),
				...(usable.rule.usesAnotherStat && stat ? { stat } : {}),
				...(cannotMiss ? { cannotMissBy: cannotMiss.item?.name ?? '' } : {}),
				place: async (done) => {
					await this.#addGrants(done, usable.rule, rollTarget);
					if (chooserUuid) return this.#waitForKeep(entry, target, done, chooserUuid);
					await this.#placeReroll(entry, target, done.roll, {
						reroll: done.reroll,
						discardedCritTriggers: done.discardedCritTriggers,
						list: 'new',
						...(cannotFail ? { resultChange: cannotFailChange(entry, cannotFail) } : {}),
					});
					if ((usable.rule.die ?? 'wholeRoll') === 'wholeRoll') {
						await this.#offerOtherWeaponAgain(rollTarget, usable.actor);
					}
				},
				failedLog: 'Nimble | A reroll failed; its cost is given back.',
			},
		);
		if (result?.status === 'done') await this.#applyGrants(result.reroll, usable.rule);
	}

	/**
	 * Use a Change a Die rule's entry: change the die and put the changed roll
	 * on the card as a reroll is put there. A set value needs the face the
	 * player picked. Modify Reroll rules do not apply to a change.
	 */
	async #applyChange(
		rollTarget: RerollRollTarget,
		found: RerollableRoll,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		pick: RerollPick,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		const { die = null, value = null } = pick;
		const dieChange: DieChange = usable.rule.dieChange ?? { mode: 'set', value: 0 };
		if (dieChange.mode === 'set' && !value) {
			return void reject('NIMBLE.chat.incomingReactions.changePickAValue');
		}
		const change: DieChange =
			dieChange.mode === 'set' ? { ...dieChange, value: value ?? 0 } : dieChange;
		const target = changeableFor(found, changeableDieOf(usable.rule), die, change);
		if (!target) return void reject('NIMBLE.chat.incomingReactions.changePickADie');
		await this.#applyNewRoll(rollTarget, target, entry, usable, forceHeroicReaction, reject, {
			change: dieChange,
			failedLog: 'Nimble | A die change failed; its cost is given back.',
		});
	}

	/**
	 * The one step for every use that makes a new roll: pay the cost of the
	 * rule's entry, make the new roll of `target` and put it on the card. The
	 * cost is given back when the roll cannot be made. `use` adds what this
	 * kind of use changes; by default Modify Reroll rules do not apply.
	 */
	async #applyNewRoll(
		rollTarget: RerollRollTarget,
		target: RerollableRoll | null,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		forceHeroicReaction: boolean,
		reject: Reject,
		use: NewRollUse,
	): Promise<RerollStepOutcome<unknown> | null> {
		if (!target) {
			reject('NIMBLE.chat.incomingReactions.useFailed');
			return null;
		}
		const { failedLog, ...fields } = use;
		const systemData = this.#host.system() as unknown as { discardedCritTriggers?: boolean };
		const result = await rerollWithRule({
			rule: usable.rule,
			entry,
			rollKind: rollTarget.context().roll.kind,
			payer: usable.actor,
			replaced: target.replaced,
			previousResult: target.previousResult,
			makeRoll: (formula, options) => target.makeRoll(formula, options),
			readNewDie: target.readNewDie?.bind(target),
			earlierCritTriggers: systemData.discardedCritTriggers === true,
			payOptions: { forceHeroicReaction },
			place: async (done) => {
				await this.#placeReroll(entry, target, done.roll, {
					reroll: done.reroll,
					discardedCritTriggers: done.discardedCritTriggers,
					list: 'new',
				});
			},
			...fields,
		});
		if (result.status === 'unpaid') reject('NIMBLE.chat.incomingReactions.rerollCostUnpaid');
		if (result.status === 'failed') {
			console.error(failedLog, result.error);
			reject('NIMBLE.chat.incomingReactions.useFailed');
		}
		return result;
	}

	/**
	 * Use a row that does by hand what its feature does by itself with Feature
	 * Effects on: change the roll and put it on the card as a reroll is put there.
	 */
	async #applyRollEffect(
		rollTarget: RerollRollTarget,
		found: RerollableRoll,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		effect: RollEffect,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		const target =
			effect === 'offerBonus' && usable.rule.offerBonus
				? offerBonusFor(found, usable.rule.offerBonus.primaryDie)
				: effectFor(found, effect, usable.rule.critDiceSpec ?? null);
		await this.#applyNewRoll(rollTarget, target, entry, usable, forceHeroicReaction, reject, {
			effect,
			...(effect === 'offerBonus' && usable.rule.offerBonus?.damage
				? {
						rollChanges: [
							{
								kind: 'extraDamage' as const,
								key: `${usable.rule.id}`,
								value: usable.rule.offerBonus.damage,
								label: usable.rule.offerBonus.label,
							},
						],
					}
				: {}),
			failedLog: 'Nimble | A roll effect failed; its cost is given back.',
		});
	}

	/**
	 * The one step for every use that makes no new roll: pay the cost of the
	 * rule's entry, then `act`. The cost is given back when `act` throws or
	 * returns false. Resolves whether the use stands.
	 */
	async #payThen(
		usable: UsableRule,
		forceHeroicReaction: boolean,
		reject: Reject,
		failedLog: string,
		act: (paid: PaidRerollCost | null) => Promise<boolean>,
	): Promise<boolean> {
		const { rule, actor } = usable;
		const cost = rule.rollUseCost;
		const paid = cost ? await payRerollCost(actor, cost, { forceHeroicReaction }) : null;
		if (cost && !paid) {
			reject('NIMBLE.chat.incomingReactions.rerollCostUnpaid');
			return false;
		}
		const giveBack = async () => {
			if (cost && paid) await refundRerollCost(actor, cost, paid);
		};
		try {
			if (await act(paid)) return true;
			await giveBack();
			return false;
		} catch (error) {
			await giveBack();
			console.error(failedLog, error);
			reject('NIMBLE.chat.incomingReactions.useFailed');
			return false;
		}
	}

	/**
	 * Spend a use and post the target's save on a normal save card. The result
	 * of that card changes this card later (see `critDiceSave`). The use is given
	 * back when the save cannot be made.
	 */
	async #postCritDiceSave(
		rollTarget: RerollRollTarget,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		const { rule, actor } = usable;
		const context = rollTarget.context();
		const target = soleTarget(context.targets, {
			firstDecides: context.firstTargetDecides,
		})?.actor as unknown as Parameters<typeof rollSaveWithOwner>[0] | null;
		const saveKey = rule.saveType;
		if (!target?.rollSavingThrowToChat || !saveKey) {
			return void reject('NIMBLE.chat.incomingReactions.useFailed');
		}

		await this.#payThen(
			usable,
			forceHeroicReaction,
			reject,
			'Nimble | A save for crit dice failed; its cost is given back.',
			async () => {
				const made = await rollSaveWithOwner(target, saveKey, {
					dc: resolveSaveNodeDC(rule.saveDC, actor as never),
					cardFlags: {
						critDiceSave: {
							attackMessageId: this.#host.id(),
							role: CRIT_BONUS_ROLE,
							actorUuid: actor.uuid,
							chargePoolIdentifier: rule.rollUseCost?.chargePoolIdentifier ?? '',
						},
					},
				});
				// The window was closed: no save, so the use comes back with no error.
				if (!made) return false;
				await this.#host.update({
					system: { incomingReactions: this.#withEntryUsed(entry) },
				} as Record<string, unknown>);
				return true;
			},
		);
	}

	/**
	 * Spend the 1/turn use and hold the damage total of this card for the next
	 * attack. The amount is fixed now: a later Reroll of this card does not change it.
	 */
	async #keepAmount(
		entry: IncomingReactionEntry,
		usable: UsableRule,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		await this.#payThen(
			usable,
			forceHeroicReaction,
			reject,
			'Nimble | Keeping an amount failed; its cost is given back.',
			async () => {
				const amount = cardDamageTotal(this.#host.system() as never);
				const label = entry.label;
				await keepAmount(usable.actor, label, amount);
				await this.#host.update({
					system: { incomingReactions: this.#withEntryUsed(entry), keptAmount: { label, amount } },
				} as Record<string, unknown>);
				return true;
			},
		);
	}

	/** What a Change a Result entry does now, for its row. Null when it can do nothing. */
	resultUseOf(entry: IncomingReactionEntry): ResultUse | null {
		const rule = findRerollRule(entry);
		const card = this.#rerollTarget()?.context().card;
		return rule?.resultUseFor?.(card?.roller ?? null, card) ?? null;
	}

	/**
	 * Use a Change a Result rule's entry: pay its cost and add the click to the
	 * card's changes. The roll stays as it is. The cost is given back when the
	 * click cannot be written.
	 */
	async #applyResultChange(
		rollTarget: RerollRollTarget,
		entry: IncomingReactionEntry,
		usable: UsableRule,
		forceHeroicReaction: boolean,
		reject: Reject,
	): Promise<void> {
		const context = rollTarget.context();
		const use = usable.rule.resultUseFor?.(context.card?.roller ?? null, context.card) ?? null;
		if (!use) return void reject('NIMBLE.chat.incomingReactions.useFailed');

		const changes = this.#resultChanges();
		const written: { added?: ResultChange } = {};
		await this.#payThen(
			usable,
			forceHeroicReaction,
			reject,
			'Nimble | A change of a result failed; its cost is given back.',
			async (paid) => {
				const added = newResultChange({
					entry,
					use,
					changes,
					chargePoolIdentifier: usable.rule.rollUseCost?.chargePoolIdentifier ?? '',
					paid: {
						charges: paid?.charges ?? 0,
						mana: paid?.mana ?? 0,
						wounds: paid?.wounds ?? 0,
					},
				});
				await this.#host.update({
					system: {
						// Read after the cost is paid: a rule that can pay again gets a new row.
						incomingReactions: withNewRerollEntries(
							this.#withEntryUsed(entry),
							this.#resultEntriesFound(context),
						),
						resultChanges: [...changes, added],
					},
				} as Record<string, unknown>);
				written.added = added;
				return true;
			},
		);
		if (written.added) await this.#followInitiative(changes, [...changes, written.added]);
	}

	/**
	 * The entries a change of a result can bring back. On an attack only such rows: other
	 * rows are stamped by the attack's own steps, and an area has none.
	 */
	#resultEntriesFound(context: RerollRollContext): IncomingReactionEntry[] {
		const found = collectRerollEntries(context).manual;
		if (!this.#host.isActivationCard()) return found;
		return found.filter((entry) => entry.use === 'result');
	}

	/** An Initiative card's combatant follows the card. A failure here leaves the card as it is. */
	async #followInitiative(
		before: readonly ResultChange[],
		after: readonly ResultChange[],
	): Promise<void> {
		if (this.#host.type() !== 'initiative') return;
		try {
			await followInitiativeCard({
				system: this.#host.system() as unknown as Record<string, unknown>,
				rollSource: this.#host.rollsSource()[0],
				before,
				after,
			});
		} catch (error) {
			console.error('Nimble | A combatant could not follow its Initiative card.', error);
		}
	}

	/**
	 * Take a Change a Result line off the card, with all its clicks, and give back
	 * their cost. The order of the other changes stays. Runs on the primary GM's client.
	 */
	async resolveResultRemoval(
		lineId: string,
		requestingUserId: string,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		await this.#runLocked(`${this.#host.id()}:remove:${lineId}`, () =>
			this.#applyResultRemoval(lineId, requestingUserId, viaSocket),
		);
	}

	async #applyResultRemoval(
		lineId: string,
		requestingUserId: string,
		viaSocket: boolean,
	): Promise<void> {
		const reject = (reasonKey: string) =>
			rejectCardRequest({
				messageId: this.#host.id() ?? '',
				entryId: lineId,
				userId: requestingUserId,
				reasonKey,
			});

		const changes = this.#resultChanges();
		const line = standingResultChanges(changes).filter((change) => change.lineId === lineId);
		const first = line[0];
		if (!first) return reject('NIMBLE.chat.incomingReactions.useFailed');
		const refusal = resultRemovalRefusal(this.#host.system(), first);
		if (refusal === 'NIMBLE.chat.incomingReactions.keepFirst') return reject(refusal);
		if (!mayActFor(first.actorUuid, { userId: requestingUserId, viaSocket })) {
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}
		if (refusal) return reject(refusal);

		const removed = new Set(line.map((change) => change.id));
		const remaining = changes.filter((change) => !removed.has(change.id));
		await this.#host.update({
			system: { resultChanges: remaining },
		} as Record<string, unknown>);
		await this.#followInitiative(changes, remaining);

		try {
			await this.#giveBackResultCost(line);
		} catch (error) {
			console.error('Nimble | The cost of a removed change could not be given back.', error);
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}

		// A rule that could not pay when the card last looked can pay now.
		const context = this.#rerollTarget()?.context();
		if (!context) return;
		const entries = this.#host.incomingReactions();
		const withNew = withNewRerollEntries(entries, this.#resultEntriesFound(context));
		if (withNew.length !== entries.length) {
			await this.#host.update({ system: { incomingReactions: withNew } } as Record<
				string,
				unknown
			>);
		}
	}

	/** Uses, Mana and Wounds go back. An action or a heroic reaction stays spent. */
	async #giveBackResultCost(line: readonly ResultChange[]): Promise<void> {
		for (const change of line) {
			const actor = fromUuidSync(change.actorUuid as `Actor.${string}`) as Actor | null;
			if (!actor) continue;
			await refundRerollCost(
				actor,
				{
					chargePoolIdentifier: change.chargePoolIdentifier,
					chargeCost: change.paid.charges,
					manaCost: change.paid.mana,
					woundCost: change.paid.wounds,
					heroicReaction: '',
				},
				{ ...change.paid, heroicReaction: null, action: null },
			);
		}
	}
}

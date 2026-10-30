import { SYSTEM_ID } from '#system';
import type { DieChange } from '#types/dieChange.d.ts';
import {
	applyRerollRecoveryChange,
	RECOVERY_GIVEN_FLAG,
	type RecoveryTriggerChange,
	rerollChargeConsumption,
} from '#utils/chargePool/chargePoolReroll.js';
import type { ChargeConsumptionDetail, ChargeRecoveryGiven } from '#utils/chargePool/types.js';
import type { AttackDelivery } from '#utils/damage/attackDelivery.js';
import {
	broadcastRerollRolling,
	rejectIncomingAttackReaction,
} from '#utils/incomingReactions/incomingAttackReactions.js';
import type {
	IncomingReactionEntry,
	KeepChoiceRoll,
	PendingKeep,
	RerollKeep,
	RerollKept,
	RerollRecord,
	RollChange,
} from '#utils/incomingReactions/incomingReactionEntry.js';
import {
	type CheckCard,
	type CheckRoll,
	checkCardRollTarget,
	checkRollOfCard,
} from '#utils/reroll/checkCardRollTarget.js';
import {
	type DamageCard,
	damageCardRollTarget,
	damageRollContext,
} from '#utils/reroll/damageCardRollTarget.js';
import { newRollChanges } from '#utils/reroll/modifyReroll.js';
import { rollerTokenOf, scanRerollAllies } from '#utils/reroll/rerollAllies.js';
import {
	changeableFor,
	diceForRule,
	diceToPick,
	rerollableFor,
} from '#utils/reroll/rerollDieChoice.js';
import {
	type AutomaticReroll,
	CHANGE_DIE_RULE_TYPE,
	collectRerollEntries,
	nextAutomaticReroll,
	offerStands,
	type RerollingActor,
	type RerollRollOutcome,
	type RerollRuleLike,
	usableRerollEntry,
	withNewRerollEntries,
} from '#utils/reroll/rerollEntries.js';
import type { RerollableRoll, RerollRollTarget } from '#utils/reroll/rerollRollTarget.js';
import { type RerollStepDone, rerollWithRule } from '#utils/reroll/rerollStep.js';
import { applyGrants, grantsForUse } from '#utils/reroll/rerollUseGrants.js';
import type { RerollRollKind } from '#utils/reroll/rollToReroll.js';
import { canShowDiceAnimation, showDiceAnimation } from '#utils/rolls/showDiceAnimation.js';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import type { DieRef, PickableDie } from '../../dice/oneDieReroll.js';
import { inFlightSpendOffers, queueReactionWrite } from './reactionWriteQueue.js';

/**
 * A reroll for the card's history. A new action starts a new list; an
 * automatic reroll it triggers is added to that list.
 */
interface CardReroll {
	reroll: RerollRecord;
	discardedCritTriggers: boolean;
	list: 'new' | 'append';
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
			update: (changes) => this.#host.update(changes),
		};
	}

	/** This card as the damage-card roll target reads and writes it. */
	#damageCard(): DamageCard {
		return {
			system: () => this.#host.system() as ReturnType<DamageCard['system']>,
			rollsSource: () => this.#host.rollsSource(),
			// Not `speakerActor`: it falls back to the author's character.
			attacker: () => this.#host.attacker(),
			delivery: () => this.#host.attackDelivery(),
			movementOfferChanges: (changes) => this.#host.movementOfferChanges(changes),
			update: (changes) => this.#host.update(changes),
			followChargeRecovery: (change) => this.followChargeRecovery(change),
		};
	}

	/**
	 * Put `newRoll` on the card in place of `target`; the second result stands.
	 * `history` adds what the card shows about this reroll.
	 */
	async #placeReroll(
		entry: IncomingReactionEntry,
		target: RerollableRoll,
		newRoll: unknown,
		history: CardReroll,
		options: { thrown?: boolean } = {},
	): Promise<void> {
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
			});
		} catch (error) {
			if (rolling && messageId) broadcastRerollRolling(messageId, null);
			throw error;
		}
		await this.runAutomaticReroll(
			rerolls.automatic,
			entries,
			history.discardedCritTriggers,
			prepared.context,
		);
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
				old: describe(target.current?.() ?? target.replaced),
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

	/** The reroll result waiting for a player to choose, or null. */
	pendingKeep(): PendingKeep | null {
		return (
			(this.#host.system() as unknown as { pendingKeep?: PendingKeep | null }).pendingKeep ?? null
		);
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
		const lockKey = `${this.#host.id()}:keep`;
		if (inFlightSpendOffers.has(lockKey)) return;
		inFlightSpendOffers.add(lockKey);
		try {
			await queueReactionWrite(this.#host.id() ?? '', () =>
				this.#applyKeepChoice(choice, requestingUserId, viaSocket),
			);
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
			rejectIncomingAttackReaction({
				messageId: this.#host.id() ?? '',
				entryId: pending.entryId,
				userId: requestingUserId,
				reasonKey,
			});
		if (!this.#mayKeep(pending, requestingUserId, viaSocket)) {
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

	/** A GM, or a player who owns the actor that chooses. */
	#mayKeep(pending: PendingKeep, requestingUserId: string, viaSocket: boolean): boolean {
		const user = game.users?.get(requestingUserId) ?? null;
		if (!user) return false;
		if (user.isGM) return !viaSocket;
		const chooser = fromUuidSync(
			pending.chooserUuid as `Actor.${string}`,
		) as Actor.Implementation | null;
		return chooser?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) === true;
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
	#newRollChanges(rule: RerollRuleLike, kind: RerollRollKind): Promise<RollChange[]> {
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
	 * Run the next automatic reroll the card's roll now allows, by the same
	 * rule as the roll-time path. Runs after the card is written; a failure
	 * here does not undo the reroll before it.
	 */
	async runAutomaticReroll(
		automatic: AutomaticReroll[],
		entries: IncomingReactionEntry[],
		earlierCritTriggers: boolean,
		roll: RerollRollOutcome,
	): Promise<void> {
		const next = nextAutomaticReroll(automatic, entries, roll);
		if (!next) return;

		try {
			const rollTarget = this.#rerollTarget();
			const found = rollTarget?.findRoll();
			const target = found ? rerollableFor(found, next.rule.die) : null;
			if (!rollTarget || !target) return;
			const rollKind = rollTarget.context().roll.kind;
			const result = await rerollWithRule({
				rule: next.rule,
				entry: next.entry,
				rollKind,
				rollChanges: await this.#newRollChanges(next.rule, rollKind),
				automatic: true,
				payer: next.rule.actor as Actor | null | undefined,
				replaced: target.replaced,
				previousResult: target.previousResult,
				makeRoll: (formula, options, changes) => target.makeRoll(formula, options, changes),
				readNewDie: target.readNewDie?.bind(target),
				earlierCritTriggers,
				place: async (done) => {
					await this.#addGrants(done, next.rule, rollTarget);
					return this.#placeReroll(next.entry, target, done.roll, {
						reroll: done.reroll,
						discardedCritTriggers: done.discardedCritTriggers,
						list: 'append',
					});
				},
			});
			if (result.status === 'failed') throw result.error;
			if (result.status === 'done') await this.#applyGrants(result.reroll, next.rule);
		} catch (error) {
			console.error('Nimble | An automatic reroll failed.', error);
		}
	}

	/**
	 * Make the attacker's charge recoveries follow the roll that now stands.
	 * Runs after the card is written; a failure here does not undo the roll.
	 */
	async followChargeRecovery(change: RecoveryTriggerChange): Promise<void> {
		const flags = this.#host.flags();
		const itemUuid = flags?.itemUuid;
		if (typeof itemUuid !== 'string') return;

		try {
			const item = fromUuidSync(itemUuid as `Item.${string}`) as { actor?: Actor | null } | null;
			const recordedGiven = flags?.[RECOVERY_GIVEN_FLAG] as ChargeRecoveryGiven | undefined;
			const result = await applyRerollRecoveryChange(item?.actor, change, recordedGiven);
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
			dice: diceForRule(
				found,
				usable.rule.die === 'pickedDie' ? 'pickedDie' : 'primaryDie',
				change,
			),
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
		die: DieRef | null = null,
		value: number | null = null,
	): Promise<void> {
		if (!game.user?.isGM) return;
		const target = this.#rerollTarget();
		if (!target) return;

		const lockKey = `${this.#host.id()}:${entryId}`;
		if (inFlightSpendOffers.has(lockKey)) return;
		inFlightSpendOffers.add(lockKey);

		try {
			await queueReactionWrite(this.#host.id() ?? '', () =>
				this.#applyRerollReaction(
					target,
					entryId,
					requestingUserId,
					viaSocket,
					forceHeroicReaction,
					die,
					value,
				),
			);
		} finally {
			inFlightSpendOffers.delete(lockKey);
		}
	}

	async #applyRerollReaction(
		rollTarget: RerollRollTarget,
		entryId: string,
		requestingUserId: string,
		viaSocket: boolean,
		forceHeroicReaction: boolean,
		die: DieRef | null,
		value: number | null,
	): Promise<void> {
		const reject = (reasonKey: string) =>
			rejectIncomingAttackReaction({
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
		if (usable.rule.type === CHANGE_DIE_RULE_TYPE) {
			return this.#applyChange(
				rollTarget,
				found,
				entry,
				usable,
				die,
				value,
				forceHeroicReaction,
				reject,
			);
		}
		const target = rerollableFor(found, usable.rule.die, die);
		if (!target) return reject('NIMBLE.chat.incomingReactions.rerollPickADie');
		const chooserUuid = this.#keepChooser(usable.rule.keep, entry, rollTarget);
		const systemData = this.#host.system() as unknown as { discardedCritTriggers?: boolean };
		const rollKind = rollTarget.context().roll.kind;
		const result = await rerollWithRule({
			rule: usable.rule,
			entry,
			rollKind,
			rollChanges: await this.#newRollChanges(usable.rule, rollKind),
			payer: usable.actor,
			replaced: target.replaced,
			previousResult: target.previousResult,
			makeRoll: (formula, options, changes) => target.makeRoll(formula, options, changes),
			readNewDie: target.readNewDie?.bind(target),
			earlierCritTriggers: systemData.discardedCritTriggers === true,
			payOptions: { forceHeroicReaction },
			place: async (done) => {
				await this.#addGrants(done, usable.rule, rollTarget);
				if (chooserUuid) return this.#waitForKeep(entry, target, done, chooserUuid);
				return this.#placeReroll(entry, target, done.roll, {
					reroll: done.reroll,
					discardedCritTriggers: done.discardedCritTriggers,
					list: 'new',
				});
			},
		});
		if (result.status === 'done') await this.#applyGrants(result.reroll, usable.rule);
		if (result.status === 'unpaid') {
			return reject('NIMBLE.chat.incomingReactions.rerollCostUnpaid');
		}
		if (result.status === 'failed') {
			console.error('Nimble | A reroll failed; its cost is given back.', result.error);
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}
	}

	/**
	 * Use a Change a Die rule's entry: pay its cost, then change the die and
	 * put the changed roll on the card as a reroll is put there. A set value
	 * needs the face the player picked. Modify Reroll rules do not apply to a
	 * change. The cost is given back when the change cannot be made.
	 */
	async #applyChange(
		rollTarget: RerollRollTarget,
		found: RerollableRoll,
		entry: IncomingReactionEntry,
		usable: { rule: RerollRuleLike; actor: Actor.Implementation },
		die: DieRef | null,
		value: number | null,
		forceHeroicReaction: boolean,
		reject: (reasonKey: string) => unknown,
	): Promise<void> {
		const { rule } = usable;
		const dieChange: DieChange = rule.dieChange ?? { mode: 'set', value: 0 };
		if (dieChange.mode === 'set' && !value) {
			return void reject('NIMBLE.chat.incomingReactions.changePickAValue');
		}
		const change: DieChange =
			dieChange.mode === 'set' ? { ...dieChange, value: value ?? 0 } : dieChange;
		const target = changeableFor(
			found,
			rule.die === 'pickedDie' ? 'pickedDie' : 'primaryDie',
			die,
			change,
		);
		if (!target) return void reject('NIMBLE.chat.incomingReactions.changePickADie');

		const systemData = this.#host.system() as unknown as { discardedCritTriggers?: boolean };
		const result = await rerollWithRule({
			rule,
			entry,
			rollKind: rollTarget.context().roll.kind,
			change: dieChange,
			payer: usable.actor,
			replaced: target.replaced,
			previousResult: target.previousResult,
			makeRoll: (formula, options) => target.makeRoll(formula, options),
			readNewDie: target.readNewDie?.bind(target),
			earlierCritTriggers: systemData.discardedCritTriggers === true,
			payOptions: { forceHeroicReaction },
			place: (done) =>
				this.#placeReroll(entry, target, done.roll, {
					reroll: done.reroll,
					discardedCritTriggers: done.discardedCritTriggers,
					list: 'new',
				}),
		});
		if (result.status === 'unpaid') {
			return void reject('NIMBLE.chat.incomingReactions.rerollCostUnpaid');
		}
		if (result.status === 'failed') {
			console.error('Nimble | A die change failed; its cost is given back.', result.error);
			return void reject('NIMBLE.chat.incomingReactions.useFailed');
		}
	}
}

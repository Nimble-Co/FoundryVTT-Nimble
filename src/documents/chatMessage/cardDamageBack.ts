import type { AttackerEffect } from '#types/defend.d.ts';
import { ruleKey, ruleLabel } from '#utils/actor/actorRules.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import { mayActFor, rejectCardRequest } from '#utils/chat/cardOperations.js';
import { queueReactionWrite } from '#utils/chat/reactionWriteQueue.js';
import { payCost } from '#utils/cost/costLedger.js';
import type { AttackDelivery } from '#utils/damage/attackDelivery.js';
import { applyAttackerEffects } from '#utils/defend/defendRequests.js';
import { areAllies } from '#utils/movement/alliesWithin.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

/** Damage a creature gave back to the one who attacked it, as the card shows it. */
export interface DamageBackRecord {
	id: string;
	label: string;
	/** The creature that gave the damage back. Its owner can pay a Wound to double it. */
	actorUuid: string;
	attackerUuid: string;
	attackerName: string;
	amount: number;
	/** False until the damage is on the attacker. With Feature Effects off, a click does it. */
	dealt: boolean;
	woundDoubles: boolean;
	doubled: boolean;
	/** The effect the attacker gains with the damage. */
	effect?: AttackerEffect | null;
	ignoreArmor?: boolean;
	damageType?: string;
	/** Rule, holder, attacker and card: a second read of the card makes no second record. */
	key?: string;
}

export type DamageBackAction = 'deal' | 'double';

type DamageBackTrigger = 'damaged' | 'attacked' | 'tempHpReduced';

interface DamageBackRuleLike {
	id?: string | null;
	type?: string;
	label?: string;
	parentDocument?: {
		id?: string | null;
		uuid?: string | null;
		name?: string | null;
		system?: unknown;
	} | null;
	woundDoubles?: boolean;
	amount?: string;
	formula?: string;
	damageType?: string;
	ignoreArmor?: boolean;
	notOnAllies?: boolean;
	answeredAttack?: boolean;
	attackerEffectId?: string;
	item?: {
		uuid?: string | null;
		name?: string;
		effects?: { get(id: string): { name?: string | null; transfer?: boolean } | undefined } | null;
	} | null;
	disabled?: boolean;
	answersAttack?(attack: {
		trigger?: DamageBackTrigger;
		isCritical: boolean;
		delivery?: AttackDelivery;
	}): boolean;
}

interface SideToken {
	disposition?: number;
}

interface HurtCreature {
	uuid?: string;
	rules?: unknown;
	system?: unknown;
	token?: SideToken | null;
	getActiveTokens?(linked?: boolean, document?: boolean): unknown[];
	getRollData?(): Record<string, unknown>;
}

interface AttackerLike {
	uuid?: string;
	name?: string | null;
	rules?: unknown;
	token?: SideToken | null;
	getActiveTokens?(linked?: boolean, document?: boolean): unknown[];
	applyDamage?(amount: number): Promise<unknown>;
}

/** One creature that made the card's attack, with its token and how its attack reached. */
export interface CardAttacker {
	actor: AttackerLike;
	token?: SideToken | null;
	delivery: AttackDelivery;
	/** False for a member of a minion group that missed. */
	hit?: boolean;
}

/** The temp HP of a creature before the damage, and the rules that answer losing them. */
export interface TempHpBefore {
	temp: number;
	answers: Array<{ rule: DamageBackRuleLike; attacker: CardAttacker }>;
}

/** A creature the card attacked, with the token the card names. */
export interface AttackedCreature {
	actor: HurtCreature;
	token?: SideToken | null;
}

/** The damage of one packet on a creature after its armor, immunity, resistance and reductions. */
export type DamageAfterDefenses = (
	actor: AttackerLike,
	amount: number,
	options: { damageType: string; roll: Record<string, unknown> | null },
) => number;

/** What the damage back code reads and writes on its chat card. */
export interface DamageBackCard {
	id(): string | null;
	attacker(): AttackerLike | null;
	records(): DamageBackRecord[];
	update(changes: Record<string, unknown>): Promise<unknown>;
	/** Every creature that made the attack. Absent: the attacker, with no delivery. */
	attackers?(): CardAttacker[];
	/** How the card's attack reached. */
	delivery?(): AttackDelivery;
	damageAfterDefenses?: DamageAfterDefenses;
}

const WOUND_COST = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 1,
	heroicReaction: '',
	actionCost: 0,
} as const;

function rulesOf(creature: HurtCreature): DamageBackRuleLike[] {
	return Array.isArray(creature.rules) ? (creature.rules as DamageBackRuleLike[]) : [];
}

function sideTokenOf(actor: {
	token?: SideToken | null;
	getActiveTokens?: HurtCreature['getActiveTokens'];
}) {
	if (actor.token) return actor.token;
	const [token] = actor.getActiveTokens?.(false, true) ?? [];
	return (token as SideToken | undefined) ?? null;
}

function tempOf(actor: HurtCreature): number {
	const temp = Number(foundry.utils.getProperty(actor, 'system.attributes.hp.temp') ?? 0);
	return Number.isFinite(temp) ? temp : 0;
}

function attackerEffectOf(rule: DamageBackRuleLike): AttackerEffect | null {
	const effectId = rule.attackerEffectId?.trim();
	const item = rule.item;
	const effect = effectId ? itemEffectOf(item, effectId) : null;
	if (!effect || !item?.uuid || !effectId) return null;
	return { itemUuid: item.uuid, effectId, name: effect.name ?? '' };
}

async function rollTotal(formula: string, rollData: Record<string, unknown>) {
	try {
		const roll = new Roll(formula, rollData);
		await roll.evaluate();
		const total = Math.floor(Number(roll.total));
		return {
			total: Number.isFinite(total) ? total : 0,
			roll: roll.toJSON() as Record<string, unknown>,
		};
	} catch (error) {
		console.warn(`Nimble | Could not roll the damage "${formula}" for the attacker.`, error);
		return { total: 0, roll: null };
	}
}

interface RecordContext {
	trigger: DamageBackTrigger;
	taken: number;
	critDiceTotal: number;
}

interface RecoilRuleLike {
	type?: string;
	label?: string;
	item?: { name?: string } | null;
	disabled?: boolean;
	recoilFor?(dealt: number): number;
}

/** Damage Recoil rules the attacker holds now. */
export type RecoilRules = RecoilRuleLike[];

/** Damage creatures give back to the one who attacked, on one chat card. */
export class CardDamageBack {
	#host: DamageBackCard;

	constructor(host: DamageBackCard) {
		this.#host = host;
	}

	/** Read before the damage: the effect that holds the rule can end on the damage it deals. */
	recoilRules(): RecoilRules {
		const rules = this.#host.attacker()?.rules;
		return (Array.isArray(rules) ? (rules as RecoilRuleLike[]) : []).filter(
			(rule) => rule?.type === 'damageRecoil' && !rule.disabled,
		);
	}

	#attackers(): CardAttacker[] {
		if (this.#host.attackers) return this.#host.attackers();
		const attacker = this.#host.attacker();
		return attacker ? [{ actor: attacker, delivery: this.#host.delivery?.() ?? null }] : [];
	}

	/**
	 * The record that one rule of the holder makes against one attacker, or null when it makes
	 * none. The amount is the one after the attacker's defenses, unless the rule ignores armor.
	 */
	async #recordFor(
		rule: DamageBackRuleLike,
		holder: AttackedCreature,
		attacker: CardAttacker,
		context: RecordContext,
	): Promise<DamageBackRecord | null> {
		const holderUuid = holder.actor.uuid;
		const attackerUuid = attacker.actor.uuid;
		if (!holderUuid || !attackerUuid || holderUuid === attackerUuid) return null;
		if (rule.notOnAllies) {
			const holderSide = holder.token ?? sideTokenOf(holder.actor);
			const attackerSide = attacker.token ?? sideTokenOf(attacker.actor);
			if (holderSide && attackerSide && areAllies(holderSide as never, attackerSide as never)) {
				return null;
			}
		}
		const ignoreArmor = rule.ignoreArmor !== false;
		const damageType = rule.amount === 'formula' ? (rule.damageType ?? '') : '';
		let amount = 0;
		let roll: Record<string, unknown> | null = null;
		if (rule.amount === 'formula' && rule.formula?.trim()) {
			({ total: amount, roll } = await rollTotal(
				rule.formula.trim(),
				holder.actor.getRollData?.() ?? {},
			));
		} else if (context.trigger !== 'attacked' && rule.amount === 'critDice') {
			amount = context.critDiceTotal;
		} else if (context.trigger !== 'attacked' && (rule.amount ?? 'taken') === 'taken') {
			amount = context.taken;
		}
		if (amount > 0 && !ignoreArmor && this.#host.damageAfterDefenses) {
			amount = this.#host.damageAfterDefenses(attacker.actor, amount, { damageType, roll });
		}
		amount = Math.max(0, Math.floor(amount));
		const effect = attackerEffectOf(rule);
		if (amount <= 0 && !effect) return null;
		return {
			id: foundry.utils.randomID(),
			label: ruleLabel(rule),
			actorUuid: holderUuid,
			attackerUuid,
			attackerName: attacker.actor.name ?? '',
			amount,
			dealt: false,
			woundDoubles: amount > 0 && rule.woundDoubles === true,
			doubled: false,
			effect,
			ignoreArmor,
			damageType,
			key: `${ruleKey(rule)}:${holderUuid}:${attackerUuid}:${this.#host.id() ?? ''}`,
		};
	}

	/** Put a record's damage and effect on the attacker. */
	async #deliver(record: DamageBackRecord, attacker: AttackerLike): Promise<void> {
		if (record.amount > 0) await attacker.applyDamage?.(record.amount);
		if (record.effect) {
			await applyAttackerEffects(
				attacker as Actor.Implementation,
				[record.effect],
				record.actorUuid,
				undefined,
				this.#host.id(),
			);
		}
	}

	/** Deal each new record now with Feature Effects on, and add them all to the card. */
	async #add(records: Array<{ record: DamageBackRecord; attacker: AttackerLike }>) {
		const known = new Set(
			this.#host
				.records()
				.map((record) => record.key)
				.filter(Boolean),
		);
		const added: DamageBackRecord[] = [];
		const automatic = isRuleAutomationEnabled();
		for (const { record, attacker } of records) {
			if (record.key && known.has(record.key)) continue;
			if (record.key) known.add(record.key);
			if (automatic) await this.#deliver(record, attacker);
			added.push({ ...record, dealt: automatic });
		}
		if (added.length > 0) {
			await this.#host.update({ 'system.damageBack': [...this.#host.records(), ...added] });
		}
	}

	/**
	 * Each creature the card attacks gives its Attacked rules to each attacker of the card. With
	 * `answered`, only the rules of that effect that also answer the attack it reacts to.
	 */
	async afterAttack(
		holders: readonly AttackedCreature[],
		answered: { effectId: string } | null = null,
	): Promise<void> {
		const attackers = this.#attackers();
		if (attackers.length < 1 || holders.length < 1) return;
		await queueReactionWrite(this.#host.id() ?? '', async () => {
			const records: Array<{ record: DamageBackRecord; attacker: AttackerLike }> = [];
			for (const holder of holders) {
				for (const rule of rulesOf(holder.actor)) {
					if (rule?.type !== 'damageBack' || rule.disabled) continue;
					if (answered) {
						if (!rule.answeredAttack || rule.parentDocument?.id !== answered.effectId) continue;
					}
					for (const attacker of attackers) {
						const attack = {
							trigger: 'attacked' as const,
							isCritical: false,
							delivery: attacker.delivery,
						};
						if (rule.answersAttack?.(attack) !== true) continue;
						const record = await this.#recordFor(rule, holder, attacker, {
							trigger: 'attacked',
							taken: 0,
							critDiceTotal: 0,
						});
						if (record) records.push({ record, attacker: attacker.actor });
					}
				}
			}
			await this.#add(records);
		});
	}

	/**
	 * Read before the damage: the creature's temp HP, and for each attacker that hit, the rules
	 * of an effect that owns temp HP now and answers an attack that takes them.
	 */
	beforeDamage(actor: HurtCreature, attack: { isCritical: boolean }): TempHpBefore {
		const answers: TempHpBefore['answers'] = [];
		for (const rule of rulesOf(actor)) {
			if (rule?.type !== 'damageBack' || rule.disabled) continue;
			const owned = Number(
				(rule.parentDocument?.system as { tempHp?: number | null } | undefined)?.tempHp,
			);
			if (!(owned > 0)) continue;
			for (const attacker of this.#attackers()) {
				if (attacker.hit === false) continue;
				const answering = rule.answersAttack?.({
					trigger: 'tempHpReduced',
					isCritical: attack.isCritical,
					delivery: attacker.delivery,
				});
				if (answering === true) answers.push({ rule, attacker });
			}
		}
		return { temp: tempOf(actor), answers };
	}

	/**
	 * Give back the damage these creatures just took from the card's attack, and put the
	 * attacker's recoil on the attacker.
	 */
	async afterDamage(
		hurt: ReadonlyArray<{
			actor: HurtCreature;
			taken: number;
			token?: SideToken | null;
			tempHp?: TempHpBefore;
		}>,
		attack: { isCritical: boolean; critDiceTotal?: number },
		recoil: RecoilRules = [],
	): Promise<void> {
		const attacker = this.#host.attacker();
		if (!attacker?.uuid) return;
		const [first] = this.#attackers();
		const cardAttacker: CardAttacker = {
			actor: attacker,
			token: first?.actor === attacker ? (first.token ?? null) : null,
			delivery: this.#host.delivery?.() ?? null,
		};
		const records: Array<{ record: DamageBackRecord; attacker: AttackerLike }> = [];

		for (const { actor, taken, token, tempHp } of hurt) {
			if (tempHp && tempOf(actor) < tempHp.temp) {
				for (const answer of tempHp.answers) {
					const record = await this.#recordFor(
						answer.rule,
						{ actor, token: token ?? null },
						answer.attacker,
						{ trigger: 'tempHpReduced', taken, critDiceTotal: attack.critDiceTotal ?? 0 },
					);
					if (record)
						records.push({ record: { ...record, key: '' }, attacker: answer.attacker.actor });
				}
			}
			if (taken <= 0 || !actor.uuid || actor.uuid === attacker.uuid) continue;
			for (const rule of rulesOf(actor)) {
				if (rule?.type !== 'damageBack' || rule.disabled) continue;
				const answers = rule.answersAttack?.({
					trigger: 'damaged',
					isCritical: attack.isCritical,
					delivery: cardAttacker.delivery,
				});
				if (answers !== true) continue;
				const record = await this.#recordFor(rule, { actor, token: token ?? null }, cardAttacker, {
					trigger: 'damaged',
					taken,
					critDiceTotal: attack.critDiceTotal ?? 0,
				});
				if (record) records.push({ record: { ...record, key: '' }, attacker });
			}
		}
		const dealt = hurt.reduce(
			(sum, { actor, taken }) => (actor.uuid === attacker.uuid ? sum : sum + Math.max(0, taken)),
			0,
		);
		for (const rule of recoil) {
			const amount = rule.recoilFor?.(dealt) ?? 0;
			if (amount <= 0) continue;
			records.push({
				record: {
					id: foundry.utils.randomID(),
					label: ruleLabel(rule),
					actorUuid: attacker.uuid,
					attackerUuid: attacker.uuid,
					attackerName: attacker.name ?? '',
					amount,
					dealt: false,
					woundDoubles: false,
					doubled: false,
				},
				attacker,
			});
		}
		if (records.length > 0) {
			await queueReactionWrite(this.#host.id() ?? '', () => this.#add(records));
		}
	}

	/** Deal a waiting record, or pay its Wound and deal the amount again. Runs on the GM client. */
	async resolve(
		recordId: string,
		action: DamageBackAction,
		requestingUserId: string,
		viaSocket = false,
	): Promise<void> {
		if (!game.user?.isGM) return;
		await queueReactionWrite(this.#host.id() ?? '', () =>
			this.#apply(recordId, action, requestingUserId, viaSocket),
		);
	}

	async #apply(
		recordId: string,
		action: DamageBackAction,
		requestingUserId: string,
		viaSocket: boolean,
	): Promise<void> {
		const reject = (reasonKey: string) =>
			rejectCardRequest({
				messageId: this.#host.id() ?? '',
				entryId: recordId,
				userId: requestingUserId,
				reasonKey,
			});
		const records = this.#host.records();
		const record = records.find((candidate) => candidate.id === recordId);
		const actor = record
			? (fromUuidSync(record.actorUuid as `Actor.${string}`) as Actor.Implementation | null)
			: null;
		if (!record || !actor || !mayActFor(actor, { userId: requestingUserId, viaSocket })) {
			return reject('NIMBLE.chat.incomingReactions.useFailed');
		}
		const canUse =
			action === 'deal' ? !record.dealt : record.dealt && record.woundDoubles && !record.doubled;
		if (!canUse) return reject('NIMBLE.chat.incomingReactions.useFailed');

		const attacker = fromUuidSync(record.attackerUuid as `Actor.${string}`) as AttackerLike | null;
		if (!attacker) return reject('NIMBLE.chat.incomingReactions.useFailed');

		if (action === 'double' && !(await payCost(actor, WOUND_COST))) {
			return reject('NIMBLE.chat.incomingReactions.rerollCostUnpaid');
		}
		if (action === 'deal') await this.#deliver(record, attacker);
		else await attacker.applyDamage?.(record.amount);
		await this.#host.update({
			'system.damageBack': records.map((candidate) =>
				candidate.id === recordId
					? { ...candidate, ...(action === 'deal' ? { dealt: true } : { doubled: true }) }
					: candidate,
			),
		});
	}
}

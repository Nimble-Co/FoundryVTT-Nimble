import { ruleLabel } from '#utils/actor/actorRules.js';
import { mayActFor, rejectCardRequest } from '#utils/chat/cardOperations.js';
import { queueReactionWrite } from '#utils/chat/reactionWriteQueue.js';
import { payCost } from '#utils/cost/costLedger.js';
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
}

export type DamageBackAction = 'deal' | 'double';

interface DamageBackRuleLike {
	type?: string;
	label?: string;
	woundDoubles?: boolean;
	amount?: string;
	item?: { name?: string } | null;
	disabled?: boolean;
	answersAttack?(attack: { isCritical: boolean }): boolean;
}

interface HurtCreature {
	uuid?: string;
	rules?: unknown;
}

interface AttackerLike {
	uuid?: string;
	name?: string | null;
	rules?: unknown;
	applyDamage?(amount: number): Promise<unknown>;
}

/** What the damage back code reads and writes on its chat card. */
export interface DamageBackCard {
	id(): string | null;
	attacker(): AttackerLike | null;
	records(): DamageBackRecord[];
	update(changes: Record<string, unknown>): Promise<unknown>;
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

	/**
	 * Give back the damage these creatures just took from the card's attack, and put the
	 * attacker's recoil on the attacker.
	 */
	async afterDamage(
		hurt: ReadonlyArray<{ actor: HurtCreature; taken: number }>,
		attack: { isCritical: boolean; critDiceTotal?: number },
		recoil: RecoilRules = [],
	): Promise<void> {
		const attacker = this.#host.attacker();
		if (!attacker?.uuid) return;
		const automatic = isRuleAutomationEnabled();
		const added: DamageBackRecord[] = [];
		const record = (label: string, actorUuid: string, amount: number): DamageBackRecord => ({
			id: foundry.utils.randomID(),
			label,
			actorUuid,
			attackerUuid: attacker.uuid ?? '',
			attackerName: attacker.name ?? '',
			amount,
			dealt: automatic,
			woundDoubles: false,
			doubled: false,
		});

		for (const { actor, taken } of hurt) {
			if (taken <= 0 || !actor.uuid || actor.uuid === attacker.uuid) continue;
			for (const rule of rulesOf(actor)) {
				if (rule?.type !== 'damageBack' || rule.disabled) continue;
				if (rule.answersAttack?.(attack) !== true) continue;
				const amount = rule.amount === 'critDice' ? (attack.critDiceTotal ?? 0) : taken;
				if (amount <= 0) continue;
				if (automatic) await attacker.applyDamage?.(amount);
				added.push({
					...record(ruleLabel(rule), actor.uuid, amount),
					woundDoubles: rule.woundDoubles === true,
				});
			}
		}
		const dealt = hurt.reduce(
			(sum, { actor, taken }) => (actor.uuid === attacker.uuid ? sum : sum + Math.max(0, taken)),
			0,
		);
		for (const rule of recoil) {
			const amount = rule.recoilFor?.(dealt) ?? 0;
			if (amount <= 0) continue;
			if (automatic) await attacker.applyDamage?.(amount);
			added.push(record(ruleLabel(rule), attacker.uuid, amount));
		}
		if (added.length > 0) {
			await queueReactionWrite(this.#host.id() ?? '', async () => {
				await this.#host.update({ 'system.damageBack': [...this.#host.records(), ...added] });
			});
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
		await attacker.applyDamage?.(record.amount);
		await this.#host.update({
			'system.damageBack': records.map((candidate) =>
				candidate.id === recordId
					? { ...candidate, ...(action === 'deal' ? { dealt: true } : { doubled: true }) }
					: candidate,
			),
		});
	}
}

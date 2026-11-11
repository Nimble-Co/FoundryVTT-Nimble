import { SYSTEM_ID } from '#system';
import type { DefendOptionUse, DefendRecord, WholeRoundDefend } from '#types/defend.d.ts';
import { CONDITION_REPLACED_OPTION } from '../actor/applyConditionToActor.js';
import { applyEffectHere, payloadFromEffect } from '../actor/applyEffectToActor.js';
import { itemEffectOf } from '../actor/itemEffectOf.js';
import { defineCardOperation, rejectCardRequest } from '../chat/cardOperations.js';
import { queueReactionWrite } from '../chat/reactionWriteQueue.js';
import { buildCombatantActionDeltaUpdate } from '../combat/requestCombatantActionDelta.js';
import { giveBack } from '../cost/costLedger.js';
import {
	getHeroicReactionAvailabilityUpdate,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../incomingReactions/heroicActions.js';
import localize from '../localize.js';
import { cardTakesDefends, damageAppliedTo, defendsOf } from './defendRecords.js';
import {
	EXTRA_DEFEND_FLAG,
	roundDefendEffectData,
	roundDefendEffectIds,
	roundMarkNow,
} from './defendRound.js';

type DefendRequest = Omit<DefendRecord, 'id' | 'armorApplies' | 'userId'> & {
	messageId: string;
	/** The Defend covers every attack on the hero until their own turn begins. */
	wholeRound: boolean;
};

/** An ally's option used on a hero's Defend (a reaction when an ally Defends). */
interface DefendAllyUse {
	messageId: string;
	defendId: string;
	use: DefendOptionUse;
	reminder: string;
}

type DefendCard = ChatMessage.Implementation & {
	system: { targets?: string[]; isMiss?: boolean; defends?: unknown; damageAppliedTo?: unknown };
};

function cardOf(messageId: string): DefendCard | null {
	return (game.messages?.get(messageId) as DefendCard | undefined) ?? null;
}

/** Why the GM refuses this Defend, or null when it can be written. */
export function defendRefusal(card: DefendCard | null, request: DefendRequest): string | null {
	if (!card || !cardTakesDefends(card.system)) return 'NIMBLE.chat.defend.refused.noCard';
	if (!(card.system.targets ?? []).includes(request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.notTarget';
	}
	if (damageAppliedTo(card.system).has(request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.applied';
	}
	if (defendsOf(card.system).some((record) => record.tokenUuid === request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.already';
	}
	return null;
}

async function writeDefend(request: DefendRequest, userId: string): Promise<string | null> {
	const card = cardOf(request.messageId);
	const refusal = defendRefusal(card, request);
	if (refusal || !card) return refusal;

	const record: DefendRecord = {
		id: foundry.utils.randomID(),
		tokenUuid: request.tokenUuid,
		actorUuid: request.actorUuid,
		armor: Math.max(0, Math.floor(request.armor)),
		armorApplies: true,
		label: request.label,
		userId,
		combatantId: request.combatantId,
		actionsSpent: request.actionsSpent,
		reactionKeys: request.reactionKeys,
		outcome: request.outcome,
		armorBonus: Math.max(0, Math.floor(request.armorBonus)),
		options: request.options,
		reminders: request.reminders,
		attackerEffects: request.attackerEffects,
		way: request.way,
	};
	await card.update({
		'system.defends': [...defendsOf(card.system), record],
	} as Record<string, unknown>);
	await affectAttacker(card, record);
	await setRoundMarks(record, request);
	return null;
}

async function setRoundMarks(record: DefendRecord, request: DefendRequest): Promise<void> {
	const mark = roundMarkNow();
	const actor = fromUuidSync(record.actorUuid) as Actor.Implementation | null;
	if (!mark || !actor) return;
	if (record.way === 'extra') await actor.setFlag(SYSTEM_ID, EXTRA_DEFEND_FLAG, mark);
	if (!request.wholeRound) return;
	const whole: WholeRoundDefend = {
		...mark,
		label: record.label,
		armorBonus: record.armorBonus,
		outcome: record.outcome,
		messageId: request.messageId,
		recordId: record.id,
	};
	const older = roundDefendEffectIds(actor);
	if (older.length) {
		await actor.deleteEmbeddedDocuments('ActiveEffect', older, {
			[CONDITION_REPLACED_OPTION]: true,
		} as never);
	}
	const itemUuid = record.options.find((use) => use.label === record.label)?.itemUuid;
	const item = itemUuid ? (fromUuidSync(itemUuid) as { uuid?: string; img?: string } | null) : null;
	const data = roundDefendEffectData(whole, {
		name: record.label || localize('NIMBLE.chat.defend.confirmDefend'),
		img: item?.img ?? null,
		origin: item?.uuid ?? actor.uuid ?? null,
	});
	await actor.createEmbeddedDocuments('ActiveEffect', [data as never]);
}

/** A copy of each picked item effect goes on the attacker, with the item as its source. */
async function affectAttacker(card: DefendCard, record: DefendRecord): Promise<void> {
	if (record.attackerEffects.length < 1) return;
	const attacker = (card.constructor as typeof ChatMessage).getSpeakerActor(card.speaker);
	if (!attacker) return;
	for (const { itemUuid, effectId } of record.attackerEffects) {
		const item = fromUuidSync(itemUuid) as Item.Implementation | null;
		const effect = itemEffectOf(item, effectId) as ActiveEffect.Implementation | null;
		if (!item || !effect) continue;
		const user = (item.actor ?? fromUuidSync(record.actorUuid) ?? null) as never;
		await applyEffectHere(attacker as never, payloadFromEffect(effect, { itemUuid, user }));
	}
}

async function writeAllyUse(request: DefendAllyUse): Promise<boolean> {
	const card = cardOf(request.messageId);
	if (!card) return false;
	const record = defendsOf(card.system).find((entry) => entry.id === request.defendId);
	if (!record || damageAppliedTo(card.system).has(record.tokenUuid)) return false;
	if (
		record.options.some(
			(use) => use.actorUuid === request.use.actorUuid && use.ruleId === request.use.ruleId,
		)
	) {
		return false;
	}
	const defends = defendsOf(card.system).map((entry) =>
		entry.id === record.id
			? {
					...entry,
					options: [...entry.options, request.use],
					reminders: request.reminder ? [...entry.reminders, request.reminder] : entry.reminders,
				}
			: entry,
	);
	await card.update({ 'system.defends': defends } as Record<string, unknown>);
	return true;
}

/** The request of a socket payload: the payload without its routing fields. */
function requestOf<T>(raw: Record<string, unknown>): T | null {
	const { type: _type, userId: _userId, ...request } = raw;
	return typeof request.messageId === 'string' && request.messageId ? (request as T) : null;
}

/**
 * Put an ally's option on a hero's Defend. The cost is paid before; a refused
 * write gives it back.
 */
export const requestDefendAllyUse = defineCardOperation<DefendAllyUse>({
	type: 'defendAllyUse',
	noGmKey: 'NIMBLE.chat.defend.refused.noGm',
	parse: (raw) => requestOf<DefendAllyUse>(raw),
	run: async (request) => {
		let written = false;
		await queueReactionWrite(request.messageId, async () => {
			written = await writeAllyUse(request);
			if (!written) await refundUses([request.use]);
		});
		return written;
	},
});

/**
 * Write a Defend to an attack card. A refused Defend gives back what it spent,
 * and the one who asked is told why.
 */
export const requestDefend = defineCardOperation<DefendRequest>({
	type: 'defendRequest',
	noGmKey: 'NIMBLE.chat.defend.refused.noGm',
	parse: (raw) => requestOf<DefendRequest>(raw),
	run: async (request, { userId }) => {
		const refusal = await queueReactionWrite(request.messageId, async () => {
			const refused = await writeDefend(request, userId);
			if (refused) await refundRefused(refused, request);
			return refused;
		});
		if (refusal) rejectCardRequest({ messageId: request.messageId, userId, reasonKey: refusal });
		return !refusal;
	},
});

/** GM only: the "Armor applies" toggle of one Defend. */
export async function setDefendArmorApplies(
	messageId: string,
	defendId: string,
	armorApplies: boolean,
): Promise<void> {
	if (!game.user?.isGM) return;
	await queueReactionWrite(messageId, async () => {
		const card = cardOf(messageId);
		if (!card) return;
		const defends = defendsOf(card.system).map((record) =>
			record.id === defendId ? { ...record, armorApplies } : record,
		);
		await card.update({ 'system.defends': defends } as Record<string, unknown>);
	});
}

/** GM only: take a Defend back and give back what it spent. */
export async function undoDefend(messageId: string, defendId: string): Promise<void> {
	if (!game.user?.isGM) return;
	await queueReactionWrite(messageId, async () => {
		const card = cardOf(messageId);
		if (!card) return;
		const record = defendsOf(card.system).find((entry) => entry.id === defendId);
		if (!record || damageAppliedTo(card.system).has(record.tokenUuid)) return;
		await refundDefend(record);
		await card.update({
			'system.defends': defendsOf(card.system).filter((entry) => entry.id !== defendId),
		} as Record<string, unknown>);
	});
}

/** A refused Defend gives back what it spent, unless an earlier Defend of the hero holds it. */
async function refundRefused(refusal: string, request: DefendRequest): Promise<void> {
	if (refusal === 'NIMBLE.chat.defend.refused.already') return;
	const { messageId: _messageId, wholeRound: _wholeRound, ...record } = request;
	await refundDefend({ ...record, id: '', armorApplies: true, userId: '' });
}

export async function refundUses(uses: readonly DefendOptionUse[]): Promise<void> {
	for (const use of uses) {
		if (!use.cost || !use.paid) continue;
		const actor = fromUuidSync(use.actorUuid) as Actor.Implementation | null;
		if (actor) await giveBack(actor, { cost: use.cost, paid: use.paid });
	}
}

/** Take back the round marks this Defend set on its hero. */
async function clearRoundMarks(record: DefendRecord): Promise<void> {
	const actor = fromUuidSync(record.actorUuid) as Actor.Implementation | null;
	if (!actor) return;
	if (record.way === 'extra') await actor.unsetFlag(SYSTEM_ID, EXTRA_DEFEND_FLAG);
	const marks = roundDefendEffectIds(actor, record.id);
	if (marks.length) await actor.deleteEmbeddedDocuments('ActiveEffect', marks);
}

async function refundDefend(record: DefendRecord): Promise<void> {
	await refundUses(record.options);
	if (record.id) await clearRoundMarks(record);
	const combat = game.combat;
	const combatant = record.combatantId ? combat?.combatants.get(record.combatantId) : null;
	if (!combat || !combatant) return;
	const keys = record.reactionKeys.filter((key): key is HeroicReactionKey =>
		(HEROIC_REACTIONS as readonly string[]).includes(key),
	);
	const update: Record<string, unknown> = { _id: combatant.id };
	for (const key of keys) Object.assign(update, getHeroicReactionAvailabilityUpdate(key, true));
	if (record.actionsSpent) {
		Object.assign(
			update,
			buildCombatantActionDeltaUpdate(combatant, {
				currentDelta: record.actionsSpent,
				pendingDelta: 0,
			}),
		);
	}
	await combat.updateEmbeddedDocuments('Combatant', [update]);
}

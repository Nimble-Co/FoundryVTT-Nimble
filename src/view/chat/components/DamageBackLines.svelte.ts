import type { DamageBackAction, DamageBackRecord } from '#documents/chatMessage/cardDamageBack.ts';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { requestDamageBack } from '#utils/incomingReactions/incomingAttackReactions.js';
import localize from '#utils/localize.js';

type LineShape = 'gains' | 'dealt' | 'dealtArmor' | 'dealtEffect' | 'dealtArmorEffect';

const LINE_KEYS: Record<LineShape, string> = {
	gains: 'NIMBLE.chat.damageBack.gains',
	dealt: 'NIMBLE.chat.damageBack.dealt',
	dealtArmor: 'NIMBLE.chat.damageBack.dealtArmor',
	dealtEffect: 'NIMBLE.chat.damageBack.dealtEffect',
	dealtArmorEffect: 'NIMBLE.chat.damageBack.dealtArmorEffect',
};

/** The sentence: the damage (with or without armor), the effect, or both. */
function shapeOf(record: DamageBackRecord): LineShape {
	if (record.amount <= 0) return 'gains';
	const armor = record.ignoreArmor === false;
	if (record.effect) return armor ? 'dealtArmorEffect' : 'dealtEffect';
	return armor ? 'dealtArmor' : 'dealt';
}

/** The line of a damage back record. A waiting line has the same words; its button shows that it waits. */
export function damageBackText(record: DamageBackRecord): string {
	return localize(LINE_KEYS[shapeOf(record)], {
		label: record.label,
		name: record.attackerName,
		amount: String(record.doubled ? record.amount * 2 : record.amount),
		effect: record.effect?.name ?? '',
	});
}

export function damageBackButton(record: DamageBackRecord): string {
	const data = { amount: String(record.amount), effect: record.effect?.name ?? '' };
	if (record.amount <= 0) return localize('NIMBLE.chat.damageBack.apply', data);
	return localize(
		record.effect ? 'NIMBLE.chat.damageBack.dealAndApply' : 'NIMBLE.chat.damageBack.deal',
		data,
	);
}

/** The damage back lines of a chat card, with the buttons of the one who may act on them. */
export function createDamageBackLinesState(getMessage: () => NimbleChatMessage) {
	const records = $derived(
		(getMessage().reactive?.system as { damageBack?: DamageBackRecord[] } | undefined)
			?.damageBack ?? [],
	);

	const canUse = (record: DamageBackRecord): boolean => mayActHere(record.actorUuid);

	const doubleText = (record: DamageBackRecord): string =>
		localize('NIMBLE.chat.damageBack.double', { amount: String(record.amount) });

	const use = (record: DamageBackRecord, action: DamageBackAction) =>
		requestDamageBack({ messageId: getMessage().id ?? '', recordId: record.id, action });

	return {
		get records() {
			return records;
		},
		canUse,
		textOf: damageBackText,
		buttonOf: damageBackButton,
		doubleText,
		use,
	};
}

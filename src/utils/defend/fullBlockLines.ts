import type { DefendRecord } from '#types/defend.d.ts';
import {
	collectTriggerOffers,
	type GrantedActionOffer,
	spendLineCharges,
} from '../combat/grantedActionOffers.js';

interface AttackCard {
	whisper?: string[] | null;
	system: { grantedActionOffers?: unknown };
	previewDamageFor?: (tokenUuid: string, defend?: 0) => number | null;
	getDamageBreakdownForTarget?: (tokenUuid: string) => { total: number } | null;
	update: (data: Record<string, unknown>) => Promise<unknown>;
}

/** Whether the Defend on this token takes all the damage the attack would deal it. */
export function blocksAllDamage(card: AttackCard, tokenUuid: string): boolean {
	const before = card.previewDamageFor?.(tokenUuid, 0) ?? 0;
	if (before <= 0) return false;
	return card.getDamageBreakdownForTarget?.(tokenUuid)?.total === 0;
}

type FullBlockRecord = Pick<DefendRecord, 'tokenUuid' | 'actorUuid' | 'armor'>;

interface Defender {
	uuid?: string;
	name?: string | null;
	type?: string;
	img?: string | null;
	permission?: number;
	items?: Iterable<never>;
}

function defenderOf(record: FullBlockRecord): Defender | null {
	const token = fromUuidSync(record.tokenUuid as never, { strict: false }) as {
		actor?: Parameters<typeof collectTriggerOffers>[0];
	} | null;
	return (token?.actor ??
		fromUuidSync(record.actorUuid as never, { strict: false }) ??
		null) as Defender | null;
}

/** A Defend card of the defender that hosts the lines, when they cannot read the attack card. */
async function postDefendCard(
	defender: Defender,
	record: FullBlockRecord,
	lines: GrantedActionOffer[],
): Promise<void> {
	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor: defender as Actor }),
		type: 'reaction',
		system: {
			actorName: defender.name ?? '',
			actorType: defender.type ?? '',
			image: defender.img ?? '',
			permissions: defender.permission ?? 0,
			rollMode: 0,
			reactionType: 'defend',
			armorValue: record.armor,
			targets: [],
			grantedActionOffers: lines,
		},
	} as unknown as ChatMessage.CreateData);
}

/**
 * After a Defend is written: the defender's lines for a full block go on the card of the
 * attack, or on a Defend card of their own when the attack card is a whisper.
 */
export async function addFullBlockLines(card: AttackCard, record: FullBlockRecord): Promise<void> {
	const existing = card.system.grantedActionOffers;
	if (!Array.isArray(existing) || !blocksAllDamage(card, record.tokenUuid)) return;
	const defender = defenderOf(record);
	const lines = collectTriggerOffers(defender, 'onFullBlock');
	if (!defender || lines.length < 1) return;
	if ((card.whisper ?? []).length > 0) {
		await postDefendCard(defender, record, lines);
	} else {
		await card.update({
			system: { grantedActionOffers: [...(existing as GrantedActionOffer[]), ...lines] },
		});
	}
	await spendLineCharges(lines);
}

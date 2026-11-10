import { SYSTEM_ID } from '#system';
import type { ApplyEffectNode, ApplyEffectSource, EffectNode } from '#types/effectTree.js';
import {
	type AppliedEffect,
	applyEffectToActor,
	type EffectPayload,
	payloadFromCondition,
	payloadFromEffect,
} from '#utils/actor/applyEffectToActor.js';
import { usedUpOf } from '#utils/lastsUntil/describeLastsUntil.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import { statusOf } from '#utils/treeManipulation/conditionsToItemEffects.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

export const APPLIED_EFFECTS_FLAG = 'appliedEffects';

interface CardItem {
	uuid: string;
	actor?: CardActor | null;
	effects?: { get(id: string): CardEffect | undefined };
}

interface CardEffect {
	name: string;
	img?: string | null;
	system?: { lastsUntil?: Moment[]; escape?: { dc?: string } };
	toObject(): Record<string, unknown>;
}

type CardActor = Parameters<typeof applyEffectToActor>[0] & {
	type: string;
	getRollData(): Record<string, unknown>;
};

export interface EffectCard {
	id?: string | null;
	flags?: Record<string, unknown>;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

function cardFlags(card: EffectCard): {
	itemUuid?: string;
	actorId?: string;
	appliedEffects?: Record<string, AppliedEffect[]>;
} {
	return (card.flags?.[SYSTEM_ID] ?? {}) as never;
}

function cardItem(card: EffectCard): CardItem | null {
	const uuid = cardFlags(card).itemUuid;
	return uuid ? (fromUuidSync(uuid as never, { strict: false }) as CardItem | null) : null;
}

/** The creature that used the item of the card. */
export function cardUser(card: EffectCard): CardActor | null {
	const item = cardItem(card);
	if (item?.actor) return item.actor;
	const actorId = cardFlags(card).actorId;
	return actorId ? ((game.actors?.get(actorId) as unknown as CardActor | undefined) ?? null) : null;
}

function nodeEffect(card: EffectCard, node: ApplyEffectNode): CardEffect | null {
	return node.effectId ? (cardItem(card)?.effects?.get(node.effectId) ?? null) : null;
}

/** What the card row shows; null when the item no longer has the effect. */
export function applyEffectSource(
	card: EffectCard,
	node: ApplyEffectNode,
): ApplyEffectSource | null {
	const effect = nodeEffect(card, node);
	if (effect) {
		return {
			name: effect.name,
			img: effect.img ?? 'icons/svg/aura.svg',
			lastsUntil: effect.system?.lastsUntil ?? [],
			usedUp: usedUpOf(effect.system),
			escape: !!effect.system?.escape?.dc?.trim(),
		};
	}
	if (!node.condition) return null;
	return {
		...statusOf(node.condition),
		lastsUntil: node.lastsUntil ?? [],
		coreDuration: node.duration ?? null,
		escape: false,
	};
}

export function appliedEffects(card: EffectCard, nodeId: string): AppliedEffect[] | undefined {
	return cardFlags(card).appliedEffects?.[nodeId];
}

/** The card's own targets, not what the user has selected on the canvas now. */
export function cardTargets(card: EffectCard): CardActor[] {
	const uuids = (card.system as { targets?: string[] } | undefined)?.targets ?? [];
	return uuids
		.map(
			(uuid) =>
				(fromUuidSync(uuid as never, { strict: false }) as { actor?: CardActor } | null)?.actor,
		)
		.filter((actor): actor is CardActor => !!actor);
}

function payloadOf(card: EffectCard, node: ApplyEffectNode): EffectPayload | null {
	const item = cardItem(card);
	const user = cardUser(card);
	const effect = nodeEffect(card, node);
	if (effect) return payloadFromEffect(effect, { itemUuid: item?.uuid ?? null, user });
	if (!node.condition) return null;
	return payloadFromCondition(
		node.condition,
		node.lastsUntil ?? [],
		{ itemUuid: item?.uuid ?? null, actorUuid: user?.uuid ?? null },
		node.duration ?? null,
	);
}

/** The temp healing node of the card that an Apply Effect node gives, when it has a roll. */
export function linkedTempHealing(
	card: EffectCard,
	node: Pick<ApplyEffectNode, 'tempHealingNodeId'>,
): { id: string; total: number } | null {
	if (!node.tempHealingNodeId) return null;
	const tree = (card.system as { activation?: { effects?: EffectNode[] } } | undefined)?.activation
		?.effects;
	const healing = flattenEffectsTree(tree ?? []).find(
		(entry) => entry.id === node.tempHealingNodeId,
	);
	if (healing?.type !== 'healing' || healing.healingType !== 'tempHealing') return null;
	const total = Number(healing.roll?.total);
	return Number.isFinite(total) ? { id: healing.id, total } : null;
}

/** An Apply Effect node of the card gives this temp healing: the healing node has no button of its own. */
export function givenByAnEffect(card: EffectCard, healingNodeId: string): boolean {
	const tree = (card.system as { activation?: { effects?: EffectNode[] } } | undefined)?.activation
		?.effects;
	return flattenEffectsTree(tree ?? []).some(
		(entry) => entry.type === 'applyEffect' && entry.tempHealingNodeId === healingNodeId,
	);
}

function warnTempHpKept(name: string, refused: { temp: number; amount: number }): void {
	ui.notifications?.warn(
		localize('NIMBLE.healingTypes.tempHealingNotGranted', {
			name,
			temp: String(refused.temp),
			amount: String(refused.amount),
		}),
	);
}

/** Puts the node's effect on the card's targets, or on its user, and records who took it. */
export async function applyEffectFromCard(card: EffectCard, node: ApplyEffectNode): Promise<void> {
	const base = payloadOf(card, node);
	if (!base) return;
	const payload = { ...base, tempHp: linkedTempHealing(card, node)?.total ?? null };
	const user = cardUser(card);
	const recipients = node.recipient === 'self' ? (user ? [user] : []) : cardTargets(card);
	const results = await Promise.allSettled(
		recipients.map((actor) => applyEffectToActor(actor, payload)),
	);
	const applied: AppliedEffect[] = [];
	for (const result of results) {
		if (result.status === 'rejected') console.error(result.reason);
		else if (result.value) {
			const { tempHpRefused, ...entry } = result.value;
			if (tempHpRefused) warnTempHpKept(entry.actorName, tempHpRefused);
			applied.push(entry);
		}
	}
	if (!applied.length) {
		const name = applyEffectSource(card, node)?.name ?? '';
		ui.notifications?.info(localize('NIMBLE.chat.applyEffect.noneTook', { name }));
		return;
	}
	await card.update({ [`flags.${SYSTEM_ID}.${APPLIED_EFFECTS_FLAG}.${node.id}`]: applied });
}

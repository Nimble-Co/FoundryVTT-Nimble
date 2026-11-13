import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';
import type { ApplyEffectNode, ApplyEffectSource, EffectNode } from '#types/effectTree.js';
import type { RuleRaise } from '#types/spellScaling.js';
import {
	type AppliedEffect,
	applyEffectToActor,
	type EffectPayload,
	payloadFromCondition,
	payloadFromEffect,
} from '#utils/actor/applyEffectToActor.js';
import { stackGainEvent } from '#utils/actor/stackGainLine.js';
import { tempHpChoiceEvent } from '#utils/actor/tempHpChoice.js';
import { addCardEvents } from '#utils/chat/cardEvents.js';
import { usedUpOf } from '#utils/lastsUntil/describeLastsUntil.js';
import { hasEscape } from '#utils/lastsUntil/escapeEffect.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import { statusOf } from '#utils/treeManipulation/conditionsToItemEffects.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

export const APPLIED_EFFECTS_FLAG = 'appliedEffects';

interface CardItem {
	uuid: string;
	name?: string | null;
	actor?: CardActor | null;
	effects?: { get(id: string): CardEffect | undefined };
}

interface CardEffect {
	name: string;
	img?: string | null;
	system?: { lastsUntil?: Moment[]; escape?: { dc?: string; noDc?: boolean } };
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

/** The item that was used for the card. */
export function cardItem(card: EffectCard): CardItem | null {
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

/** The item that has the node's effect: the card's item, or the item the node names. */
function effectItem(card: EffectCard, node: ApplyEffectNode): CardItem | null {
	if (!node.effectItemUuid) return cardItem(card);
	return fromUuidSync(node.effectItemUuid as never, { strict: false }) as CardItem | null;
}

function nodeEffect(card: EffectCard, node: ApplyEffectNode): CardEffect | null {
	return node.effectId ? (effectItem(card, node)?.effects?.get(node.effectId) ?? null) : null;
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
			escape: hasEscape(effect.system),
		};
	}
	if (!node.condition) return null;
	return {
		...statusOf(node.condition),
		lastsUntil: node.lastsUntil ?? [],
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

/** Adds each upcast raise to its rule's field, when that field holds a number. */
function raiseRules(payload: EffectPayload, raises: readonly RuleRaise[]): void {
	const rules = (payload.data.system as { rules?: Record<string, unknown>[] } | undefined)?.rules;
	if (!rules) return;
	for (const { ruleId, field, amount } of raises) {
		const rule = rules.find((entry) => entry.id === ruleId);
		const current = rule?.[field];
		if (rule && typeof current === 'number' && Number.isFinite(current)) {
			rule[field] = current + amount;
		}
	}
}

function payloadOf(card: EffectCard, node: ApplyEffectNode): EffectPayload | null {
	const user = cardUser(card);
	const effect = nodeEffect(card, node);
	if (effect) {
		const itemUuid = effectItem(card, node)?.uuid ?? null;
		const payload = payloadFromEffect(effect, { itemUuid, user });
		if (node.ruleRaises?.length) raiseRules(payload, node.ruleRaises);
		return payload;
	}
	if (!node.condition) return null;
	return payloadFromCondition(node.condition, node.lastsUntil ?? [], {
		itemUuid: cardItem(card)?.uuid ?? null,
		actorUuid: user?.uuid ?? null,
	});
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

const appliedPath = (nodeId: string) => `flags.${SYSTEM_ID}.${APPLIED_EFFECTS_FLAG}.${nodeId}`;

/**
 * Puts the node's effect on the card's targets, or on its user, and records who took it. Given
 * `recipients` (a save's saver), it puts it on them and adds them to the record. Gives the
 * creatures that took it.
 */
export async function applyEffectFromCard(
	card: EffectCard,
	node: ApplyEffectNode,
	options: { recipients?: CardActor[] } = {},
): Promise<AppliedEffect[]> {
	const base = payloadOf(card, node);
	if (!base) return [];
	const payload = {
		...base,
		tempHp: linkedTempHealing(card, node)?.total ?? null,
		cardId: (card as { id?: string | null }).id ?? null,
	};
	const user = cardUser(card);
	const recipients =
		options.recipients ?? (node.recipient === 'self' ? (user ? [user] : []) : cardTargets(card));
	const results = await Promise.allSettled(
		recipients.map((actor) => applyEffectToActor(actor, payload)),
	);
	const applied: AppliedEffect[] = [];
	const lines: CardEvent[] = [];
	results.forEach((result, index) => {
		if (result.status === 'rejected') console.error(result.reason);
		else if (result.value) {
			const { tempHpRefused, stackReached, ...entry } = result.value;
			const holder = recipients[index] as { uuid?: string | null; name?: string | null };
			if (stackReached && holder?.uuid) {
				lines.push(stackGainEvent({ uuid: holder.uuid, name: holder.name }, stackReached));
			}
			if (tempHpRefused && holder?.uuid) {
				lines.push(
					tempHpChoiceEvent(
						{ uuid: holder.uuid, name: holder.name },
						tempHpRefused,
						entry.effectUuid,
					),
				);
			}
			applied.push(entry);
		}
	});
	if (lines.length && !(await addCardEvents(card as never, lines))) {
		for (const line of lines) {
			if (line.action?.kind !== 'tempHpChoice') continue;
			warnTempHpKept(line.action.holderName, { temp: line.action.had, amount: line.action.amount });
		}
	}
	if (!applied.length) {
		if (options.recipients) return [];
		const name = applyEffectSource(card, node)?.name ?? '';
		ui.notifications?.info(localize('NIMBLE.chat.applyEffect.noneTook', { name }));
		return [];
	}
	const record = options.recipients
		? [...(appliedEffects(card, node.id) ?? []), ...applied]
		: applied;
	await card.update({ [appliedPath(node.id)]: record });
	return applied;
}

/** Takes one creature's entry out of the record of the node, as a taken-back application. */
export async function forgetAppliedEffect(
	card: EffectCard,
	nodeId: string,
	effectUuid: string,
): Promise<void> {
	const record = [...(appliedEffects(card, nodeId) ?? [])];
	const index = record.findIndex((entry) => entry.effectUuid === effectUuid);
	if (index < 0) return;
	record.splice(index, 1);
	await card.update({ [appliedPath(nodeId)]: record });
}

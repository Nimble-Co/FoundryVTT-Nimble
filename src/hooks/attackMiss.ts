import type { AttackedCreature, CardDamageBack } from '#documents/chatMessage/cardDamageBack.js';
import { SYSTEM_ID, systemHookName } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { cardTargetTokens } from '#utils/chat/cardTargetTokens.js';
import { findPrimaryDamageNode } from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

const ITEM_CARD_TYPES = new Set(['feature', 'spell', 'object', 'reaction']);

/** The card reported its miss. A reroll into a hit clears it. */
const ATTACK_MISSED_FLAG = 'attackMissed';

/** What `attackMissed` sends: the first target of an item attack that missed. */
export interface AttackMissedPayload {
	sourceItem: Item | null;
	sourceActor: Actor | null;
	targetActor: Actor;
	card: unknown;
	isCritical: false;
	isMiss: true;
}

interface CardActivation {
	acquireTargetsFromTemplate?: boolean;
	template?: { shape?: string };
	effects?: EffectNode[];
}

interface MissCard {
	id?: string | null;
	type?: string;
	flags?: Record<string, Record<string, unknown> | undefined>;
	system?: {
		isMiss?: boolean;
		isCritical?: boolean;
		targets?: string[];
		activation?: CardActivation;
	};
	speaker?: { actor?: string | null };
	cardDamageBack?: CardDamageBack;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	unsetFlag(scope: string, key: string): Promise<unknown>;
}

interface TargetToken {
	actor?: Actor | null;
}

const firing = new Set<string>();

/** Whether `attackMissed` already reported the miss of this card. */
export function missReported(card: unknown): boolean {
	const flags = (card as Pick<MissCard, 'flags'> | null)?.flags;
	return flags?.[SYSTEM_ID]?.[ATTACK_MISSED_FLAG] === true;
}

/**
 * A miss this hook reports: an item attack, the first target only, and not an area, an
 * opportunity attack, a minion group card, or damage that waits for a later roll.
 * `attackMissed` is not `damageApplied`. That hook also refills on-attacked pools, which the
 * card already did when it was made.
 */
function coveredMiss(card: MissCard): boolean {
	if (!ITEM_CARD_TYPES.has(card.type ?? '')) return false;
	if (card.system?.isMiss !== true || card.system.isCritical === true) return false;
	if (missReported(card)) return false;
	if (card.flags?.[SYSTEM_ID]?.opportunityAttack === true) return false;
	const activation = card.system.activation;
	const shape = activation?.template?.shape ?? '';
	if (activation?.acquireTargetsFromTemplate === true && shape !== '') return false;
	const nodes = flattenEffectsTree(activation?.effects ?? []);
	const deferred = nodes.some(
		(node) => node.type === 'damage' && (node as { deferredRoll?: boolean }).deferredRoll === true,
	);
	if (deferred || !findPrimaryDamageNode(nodes)) return false;
	return true;
}

/** Runs `work` once at a time for each card. */
async function onceFor(card: MissCard, work: () => Promise<void>): Promise<void> {
	const cardId = card.id ?? null;
	if (!cardId || firing.has(cardId)) return;
	firing.add(cardId);
	try {
		await work();
	} catch (error) {
		console.error('Nimble | The miss of an attack could not be read.', error);
	} finally {
		firing.delete(cardId);
	}
}

async function reportAttackMiss(card: MissCard): Promise<void> {
	if (!isActiveGM() || !coveredMiss(card)) return;
	const [first] = cardTargetTokens<TargetToken>(card);
	const targetActor = first?.actor;
	if (!first || !targetActor) return;

	await onceFor(card, async () => {
		await card.setFlag(SYSTEM_ID, ATTACK_MISSED_FLAG, true);
		await card.cardDamageBack?.afterMiss([
			{ actor: targetActor as unknown as AttackedCreature['actor'], token: first as never },
		]);

		const sourceActorId = card.speaker?.actor;
		const sourceActor = sourceActorId ? (game.actors?.get(sourceActorId) ?? null) : null;
		const sourceItemId = card.flags?.[SYSTEM_ID]?.itemId;
		const sourceItem =
			typeof sourceItemId === 'string' ? (sourceActor?.items?.get(sourceItemId) ?? null) : null;
		const payload: AttackMissedPayload = {
			sourceItem: sourceItem as Item | null,
			sourceActor: sourceActor as Actor | null,
			targetActor,
			card,
			isCritical: false,
			isMiss: true,
		};
		// @ts-expect-error - attackMissed is a custom system hook
		Hooks.callAll(systemHookName('attackMissed'), payload);
	});
}

/** A reroll turned a reported miss into a hit: its miss lines not dealt yet go. */
async function takeBackMiss(card: MissCard): Promise<void> {
	if (!isActiveGM() || !missReported(card)) return;
	await onceFor(card, async () => {
		await card.cardDamageBack?.dropMissed();
		await card.unsetFlag(SYSTEM_ID, ATTACK_MISSED_FLAG);
	});
}

let registered = false;

/**
 * The active GM reports each in-scope miss once, with no Apply Damage click. An update counts
 * only when it changes the outcome, as a reroll does.
 */
export function registerAttackMissHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('createChatMessage', (card: unknown) => {
		void reportAttackMiss(card as MissCard);
	});
	Hooks.on('updateChatMessage', (card: unknown, changes: unknown) => {
		const system = (changes as { system?: Record<string, unknown> } | null)?.system;
		if (!system || !('isMiss' in system)) return;
		const missCard = card as MissCard;
		void (missCard.system?.isMiss === true ? reportAttackMiss(missCard) : takeBackMiss(missCard));
	});
}

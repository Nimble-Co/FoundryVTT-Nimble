import { SYSTEM_ID, systemHookName } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { cardTargetTokens } from '#utils/chat/cardTargetTokens.js';
import { findPrimaryDamageNode } from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

const ITEM_CARD_TYPES = new Set(['feature', 'spell', 'object', 'reaction']);

/** Once per card, so a later update of the same miss does not report it again. */
const ATTACK_MISSED_FLAG = 'attackMissed';

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
	cardDamageBack?: {
		afterMiss?(holders: readonly { actor: unknown; token?: unknown }[]): Promise<void>;
	};
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

interface TargetToken {
	actor?: Actor | null;
}

const firing = new Set<string>();

function alreadyReported(card: MissCard): boolean {
	return card.flags?.[SYSTEM_ID]?.[ATTACK_MISSED_FLAG] === true;
}

/** Written before `setFlag`, so the update that flag makes cannot report the miss again. */
function markReported(card: MissCard): void {
	card.flags ??= {};
	const scope = card.flags[SYSTEM_ID] ?? {};
	scope[ATTACK_MISSED_FLAG] = true;
	card.flags[SYSTEM_ID] = scope;
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
	if (alreadyReported(card)) return false;
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

async function reportAttackMiss(card: MissCard): Promise<void> {
	if (!isActiveGM() || !coveredMiss(card)) return;
	const cardId = card.id ?? null;
	if (!cardId || firing.has(cardId)) return;
	const [first] = cardTargetTokens<TargetToken>(card);
	const targetActor = first?.actor;
	if (!first || !targetActor) return;

	firing.add(cardId);
	markReported(card);
	try {
		await card.setFlag(SYSTEM_ID, ATTACK_MISSED_FLAG, true);
		await card.cardDamageBack?.afterMiss?.([{ actor: targetActor, token: first }]);

		const sourceActorId = card.speaker?.actor;
		const sourceActor = sourceActorId ? (game.actors?.get(sourceActorId) ?? null) : null;
		const sourceItemId = card.flags?.[SYSTEM_ID]?.itemId;
		const sourceItem =
			typeof sourceItemId === 'string' ? (sourceActor?.items?.get(sourceItemId) ?? null) : null;
		// @ts-expect-error - attackMissed is a custom system hook
		Hooks.callAll(systemHookName('attackMissed'), {
			sourceItem,
			sourceActor,
			targetActor,
			card,
			isCritical: false,
			isMiss: true,
		});
	} catch (error) {
		console.error('Nimble | An attack that missed could not be reported.', error);
	} finally {
		firing.delete(cardId);
	}
}

let registered = false;

/** The active GM reports each in-scope miss once, with no Apply Damage click. */
export function registerAttackMissHooks(): void {
	if (registered) return;
	registered = true;
	const onCard = (card: unknown) => {
		void reportAttackMiss(card as MissCard);
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}

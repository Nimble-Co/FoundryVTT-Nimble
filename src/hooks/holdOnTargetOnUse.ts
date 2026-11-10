import { SYSTEM_ID, systemHookName } from '#system';
import type { HeldChangeKind } from '#types/heldChange.d.ts';
import { createHeldChange, takeBackHeldChanges } from '#utils/heldChange/heldChange.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

const HELD_FLAG = 'heldOnTargets';
const SPENT = 'spent';

interface HoldRule {
	type?: string;
	disabled?: boolean;
	heldKind?: HeldChangeKind;
	damageType?: string;
	test?(): boolean;
}

interface UsedItem {
	name?: string;
	uuid?: string;
	rules?: Iterable<unknown> | Map<string, unknown>;
}

interface UseContext {
	isMiss?: boolean;
	targets?: Array<{ actor?: Actor.Implementation | null }>;
}

interface Card {
	id?: string | null;
	isAuthor?: boolean;
	author?: { active?: boolean } | null;
	flags?: Record<string, Record<string, unknown> | undefined>;
	system?: { targets?: string[]; isMiss?: boolean };
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

function holdRulesOf(item: UsedItem): HoldRule[] {
	const rules = item.rules;
	if (!rules) return [];
	const list = (rules instanceof Map ? [...rules.values()] : [...rules]) as HoldRule[];
	return list.filter(
		(rule) => rule?.type === 'holdOnTarget' && !rule.disabled && rule.test?.() !== false,
	);
}

async function holdOn(
	item: UsedItem,
	rules: HoldRule[],
	actors: Actor.Implementation[],
	cardId?: string,
) {
	if (!game.combat?.started) return;
	for (const rule of rules) {
		if (rule.heldKind === 'vulnerableOnce' && !rule.damageType) continue;
		for (const actor of actors) {
			await createHeldChange(actor, {
				kind: rule.heldKind ?? 'mustAttackOther',
				value: 0,
				label: item.name ?? '',
				appliesTo: rule.heldKind === 'vulnerableOnce' ? 'attacksOnHolder' : 'holderAttacks',
				spentBy: 'oneRoll',
				ends: 'combat',
				origin: item.uuid ?? null,
				...(rule.damageType ? { damageType: rule.damageType } : {}),
				...(cardId ? { sourceMessageId: cardId } : {}),
			});
		}
	}
}

function cardTargetActors(card: Card): Actor.Implementation[] {
	return (card.system?.targets ?? [])
		.map((uuid) => (fromUuidSync(uuid) as { actor?: Actor.Implementation | null } | null)?.actor)
		.filter((actor): actor is Actor.Implementation => !!actor);
}

/** The author follows the new roll; with the author away, the GM does. */
function followsHere(card: Card): boolean {
	return card.author?.active ? card.isAuthor === true : isActiveGM();
}

/**
 * A new roll that turns the hit into a miss takes the holds back, and a new hit gives them.
 * A hold that was spent before the miss is not given again.
 */
async function followNewRoll(card: Card, changes: { system?: { isMiss?: boolean } }) {
	const isMiss = changes.system?.isMiss;
	if (typeof isMiss !== 'boolean' || !card.id || !followsHere(card)) return;
	const held = card.flags?.[SYSTEM_ID]?.[HELD_FLAG];
	if (typeof held !== 'boolean' || held === !isMiss) return;
	if (!isRuleAutomationEnabled()) return;

	const itemUuid = card.flags?.[SYSTEM_ID]?.itemUuid;
	const item = typeof itemUuid === 'string' ? (fromUuidSync(itemUuid as never) as UsedItem) : null;
	const rules = item ? holdRulesOf(item) : [];
	if (!item || rules.length === 0) return;

	const actors = cardTargetActors(card);
	if (isMiss) {
		let taken = 0;
		for (const actor of actors) taken += await takeBackHeldChanges(actor, card.id);
		await card.setFlag?.(SYSTEM_ID, HELD_FLAG, taken > 0 ? false : SPENT);
	} else {
		await holdOn(item, rules, actors, card.id);
		await card.setFlag?.(SYSTEM_ID, HELD_FLAG, true);
	}
}

/** The client that used the item holds the change. It lasts until spent, or the combat ends. */
export function registerHoldOnTargetHooks(): void {
	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: UsedItem, card: Card | null, context: UseContext) => {
			if (!isRuleAutomationEnabled()) return;
			const rules = holdRulesOf(item);
			if (rules.length === 0 || !game.combat?.started) return;
			if (!context?.isMiss) {
				const actors = (context.targets ?? [])
					.map((target) => target.actor)
					.filter((actor): actor is Actor.Implementation => !!actor);
				await holdOn(item, rules, actors, card?.id ?? undefined);
			}
			await card?.setFlag?.(SYSTEM_ID, HELD_FLAG, !context?.isMiss);
		}) as never,
	);
	Hooks.on(
		'updateChatMessage' as never,
		((card: Card, changes: { system?: { isMiss?: boolean } }) =>
			void followNewRoll(card, changes)) as never,
	);
}

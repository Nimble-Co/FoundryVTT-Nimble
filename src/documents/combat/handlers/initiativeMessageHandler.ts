import { InitiativeMessageRule } from '../../../models/rules/initiativeMessage.js';

type ItemLike = {
	uuid?: string;
	id?: string;
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
	system?: { rules?: Record<string, unknown>[] };
};

type ActorWithRules = Actor & {
	items?: Iterable<ItemLike>;
};

/**
 * Returns the compendium UUID for an embedded item, falling back through the
 * various locations Foundry uses across different versions.
 */
function getItemSourceId(item: ItemLike): string | undefined {
	return item.sourceId ?? item._stats?.compendiumSource ?? item.flags?.core?.source;
}

/**
 * Reads rules from the item's compendium source via `fromUuidSync`.
 * Used to hydrate rules on embedded items that predate the rule being added
 * to the compendium — the same fallback pattern used in `combatManaRules.ts`.
 */
function getRulesFromCompendiumSource(item: ItemLike): Record<string, unknown>[] {
	const sourceId = getItemSourceId(item);
	if (!sourceId) return [];

	const fromUuidSyncFn = (globalThis as Record<string, unknown>).fromUuidSync as
		| ((uuid: string) => unknown)
		| undefined;
	if (typeof fromUuidSyncFn !== 'function') return [];

	const sourceItem = fromUuidSyncFn(sourceId) as {
		system?: { rules?: Record<string, unknown>[] };
	} | null;

	return Array.isArray(sourceItem?.system?.rules) ? sourceItem.system.rules : [];
}

/**
 * Returns all `initiativeMessage` rule sources for an item.
 * Prefers the embedded item's own rules; falls back to the compendium source
 * when the embedded copy predates the rule addition.
 */
function getInitiativeMessageRuleSources(item: ItemLike): Record<string, unknown>[] {
	const embeddedRules = item.system?.rules ?? [];
	const hasLocalDefinition = embeddedRules.some((r) => r.type === 'initiativeMessage');

	const ruleSources = hasLocalDefinition ? embeddedRules : getRulesFromCompendiumSource(item);
	return ruleSources.filter((r) => r.type === 'initiativeMessage' && r.disabled !== true);
}

/**
 * Fires when a character rolls initiative.  Collects every `initiativeMessage`
 * rule from the actor's items (using the compendium source as a fallback for
 * stale embedded copies) and whispers each resolved message to the owning player.
 *
 * Adding the behaviour to any feature requires only a `"type": "initiativeMessage"`
 * entry in that feature's `system.rules` array — no code changes needed.
 */
export default async function initiativeMessageHandler(
	combatant: Combatant.Implementation,
): Promise<void> {
	const actor = combatant.actor as ActorWithRules | null;

	const shouldRun =
		combatant.type === 'character' && combatant.initiative === null && actor?.isOwner === true;

	if (!shouldRun || !actor) return;

	const whisperTargets = game.user?.id ? [game.user.id] : [];
	const speaker = ChatMessage.getSpeaker({
		actor: actor as unknown as Actor,
		token: combatant.token,
	});

	for (const item of actor.items ?? []) {
		for (const ruleSource of getInitiativeMessageRuleSources(item)) {
			const rule = new InitiativeMessageRule(
				ruleSource as Parameters<typeof InitiativeMessageRule.prototype.resolveMessage>[never],
				{ parent: item as unknown as foundry.abstract.DataModel.Any },
			);

			const content = rule.resolveMessage();
			if (!content) continue;

			await ChatMessage.create({
				author: game.user?.id,
				speaker,
				whisper: whisperTargets,
				content: `<p><strong>${rule.label}</strong>: ${content}</p>`,
			} as ChatMessage.CreateData);
		}
	}
}

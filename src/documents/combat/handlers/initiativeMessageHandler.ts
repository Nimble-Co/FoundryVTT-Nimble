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

function getItemSourceId(item: ItemLike): string | undefined {
	return item.sourceId ?? item._stats?.compendiumSource ?? item.flags?.core?.source;
}

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

// Prefers embedded rules; falls back to compendium source for items that predate the rule addition.
function getInitiativeMessageRuleSources(item: ItemLike): Record<string, unknown>[] {
	const embeddedRules = item.system?.rules ?? [];
	const hasLocalDefinition = embeddedRules.some((r) => r.type === 'initiativeMessage');

	const ruleSources = hasLocalDefinition ? embeddedRules : getRulesFromCompendiumSource(item);
	return ruleSources.filter((r) => r.type === 'initiativeMessage' && r.disabled !== true);
}

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

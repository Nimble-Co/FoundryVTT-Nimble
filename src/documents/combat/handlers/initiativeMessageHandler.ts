import { InitiativeMessageRule } from '../../../models/rules/initiativeMessage.js';
import { getRulesFromCompendiumSource } from '../../../utils/itemSourceRules.js';

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

// Prefers embedded rules; falls back to compendium source for items that predate the rule addition.
export function getInitiativeMessageRuleSources(item: ItemLike): Record<string, unknown>[] {
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
				ruleSource as ConstructorParameters<typeof InitiativeMessageRule>[0],
				{ parent: item as unknown as foundry.abstract.DataModel.Any },
			);

			const content = rule.resolveMessage();
			if (!content) continue;

			const label = foundry.utils.escapeHTML(rule.label);
			await ChatMessage.create({
				author: game.user?.id,
				speaker,
				whisper: whisperTargets,
				content: `<p><strong>${label}</strong>: ${content}</p>`,
			} as ChatMessage.CreateData);
		}
	}
}

import { getRulesFromCompendiumSource } from '../../utils/itemSourceRules.js';
import localize from '../../utils/localize.js';
import { countAdjacentByDisposition } from '../../utils/tokenAdjacency.js';

const LIONHEARTED_STATUS_ID = 'lionhearted';

let didRegisterLionheartedAdjacencySync = false;

type ItemLike = {
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
	system?: { rules?: Record<string, unknown>[] };
};

// Prefers embedded rules; falls back to compendium source for items that predate the rule addition.
function getLionheartedBonusRuleSources(item: ItemLike): Record<string, unknown>[] {
	const embeddedRules = item.system?.rules ?? [];
	const hasLocalDefinition = embeddedRules.some((r) => r.type === 'lionheartedBonus');

	const ruleSources = hasLocalDefinition ? embeddedRules : getRulesFromCompendiumSource(item);
	return ruleSources.filter((r) => r.type === 'lionheartedBonus' && r.disabled !== true);
}

function actorHasLionheartedBonusRule(actor: Actor): boolean {
	for (const item of (actor as Actor & { items?: Iterable<ItemLike> }).items ?? []) {
		if (getLionheartedBonusRuleSources(item).length > 0) return true;
	}
	return false;
}

function getActorOwnerIds(actor: Actor.Implementation): string[] {
	return (game.users?.contents ?? [])
		.filter((u) => actor.testUserPermission(u as User, 'OWNER'))
		.map((u) => u.id)
		.filter((id): id is string => id != null);
}

async function sendLionheartedNotification(
	actor: Actor.Implementation,
	gained: boolean,
): Promise<void> {
	const whisperTargets = getActorOwnerIds(actor);
	const label = foundry.utils.escapeHTML(localize('NIMBLE.conditions.lionhearted'));
	const detail = gained ? localize('NIMBLE.lionheart.gained') : localize('NIMBLE.lionheart.lost');

	await ChatMessage.create({
		author: game.user?.id,
		whisper: whisperTargets,
		content: `<p><strong>${label}</strong>: ${detail}</p>`,
	} as ChatMessage.CreateData);
}

function getCombatCharacterTokens(combat: Combat): Array<{
	actor: Actor.Implementation;
	token: Token;
}> {
	const results: Array<{ actor: Actor.Implementation; token: Token }> = [];

	for (const combatant of combat.combatants.contents) {
		if ((combatant as { type?: string }).type !== 'character') continue;

		const actor = combatant.actor;
		if (!actor) continue;

		if (!actorHasLionheartedBonusRule(actor)) continue;

		const token = combatant.token?.object as Token | null;
		if (!token) continue;

		results.push({ actor, token });
	}

	return results;
}

export async function syncLionheartedAdjacencyState(combat: Combat): Promise<void> {
	if (!game.user?.isGM) return;
	if (!canvas?.ready || !canvas.tokens) return;

	const allTokens = canvas.tokens.placeables as Token[];
	const characterEntries = getCombatCharacterTokens(combat);

	if (characterEntries.length === 0) return;

	const adjacencyCounts = characterEntries.map(({ actor, token }) => ({
		actor,
		count: countAdjacentByDisposition(token, allTokens, CONST.TOKEN_DISPOSITIONS.HOSTILE),
	}));

	const maxCount = Math.max(...adjacencyCounts.map((e) => e.count));

	for (const { actor, count } of adjacencyCounts) {
		const shouldBeActive = maxCount > 0 && count >= maxCount;
		const isCurrentlyActive =
			(actor as { statuses?: Set<string> }).statuses?.has(LIONHEARTED_STATUS_ID) ?? false;

		if (shouldBeActive === isCurrentlyActive) continue;

		try {
			await actor.toggleStatusEffect(LIONHEARTED_STATUS_ID, {
				active: shouldBeActive,
				overlay: false,
			});
			await sendLionheartedNotification(actor, shouldBeActive);
		} catch {
			// Ignore errors from concurrent status effect modifications
		}
	}
}

export async function clearLionheartedAdjacencyState(combat: Combat): Promise<void> {
	if (!game.user?.isGM) return;

	for (const combatant of combat.combatants.contents) {
		const actor = combatant.actor;
		if (!actor) continue;

		const isActive =
			(actor as { statuses?: Set<string> }).statuses?.has(LIONHEARTED_STATUS_ID) ?? false;
		if (!isActive) continue;

		try {
			await actor.toggleStatusEffect(LIONHEARTED_STATUS_ID, {
				active: false,
				overlay: false,
			});
		} catch {
			// Ignore errors from concurrent status effect modifications
		}
	}
}

export default function registerLionheartedAdjacencySync() {
	if (didRegisterLionheartedAdjacencySync) return;
	didRegisterLionheartedAdjacencySync = true;

	let scheduled = false;

	function scheduleSync(): void {
		if (scheduled) return;
		scheduled = true;
		setTimeout(() => {
			scheduled = false;
			const combat = game.combat;
			if (combat?.active) void syncLionheartedAdjacencyState(combat);
		}, 0);
	}

	Hooks.on('updateToken', (_token: TokenDocument, changes: Record<string, unknown>) => {
		if (!foundry.utils.hasProperty(changes, 'x') && !foundry.utils.hasProperty(changes, 'y'))
			return;
		scheduleSync();
	});
	Hooks.on('createToken', scheduleSync);
	Hooks.on('deleteToken', scheduleSync);
	Hooks.on('createCombat', scheduleSync);
	Hooks.on('canvasReady', scheduleSync);

	Hooks.on('deleteCombat', (combat: Combat) => {
		void clearLionheartedAdjacencyState(combat);
	});
}

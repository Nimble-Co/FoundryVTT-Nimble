import localize from '../../utils/localize.js';
import { countAdjacentByDisposition, type PositionOverrides } from '../../utils/tokenAdjacency.js';

const LIONHEARTED_STATUS_ID = 'lionhearted';

function actorHasLionheartedBonusRule(actor: Actor): boolean {
	return (
		(actor as { rules?: Array<{ type: string }> }).rules?.some(
			(r) => r.type === 'lionheartedBonus',
		) ?? false
	);
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

export async function syncLionheartedAdjacencyState(
	combat: Combat,
	overrides?: PositionOverrides,
): Promise<void> {
	if (!game.user?.isGM) return;
	if (!canvas?.ready || !canvas.tokens) return;

	const allTokens = canvas.tokens.placeables as Token[];
	const characterEntries = getCombatCharacterTokens(combat);

	if (characterEntries.length === 0) return;

	const adjacencyCounts = characterEntries.map(({ actor, token }) => ({
		actor,
		count: countAdjacentByDisposition(
			token,
			allTokens,
			CONST.TOKEN_DISPOSITIONS.HOSTILE,
			overrides,
		),
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

const registeredHooks: Array<{ event: string; id: number }> = [];
const hooksOff = Hooks.off.bind(Hooks) as (event: string, id: number) => void;

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		for (const { event, id } of registeredHooks) hooksOff(event, id);
		registeredHooks.length = 0;
	});
}

export default function registerLionheartedAdjacencySync() {
	for (const { event, id } of registeredHooks) hooksOff(event, id);
	registeredHooks.length = 0;

	const pendingPositions = new Map<string, { x: number; y: number }>();
	let syncTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSync(): void {
		if (syncTimer !== null) clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			syncTimer = null;
			const positions = new Map(pendingPositions);
			pendingPositions.clear();
			const combat = game.combat;
			if (combat?.active) void syncLionheartedAdjacencyState(combat, positions);
		}, 0);
	}

	const onUpdateToken = (_token: TokenDocument, changes: Record<string, unknown>) => {
		const hasPos =
			foundry.utils.hasProperty(changes, 'x') || foundry.utils.hasProperty(changes, 'y');
		if (!hasPos) return;
		if (_token.id) {
			pendingPositions.set(_token.id, {
				x: typeof changes.x === 'number' ? changes.x : _token.x,
				y: typeof changes.y === 'number' ? changes.y : _token.y,
			});
		}
		scheduleSync();
	};

	const onDeleteCombat = (combat: Combat) => {
		void clearLionheartedAdjacencyState(combat);
	};

	registeredHooks.push(
		{ event: 'updateToken', id: Hooks.on('updateToken', onUpdateToken) },
		{ event: 'createToken', id: Hooks.on('createToken', scheduleSync) },
		{ event: 'deleteToken', id: Hooks.on('deleteToken', scheduleSync) },
		{ event: 'createCombat', id: Hooks.on('createCombat', scheduleSync) },
		{ event: 'canvasReady', id: Hooks.on('canvasReady', scheduleSync) },
		{ event: 'deleteCombat', id: Hooks.on('deleteCombat', onDeleteCombat) },
	);

	if (canvas?.ready) scheduleSync();
}

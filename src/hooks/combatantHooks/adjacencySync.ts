import { countAdjacentEnemies, type PositionOverrides } from '../../utils/tokenAdjacency.js';

const ADJACENCY_FLAG_PATH = 'flags.nimble.adjacency';

interface AdjacencyFlagData {
	enemiesAdjacentCount: number;
	hasMostAdjacentEnemies: boolean;
}

let didRegisterAdjacencySync = false;

async function syncAdjacency(overrides?: PositionOverrides): Promise<void> {
	if (!game.user?.isGM) return;
	if (!canvas?.ready || !canvas.scene) return;

	const combat = game.combat;
	if (!combat?.active) return;

	const sceneId = canvas.scene.id;
	const activeCombatants = combat.combatants.contents.filter(
		(c) => c.sceneId === sceneId && c.token && c.actor && !c.defeated,
	);

	const tokens = activeCombatants
		.map((c) => c.token?.object)
		.filter((t): t is Token.Implementation => t != null);

	if (tokens.length === 0) return;

	const counts = tokens.map((token) => countAdjacentEnemies(token, tokens, overrides));
	const maxCount = Math.max(...counts, 0);

	const updates = activeCombatants
		.map((combatant, i) => {
			const actor = combatant.actor;
			if (!actor) return null;

			const count = counts[i];
			const hasMost = count > 0 && count === maxCount;

			const currentFlag = actor.getFlag('nimble', 'adjacency') as AdjacencyFlagData | undefined;
			if (
				currentFlag?.enemiesAdjacentCount === count &&
				currentFlag?.hasMostAdjacentEnemies === hasMost
			) {
				return null;
			}

			return { actor, count, hasMost };
		})
		.filter(
			(u): u is { actor: Actor.Implementation; count: number; hasMost: boolean } => u != null,
		);

	await Promise.all(
		updates.map(({ actor, count, hasMost }) =>
			actor.update({
				[ADJACENCY_FLAG_PATH]: {
					enemiesAdjacentCount: count,
					hasMostAdjacentEnemies: hasMost,
				},
			} as Record<string, unknown>),
		),
	);
}

async function clearAdjacencyForCombat(combat: Combat.Implementation): Promise<void> {
	if (!game.user?.isGM) return;

	const actorsToReset = combat.combatants.contents
		.map((c) => c.actor)
		.filter((actor): actor is Actor.Implementation => {
			if (!actor) return false;
			const flag = actor.getFlag('nimble', 'adjacency') as AdjacencyFlagData | undefined;
			return (flag?.enemiesAdjacentCount ?? 0) > 0 || (flag?.hasMostAdjacentEnemies ?? false);
		});

	await Promise.all(
		actorsToReset.map((actor) =>
			actor.update({
				[ADJACENCY_FLAG_PATH]: {
					enemiesAdjacentCount: 0,
					hasMostAdjacentEnemies: false,
				},
			} as Record<string, unknown>),
		),
	);
}

export default function registerAdjacencySync() {
	if (didRegisterAdjacencySync) return;
	didRegisterAdjacencySync = true;

	// Stores the latest x/y from updateToken changes before document.x/y is committed.
	// FoundryVTT fires updateToken before the document properties are updated in memory,
	// so we must capture the new position from the change object and pass it as overrides.
	const pendingPositions: PositionOverrides = new Map();

	let timer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSync(): void {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			const positions = new Map(pendingPositions);
			pendingPositions.clear();
			void syncAdjacency(positions);
		}, 0);
	}

	Hooks.on(
		'updateToken',
		(_tokenDoc: TokenDocument.Implementation, changes: Record<string, unknown>) => {
			const hasPos =
				foundry.utils.hasProperty(changes, 'x') || foundry.utils.hasProperty(changes, 'y');
			if (!hasPos) return;
			if (_tokenDoc.id) {
				pendingPositions.set(_tokenDoc.id, {
					x: typeof changes.x === 'number' ? changes.x : _tokenDoc.x,
					y: typeof changes.y === 'number' ? changes.y : _tokenDoc.y,
				});
			}
			scheduleSync();
		},
	);

	// Fires when combat is started (active: true) or turn advances
	Hooks.on('updateCombat', (_combat: Combat.Implementation, changes: Record<string, unknown>) => {
		if (
			foundry.utils.hasProperty(changes, 'active') ||
			foundry.utils.hasProperty(changes, 'turn') ||
			foundry.utils.hasProperty(changes, 'round')
		) {
			scheduleSync();
		}
	});

	Hooks.on('createCombatant', scheduleSync);
	Hooks.on('deleteCombatant', scheduleSync);

	Hooks.on('deleteCombat', (combat: Combat.Implementation) => {
		void clearAdjacencyForCombat(combat);
	});

	Hooks.on('canvasReady', scheduleSync);
}

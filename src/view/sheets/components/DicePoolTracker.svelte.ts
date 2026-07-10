import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { systemHookName } from '#system';
import { rollChargeDie } from '#utils/chargePool/chargePoolRoll.js';
import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
import type { ChargePoolState } from '#utils/chargePool/types.js';
import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { rollDieIntoPool, setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { dieSizeToMaxFace } from '#utils/dicePool/helpers.js';
import type { DicePoolState, DieSize } from '#utils/dicePool/types.js';

const POOL_STATE_HOOK_NAMES = [
	systemHookName('dicePool.changed'),
	systemHookName('dicePool.refilled'),
	systemHookName('chargePool.changed'),
	systemHookName('chargePool.recovered'),
	'updateItem',
	'updateActor',
] as const;

function registerPoolStateHooks(listener: () => void): () => void {
	const hooksApi = Hooks as unknown as {
		on: (hook: string, listener: () => void) => number;
		off: (hook: string, id: number) => void;
	};

	const hookIds = POOL_STATE_HOOK_NAMES.map((hookName) => ({
		hookName,
		hookId: hooksApi.on(hookName, listener),
	}));

	return () => {
		for (const { hookName, hookId } of hookIds) {
			hooksApi.off(hookName, hookId);
		}
	};
}

// ============================================================================
// Types
// ============================================================================

type RolledPoolView = {
	kind: 'rolled';
	id: string;
	identifier: string;
	label: string;
	dieSize: string;
	max: number;
	faces: number[];
	total: number;
	hasConsumers: boolean;
};

type CountPoolView = {
	kind: 'count';
	id: string;
	identifier: string;
	label: string;
	dieSize: string | null;
	max: number;
	current: number;
};

export type LivePoolView = RolledPoolView | CountPoolView;

// Die-face icons live in #utils/dicePool/dieFaceIcons.js (see DicePoolTracker.svelte).

function rolledFromDice(pool: DicePoolState, hasConsumers: boolean): RolledPoolView {
	const total = pool.faces.reduce((sum, face) => sum + face, 0);
	return {
		kind: 'rolled',
		id: pool.id,
		identifier: pool.identifier,
		label: pool.label,
		dieSize: pool.dieSize,
		max: pool.max,
		faces: [...pool.faces],
		total,
		hasConsumers,
	};
}

function countFromCharge(pool: ChargePoolState): CountPoolView {
	return {
		kind: 'count',
		id: pool.id,
		identifier: pool.identifier,
		label: pool.label,
		dieSize: pool.dieSize,
		max: pool.max,
		current: pool.current,
	};
}

// ============================================================================
// State Factory
// ============================================================================

export function createDicePoolTrackerState(getActor: () => NimbleCharacter) {
	const subscribePoolState = createSubscriber(registerPoolStateHooks);

	const pools = $derived.by((): LivePoolView[] => {
		subscribePoolState();
		const actor = getActor();

		const dice = getDicePools(actor).map((pool) =>
			rolledFromDice(pool, getDicePoolConsumers(actor, pool).length > 0),
		);
		// Charge pools without a `dieSize` are pure counters and are already
		// rendered by ChargeIndicator elsewhere on the sheet. Only surface
		// charge pools that have a die-size hint (roll-on-spend resources like
		// Commander Combat Dice / Artificer Mana Dice).
		const charge = getChargePools(actor)
			.filter((p) => p.dieSize != null)
			.map(countFromCharge);

		return [...dice, ...charge];
	});

	const hasPools = $derived(
		pools.some((p) => {
			if (p.kind === 'rolled') return p.max > 0;
			// Counted (roll-on-spend) pools have pips that are interesting to see
			// even when at max — they are the player's spend buttons. Show whenever
			// the pool has any capacity defined.
			return p.max > 0;
		}),
	);

	// ============================================================================
	// Actions
	// ============================================================================

	/** Discard one rolled die from a pool by index (no game effect). */
	async function discardRolledDie(poolId: string, dieIndex: number): Promise<void> {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool || pool.kind !== 'rolled') return;
		const next = [...pool.faces];
		next.splice(dieIndex, 1);
		await setPoolFaces(getActor(), poolId, next);
	}

	/** Clear all faces from a rolled pool (sum-and-discard UX). */
	async function discardAllRolled(poolId: string): Promise<void> {
		await setPoolFaces(getActor(), poolId, []);
	}

	/** Roll a die from a count pool, decrementing the count by one. */
	async function rollAndSpendCountPool(pool: CountPoolView): Promise<void> {
		if (pool.current < 1) return;
		await rollChargeDie(getActor(), pool.id, { flavor: pool.label });
	}

	/** Set a single die face value (GM/owner inline edit). Clamps to 1..max. */
	async function setDieFaceValue(poolId: string, dieIndex: number, value: number): Promise<void> {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool || pool.kind !== 'rolled') return;
		if (dieIndex < 0 || dieIndex >= pool.faces.length) return;
		const maxFace = dieSizeToMaxFace(pool.dieSize as DieSize);
		const clamped = Math.max(1, Math.min(maxFace, Math.floor(value)));
		const next = [...pool.faces];
		next[dieIndex] = clamped;
		await setPoolFaces(getActor(), poolId, next);
	}

	/** Roll one die into a rolled pool (owner action). Delegates to dicePoolRefill. */
	async function rollOneIntoPool(poolId: string): Promise<void> {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool || pool.kind !== 'rolled') return;
		await rollDieIntoPool(getActor(), poolId, { flavor: pool.label });
	}

	// Per-pool panel open-state. Multiple panels may be open simultaneously;
	// each chevron toggles its pool's entry in this set.
	let openPanelIds = $state<Set<string>>(new Set());

	function isPanelOpen(poolId: string): boolean {
		return openPanelIds.has(poolId);
	}

	function togglePanel(poolId: string): void {
		const next = new Set(openPanelIds);
		if (next.has(poolId)) next.delete(poolId);
		else next.add(poolId);
		openPanelIds = next;
	}

	function closePanel(poolId: string): void {
		if (!openPanelIds.has(poolId)) return;
		const next = new Set(openPanelIds);
		next.delete(poolId);
		openPanelIds = next;
	}

	return {
		get pools() {
			return pools;
		},
		get hasPools() {
			return hasPools;
		},
		get isOwner() {
			return getActor().isOwner === true;
		},
		discardRolledDie,
		discardAllRolled,
		rollAndSpendCountPool,
		setDieFaceValue,
		rollOneIntoPool,
		isPanelOpen,
		togglePanel,
		closePanel,
	};
}

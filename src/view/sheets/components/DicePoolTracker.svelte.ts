import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { rollChargeDie } from '#utils/chargePool/chargePoolRoll.js';
import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
import type { ChargePoolState } from '#utils/chargePool/types.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import type { DicePoolState } from '#utils/dicePool/types.js';

const POOL_STATE_HOOK_NAMES = [
	'nimble.dicePool.changed',
	'nimble.dicePool.refilled',
	'nimble.chargePool.changed',
	'nimble.chargePool.recovered',
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

// ============================================================================
// Die Face Icons
// ============================================================================

const DIE_FACE_ICONS: Record<string, string> = {
	d4: 'fa-dice-d4',
	d6: 'fa-dice-d6',
	d8: 'fa-dice-d8',
	d10: 'fa-dice-d10',
	d12: 'fa-dice-d12',
	d20: 'fa-dice-d20',
};

export function getDieFaceIcon(dieSize: string | null | undefined): string {
	if (!dieSize) return 'fa-dice-d6';
	return DIE_FACE_ICONS[dieSize] ?? 'fa-dice-d6';
}

function rolledFromDice(pool: DicePoolState): RolledPoolView {
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

		const dice = getDicePools(actor).map(rolledFromDice);
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

	/** Spend one rolled die from a pool by index. */
	async function expendRolledDie(poolId: string, dieIndex: number): Promise<void> {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool || pool.kind !== 'rolled') return;
		const next = [...pool.faces];
		next.splice(dieIndex, 1);
		await setPoolFaces(getActor(), poolId, next);
	}

	/** Clear all faces from a rolled pool (used by sum-and-expend UX). */
	async function expendAllRolled(poolId: string): Promise<void> {
		await setPoolFaces(getActor(), poolId, []);
	}

	/** Roll a die from a count pool, decrementing the count by one. */
	async function rollAndSpendCountPool(pool: CountPoolView): Promise<void> {
		if (pool.current < 1) return;
		await rollChargeDie(getActor(), pool.id, { flavor: pool.label });
	}

	return {
		get pools() {
			return pools;
		},
		get hasPools() {
			return hasPools;
		},
		expendRolledDie,
		expendAllRolled,
		rollAndSpendCountPool,
	};
}

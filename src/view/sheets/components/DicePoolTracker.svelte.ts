import type { NimbleCharacter } from '#documents/actor/character.js';
import type { DicePoolEntry } from '../../../models/rules/dicePool.js';

// ============================================================================
// Types
// ============================================================================

export interface LiveDicePool extends DicePoolEntry {
	current: number;
	/** Populated only for poolMode === 'individual': the individual rolled die values. */
	dice: number[];
}

// ============================================================================
// Die Face Icons
// ============================================================================

const DIE_FACE_ICONS: Record<number, string> = {
	4: 'fa-dice-d4',
	6: 'fa-dice-d6',
	8: 'fa-dice-d8',
	10: 'fa-dice-d10',
	12: 'fa-dice-d12',
	20: 'fa-dice-d20',
};

export function getDieFaceIcon(faces: number): string {
	return DIE_FACE_ICONS[faces] ?? 'fa-dice-d6';
}

// ============================================================================
// State Factory
// ============================================================================

export function createDicePoolTrackerState(getActor: () => NimbleCharacter) {
	// ============================================================================
	// Dice Pool State
	// ============================================================================

	const dicePools = $derived.by((): LiveDicePool[] => {
		const actor = getActor();
		const actorPools = ((actor.reactive as any)?.dicePools ?? {}) as Record<string, DicePoolEntry>;
		const flagPools = ((actor.reactive?.flags as any)?.nimble?.dicePools ?? {}) as Record<
			string,
			{ current?: number; dice?: number[] }
		>;

		return Object.values(actorPools).map((pool) => {
			const flagPool = flagPools[pool.identifier] ?? {};
			if (pool.poolMode === 'individual') {
				const dice = (flagPool.dice as number[] | undefined) ?? [];
				return {
					...pool,
					current: dice.reduce((sum, v) => sum + v, 0),
					dice,
				};
			}
			return {
				...pool,
				current: flagPool.current ?? 0,
				dice: [],
			};
		});
	});

	// Individual pools hide when no dice are rolled (nothing to show).
	// Resource pools show while in combat (empty pips stay visible) or when pips remain.
	// Accumulate/store always expose the roll badge.
	const hasDicePools = $derived(
		dicePools.some((p) => {
			if (p.poolMode === 'individual') return p.dice.length > 0;
			if (p.poolMode === 'resource') {
				return p.current > 0 || Boolean((getActor() as any).inCombat);
			}
			return true;
		}),
	);

	// ============================================================================
	// Actions
	// ============================================================================

	async function setPoolCurrent(identifier: string, newValue: number): Promise<void> {
		const actor = getActor();
		const update: Record<string, unknown> = {};
		foundry.utils.setProperty(update, `flags.nimble.dicePools.${identifier}.current`, newValue);
		await actor.update(update);
	}

	async function handlePoolPipClick(
		identifier: string,
		_index: number,
		isAvailable: boolean,
	): Promise<void> {
		const pool = dicePools.find((p) => p.identifier === identifier);
		if (!pool) return;

		if (isAvailable) {
			const actor = getActor();
			const roll = new Roll(`1d${pool.faces}`);
			await roll.evaluate();
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: pool.label,
			});
			await setPoolCurrent(identifier, Math.max(0, pool.current - 1));
		} else {
			await setPoolCurrent(identifier, Math.min(pool.max, pool.current + 1));
		}
	}

	async function rollPool(pool: LiveDicePool): Promise<void> {
		const actor = getActor();

		if (pool.poolMode === 'accumulate') {
			// Roll one die and add the result to the running total.
			const roll = new Roll(`1d${pool.faces}`);
			await roll.evaluate();
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: pool.label,
			});
			const newTotal = pool.current + (roll.total ?? 0);
			await setPoolCurrent(pool.identifier, newTotal);
			return;
		}

		if (pool.poolMode === 'store') {
			// Roll the full pool and store the total, replacing any existing value.
			const roll = new Roll(`${pool.max}d${pool.faces}`);
			await roll.evaluate();
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: pool.label,
			});
			await setPoolCurrent(pool.identifier, roll.total ?? 0);
			return;
		}
	}

	async function expendPool(identifier: string): Promise<void> {
		await setPoolCurrent(identifier, 0);
	}

	/** Spend one individual die by index, removing it from the pool. */
	async function spendDie(identifier: string, dieIndex: number): Promise<void> {
		const pool = dicePools.find((p) => p.identifier === identifier);
		if (!pool || pool.poolMode !== 'individual') return;
		const newDice = [...pool.dice];
		newDice.splice(dieIndex, 1);
		const actor = getActor();
		const update: Record<string, unknown> = {};
		foundry.utils.setProperty(update, `flags.nimble.dicePools.${identifier}.dice`, newDice);
		await actor.update(update);
	}

	// ============================================================================
	// Return Public Interface
	// ============================================================================

	return {
		get dicePools() {
			return dicePools;
		},
		get hasDicePools() {
			return hasDicePools;
		},
		handlePoolPipClick,
		rollPool,
		expendPool,
		spendDie,
	};
}

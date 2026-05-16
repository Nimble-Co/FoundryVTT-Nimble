import { emitForCharacter } from './dicePoolHooks.js';
import {
	areDicePoolMapsEqual,
	buildEffectiveDicePoolMap,
	dieSizeToMaxFace,
	isCharacterActor,
	persistDicePoolMap,
	resolveFormulaToInteger,
	rollSingleDieFace,
} from './helpers.js';
import type {
	CharacterActorLike,
	DicePoolMap,
	DicePoolState,
	DiceRefillTrigger,
	DiceRestType,
} from './types.js';

type RefilledEntry = {
	poolId: string;
	poolLabel: string;
	previousFaces: number[];
	newFaces: number[];
	rolledFaces: number[];
	trigger: DiceRefillTrigger;
};

/**
 * Apply each pool's matching refill entries for the given triggers.
 * Returns the next state plus a per-pool diff describing what was rolled.
 */
async function applyRefillTriggersToPools(
	actor: CharacterActorLike,
	pools: DicePoolMap,
	triggers: DiceRefillTrigger[],
): Promise<{ nextPools: DicePoolMap; entries: RefilledEntry[] }> {
	if (triggers.length < 1) return { nextPools: pools, entries: [] };

	const triggerSet = new Set(triggers);
	const nextPools = foundry.utils.deepClone(pools) as DicePoolMap;
	const entries: RefilledEntry[] = [];

	for (const pool of Object.values(nextPools) as DicePoolState[]) {
		const previousFaces = [...pool.faces];
		const rolledFaces: number[] = [];
		let matchingTrigger: DiceRefillTrigger | null = null;

		for (const refill of pool.refills) {
			if (!triggerSet.has(refill.trigger)) continue;
			matchingTrigger = refill.trigger;

			if (refill.mode === 'refresh') {
				const needed = pool.max - pool.faces.length;
				for (let index = 0; index < needed; index += 1) {
					const face = await rollSingleDieFace(pool.dieSize);
					pool.faces.push(face);
					rolledFaces.push(face);
				}
				continue;
			}

			const amount = resolveFormulaToInteger(actor, refill.value);
			if (refill.mode === 'set') {
				const target = Math.min(amount, pool.max);
				// 'set' rebuilds the pool to exactly `target` freshly-rolled dice.
				pool.faces.length = 0;
				for (let index = 0; index < target; index += 1) {
					const face = await rollSingleDieFace(pool.dieSize);
					pool.faces.push(face);
					rolledFaces.push(face);
				}
				continue;
			}

			// 'add' mode — push N new dice up to max.
			const room = pool.max - pool.faces.length;
			const toAdd = Math.max(0, Math.min(amount, room));
			for (let index = 0; index < toAdd; index += 1) {
				const face = await rollSingleDieFace(pool.dieSize);
				pool.faces.push(face);
				rolledFaces.push(face);
			}
		}

		if (rolledFaces.length > 0 || pool.faces.length !== previousFaces.length) {
			entries.push({
				poolId: pool.id,
				poolLabel: pool.label,
				previousFaces,
				newFaces: [...pool.faces],
				rolledFaces,
				trigger: matchingTrigger ?? triggers[0],
			});
		}
	}

	return { nextPools, entries };
}

/**
 * Empty (clear all faces from) every pool whose refills match the given clear triggers.
 * Some pools (e.g. Berserker Fury Dice) wipe at the end of a state, not refill.
 * For the MVP we only implement refill semantics; clear-on-trigger lives with
 * consumer rules (e.g. Rage end-state) when they land.
 */

async function applyRestRefill(
	actor: Actor | null | undefined,
	restType: DiceRestType,
): Promise<void> {
	if (!isCharacterActor(actor)) return;
	const trigger: DiceRefillTrigger = restType === 'safe' ? 'safeRest' : 'fieldRest';

	const currentPools = buildEffectiveDicePoolMap(actor);
	const { nextPools, entries } = await applyRefillTriggersToPools(actor, currentPools, [trigger]);
	if (areDicePoolMapsEqual(currentPools, nextPools)) return;

	await persistDicePoolMap(actor, nextPools);
	emitRefillEvents(actor, entries, trigger);
}

async function applyEncounterRefill(
	actor: Actor | null | undefined,
	encounterTrigger: 'encounterStart' | 'encounterEnd',
): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const currentPools = buildEffectiveDicePoolMap(actor);
	const { nextPools, entries } = await applyRefillTriggersToPools(actor, currentPools, [
		encounterTrigger,
	]);
	if (areDicePoolMapsEqual(currentPools, nextPools)) return;

	await persistDicePoolMap(actor, nextPools);
	emitRefillEvents(actor, entries, encounterTrigger);
}

async function applyRefillToActorIfEligible(
	actor: Actor | null | undefined,
	trigger: DiceRefillTrigger,
): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const currentPools = buildEffectiveDicePoolMap(actor);
	const { nextPools, entries } = await applyRefillTriggersToPools(actor, currentPools, [trigger]);
	if (areDicePoolMapsEqual(currentPools, nextPools)) return;

	await persistDicePoolMap(actor, nextPools);
	emitRefillEvents(actor, entries, trigger);
}

function emitRefillEvents(
	actor: CharacterActorLike,
	entries: RefilledEntry[],
	trigger: DiceRefillTrigger,
): void {
	if (entries.length < 1) return;

	emitForCharacter(actor, 'refilled', {
		actor,
		trigger,
		refill: entries,
	});

	for (const entry of entries) {
		emitForCharacter(actor, 'changed', {
			actor,
			poolId: entry.poolId,
			poolLabel: entry.poolLabel,
			previousFaces: entry.previousFaces,
			newFaces: entry.newFaces,
			reason: 'refill',
			trigger: entry.trigger,
		});
	}
}

/**
 * Manually adjust a pool's faces (GM tool or sheet UI). Operates on a single pool by id.
 * Pass an explicit `faces` array to overwrite, or null to clear.
 */
async function setPoolFaces(
	actor: Actor | null | undefined,
	poolId: string,
	faces: number[] | null,
): Promise<boolean> {
	if (!isCharacterActor(actor)) return false;
	if (typeof poolId !== 'string' || poolId.length < 1) return false;

	const currentPools = buildEffectiveDicePoolMap(actor);
	const pool = currentPools[poolId];
	if (!pool) return false;

	const previousFaces = [...pool.faces];
	if (faces === null) {
		pool.faces = [];
	} else {
		const maxFace = dieSizeToMaxFace(pool.dieSize);
		pool.faces = faces
			.slice(0, pool.max)
			.map((face) => Math.max(1, Math.min(maxFace, Math.floor(face))));
	}

	await persistDicePoolMap(actor, currentPools);

	emitForCharacter(actor, 'changed', {
		actor,
		poolId,
		poolLabel: pool.label,
		previousFaces,
		newFaces: [...pool.faces],
		reason: 'manual',
		trigger: 'manual',
	});

	return true;
}

export {
	applyEncounterRefill,
	applyRefillToActorIfEligible,
	applyRefillTriggersToPools,
	applyRestRefill,
	setPoolFaces,
};
export type { RefilledEntry };

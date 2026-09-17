import type { EquipmentActor } from './weaponHands.js';

/**
 * "A hero can sheathe weapons or shields they are proficient with and equip a
 * different one for free 1/round." Commander Weapon Mastery raises this to 2
 * through the `equipmentSwapBonus` rule.
 */
export const BASE_EQUIPMENT_SWAPS_PER_ROUND = 1;

export const EQUIPMENT_SWAP_BONUS_PATH = 'attributes.equipmentSwapBonus';

interface SwapTrackingCombatant {
	id: string | null;
	type: string;
	system: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface SwapTrackingCombat {
	round: number;
	combatants: { find(predicate: (entry: any) => boolean): any };
}

function getSpentThisRound(combatant: SwapTrackingCombatant, round: number): number {
	const tracked = (combatant.system as { equipmentSwaps?: { round?: number; spent?: number } })
		?.equipmentSwaps;
	if (!tracked || tracked.round !== round) return 0;
	return Math.max(0, Number(tracked.spent) || 0);
}

export function getEquipmentSwapMax(actor: EquipmentActor): number {
	const bonus = Number(actor.system.attributes?.equipmentSwapBonus ?? 0);
	return Math.max(0, BASE_EQUIPMENT_SWAPS_PER_ROUND + (Number.isFinite(bonus) ? bonus : 0));
}

/**
 * Swaps left this round. Rounds only exist in combat, so a character who is
 * not in a started combat is never budgeted.
 */
export function getEquipmentSwapsRemaining(
	actor: EquipmentActor,
	combatant: SwapTrackingCombatant | null,
	combat: SwapTrackingCombat | null,
): number {
	if (!combat || !combatant || combatant.type !== 'character') return Number.POSITIVE_INFINITY;
	return Math.max(0, getEquipmentSwapMax(actor) - getSpentThisRound(combatant, combat.round));
}

export async function spendEquipmentSwap(
	combatant: SwapTrackingCombatant | null,
	combat: SwapTrackingCombat | null,
): Promise<void> {
	if (!combat || !combatant || combatant.type !== 'character') return;
	await combatant.update({
		'system.equipmentSwaps.round': combat.round,
		'system.equipmentSwaps.spent': getSpentThisRound(combatant, combat.round) + 1,
	});
}

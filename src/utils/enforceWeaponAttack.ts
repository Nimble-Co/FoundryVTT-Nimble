import { spendEquipmentSwap } from './equipmentSwaps.js';
import localize from './localize.js';
import { checkWeaponAttack, type WeaponAttackCheck } from './weaponAttackLegality.js';
import type { EquipmentActor, HandItem } from './weaponHands.js';

interface AttackingActor extends EquipmentActor {
	id: string | null;
	updateItem(id: string, data: Record<string, unknown>): Promise<unknown>;
}

function findCombatant(actorId: string | null) {
	const combat = (game.combat as Combat.Implementation | null) ?? null;
	if (!combat?.started || !actorId) return { combat: null, combatant: null };
	return {
		combat,
		combatant: combat.combatants.find((entry) => entry.actorId === actorId) ?? null,
	};
}

function notifyRefusal(weapon: HandItem, check: WeaponAttackCheck): void {
	if (!check.refusal) return;
	ui.notifications?.warn(
		localize(`NIMBLE.weapons.refusals.${check.refusal}`, {
			name: weapon.name ?? '',
			value: String(check.strengthRequired ?? 0),
		}),
	);
}

async function chooseItemToSheathe(candidates: HandItem[]): Promise<HandItem | null> {
	if (candidates.length === 1) return candidates[0];

	const chosenId = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.weapons.swaps.choosePrompt') },
		content: '',
		buttons: candidates.map((item) => ({
			action: item.id ?? '',
			label: item.name ?? '',
		})),
		rejectClose: false,
	} as never);

	return candidates.find((item) => item.id === chosenId) ?? null;
}

/**
 * The single gate every weapon attack passes through. Refuses with a localized
 * notification naming the condition that failed, and where the attack is legal
 * but needs a hand, performs the free sheathe inline so the player never has to
 * open the inventory to attack.
 *
 * @returns whether the attack may proceed.
 */
export default async function enforceWeaponAttack(
	actor: AttackingActor,
	weapon: HandItem,
): Promise<boolean> {
	const { combat, combatant } = findCombatant(actor.id);
	const check = checkWeaponAttack(actor, weapon, { combat, combatant });

	if (!check.allowed) {
		notifyRefusal(weapon, check);
		return false;
	}

	if (!check.requiresSwap) return true;

	const toSheathe = await chooseItemToSheathe(check.sheatheCandidates);
	if (!toSheathe) return false;

	await actor.updateItem(toSheathe.id ?? '', { 'system.equipped': false });
	await spendEquipmentSwap(combatant, combat);
	ui.notifications?.info(localize('NIMBLE.weapons.swaps.sheathed', { name: toSheathe.name ?? '' }));

	return true;
}

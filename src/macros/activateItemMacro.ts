import { getActiveCombatForCurrentScene } from '../utils/combatState.js';

interface ActivationCost {
	type: string;
	quantity: number;
}

interface ItemActivationSystem {
	activation?: {
		cost?: ActivationCost;
	};
}

/**
 * The function called by macros created by dragging an item to the macro hot bar.
 *
 * @param {string} itemName  The name of the owned item to be activated.
 * @returns {Promise}
 */
export async function activateItemMacro(itemName: string) {
	const speaker = ChatMessage.getSpeaker();

	let actor: Actor | undefined;
	if (speaker.token) actor = game.actors.tokens[speaker.token as string];
	if (!actor && speaker.actor) actor = game.actors.get(speaker.actor as string) ?? undefined;

	// Get matching items
	const items = actor ? actor.items.filter((item) => item.name === itemName) : [];

	if (items.length > 1) {
		ui.notifications.warn(
			`Your controlled Actor ${actor?.name} has more than one Item with name ${itemName}. The first matched item will be chosen.`,
		);
	} else if (items.length === 0) {
		return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);
	}

	const item = items[0] as Item & { activate(): Promise<unknown> };
	const result = await item.activate();

	// If activation was successful and item has an action cost, deduct action pips
	if (result) {
		const itemSystem = item.system as unknown as ItemActivationSystem;
		const activationCost = itemSystem?.activation?.cost;
		if (activationCost?.type === 'action') {
			await deductActionPips(actor!, activationCost.quantity ?? 1);
		}
	}

	return result;
}

/**
 * Deducts action pips from the actor's combatant in the current combat.
 */
async function deductActionPips(actor: Actor, count: number): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	if (!combat) return;

	const combatant = combat.combatants.find((c) => c.actorId === actor.id);
	if (!combatant || combatant.initiative === null) return;

	// @ts-expect-error - combatant.system is not typed
	const currentActions = combatant.system?.actions?.base?.current ?? 0;
	if (currentActions > 0) {
		const newValue = Math.max(0, currentActions - count);
		await combatant.update({ 'system.actions.base.current': newValue } as Record<string, unknown>);
	}
}

/**
 * The function called by macros created by dragging an item to the macro hot bar.
 *
 * @param {string} itemName  The name of the owned item to be activated.
 * @returns {Promise}
 */
export function activateItemMacro(itemName: string) {
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

	const item = items[0] as object as { activate(): Promise<void> };
	return item.activate();
}

// Interface for item document from UUID
interface ItemDocument {
	name: string;
	img: string;
	parent: Actor | null;
}

export async function createMacro(data: { uuid: string }, slot: number): Promise<void> {
	const item = (await fromUuid(data.uuid as `Item.${string}`)) as ItemDocument | null;

	if (!item || item.parent === null) {
		ui.notifications.warn(game.i18n.localize('Cannot Create Macros for unowned Items'));
		return;
	}

	// Create the macro command
	const command = `game.nimble.macros.activateItemMacro("${item.name}")`;

	let macro = game.macros.find((m) => {
		const sameCommand = m.name === item.name && m.command === command;
		const perms = m.ownership?.default === 3 || m.ownership?.[game.user?.id ?? ''] === 3;

		return sameCommand && perms;
	}) as Macro | undefined;

	if (!macro) {
		macro = (await Macro.create({
			name: item.name,
			type: 'script',
			scope: 'actor',
			img: item.img,
			command: command,
			flags: {
				nimble: {
					itemUuid: data.uuid,
					itemMacro: true,
				},
			} as Record<string, unknown>,
		})) as Macro | undefined;
	}

	if (macro) {
		await game.user?.assignHotbarMacro(macro, slot);
	}
}

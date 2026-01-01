export async function createMacro(data: { uuid: string }, slot: number) {
	const item = await fromUuid(data.uuid as `Item.${string}`);

	if (!item || foundry.utils.isEmpty(item) || item.parent === null) {
		ui.notifications.warn(game.i18n.localize('Cannot Create Macros for unowned Items'));
		return;
	}

	// Create the macro command
	const command = `game.nimble.macros.activateItemMacro("${item.name}")`;

	let macro: Macro | undefined = game.macros.find((m) => {
		const sameCommand = m.name === item.name && m.command === command;
		const perms = m.ownership?.default === 3 || m.ownership?.[game.user!.id] === 3;

		return sameCommand && perms;
	});

	if (!macro) {
		macro =
			(await Macro.create({
				name: item.name ?? 'Unknown',
				type: 'script',
				scope: 'actor',
				img: (item as Item).img,
				command: command,
				flags: {
					nimble: {
						itemUuid: data.uuid,
						itemMacro: true,
					},
				} as Macro.CreateData['flags'],
			})) ?? undefined;
	}

	if (macro) {
		await game.user!.assignHotbarMacro(macro, slot);
	}
}

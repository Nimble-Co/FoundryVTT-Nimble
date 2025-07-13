export async function createMacro(data: { uuid: string }, slot) {
	const item = await fromUuid(data.uuid);

	if (foundry.utils.isEmpty(item) || item.parent === null) {
		return ui.notifications.warn(game.i18n.localize('Cannot Create Macros for unowned Items'));
	}

	// Create the macro command
	const command = `game.nimble.macros.activateItemMacro("${item.name}")`;

	let macro = game.macros.find((m) => {
		const sameCommand = m.name === item.name && m.command === command;
		const perms = m.ownership?.default === 3 || m.ownership?.[game.user.id] === 3;

		return sameCommand && perms;
	});

	if (!macro) {
		macro = await Macro.create({
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
			},
		});
	}

	await game.user.assignHotbarMacro(macro, slot);
}

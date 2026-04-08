interface HeroicActionMacroData {
	actionId: string;
	actionType: 'action' | 'reaction';
	name: string;
}

function getActionIcon(actionId: string): string {
	const iconMap: Record<string, string> = {
		attack: 'icons/svg/sword.svg',
		spell: 'icons/svg/lightning.svg',
		move: 'icons/svg/wingfoot.svg',
		assess: 'icons/svg/eye.svg',
		defend: 'icons/svg/shield.svg',
		interpose: 'icons/svg/angel.svg',
		opportunity: 'icons/svg/target.svg',
		help: 'icons/svg/upgrade.svg',
		interposeAndDefend: 'icons/svg/combat.svg',
		unarmedStrike: 'icons/skills/melee/unarmed-punch-fist.webp',
	};
	return iconMap[actionId] ?? 'systems/nimble/assets/icons/d20.svg';
}

export async function createHeroicActionMacro(data: HeroicActionMacroData, slot: number) {
	const command = `game.nimble.macros.activateHeroicActionMacro("${data.actionId}", "${data.actionType}")`;
	const expectedIcon = getActionIcon(data.actionId);

	let macro: Macro | undefined = game.macros.find((m) => {
		const sameCommand = m.command === command;
		const perms =
			m.ownership?.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER ||
			m.ownership?.[game.user!.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

		return sameCommand && perms;
	});

	if (!macro) {
		macro =
			(await Macro.create({
				name: data.name,
				type: 'script',
				scope: 'actor',
				img: expectedIcon,
				command: command,
				flags: {
					nimble: {
						heroicActionMacro: true,
						actionId: data.actionId,
						actionType: data.actionType,
					},
				} as Macro.CreateData['flags'],
			})) ?? undefined;
	} else if (macro.img !== expectedIcon && macro.isOwner) {
		// Update icon if it changed (e.g., was previously broken)
		await macro.update({ img: expectedIcon });
	}

	if (macro) {
		await game.user!.assignHotbarMacro(macro, slot);
	}
}

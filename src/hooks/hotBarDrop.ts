export function hotbarDrop(_, data, slot) {
	if (data.type === 'Item') {
		game.nimble.macros.createMacro(data, slot);
		return false;
	}
	if (data.type === 'HeroicAction') {
		game.nimble.macros.createHeroicActionMacro(data, slot);
		return false;
	}
}

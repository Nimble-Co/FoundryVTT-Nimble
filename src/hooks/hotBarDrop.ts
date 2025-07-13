export function hotbarDrop(_, data, slot) {
	if (data.type === 'Item') {
		game.nimble.macros.createMacro(data, slot);
		return false;
	}
}

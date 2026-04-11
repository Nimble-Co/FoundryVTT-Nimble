interface HotbarDropData {
	type?: string;
	uuid?: string;
	actionId?: string;
	actionType?: 'action' | 'reaction';
	name?: string;
}

export function hotbarDrop(_bar: unknown, data: unknown, slot: number): false | undefined {
	const dropData = data as HotbarDropData;
	if (dropData.type === 'Item') {
		game.nimble.macros.createMacro(dropData as { uuid: string }, slot);
		return false;
	}
	if (dropData.type === 'HeroicAction') {
		game.nimble.macros.createHeroicActionMacro(
			dropData as { actionId: string; actionType: 'action' | 'reaction'; name: string },
			slot,
		);
		return false;
	}
}

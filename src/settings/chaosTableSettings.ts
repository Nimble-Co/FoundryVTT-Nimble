import { SYSTEM_ID } from '#system';

export const SHOW_CHAOS_TABLE_ROLLS_SETTING_KEY = 'showChaosTableRolls';

export function registerChaosTableSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		SHOW_CHAOS_TABLE_ROLLS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.showChaosTableRolls.name',
			hint: 'NIMBLE.settings.showChaosTableRolls.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

/** Whether a Chaos card shows the table text to all, or only a number with the text to the GM. */
export function showsChaosTableRolls(): boolean {
	return (
		game.settings.get(SYSTEM_ID as 'core', SHOW_CHAOS_TABLE_ROLLS_SETTING_KEY as 'rollMode') ===
		(true as never)
	);
}

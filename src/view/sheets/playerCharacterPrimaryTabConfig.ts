export const PLAYER_CHARACTER_PRIMARY_TAB_NAMES = [
	'core',
	'conditions',
	'inventory',
	'features',
	'spells',
	'bio',
	'settings',
] as const;

export type PrimaryTabName = (typeof PLAYER_CHARACTER_PRIMARY_TAB_NAMES)[number];

export const DEFAULT_PRIMARY_TAB: PrimaryTabName = 'features';

export const ITEM_TYPE_TO_PRIMARY_TAB: Partial<Record<string, PrimaryTabName>> = {
	object: 'inventory',
	spell: 'spells',
};

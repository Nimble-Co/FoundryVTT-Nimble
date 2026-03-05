import PlayerCharacterBioTab from './pages/PlayerCharacterBioTab.svelte';
import PlayerCharacterConditionsTab from './pages/PlayerCharacterConditionsTab.svelte';
import PlayerCharacterCoreTab from './pages/PlayerCharacterCoreTab.svelte';
import PlayerCharacterFeaturesTab from './pages/PlayerCharacterFeaturesTab.svelte';
import PlayerCharacterInventoryTab from './pages/PlayerCharacterInventoryTab.svelte';
import PlayerCharacterSettingsTab from './pages/PlayerCharacterSettingsTab.svelte';
import PlayerCharacterSpellsTab from './pages/PlayerCharacterSpellsTab.svelte';

export const PLAYER_CHARACTER_PRIMARY_NAVIGATION = [
	{
		component: PlayerCharacterCoreTab,
		icon: 'fa-solid fa-home',
		tooltip: 'NIMBLE.ui.core',
		name: 'core',
	},
	{
		component: PlayerCharacterConditionsTab,
		icon: 'fa-solid fa-heart-pulse',
		tooltip: 'NIMBLE.ui.conditions',
		name: 'conditions',
	},
	{
		component: PlayerCharacterInventoryTab,
		icon: 'fa-solid fa-box-open',
		tooltip: 'NIMBLE.ui.inventory',
		name: 'inventory',
	},
	{
		component: PlayerCharacterFeaturesTab,
		icon: 'fa-solid fa-table-list',
		tooltip: 'NIMBLE.ui.features',
		name: 'features',
	},
	{
		component: PlayerCharacterSpellsTab,
		icon: 'fa-solid fa-wand-sparkles',
		tooltip: 'NIMBLE.ui.spells',
		name: 'spells',
	},
	{
		component: PlayerCharacterBioTab,
		icon: 'fa-solid fa-file-lines',
		tooltip: 'NIMBLE.ui.bio',
		name: 'bio',
	},
	{
		component: PlayerCharacterSettingsTab,
		icon: 'fa-solid fa-cog',
		tooltip: 'NIMBLE.ui.settings',
		name: 'settings',
	},
] as const;

export type PrimaryTabName = (typeof PLAYER_CHARACTER_PRIMARY_NAVIGATION)[number]['name'];

export const DEFAULT_PRIMARY_TAB: PrimaryTabName = 'features';

export const ITEM_TYPE_TO_PRIMARY_TAB: Partial<Record<string, PrimaryTabName>> = {
	object: 'inventory',
	spell: 'spells',
};

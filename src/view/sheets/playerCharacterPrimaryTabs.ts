import PlayerCharacterBioTab from './pages/PlayerCharacterBioTab.svelte';
import PlayerCharacterConditionsTab from './pages/PlayerCharacterConditionsTab.svelte';
import PlayerCharacterCoreTab from './pages/PlayerCharacterCoreTab.svelte';
import PlayerCharacterFeaturesTab from './pages/PlayerCharacterFeaturesTab.svelte';
import PlayerCharacterInventoryTab from './pages/PlayerCharacterInventoryTab.svelte';
import PlayerCharacterSettingsTab from './pages/PlayerCharacterSettingsTab.svelte';
import PlayerCharacterSpellsTab from './pages/PlayerCharacterSpellsTab.svelte';
import type { PrimaryTabName } from './playerCharacterPrimaryTabConfig.js';

export const PLAYER_CHARACTER_PRIMARY_NAVIGATION: Array<{
	component: unknown;
	icon: string;
	tooltip: string;
	name: PrimaryTabName;
}> = [
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
];

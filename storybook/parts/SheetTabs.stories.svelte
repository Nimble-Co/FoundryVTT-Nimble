<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SheetTabs from '#view/actorSheets/parts/SheetTabs.svelte';
	import type { SheetTab } from '#view/actorSheets/parts/types.ts';

	const character: SheetTab[] = [
		{ id: 'core', label: 'Core', icon: 'fa-solid fa-home' },
		{ id: 'actions', label: 'Actions', icon: 'fa-solid fa-bolt' },
		{ id: 'features', label: 'Features', icon: 'fa-solid fa-table-list' },
		{ id: 'inventory', label: 'Inventory', icon: 'fa-solid fa-box-open' },
		{ id: 'spells', label: 'Spells', icon: 'fa-solid fa-wand-sparkles' },
		{
			id: 'effects',
			label: 'Effects',
			icon: 'fa-solid fa-heart-pulse',
			badge: 2,
			badgeTitle: '2 conditions and effects on you now',
		},
		{ id: 'bio', label: 'Bio', icon: 'fa-solid fa-file-lines' },
		{ id: 'settings', label: 'Settings', icon: 'fa-solid fa-cog' },
	];
	const npc: SheetTab[] = [
		{ id: 'abilities', label: 'Abilities', icon: 'fa-solid fa-home' },
		{
			id: 'effects',
			label: 'Effects',
			icon: 'fa-solid fa-heart-pulse',
			badge: 1,
			badgeTitle: '1 condition on Dravok',
		},
		{ id: 'notes', label: 'Notes', icon: 'fa-solid fa-scroll' },
		{ id: 'settings', label: 'Settings', icon: 'fa-solid fa-cog' },
	];

	const { Story } = defineMeta({
		title: 'Parts/Sheet/SheetTabs',
		component: SheetTabs,
		args: { onchange: fn() },
	});
</script>

<Story
	name="Character tab bar"
	args={{ tabs: character, value: 'features', layout: 'top' }}
	parameters={{ width: '520px' }}
/>
<Story
	name="Character tab bar, inline"
	args={{ tabs: character, value: 'features', layout: 'top', fit: 'inline' }}
	parameters={{ width: '760px' }}
/>
<Story
	name="Character tab bar, icons"
	args={{ tabs: character, value: 'features', layout: 'top', fit: 'icon' }}
	parameters={{ width: '360px' }}
/>
<Story
	name="NPC rail"
	args={{ tabs: npc, value: 'abilities', layout: 'rail' }}
	parameters={{ chrome: true, width: '220px' }}
/>
<Story
	name="Phone strip"
	args={{ tabs: npc, value: 'effects', layout: 'strip' }}
	parameters={{ chrome: true, width: '390px' }}
/>

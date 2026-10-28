<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatBox from '#view/actorSheets/parts/StatBox.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rail/StatBox',
		component: StatBox,
		parameters: { chrome: true, width: '280px' },
	});
</script>

<Story
	name="Armor (NPC box)"
	args={{ icon: 'fa-solid fa-shield-halved', label: 'ARMOR', value: 'H' }}
/>
<Story
	name="Burrow (NPC box)"
	args={{ icon: 'fa-solid fa-circle-down', label: 'BURROW', value: 8, tooltip: 'Burrow speed 8' }}
/>
<Story
	name="Speed (character line)"
	args={{ variant: 'inline', icon: 'fa-solid fa-person-walking', label: 'SPEED', value: 5 }}
/>
<Story
	name="Slowed (character line)"
	args={{
		variant: 'inline',
		icon: 'fa-solid fa-person-walking',
		label: 'SPEED',
		value: 5,
		warn: 'Slowed: halved',
	}}
/>
<Story
	name="Bonus (character line)"
	args={{
		variant: 'inline',
		icon: 'fa-solid fa-person-walking',
		label: 'SPEED',
		value: 7,
		note: '+2',
	}}
/>

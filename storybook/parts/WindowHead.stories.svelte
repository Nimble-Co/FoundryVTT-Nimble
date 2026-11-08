<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';

	const { Story } = defineMeta({ title: 'Parts/Windows/WindowHead', component: WindowHead });
</script>

<Story name="Roll window" args={{ title: 'Strength Check', icon: 'fa-solid fa-dice-d20' }} />
<Story
	name="Item window"
	args={{
		title: 'Firebrand',
		img: 'assets/magicItems/PheonixHelm.webp',
		sub: 'Fire Utility Spell',
		tileLabel: 'Change Image',
		ontile: () => {},
	}}
/>

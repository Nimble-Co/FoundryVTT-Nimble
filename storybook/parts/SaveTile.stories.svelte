<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SaveTile from '#view/actorSheets/parts/SaveTile.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rail/SaveTile',
		component: SaveTile,
		parameters: { chrome: true, width: '280px' },
	});
</script>

<Story name="Plain" args={{ ability: 'STR', mod: '+3' }} />
<Story
	name="Advantage × 2"
	exportName="AdvantageTwo"
	args={{ ability: 'INT', mod: '+0', advantage: 2 }}
/>
<Story name="Disadvantage" args={{ ability: 'WIL', mod: '−1', advantage: -1 }} />
<Story name="Rolls on click" args={{ ability: 'DEX', mod: '+1', onclick: fn() }} />
<Story name="NPC rail" args={{ ability: 'STR', mod: '+0', stripTone: 'card' }} />
<Story name="The four saves" asChild>
	<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">
		<SaveTile ability="STR" mod="+3" onclick={fn()} />
		<SaveTile ability="DEX" mod="+1" onclick={fn()} />
		<SaveTile ability="INT" mod="+0" advantage={2} onclick={fn()} />
		<SaveTile ability="WIL" mod="−1" advantage={-1} onclick={fn()} />
	</div>
</Story>

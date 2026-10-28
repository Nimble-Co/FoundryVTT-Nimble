<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RowCost from '#view/actorSheets/parts/RowCost.svelte';

	const { Story } = defineMeta({ title: 'Parts/Rows/RowCost', component: RowCost });
</script>

<Story name="Uses and an action" args={{ uses: [{ left: 1, max: 1, per: 'turn' }], actions: 1 }} />
<Story
	name="Pool cost, free"
	args={{ pool: { kind: 'dice', icon: 'fa-solid fa-dice-d6', amount: '1-3' }, free: true }}
/>
<Story
	name="Mana, 1 of 2 actions spent"
	args={{
		pool: { kind: 'mana', icon: 'fa-solid fa-droplet', amount: 2 },
		actions: 2,
		actionsSpent: 1,
	}}
/>
<Story name="Each pool kind" asChild>
	<div style="display:flex;flex-direction:column;gap:8px">
		<RowCost pool={{ kind: 'mana', icon: 'fa-solid fa-droplet', amount: 2 }} />
		<RowCost pool={{ kind: 'dice', icon: 'fa-solid fa-dice-d6', amount: '1-3' }} />
		<RowCost pool={{ kind: 'charges', icon: 'fa-solid fa-dice', amount: 1 }} />
		<RowCost pool={{ kind: 'uses', icon: 'fa-solid fa-hand-holding-droplet', amount: 1 }} />
		<RowCost pool={{ kind: 'count', icon: 'fa-solid fa-paw', amount: 1 }} />
		<RowCost pool={{ kind: 'mana', icon: 'fa-solid fa-droplet', amount: 5, muted: true }} />
	</div>
</Story>
<Story
	name="Quantity, range, no uses left"
	args={{ text: 'x2', uses: [{ left: 0, max: 1, per: 'encounter' }], range: 'Range 8' }}
/>
<Story
	name="NPC card, compact"
	args={{
		uses: [{ left: 0, max: 1, per: 'encounter' }],
		range: 'Range 8',
		compact: true,
		outTone: 'ink',
	}}
/>

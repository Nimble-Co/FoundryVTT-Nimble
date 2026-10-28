<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import VitalPlate from '#view/actorSheets/parts/VitalPlate.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rail/VitalPlate',
		component: VitalPlate,
		args: { onchange: fn() },
		parameters: { chrome: true, width: '300px' },
	});
</script>

<script lang="ts">
	let hp = $state(38);
	let temp = $state(0);
	const word = $derived(hp <= 0 ? 'Dying' : hp <= 27 ? 'Bloodied' : undefined);
</script>

<Story name="HP" args={{ value: 38, max: 55 }} />
<Story name="Bloodied" args={{ value: 20, max: 55, state: 'Bloodied' }} />
<Story name="Dying" args={{ value: 0, max: 55, state: 'Dying', dying: true }} />
<Story name="Temp HP" args={{ temp: true, label: 'Temp HP', value: 0 }} />
<Story
	name="Block (character rail)"
	args={{ variant: 'block', value: 38, max: 55, icon: 'fa-solid fa-heart' }}
	parameters={{ width: '200px' }}
/>
<Story
	name="Block, Bloodied"
	args={{ variant: 'block', value: 20, max: 55, state: 'Bloodied', icon: 'fa-solid fa-heart' }}
	parameters={{ width: '200px' }}
/>
<Story
	name="Block, Dying"
	args={{ variant: 'block', value: 0, max: 55, state: 'Dying', dying: true }}
	parameters={{ width: '200px' }}
/>
<Story
	name="Block, compact"
	args={{ variant: 'block', compact: true, value: 38, max: 55 }}
	parameters={{ width: '160px' }}
/>
<Story name="Type a number" asChild>
	<div style="display:flex;gap:8px;align-items:flex-start">
		<VitalPlate value={hp} max={55} state={word} dying={hp <= 0} onchange={(v) => (hp = v)} />
		<VitalPlate temp label="Temp HP" value={temp} onchange={(v) => (temp = v)} />
	</div>
</Story>

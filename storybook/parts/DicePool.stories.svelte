<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import DicePool from '#view/actorSheets/parts/DicePool.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rail/DicePool',
		component: DicePool,
		args: {
			label: 'FURY DICE',
			kind: 'dice',
			die: 6,
			max: 3,
			icon: 'fa-solid fa-dice-d6',
			onremove: fn(),
			onadd: fn(),
		},
		parameters: { chrome: true, width: '280px' },
	});
</script>

<script lang="ts">
	let faces = $state([5, 3]);
</script>

<Story name="Two dice" args={{ faces: [5, 3] }} />
<Story name="Empty" args={{ faces: [] }} />
<Story name="Full" args={{ faces: [6, 2, 4] }} />
<Story name="Rail" args={{ faces: [5, 3], variant: 'rail' }} />
<Story name="Rail, idle" args={{ faces: [], variant: 'rail', idle: true }} />
<Story name="Rail, edit mode" args={{ faces: [5, 3], variant: 'rail', rest: true }} />
<Story
	name="Charges"
	args={{
		label: 'COMBAT DICE',
		kind: 'charges',
		die: 10,
		max: 4,
		faces: [7, 2],
		icon: 'fa-solid fa-dice',
	}}
/>
<Story name="Roll and remove" asChild>
	<DicePool
		label="FURY DICE"
		die={6}
		max={3}
		icon="fa-solid fa-dice-d6"
		{faces}
		onremove={() => (faces = faces.slice(0, -1))}
		onadd={() => (faces = [...faces, 1 + Math.floor(Math.random() * 6)])}
	/>
</Story>

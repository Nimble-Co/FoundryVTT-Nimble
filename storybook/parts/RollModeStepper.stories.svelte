<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import RollModeStepper from '#view/actorSheets/parts/RollModeStepper.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Sheet/RollModeStepper',
		component: RollModeStepper,
		args: { onchange: fn() },
		parameters: { width: '360px' },
	});
</script>

<Story name="Straight Roll" args={{ value: 0 }} />
<Story name="Advantage × 2" exportName="AdvantageTwo" args={{ value: 2 }} />
<Story name="Disadvantage × 1" exportName="DisadvantageOne" args={{ value: -1 }} />
<Story
	name="Fixed widths, warn tone"
	args={{ value: -2, fixed: true, disTone: 'warn' }}
	parameters={{ width: '420px' }}
/>

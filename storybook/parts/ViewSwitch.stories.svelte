<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import ViewSwitch from '#view/actorSheets/parts/ViewSwitch.svelte';

	const spells = [
		{ value: 'tier', label: 'By tier' },
		{ value: 'school', label: 'By school' },
	];

	const { Story } = defineMeta({
		title: 'Parts/Rows/ViewSwitch',
		component: ViewSwitch,
		args: { options: spells, label: 'Group the spells', onchange: fn() },
	});
</script>

<Story name="Spells by tier" args={{ value: 'tier' }} />
<Story name="Spells by school" args={{ value: 'school' }} />

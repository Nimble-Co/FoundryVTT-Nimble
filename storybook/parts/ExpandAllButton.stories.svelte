<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import ExpandAllButton from '#view/actorSheets/parts/ExpandAllButton.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/ExpandAllButton',
		component: ExpandAllButton,
		args: { onclick: fn() },
	});
</script>

<Story name="Expand all" />
<Story name="Collapse all" args={{ allOpen: true }} />
<Story name="Phone header" args={{ compact: true }} />
<Story name="NPC sheet header" args={{ size: 'sm', allOpen: true }} />

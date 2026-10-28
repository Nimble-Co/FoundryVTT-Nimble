<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import RowButton from '#view/actorSheets/parts/RowButton.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/RowButton',
		component: RowButton,
		args: { name: 'Rage', onclick: fn() },
	});
</script>

<Story name="Arrow" args={{ kind: 'expand' }} />
<Story name="Arrow, open" args={{ kind: 'expand', open: true }} />
<Story name="Pen" args={{ kind: 'edit' }} />
<Story name="NPC size" args={{ kind: 'edit', size: 'sm' }} />
<Story name="Phone" args={{ kind: 'expand', touch: true }} />

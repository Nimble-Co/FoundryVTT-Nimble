<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import ConfirmBar from '#view/actorSheets/parts/ConfirmBar.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Sheet/ConfirmBar',
		component: ConfirmBar,
		args: { onconfirm: fn(), oncancel: fn() },
		parameters: { width: '360px' },
	});
</script>

<Story name="Delete" args={{ question: 'Delete Torch? This removes it from Rager.' }} />
<Story name="End an effect" args={{ question: 'End Rage?', confirmLabel: 'End' }} />

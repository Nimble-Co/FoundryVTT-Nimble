<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import EditZone from '#view/actorSheets/parts/EditZone.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Sheet/EditZone',
		component: EditZone,
		args: { onclick: fn() },
		parameters: { width: '320px' },
	});
</script>

{#snippet holder(args: { short: string; label: string; inline?: boolean; row?: boolean })}
	<div style="position: relative; margin: 16px 8px; padding: 8px 0;">
		<b>Speed 6, Fly 4</b>
		<EditZone {...args} />
	</div>
{/snippet}

<Story name="Over a block" args={{ short: 'Movement', label: 'Configure Movement' }}>
	{#snippet template(args)}{@render holder(args)}{/snippet}
</Story>
<Story name="Inline tag" args={{ short: 'Size', label: 'Configuration', inline: true }}>
	{#snippet template(args)}{@render holder(args)}{/snippet}
</Story>
<Story
	name="Row of a list"
	args={{ short: 'Languages', label: 'Configure Language Proficiencies', inline: true, row: true }}
>
	{#snippet template(args)}{@render holder(args)}{/snippet}
</Story>

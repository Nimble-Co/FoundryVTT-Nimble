<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import InlineNumber from '#view/actorSheets/parts/InlineNumber.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rail/InlineNumber',
		component: InlineNumber,
		args: { onchange: fn() },
	});
</script>

<Story name="Current HP" args={{ value: 38, label: 'Current HP', min: 0 }}>
	{#snippet template(args)}
		<span style="font-size:1.571rem;font-weight:600"
			><InlineNumber {...args} /> <small style="font-size:1rem">/ 55</small></span
		>
	{/snippet}
</Story>
<Story
	name="Uses, edit mode"
	args={{ value: 2, label: 'Uses left', min: 0, max: 3, dotted: true, width: '22px' }}
>
	{#snippet template(args)}
		<span style="font-size:0.929rem">Uses <InlineNumber {...args} />/3</span>
	{/snippet}
</Story>
<Story
	name="Rail meter label"
	args={{ value: 6, label: 'Current Hit Dice', min: 0, max: 8, variant: 'label', width: '34px' }}
	parameters={{ chrome: true, width: '240px' }}
>
	{#snippet template(args)}
		<span style="font-size:0.833rem;font-weight:900;letter-spacing:0.05em"
			>HIT DICE <InlineNumber {...args} />/ 8</span
		>
	{/snippet}
</Story>
<Story
	name="Field"
	args={{
		value: 4,
		label: 'Current Mana',
		min: 0,
		variant: 'field',
		align: 'center',
		width: '44px',
	}}
	parameters={{ chrome: true, width: '240px' }}
/>
<Story
	name="Row uses, edit mode"
	args={{
		value: 2,
		label: 'Uses left',
		min: 0,
		max: 3,
		dotted: true,
		width: '22px',
		variant: 'cost',
	}}
>
	{#snippet template(args)}
		<span style="font:700 0.893rem/1 var(--nimble-primary-font)"><InlineNumber {...args} />/3</span>
	{/snippet}
</Story>
<Story name="Rests in edit mode" args={{ value: 38, label: 'Current HP', min: 0, rest: true }} />

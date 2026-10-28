<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import Button from '#view/actorSheets/parts/Button.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Sheet/Button',
		component: Button,
		args: { onclick: fn() },
		parameters: { width: '360px' },
	});
</script>

<Story name="Secondary" args={{ label: 'Cancel' }} />
<Story name="Secondary, with an icon" args={{ label: 'Delete', icon: 'fa-solid fa-trash' }} />
<Story name="Secondary, small" args={{ label: 'Stats', icon: 'fa-solid fa-gear', size: 'sm' }} />
<Story
	name="Icon only"
	args={{
		icon: 'fa-solid fa-expand',
		iconOnly: true,
		ariaLabel: 'Expand all',
		tooltip: 'Expand all',
	}}
/>
<Story name="Primary" args={{ variant: 'primary', label: 'Roll', icon: 'fa-solid fa-dice-d20' }} />
<Story name="Primary, disabled" args={{ variant: 'primary', label: 'Roll', disabled: true }} />
<Story name="Window buttons" asChild>
	<div style="display:flex;gap:8px;align-items:center">
		<Button label="Cancel" onclick={fn()} />
		<Button variant="primary" icon="fa-solid fa-dice-d20" label="Roll" autofocus onclick={fn()} />
	</div>
</Story>

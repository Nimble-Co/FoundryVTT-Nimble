<script module lang="ts">
	// The bodies of the Foundations pages. The MDX pages show them with <Story of>; they are not in the sidebar.
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorTokens from './ColorTokens.svelte';
	import Specimens from './Specimens.svelte';
	import TypeTokens from './TypeTokens.svelte';

	const { Story } = defineMeta({ title: 'Foundations/Page bodies', tags: ['!dev', '!autodocs'] });
</script>

<Story name="Colors" asChild><ColorTokens /></Story>
<Story name="Typography" asChild><TypeTokens /></Story>
<Story name="Borders" asChild><Specimens kind="borders" /></Story>
<Story name="Mono" asChild><Specimens kind="mono" /></Story>

<!--
@component
Opens or closes the text of every row on a tab. The words are the system's own ("Expand all", "Collapse all");
the icons are `fa-expand` and `fa-compress`. After Expand all, the arrow of a row still closes only that row.
`compact` is the icon only, for the phone header; it keeps the words as its label. `size="sm"` is the 26 px button of the NPC sheet header.
-->
<script lang="ts">
	import type { ExpandAllButtonProps } from '#types/components/actorSheets/ExpandAllButton.d.ts';
	import localize from '#utils/localize.js';
	import Button from './Button.svelte';

	let {
		allOpen = false,
		compact = false,
		size = 'md',
		tooltip,
		onclick,
	}: ExpandAllButtonProps = $props();

	const label = $derived(
		localize(
			allOpen
				? 'NIMBLE.actorSheet.parts.expandAll.collapse'
				: 'NIMBLE.actorSheet.parts.expandAll.expand',
		),
	);
</script>

<Button
	icon="fa-solid {allOpen ? 'fa-compress' : 'fa-expand'}"
	label={compact ? undefined : label}
	ariaLabel={compact ? label : undefined}
	iconOnly={compact}
	{size}
	pressed={allOpen}
	tooltip={tooltip ?? label}
	{onclick}
/>

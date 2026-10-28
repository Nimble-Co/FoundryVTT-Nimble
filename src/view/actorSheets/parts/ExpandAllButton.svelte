<!--
@component
Opens or closes the text of every row on a tab. The words are the system's own ("Expand all", "Collapse all");
the icons are `fa-expand` and `fa-compress`. After Expand all, the arrow of a row still closes only that row.
`compact` is the icon only, for the phone header; it keeps the words as its label. `size="sm"` is the 26 px button of the NPC sheet header.
-->
<script lang="ts">
	import localize from '#utils/localize.js';
	import Button from './Button.svelte';

	interface Props {
		/** true when every row is open: the button then says Collapse all */
		allOpen?: boolean;
		/** icon only (phone header) */
		compact?: boolean;
		/** md = 28 px (character list tabs), sm = 26 px (NPC sheet header) */
		size?: 'md' | 'sm';
		/** the tooltip; default: the words of the button */
		tooltip?: string;
		onclick?: () => void;
	}

	let { allOpen = false, compact = false, size = 'md', tooltip, onclick }: Props = $props();

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

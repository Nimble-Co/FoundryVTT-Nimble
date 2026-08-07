<script lang="ts">
	import { setContext } from 'svelte';

	import AncestryOptionsSelection from '../../src/view/dialogs/components/characterCreator/AncestryOptionsSelection.svelte';

	let {
		selectedAncestry,
		selectedAncestryBonus = null,
		selectedClass = null,
	}: {
		selectedAncestry: NimbleAncestryItem | null;
		selectedAncestryBonus?: NimbleAncestryBonusItem | null;
		selectedClass?: NimbleClassItem | null;
	} = $props();

	setContext('CHARACTER_CREATION_STAGES', { ANCESTRY_OPTIONS: '1c' });
	setContext('dialog', { id: 'character-creation-dialog' });

	// Nothing is pre-selected, matching the state the stage gates on.
	let selectedAncestryVariant = $state<string | null>(null);
	let selectedAncestrySize = $state<string | null>(null);
	let selectedAncestrySave = $state<string | null>(null);
</script>

<AncestryOptionsSelection
	active={true}
	{selectedAncestry}
	{selectedAncestryBonus}
	{selectedClass}
	bind:selectedAncestryVariant
	bind:selectedAncestrySize
	bind:selectedAncestrySave
/>

<div data-testid="selected-ancestry-variant">{String(selectedAncestryVariant)}</div>
<div data-testid="selected-ancestry-size">{String(selectedAncestrySize)}</div>

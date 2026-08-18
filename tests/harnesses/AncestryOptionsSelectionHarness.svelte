<script lang="ts">
	import { setContext } from 'svelte';

	import AncestryOptionsSelection from '../../src/view/dialogs/components/characterCreator/AncestryOptionsSelection.svelte';

	// The enhanced-save subsection needs a bonus and a class; nothing exercises it yet, so those
	// props are left off rather than passed through unused.
	let { selectedAncestry }: { selectedAncestry: NimbleAncestryItem | null } = $props();

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
	selectedAncestryBonus={null}
	selectedClass={null}
	bind:selectedAncestryVariant
	bind:selectedAncestrySize
	bind:selectedAncestrySave
/>

<div data-testid="selected-ancestry-variant">{String(selectedAncestryVariant)}</div>
<div data-testid="selected-ancestry-size">{String(selectedAncestrySize)}</div>

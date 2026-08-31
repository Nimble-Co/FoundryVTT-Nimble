<script lang="ts">
	import { setContext } from 'svelte';

	import AncestryOptionsSelection from '../../src/view/dialogs/components/characterCreator/AncestryOptionsSelection.svelte';

	let { selectedAncestry }: { selectedAncestry: NimbleAncestryItem | null } = $props();

	setContext('CHARACTER_CREATION_STAGES', { ANCESTRY_OPTIONS: '1c' });
	setContext('dialog', { id: 'character-creation-dialog' });

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

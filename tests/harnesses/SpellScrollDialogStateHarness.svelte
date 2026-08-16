<script lang="ts">
	import { untrack } from 'svelte';

	import type { SpellScrollDialogProps } from '../../types/components/SpellScrollDialog.d.ts';

	import { createSpellScrollDialogState } from '../../src/view/dialogs/SpellScrollDialog.state.svelte.ts';

	interface Props {
		props: SpellScrollDialogProps;
		/** Hands the state object back so a test can drive the setters and actions. */
		onready?: (state: ReturnType<typeof createSpellScrollDialogState>) => void;
	}

	let { props, onready }: Props = $props();

	const state = createSpellScrollDialogState(() => props);

	// Capturing the initial `onready` is the intent, hence the untrack.
	untrack(() => onready?.(state));

	// Serialized rather than read directly off `state`, so every assertion goes
	// through a real render and proves the value is reactive.
	const snapshot = $derived(
		JSON.stringify({
			destination: state.destination,
			subNavigation: state.subNavigation.map((tab) => tab.name),
			visibleCandidates: state.visibleCandidates.map((candidate) => candidate.name),
			selectedVisibleUuid: state.selectedVisibleUuid,
			expandedUuid: state.expandedUuid,
			expandedDescription: state.descriptionFor(state.expandedUuid ?? ''),
			isSubmitDisabled: state.isSubmitDisabled,
			submitLabel: state.submitLabel,
			submitIcon: state.submitIcon,
			manaCostLabel: state.manaCostLabel,
			upcastLabel: state.upcastLabel,
			arcanaLabel: state.arcanaLabel,
		}),
	);
</script>

<div data-testid="snapshot">{snapshot}</div>

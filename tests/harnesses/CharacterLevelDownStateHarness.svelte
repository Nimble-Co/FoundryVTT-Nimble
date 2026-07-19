<script lang="ts">
	import { createLevelDownState } from '../../src/view/dialogs/CharacterLevelDownDialogState.svelte.ts';

	// The harness only exercises the pool-bonus derivation, so the actor is a loose
	// structural stand-in for what that derivation reads.
	// biome-ignore lint/suspicious/noExplicitAny: test harness accepts a minimal actor stub
	let { actor }: { actor: any } = $props();

	const state = createLevelDownState(
		() => actor,
		() => ({ submit() {} }),
	);

	const poolBonusChanges = $derived(state.poolBonusChanges);
</script>

<div data-testid="pool-bonus-changes">{JSON.stringify(poolBonusChanges)}</div>

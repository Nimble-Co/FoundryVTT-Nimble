<script lang="ts">
	import { createDicePoolPanelState } from '../../src/view/sheets/components/DicePoolPanel.svelte.js';

	// The harness exercises the selection/outcome logic, so actor and pool are loose
	// structural stand-ins for what that logic reads.
	// biome-ignore lint/suspicious/noExplicitAny: test harness accepts minimal stubs
	let { actor, pool }: { actor: any; pool: any } = $props();

	const state = createDicePoolPanelState(
		() => actor,
		() => pool,
	);

	const faces = $derived(state.pool?.kind === 'rolled' ? state.pool.faces : []);

	const snapshot = $derived({
		selected: [...state.selectedIndices].sort((a, b) => a - b),
		selectedCount: state.selectedCount,
		selectedSum: state.selectedSum,
		isMaximizeOutcome: state.isMaximizeOutcome,
		selectable: faces.map((_: number, index: number) => state.canSelectDie(index)),
	});
</script>

<div data-testid="snapshot">{JSON.stringify(snapshot)}</div>

{#each state.consumers as consumer (state.consumerKey(consumer))}
	<button
		type="button"
		data-testid="consumer-{consumer.ruleId}"
		onclick={() => state.selectConsumer(consumer)}
	>
		{consumer.itemName}
	</button>
{/each}

{#each faces as face, index (index)}
	<button type="button" data-testid="die-{index}" onclick={() => state.toggleDie(index)}>
		{face}
	</button>
{/each}

<button type="button" data-testid="spend" onclick={() => state.spend()}>Spend</button>

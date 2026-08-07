<script lang="ts">
	import type { PoolNodeProps } from '#types/components/PoolNode.d.ts';
	import localize from '#utils/localize.js';

	let { node }: PoolNodeProps = $props();

	let label = $derived(
		node.result?.poolLabel ??
			node.poolIdentifier ??
			localize('NIMBLE.activationEffects.poolNode.defaultLabel'),
	);
	let actionLabel = $derived(
		localize(`NIMBLE.activationEffects.poolNode.actions.${node.action}`) || node.action,
	);
	let delta = $derived(
		typeof node.result?.previousCount === 'number' && typeof node.result?.newCount === 'number'
			? node.result.newCount - node.result.previousCount
			: null,
	);
	let rolledFaces = $derived<number[]>(node.result?.rolledFaces ?? []);
	let skipReason = $derived<string | undefined>(node.result?.skipReason);
	let skipLabel = $derived(
		skipReason
			? localize(`NIMBLE.activationEffects.poolNode.skipReasons.${skipReason}`) || skipReason
			: '',
	);
	// Predicate-skipped nodes are noise on every activation (e.g. Rage's L5 node
	// at low levels). Hide silently from the card; the dispatcher posts a
	// debug-mode notification instead when authors want to confirm gating.
	let hideSkippedNode = $derived(skipReason === 'predicate');
</script>

{#if !hideSkippedNode}
	<div class="pool-node">
		<i class="fa-solid fa-dice-d6 pool-node__icon"></i>
		<span class="pool-node__label">{label}</span>

		{#if skipReason}
			<span class="pool-node__skip">{skipLabel}</span>
		{:else if node.result?.applied}
			<span class="pool-node__action">{actionLabel}</span>
			{#if rolledFaces.length > 0}
				<span class="pool-node__faces">
					{#each rolledFaces as face, index (index)}
						<span class="pool-node__face">{face}</span>
					{/each}
				</span>
			{:else if delta !== null && delta > 0}
				<span class="pool-node__delta">+{delta}</span>
			{:else if delta !== null && delta < 0}
				<span class="pool-node__delta">{delta}</span>
			{/if}
		{:else if rolledFaces.length > 0}
			<!-- Rolled, but pool was at max. Show the face anyway so the
			     player can decide whether to manually swap one out. -->
			<span class="pool-node__action">{actionLabel}</span>
			<span class="pool-node__faces pool-node__faces--unkept">
				{#each rolledFaces as face, index (index)}
					<span class="pool-node__face">{face}</span>
				{/each}
			</span>
			<span class="pool-node__skip">
				{localize('NIMBLE.activationEffects.poolNode.atMax')}
			</span>
		{:else}
			<span class="pool-node__action">{actionLabel}</span>
			<span class="pool-node__skip">
				{localize('NIMBLE.activationEffects.poolNode.noChange')}
			</span>
		{/if}
	</div>
{/if}

<style lang="scss">
	.pool-node {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;

		&__icon {
			color: var(--nimble-dark-text-color, currentColor);
		}

		&__label {
			font-weight: 600;
		}

		&__action {
			opacity: 0.85;
		}

		&__faces {
			display: inline-flex;
			gap: 0.25rem;

			&--unkept {
				opacity: 0.65;
			}
		}

		&__face {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.25rem;
			padding: 0 0.25rem;
			background: var(--nimble-pool-node-face-background);
			border: 1px solid var(--nimble-pool-node-face-border-color);
			border-radius: 3px;
			font-weight: 700;
			color: var(--nimble-pool-node-face-text-color);
		}

		&__delta {
			font-weight: 700;
			color: var(--nimble-pool-node-delta-color);
		}

		&__skip {
			opacity: 0.65;
			font-style: italic;
		}
	}
</style>

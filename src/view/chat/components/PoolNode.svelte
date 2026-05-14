<script lang="ts">
	import localize from '#utils/localize.js';

	let { node } = $props();

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
</script>

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
	{:else}
		<span class="pool-node__action">{actionLabel}</span>
		<span class="pool-node__skip">
			{localize('NIMBLE.activationEffects.poolNode.noChange')}
		</span>
	{/if}
</div>

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
		}

		&__face {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.25rem;
			padding: 0 0.25rem;
			background: hsl(210, 65%, 92%);
			border: 1px solid hsl(210, 65%, 46%);
			border-radius: 3px;
			font-weight: 700;
			color: hsl(210, 65%, 30%);
		}

		&__delta {
			font-weight: 700;
			color: hsl(150, 50%, 35%);
		}

		&__skip {
			opacity: 0.65;
			font-style: italic;
		}
	}

	:global(.theme-dark) .pool-node__face {
		background: hsl(210, 40%, 25%);
		border-color: hsl(210, 80%, 63%);
		color: hsl(210, 80%, 80%);
	}
</style>

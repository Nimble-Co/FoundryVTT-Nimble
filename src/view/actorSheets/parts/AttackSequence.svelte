<!--
@component
The note above the abilities that a monster uses in a set order: the attack sequence of the system.
Bold names the abilities; a die chip marks a random roll. The abilities under it are `nested` AbilityCards.
-->
<script lang="ts">
	import type { SequencePart } from './types.ts';

	interface Props {
		parts?: SequencePart[];
	}

	let { parts = [] }: Props = $props();
</script>

<div class="seq">
	{#each parts as p}{#if typeof p === 'string'}{p}{:else if p[1] === 'b'}<b>{p[0]}</b>{:else}<span
				class="die"><i class="fa-solid fa-dice-d20"></i>{p[0]}</span
			>{/if}{/each}
</div>

<style>
	.seq {
		break-inside: avoid;
		margin: 0 0 4px;
		padding: 5px 8px;
		font-size: 0.833rem;
		line-height: 1.35;
		font-style: italic;
		color: var(--nimble-sequence-text-color);
		background: var(--nimble-sequence-background);
		border: 1px solid var(--nimble-sequence-border-color);
		border-radius: 4px;
	}
	b {
		color: var(--nimble-ui-ink);
	}
	.die {
		font-style: normal;
		font-weight: 700;
		color: var(--nimble-ui-ink);
		border: 1px solid var(--nimble-ui-ink);
		border-radius: 3px;
		padding: 0 3px;
		white-space: nowrap;
	}
	.die i {
		font-size: 0.643rem;
		margin-right: 3px;
	}
</style>

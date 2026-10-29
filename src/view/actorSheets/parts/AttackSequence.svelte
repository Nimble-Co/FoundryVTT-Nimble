<!--
@component
The note above the abilities that a monster uses in a set order: the attack sequence of the system.
Bold names the abilities; a die chip marks a random roll. The abilities under it are `nested` AbilityCards.
`html` is the text of the sequence item as Foundry enriched it. With `onedit` the note has a pen, as a card.
-->
<script lang="ts">
	import type { AttackSequenceProps } from '#types/components/actorSheets/AttackSequence.d.ts';
	import RowButton from './RowButton.svelte';

	let { parts = [], html, name, onedit, touch = false }: AttackSequenceProps = $props();
</script>

<div class="seq" class:edit={!!onedit}>
	<div class="text">
		{#if html !== undefined}{@html html}{:else}{#each parts as p}{#if typeof p === 'string'}{p}{:else if p[1] === 'b'}<b
						>{p[0]}</b
					>{:else}<span class="die"><i class="fa-solid fa-dice-d20"></i>{p[0]}</span
					>{/if}{/each}{/if}
	</div>
	{#if onedit}<RowButton kind="edit" size="sm" {name} {touch} onclick={onedit} />{/if}
</div>

<style>
	.seq {
		break-inside: avoid;
		display: flex;
		align-items: flex-start;
		gap: 2px;
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
	.edit {
		padding: 2px 2px 2px 8px;
	}
	.edit .text {
		padding: 3px 0;
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.text :global(p) {
		margin: 0;
	}
	.text :global(p + p) {
		margin-top: 4px;
	}
	b,
	.text :global(strong) {
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

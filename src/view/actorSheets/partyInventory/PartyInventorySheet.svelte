<!--
@component
The party inventory actor. A list of what the party has stored.
Editing happens on a character's Inventory tab.
-->
<script lang="ts">
	import type { PartyInventorySheetProps } from '#types/components/actorSheets/PartyInventorySheet.d.ts';
	import RowTile from '../parts/RowTile.svelte';

	let { empty, items }: PartyInventorySheetProps = $props();
</script>

<article>
	{#if items.length > 0}
		<ul>
			{#each items as item (item.id)}
				<li>
					<RowTile img={item.img} icon={item.icon} />
					<span class="name">{item.name}</span>
					{#if item.quantity}<span class="qty">{item.quantity}</span>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p>{empty}</p>
	{/if}
</article>

<style lang="scss">
	article {
		padding: 0.5rem 0.75rem 1rem;
	}

	p,
	ul {
		margin: 0;
	}

	ul {
		display: flex;
		flex-direction: column;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 40px;
	}

	.name {
		flex: 1;
		min-width: 0;
	}

	.qty {
		margin-left: auto;
	}
</style>

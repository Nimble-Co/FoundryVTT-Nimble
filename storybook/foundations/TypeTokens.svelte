<!--
@component
The two font families and the text size tokens, read from the loaded stylesheets. Sizes are in rem: they follow the font scale
setting of Foundry (14 px by default).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { readTokens, valueIn } from './cssTokens.ts';

	let probe: HTMLElement;
	let fonts: [string, string][] = $state([]);
	let sizes: [string, string][] = $state([]);

	onMount(() => {
		const names = [...readTokens().keys()];
		fonts = names.filter((n) => n.endsWith('-font')).map((n) => [n, valueIn(probe, n)]);
		sizes = names
			.filter((n) => /^--nimble-(x*s|sm|md|lg|x+l)-text$/.test(n))
			.map((n): [string, string] => [n, valueIn(probe, n)])
			.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
	});
</script>

<div class="page" bind:this={probe}>
	<h3>Families</h3>
	{#each fonts as [name, value] (name)}
		<div class="font">
			<code>{name}</code><code class="value">{value}</code>
			<p style="font-family: var({name})">The quick brown fox: 1d20 + 3, Advantage × 2</p>
		</div>
	{/each}
	<h3>Sizes</h3>
	{#each sizes as [name, value] (name)}
		<div class="size">
			<code>{name}</code><code class="value">{value}</code>
			<span style="font-size: var({name})">Fury Dice</span>
		</div>
	{/each}
</div>

<style>
	.page {
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	h3 {
		margin: 16px 0 8px;
		font-size: 1.071rem;
		text-transform: uppercase;
	}
	code {
		font: 600 0.857rem var(--nimble-mono-font);
	}
	.value {
		margin-left: 8px;
		font-weight: 400;
		color: var(--nimble-ui-ink-muted);
	}
	.font p {
		margin: 4px 0 12px;
		font-size: 1.286rem;
	}
	.size {
		display: grid;
		grid-template-columns: 200px 120px 1fr;
		align-items: baseline;
		padding: 6px 0;
		border-bottom: 1px solid var(--nimble-ui-soft);
	}
</style>

<!--
@component
Every colour token of the system, read from the loaded stylesheets. Each token shows its value in the light theme, the dark theme
and the `nimble-chrome` set (the dark rail of the actor sheets, in both themes).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { isColour, readTokens, valueIn } from './cssTokens.ts';

	interface Row {
		name: string;
		light: string;
		dark: string;
		chrome: string | null;
	}

	let rows: Row[] = $state([]);
	let filter = $state('');
	let light: HTMLElement;
	let dark: HTMLElement;
	let chrome: HTMLElement;

	onMount(() => {
		rows = [...readTokens()]
			.map(([name, sets]) => ({
				name,
				light: valueIn(light, name),
				dark: valueIn(dark, name),
				chrome: sets.has('chrome') ? valueIn(chrome, name) : null,
			}))
			.filter((row) => isColour(row.light) || isColour(row.dark));
	});

	const shown = $derived(rows.filter((row) => row.name.includes(filter.trim())));
	const sheetTokens = $derived(shown.filter((row) => row.chrome !== null));
	const otherTokens = $derived(shown.filter((row) => row.chrome === null));
</script>

<div class="probes" aria-hidden="true">
	<div class="theme-light" bind:this={light}></div>
	<div class="theme-dark" bind:this={dark}></div>
	<div class="theme-dark nimble-chrome" bind:this={chrome}></div>
</div>

{#snippet table(list: Row[], withChrome: boolean)}
	<div class="table" class:chrome={withChrome}>
		<div class="row head">
			<span>Token</span><span>Light</span><span>Dark</span>{#if withChrome}<span>Chrome</span>{/if}
		</div>
		{#each list as row (row.name)}
			<div class="row">
				<code class="name">{row.name}</code>
				<div class="cell theme-light">
					<span class="chip"><i style="background: var({row.name})"></i></span><code
						>{row.light}</code
					>
				</div>
				<div class="cell theme-dark">
					<span class="chip"><i style="background: var({row.name})"></i></span><code
						>{row.dark}</code
					>
				</div>
				{#if withChrome}
					<div class="cell theme-dark nimble-chrome">
						<span class="chip"><i style="background: var({row.name})"></i></span><code
							>{row.chrome}</code
						>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

<div class="page">
	<label class="filter"
		>Filter <input type="search" bind:value={filter} placeholder="ui-ink" /></label
	>
	<h3>Actor sheet tokens <small>{sheetTokens.length}</small></h3>
	<p>
		The tokens that the <code>nimble-chrome</code> set also gives. Rail parts sit inside
		<code>nimble-chrome</code>.
	</p>
	{@render table(sheetTokens, true)}
	<h3>Other colour tokens <small>{otherTokens.length}</small></h3>
	{@render table(otherTokens, false)}
</div>

<style>
	.probes {
		display: none;
	}
	.page {
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.filter {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 12px;
		font-weight: 700;
	}
	h3 {
		margin: 16px 0 6px;
		font-size: 1.071rem;
		text-transform: uppercase;
	}
	h3 small {
		font-weight: 500;
		color: var(--nimble-ui-ink-muted);
	}
	p {
		margin: 0 0 8px;
		color: var(--nimble-ui-ink-muted);
	}
	.table {
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
	}
	.chrome .row {
		grid-template-columns: minmax(0, 1.2fr) repeat(3, minmax(0, 1fr));
	}
	.row + .row {
		border-top: 1px solid var(--nimble-ui-line);
	}
	.head span {
		padding: 6px 8px;
		font-size: 0.786rem;
		font-weight: 700;
		text-transform: uppercase;
	}
	.name {
		padding: 8px;
		font: 600 0.857rem var(--nimble-mono-font);
		word-break: break-all;
		user-select: all;
	}
	.cell {
		display: grid;
		gap: 4px;
		padding: 8px;
		background: var(--nimble-sheet-background);
	}
	.cell.nimble-chrome {
		background: var(--nimble-ui-chrome);
	}
	.cell code {
		font: 0.786rem var(--nimble-mono-font);
		word-break: break-all;
		color: var(--nimble-ui-ink);
	}
	.chip {
		display: block;
		height: 24px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		background: repeating-conic-gradient(hsl(0 0% 50% / 0.25) 0 25%, transparent 0 50%) 0 0 / 10px
			10px;
		overflow: hidden;
	}
	.chip i {
		display: block;
		height: 100%;
	}
</style>

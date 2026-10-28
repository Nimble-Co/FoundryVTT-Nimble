<!--
@component
The borders, frames and code colours that a token page cannot show.
-->
<script lang="ts">
	let { kind }: { kind: 'borders' | 'mono' } = $props();
</script>

{#if kind === 'borders'}
	<div class="borders">
		<div class="box">Box: 2 px bronze</div>
		<div class="card">Card: 1 px card border</div>
		<div class="ring">Part: 1 px ui-ring</div>
		<div class="stats">
			<span class="solid">STR</span><span class="dotted">DEX</span><span>INT</span>
		</div>
	</div>
{:else}
	<code class="formula"
		>1d20 <span class="op">+</span> @abilities.strength.mod <span class="paren">(</span>3d6<span
			class="paren">)</span
		></code
	>
{/if}

<style>
	.borders {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		max-width: 700px;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.box,
	.card,
	.ring {
		padding: 10px;
		border-radius: 4px;
		font-weight: 700;
		text-align: center;
	}
	.box {
		border: 2px solid var(--nimble-bronze);
		background: var(--nimble-box-background-color);
		text-transform: uppercase;
	}
	.card {
		border: 1px solid var(--nimble-card-border-color);
		background: var(--nimble-card-background-color);
		box-shadow: var(--nimble-box-shadow);
	}
	.ring {
		border: 1px solid var(--nimble-ui-ring);
	}
	.stats {
		display: flex;
		align-items: center;
		font-weight: 700;
	}
	.stats span {
		flex: 1;
		text-align: center;
	}
	.stats .solid {
		border-right: 1px solid var(--nimble-ui-soft);
	}
	.stats .dotted {
		border-right: 1px dotted var(--nimble-ui-ring);
	}
	/* the code colours of the rules editor: the same in both themes */
	.formula {
		display: block;
		max-width: 700px;
		padding: 8px 10px;
		border-radius: 4px;
		background: hsl(0, 0%, 24%);
		font: 1rem var(--nimble-mono-font);
		color: hsl(217, 34%, 88%);
	}
	.op {
		color: hsl(169, 56%, 68%);
	}
	.paren {
		color: hsl(51, 100%, 50%);
	}
</style>

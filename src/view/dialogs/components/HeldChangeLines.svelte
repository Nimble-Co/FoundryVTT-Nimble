<!--
@component
The Held Changes a roll will use, each with its source. Read-only lines, or with `choosing`
(Feature Effects off) a tick box for each one, bound to the keys in `chosen`.
-->
<script lang="ts">
	import type { HeldChangeLinesProps } from '#types/components/HeldChangeLines.d.ts';

	let { lines, choosing = false, chosen = $bindable([]) }: HeldChangeLinesProps = $props();
</script>

{#each lines as line (line.key)}
	{#if choosing}
		<label class="check">
			<input type="checkbox" value={line.key} bind:group={chosen} />
			<span>
				{line.text}
				<small>{line.source}</small>
			</span>
		</label>
	{:else}
		<div class="held">
			<i class="fa-solid fa-crosshairs" aria-hidden="true"></i>
			<div>
				{line.text}
				<small>{line.source}</small>
			</div>
		</div>
	{/if}
{/each}

<style>
	.held {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 3px;
		background: var(--nimble-ui-well);
		font-size: 0.812rem;
		font-weight: 600;
		color: var(--nimble-ui-ink);
	}

	small {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--nimble-ui-ink-muted);
	}
</style>

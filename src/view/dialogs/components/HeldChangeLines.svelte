<!--
@component
The Held Changes a roll will use, read-only, each with its source.
-->
<script lang="ts">
	interface Props {
		lines: Array<{ key: string; text: string; source: string }>;
	}

	let { lines }: Props = $props();
</script>

{#each lines as line (line.key)}
	<div class="held">
		<i class="fa-solid fa-crosshairs" aria-hidden="true"></i>
		<div>
			{line.text}
			<small>{line.source}</small>
		</div>
	</div>
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

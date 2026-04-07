<script lang="ts">
	import localize from '#utils/localize.js';

	let selectedActorId = $state<string | null>(null);

	const actors = $derived.by(() => {
		const all = (game.actors?.contents ?? []) as Array<{ id: string; name: string; type: string }>;
		return all.filter((a) => a.type === 'character' || a.type === 'npc' || a.type === 'minion');
	});

	const selectedActor = $derived(actors.find((a) => a.id === selectedActorId) ?? null);
</script>

<div class="nimble-testbench">
	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.scenarios.title')}</h2>
		<p class="nimble-testbench__placeholder">
			{localize('NIMBLE.diceTestbench.scenarios.placeholder')}
		</p>
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.rollBuilder.title')}</h2>
		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.actorLabel')}</span>
			<select bind:value={selectedActorId}>
				<option value={null}>--</option>
				{#each actors as actor (actor.id)}
					<option value={actor.id}>{actor.name} ({actor.type})</option>
				{/each}
			</select>
		</label>
		{#if selectedActor}
			<p class="nimble-testbench__confirm">
				{localize('NIMBLE.diceTestbench.rollBuilder.selectedLabel')}: {selectedActor.name}
			</p>
		{/if}
		<p class="nimble-testbench__placeholder">
			{localize('NIMBLE.diceTestbench.rollBuilder.placeholder')}
		</p>
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.results.title')}</h2>
		<p class="nimble-testbench__placeholder">
			{localize('NIMBLE.diceTestbench.results.placeholder')}
		</p>
	</section>
</div>

<style>
	.nimble-testbench {
		display: flex;
		flex-direction: row;
		gap: 0.75rem;
		height: 100%;
		padding: 0.5rem;
		background: #1a1a1a;
		color: #e0e0e0;
		font-family: sans-serif;
	}
	.nimble-testbench__col {
		flex: 1 1 0;
		min-width: 0;
		border: 1px solid #444;
		padding: 0.5rem;
		background: #222;
		overflow: auto;
	}
	.nimble-testbench__col h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		border-bottom: 1px solid #555;
		padding-bottom: 0.25rem;
	}
	.nimble-testbench__placeholder {
		color: #888;
		font-style: italic;
		font-size: 0.85rem;
	}
	.nimble-testbench__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.nimble-testbench__field span {
		font-size: 0.8rem;
		color: #bbb;
	}
	.nimble-testbench__field select {
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.25rem;
	}
	.nimble-testbench__confirm {
		font-size: 0.85rem;
		color: #9f9;
		margin: 0.25rem 0;
	}
</style>

<script>
	import { getContext } from 'svelte';

	let actor = getContext('actor');
	let flags = $derived(actor.reactive.flags.nimble);
	let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	let actorImageScale = $derived(flags?.actorImageScale ?? 100);
</script>

<section class="nimble-sheet__body">
	<section class="nimble-settings-wrapper">
		<header>
			<h3 class="nimble-heading" data-heading-variant="section">Actor Image Settings</h3>
		</header>

		<div class="nimble-field-row">
			<label class="nimble-field nimble-field--column">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					X-Offset (px)
				</span>

				<input
					type="number"
					value={actorImageXOffset}
					onchange={({ target }) => actor.setFlag('nimble', 'actorImageXOffset', target.value)}
				/>
			</label>

			<label class="nimble-field nimble-field--column">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					Y-Offset (px)
				</span>

				<input
					type="number"
					value={actorImageYOffset}
					onchange={({ target }) => actor.setFlag('nimble', 'actorImageYOffset', target.value)}
				/>
			</label>

			<label class="nimble-field nimble-field--column">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					Scale (%)
				</span>

				<input
					type="number"
					value={actorImageScale}
					onchange={({ target }) => actor.setFlag('nimble', 'actorImageScale', target.value)}
				/>
			</label>
		</div>

		{#if actor.reactive.type === 'soloMonster'}
			<header>
				<h3 class="nimble-heading" data-heading-variant="section">Last Stand</h3>
			</header>

			<div class="nimble-field-row">
				<label class="nimble-field nimble-field--column">
					<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
						Last Stand Threshold
					</span>

					<input
						type="number"
						min="0"
						value={actor.reactive.system.attributes.hp.lastStandThreshold ?? 0}
						onchange={({ target }) =>
							actor.update({
								'system.attributes.hp.lastStandThreshold': Math.max(
									0,
									Math.trunc(Number(target.value) || 0),
								),
							})}
					/>
					<span class="notes">0 disables Last Stand until a threshold is configured.</span>
				</label>
			</div>
		{/if}
	</section>
</section>

<style lang="scss">
	.nimble-settings-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.nimble-field-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: nowrap;
	}

	header + .nimble-field-row {
		margin-block-start: 0.125rem;
	}
</style>

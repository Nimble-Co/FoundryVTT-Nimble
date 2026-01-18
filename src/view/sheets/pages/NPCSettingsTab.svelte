<script>
	import { getContext } from 'svelte';

	let actor = getContext('actor');
	let flags = $derived(actor.reactive.flags.nimble);
	let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	let actorImageScale = $derived(flags?.actorImageScale ?? 100);
	let useSeparateTokenImage = $derived(flags?.useSeparateTokenImage ?? false);
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

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={useSeparateTokenImage}
				onchange={({ target }) => actor.setFlag('nimble', 'useSeparateTokenImage', target.checked)}
			/>

			<span class="nimble-field__label"> Use Separate Token Image </span>
		</label>
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

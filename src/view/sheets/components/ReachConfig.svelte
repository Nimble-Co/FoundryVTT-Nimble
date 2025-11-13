<script>
	let { item } = $props();

	let reach = $derived(item.reactive.system.properties.reach);
</script>

<div class="nimble-config-wrapper nimble-config-wrapper--ranges">
	<header class="nimble-sheet-section-header" style="grid-area: header;">
		<h3 class="nimble-heading" data-heading-variant="section">Reach</h3>
	</header>

	<label class="nimble-field" data-field-variant="stacked" style="grid-area: minRange;">
		<span class="nimble-heading nimble-field__label" data-heading-variant="field"> Lower </span>

		<input
			type="number"
			value={reach.min}
			onchange={({ target }) =>
				item.update({
					'system.properties.reach.min': target?.value,
				})}
		/>
	</label>

	<label class="nimble-field" data-field-variant="stacked" style="grid-area: maxRange;">
		<span class="nimble-heading nimble-field__label" data-heading-variant="field"> Upper </span>

		<input
			type="number"
			value={reach.max}
			onchange={({ target }) =>
				item.update({
					'system.properties.reach.max': target?.value,
				})}
		/>
	</label>
</div>

<style lang="scss">
	.nimble-config-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-block-end: 0.5rem;

		&--ranges {
			display: grid;
			grid-template-areas:
				'header header'
				'minRange maxRange';
			grid-template-columns: repeat(2, 1fr);
			grid-template-rows: repeat(2, max-content);
		}
	}
</style>

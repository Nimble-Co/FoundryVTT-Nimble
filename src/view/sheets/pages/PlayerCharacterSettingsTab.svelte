<script>
	import { getContext } from 'svelte';

	function updateBonusInventorySlots(newValue) {
		if (newValue < 0) return;

		actor.update({ 'system.inventory.bonusSlots': newValue });
	}

	let actor = getContext('actor');
	let flags = $derived(actor.reactive.flags.nimble);

	let automaticallyExecuteAvailableMacros = $derived(
		flags?.automaticallyExecuteAvailableMacros ?? true,
	);

	let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	let actorImageScale = $derived(flags?.actorImageScale ?? 100);

	let bonusInventorySlots = $derived(actor.reactive?.system?.inventory?.bonusSlots ?? 0);

	let compactSkillsView = $derived(flags?.compactSkillsView ?? true);
	let includeCurrencyBulk = $derived(flags?.includeCurrencyBulk ?? true);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
	let showPassiveSkillScores = $derived(flags?.showPassiveSkillScores ?? false);
	let trackInventorySlots = $derived(flags?.trackInventorySlots ?? true);
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<section style="--nimble-header-margin-block-end: 0.5rem;">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Actor Image Settings</h3>
		</header>

		<div class="nimble-field-row">
			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					X-Offset (px)
				</span>

				<input
					type="number"
					value={actorImageXOffset}
					onchange={({ target }) => actor.setFlag('nimble', 'actorImageXOffset', target.value)}
				/>
			</label>

			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					Y-Offset (px)
				</span>

				<input
					type="number"
					value={actorImageYOffset}
					onchange={({ target }) => actor.setFlag('nimble', 'actorImageYOffset', target.value)}
				/>
			</label>

			<label class="nimble-field" data-field-variant="stacked">
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
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Embedded Document Settings</h3>
		</header>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={automaticallyExecuteAvailableMacros}
				onchange={({ target }) =>
					actor.setFlag('nimble', 'automaticallyExecuteAvailableMacros', target.checked)}
			/>

			<span class="nimble-field__label"> Execute Item Macros on Item Activation </span>
		</label>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={showEmbeddedDocumentImages}
				onchange={({ target }) =>
					actor.setFlag('nimble', 'showEmbeddedDocumentImages', target.checked)}
			/>

			<span class="nimble-field__label"> Show Embedded Document Images </span>
		</label>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Inventory Settings</h3>
		</header>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={trackInventorySlots}
				onchange={({ target }) => actor.setFlag('nimble', 'trackInventorySlots', target.checked)}
			/>

			<span class="nimble-field__label"> Track Inventory Slots </span>
		</label>

		{#if trackInventorySlots}
			<label class="nimble-field">
				<input
					type="checkbox"
					checked={includeCurrencyBulk}
					onchange={({ target }) => actor.setFlag('nimble', 'includeCurrencyBulk', target.checked)}
				/>

				<span class="nimble-field__label"> Automatically Include Currency Bulk </span>
			</label>

			<div class="nimble-field">
				<div class="nimble-editable-numeric-field">
					<button
						class="nimble-button"
						data-button-variant="basic"
						type="button"
						aria-label="Decrement Bonus Inventory Slots"
						onclick={() => updateBonusInventorySlots(bonusInventorySlots - 1)}
					>
						<i class="fa-solid fa-minus"></i>
					</button>

					<span class="nimble-editable-numeric-field__value">
						{bonusInventorySlots}
					</span>

					<button
						class="nimble-button"
						data-button-variant="basic"
						type="button"
						aria-label="Increment Bonus Inventory Slots"
						onclick={() => updateBonusInventorySlots(bonusInventorySlots + 1)}
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				</div>

				<span> Bonus Inventory Slots </span>
			</div>
		{/if}
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Skill Settings</h3>
		</header>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={compactSkillsView}
				onchange={({ target }) => actor.setFlag('nimble', 'compactSkillsView', target.checked)}
			/>

			<span class="nimble-field__label"> Use Two-Column Skills View </span>
		</label>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={showPassiveSkillScores}
				onchange={({ target }) => actor.setFlag('nimble', 'showPassiveSkillScores', target.checked)}
			/>

			<span class="nimble-field__label"> Show Passive Skill Scores </span>
		</label>
	</section>
</section>

<style lang="scss">
	.nimble-field-row {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
	}

	.nimble-editable-numeric-field {
		--nimble-button-padding: 0.125rem 0.5rem;

		display: flex;
		align-items: center;
		margin-block: 0.125rem;

		&__value {
			display: block;
			line-height: 1;
			min-width: 4ch;
			font-weight: 500;
			text-align: center;
		}
	}
</style>

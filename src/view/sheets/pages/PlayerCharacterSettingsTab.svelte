<script lang="ts">
	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import { getHighestSpellTier } from '#utils/spell/getHighestSpellTier.ts';
	import localize from '#utils/localize.ts';
	import CharacterJsonExportButton from '#view/sheets/components/CharacterJsonExportButton.svelte';
	import CharacterPdfExportButton from '#view/sheets/character/pdfExport/CharacterPdfExportButton.svelte';
	import { createPlayerCharacterSettingsTabState } from './PlayerCharacterSettingsTabState.svelte.ts';

	const actor = getContext('actor');
	const editingEnabledStore = getContext('editingEnabled');

	const state = createPlayerCharacterSettingsTabState(
		() => actor,
		() => $editingEnabledStore ?? true,
	);
	const { updateBonusInventorySlots, updateHighestUnlockedSpellTier } = state;
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
					value={state.actorImageXOffset}
					onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'actorImageXOffset', target.value)}
					disabled={!state.editingEnabled}
				/>
			</label>

			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					Y-Offset (px)
				</span>

				<input
					type="number"
					value={state.actorImageYOffset}
					onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'actorImageYOffset', target.value)}
					disabled={!state.editingEnabled}
				/>
			</label>

			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
					Scale (%)
				</span>

				<input
					type="number"
					value={state.actorImageScale}
					onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'actorImageScale', target.value)}
					disabled={!state.editingEnabled}
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
				checked={state.automaticallyExecuteAvailableMacros}
				onchange={({ target }) =>
					actor.setFlag(SYSTEM_ID, 'automaticallyExecuteAvailableMacros', target.checked)}
				disabled={!state.editingEnabled}
			/>

			<span class="nimble-field__label"> Execute Item Macros on Item Activation </span>
		</label>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={state.showEmbeddedDocumentImages}
				onchange={({ target }) =>
					actor.setFlag(SYSTEM_ID, 'showEmbeddedDocumentImages', target.checked)}
				disabled={!state.editingEnabled}
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
				checked={state.trackInventorySlots}
				onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'trackInventorySlots', target.checked)}
				disabled={!state.editingEnabled}
			/>

			<span class="nimble-field__label"> Track Inventory Slots </span>
		</label>

		{#if state.trackInventorySlots}
			<label class="nimble-field">
				<input
					type="checkbox"
					checked={state.includeCurrencyBulk}
					onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'includeCurrencyBulk', target.checked)}
					disabled={!state.editingEnabled}
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
						onclick={() => updateBonusInventorySlots(state.bonusInventorySlots - 1)}
						disabled={!state.editingEnabled}
					>
						<i class="fa-solid fa-minus"></i>
					</button>

					<span class="nimble-editable-numeric-field__value">
						{state.bonusInventorySlots}
					</span>

					<button
						class="nimble-button"
						data-button-variant="basic"
						type="button"
						aria-label="Increment Bonus Inventory Slots"
						onclick={() => updateBonusInventorySlots(state.bonusInventorySlots + 1)}
						disabled={!state.editingEnabled}
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
				checked={state.compactSkillsView}
				onchange={({ target }) => actor.setFlag(SYSTEM_ID, 'compactSkillsView', target.checked)}
				disabled={!state.editingEnabled}
			/>

			<span class="nimble-field__label"> Use Two-Column Skills View </span>
		</label>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={state.showPassiveSkillScores}
				onchange={({ target }) =>
					actor.setFlag(SYSTEM_ID, 'showPassiveSkillScores', target.checked)}
				disabled={!state.editingEnabled}
			/>

			<span class="nimble-field__label"> Show Passive Skill Scores </span>
		</label>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Spell settings</h3>
		</header>

		<div class="nimble-field">
			<div class="nimble-editable-numeric-field">
				<button
					class="nimble-button"
					data-button-variant="basic"
					type="button"
					aria-label="Decrement Highest Unlocked Spell Tier"
					disabled={!state.editingEnabled}
					onclick={() => updateHighestUnlockedSpellTier(state.highestUnlockedSpellTier - 1)}
				>
					<i class="fa-solid fa-minus"></i>
				</button>

				<span class="nimble-editable-numeric-field__value">
					{state.highestUnlockedSpellTier}
				</span>

				<button
					class="nimble-button"
					data-button-variant="basic"
					type="button"
					disabled={!state.editingEnabled}
					aria-label="Increment Highest Unlocked Spell Tier"
					onclick={() => updateHighestUnlockedSpellTier(state.highestUnlockedSpellTier + 1)}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</div>

			<span> Highest Unlocked Spell Tier </span>
		</div>
		<div class="nimble-field">
			<button
				class="nimble-button"
				data-button-variant="full-width"
				type="button"
				disabled={!state.editingEnabled}
				aria-label="Reset Highest Unlocked Spell Tier"
				onclick={() => updateHighestUnlockedSpellTier(getHighestSpellTier(actor))}
			>
				Reset spell tier
			</button>
		</div>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(CONFIG.NIMBLE.jsonExport.sectionHeader)}
			</h3>
		</header>

		<div class="nimble-field">
			<CharacterPdfExportButton {actor} />
		</div>
		<div class="nimble-field">
			<CharacterJsonExportButton {actor} />
		</div>
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

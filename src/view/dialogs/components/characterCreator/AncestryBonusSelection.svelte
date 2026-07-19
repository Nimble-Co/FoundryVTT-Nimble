<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import prepareAncestryBonusTooltip from '../../../dataPreparationHelpers/documentTooltips/prepareAncestryBonusTooltip.js';
	import getDocumentSourceLabel from '../../../../utils/getDocumentSourceLabel.js';
	import DocumentCard from './DocumentCard.svelte';

	let {
		active,
		ancestryBonuses,
		selectedAncestry,
		selectedAncestryBonus = $bindable(),
		ancestryBonusConfirmed = $bindable(),
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const defaultBonusUuid = $derived(selectedAncestry?.system?.defaultBonus ?? '');

	// Local UI mode: false = confirm the default/current bonus, true = browse the full list.
	let browsing = $state(false);

	// Picking a new ancestry sends us back to the confirm view for that ancestry's default.
	$effect(() => {
		void selectedAncestry;
		browsing = false;
	});

	async function handleBonusSelection(bonus) {
		// Resolve the full document so its rules are available, then drop back to the confirm
		// view so the player lands on the same Confirm / Change buttons with their new pick.
		selectedAncestryBonus = await fromUuid(bonus.uuid);
		browsing = false;
	}

	function confirmSelection() {
		ancestryBonusConfirmed = true;
		browsing = false;
	}

	function editSelection() {
		ancestryBonusConfirmed = false;
		browsing = false;
	}

	const hintText =
		'Every ancestry comes with a default bonus trait. Confirm it, or change it for any other ancestry bonus that fits your character concept.';
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY_BONUS}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 2b. Select an Ancestry Bonus

			{#if !active && selectedAncestryBonus}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Ancestry Bonus Selection"
					data-tooltip="Edit Ancestry Bonus Selection"
					onclick={editSelection}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		{#if browsing}
			<Hint hintText="Choose an ancestry bonus. You'll return here to confirm your pick." />

			<ul class="nimble-document-list">
				{#each ancestryBonuses as bonus}
					{@const sourceLabel = getDocumentSourceLabel(bonus.uuid)}
					{@const isDefault = bonus.uuid === defaultBonusUuid}

					<li class="u-semantic-only">
						<DocumentCard
							document={bonus}
							handler={handleBonusSelection}
							data-card-selected={bonus.uuid === selectedAncestryBonus?.uuid ? '' : null}
							metadata={isDefault ? 'Default' : null}
							{sourceLabel}
							getTooltip={prepareAncestryBonusTooltip}
						/>
					</li>
				{/each}
			</ul>
		{:else if selectedAncestryBonus}
			{@const sourceLabel = getDocumentSourceLabel(selectedAncestryBonus.uuid)}

			<Hint {hintText} />

			<DocumentCard
				document={selectedAncestryBonus}
				handler={null}
				data-card-option="non-clickable"
				metadata={selectedAncestryBonus.uuid === defaultBonusUuid ? 'Default' : null}
				{sourceLabel}
				getTooltip={prepareAncestryBonusTooltip}
			/>

			<div class="nimble-ancestry-bonus-actions">
				<button class="nimble-button" data-button-variant="basic" onclick={confirmSelection}>
					Confirm Ancestry Bonus
				</button>
				<button
					class="nimble-button"
					data-button-variant="basic"
					data-button-style="secondary"
					onclick={() => (browsing = true)}
				>
					Change Ancestry Bonus
				</button>
			</div>
		{/if}
	{:else if selectedAncestryBonus}
		<DocumentCard
			document={selectedAncestryBonus}
			handler={null}
			data-card-option="non-clickable"
			getTooltip={prepareAncestryBonusTooltip}
		/>
	{/if}
</section>

<style lang="scss">
	.nimble-character-creation-section {
		// Every card in this step uses the same two-row grid so the source tag always lives
		// in its own meta row instead of trailing off the end of the title.
		--nimble-card-content-grid: 'img title' 'img meta';
		--nimble-card-column-dimensions: 2.5rem 1fr;
		--nimble-card-row-dimensions: repeat(2, max-content);
		--nimble-card-width: 100%;
		--nimble-card-title-justification: start;
		--nimble-heading-justification: start;

		--nimble-document-list-columns: repeat(auto-fill, minmax(180px, 1fr));
		--nimble-document-list-gap: 0.375rem;

		:global(.nimble-card) {
			position: relative;
			overflow: hidden;
		}

		:global(.nimble-card__img) {
			height: auto;
			align-self: stretch;
		}

		// Leave room on the right for the absolutely-positioned "Default" badge.
		:global(.nimble-card__title) {
			align-self: end;
			padding: 0.375rem 1.75rem 0.125rem 0;
		}

		// Source tag sits in the meta row, right-aligned and wrapping so the full label
		// is always visible and never overflows the card.
		:global(.nimble-card__meta) {
			align-self: start;
			justify-content: flex-end;
			width: 100%;
			min-width: 0;
			padding: 0.125rem 0 0.375rem;
		}

		:global(.nimble-card__source-label) {
			margin-inline-start: auto;
			max-width: 100%;
			white-space: normal;
			text-align: right;
		}

		// "Default" badge pinned to the top-right corner, independent of the title.
		:global(.nimble-card__metadata) {
			position: absolute;
			top: 0.25rem;
			inset-inline-end: 0.25rem;
			padding: 0.0625rem 0.25rem;
			font-size: var(--nimble-xxs-text);
			font-weight: 700;
			line-height: 1.2;
			color: var(--nimble-light-text-color);
			background: var(--nimble-accent-color);
			border-radius: 2px;
		}

		// Clear selected state while browsing the list.
		:global(.nimble-card[data-card-selected]) {
			--nimble-card-image-filter: none;

			border-color: var(--nimble-accent-color);
			background: hsla(var(--nimble-accent-color-values), 0.85);
			color: var(--nimble-light-text-color);
		}

		:global(.nimble-card[data-card-selected] .nimble-card__source-label) {
			color: var(--nimble-light-text-color);
			border-color: var(--nimble-light-text-color);
		}
	}

	.nimble-ancestry-bonus-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-start: 0.75rem;

		:global(.nimble-button) {
			--nimble-button-padding: 0.5rem 1rem;

			flex: 1 1 0;
			min-width: fit-content;
			border-radius: 4px;
		}

		// Secondary ("Change") button reads as an outline so the primary action stands out.
		:global(.nimble-button[data-button-style='secondary']) {
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			color: var(--nimble-dark-text-color);
		}
	}
</style>

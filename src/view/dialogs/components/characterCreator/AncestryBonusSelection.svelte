<script lang="ts">
	import type { AncestryBonusSelectionProps } from './AncestryBonusSelection.types.js';

	import { getContext } from 'svelte';

	import Hint from '../../../components/Hint.svelte';
	import DocumentCard from './DocumentCard.svelte';
	import prepareAncestryBonusTooltip from '../../../dataPreparationHelpers/documentTooltips/prepareAncestryBonusTooltip.js';
	import getDocumentSourceLabel from '../../../../utils/getDocumentSourceLabel.js';
	import localize from '../../../../utils/localize.js';
	import { createAncestryBonusSelectionState } from './AncestryBonusSelection.svelte.js';

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES') as Record<
		string,
		number | string
	>;
	const dialog = getContext('dialog') as { id: string };

	let {
		active,
		ancestryBonuses,
		selectedAncestry,
		selectedAncestryBonus = $bindable(),
		ancestryBonusConfirmed = $bindable(),
	}: AncestryBonusSelectionProps = $props();

	const state = createAncestryBonusSelectionState({
		getSelectedAncestry: () => selectedAncestry,
		setSelectedAncestryBonus: (bonus) => {
			selectedAncestryBonus = bonus;
		},
		setAncestryBonusConfirmed: (confirmed) => {
			ancestryBonusConfirmed = confirmed;
		},
	});

	const { handleBonusSelection, confirmSelection, editSelection, startBrowsing } = state;
	const browsing = $derived(state.browsing);
	const defaultBonusUuid = $derived(state.defaultBonusUuid);

	const hintText = localize('NIMBLE.ancestryBonusSelection.hint');
	const defaultMetadata = localize('NIMBLE.ancestryBonusSelection.defaultMetadata');
</script>

<!-- An ancestry with no configured default bonus never gates this stage, so showing the
     step at all would leave a titled, permanently empty section on the page. -->
{#if selectedAncestry?.system?.defaultBonus || selectedAncestryBonus}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY_BONUS}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.ancestryBonusSelection.header')}

				{#if !active && selectedAncestryBonus}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.ancestryBonusSelection.editSelection')}
						data-tooltip={localize('NIMBLE.ancestryBonusSelection.editSelection')}
						onclick={editSelection}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h3>
		</header>

		{#if active}
			{#if browsing}
				<Hint hintText={localize('NIMBLE.ancestryBonusSelection.chooseHint')} />

				{#if !ancestryBonuses.length}
					<Hint
						hintIcon="fa-solid fa-circle-exclamation"
						hintText={localize('NIMBLE.ancestryBonusSelection.noneAvailable')}
						hintType="warning"
					/>
				{:else}
					<ul class="nimble-document-list">
						{#each ancestryBonuses as bonus}
							{@const sourceLabel = getDocumentSourceLabel(bonus.uuid)}
							{@const isDefault = bonus.uuid === defaultBonusUuid}

							<li class="u-semantic-only">
								<DocumentCard
									document={bonus}
									handler={handleBonusSelection}
									data-card-selected={bonus.uuid === selectedAncestryBonus?.uuid ? '' : null}
									metadata={isDefault ? defaultMetadata : null}
									{sourceLabel}
									getTooltip={prepareAncestryBonusTooltip}
								/>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if selectedAncestryBonus}
				{@const sourceLabel = getDocumentSourceLabel(selectedAncestryBonus.uuid)}

				<Hint {hintText} />

				<DocumentCard
					document={selectedAncestryBonus}
					handler={null}
					data-card-option="non-clickable"
					metadata={selectedAncestryBonus.uuid === defaultBonusUuid ? defaultMetadata : null}
					{sourceLabel}
					getTooltip={prepareAncestryBonusTooltip}
				/>

				<div class="nimble-ancestry-bonus-actions">
					<button class="nimble-button" data-button-variant="basic" onclick={confirmSelection}>
						{localize('NIMBLE.ancestryBonusSelection.confirmSelection')}
					</button>
					<button class="nimble-button" data-button-variant="secondary" onclick={startBrowsing}>
						{localize('NIMBLE.ancestryBonusSelection.changeSelection')}
					</button>
				</div>
			{:else}
				<!-- The ancestry's default bonus is still resolving, or its UUID didn't resolve at
			     all (missing pack). Either way the player must be able to reach the list — this
			     stage gates the rest of character creation. -->
				<Hint
					hintIcon="fa-solid fa-circle-exclamation"
					hintText={localize('NIMBLE.ancestryBonusSelection.noSelection')}
					hintType="warning"
				/>

				<div class="nimble-ancestry-bonus-actions">
					<button class="nimble-button" data-button-variant="basic" onclick={startBrowsing}>
						{localize('NIMBLE.ancestryBonusSelection.chooseSelection')}
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
{/if}

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
			max-width: 100%;
			white-space: normal;
			text-align: right;
		}

		// Pin the "Default" badge to the top-right corner, independent of the title. The
		// badge's own appearance is owned by DocumentCard; only placement is step-specific.
		:global(.nimble-card__metadata) {
			position: absolute;
			top: 0.25rem;
			inset-inline-end: 0.25rem;
		}

		// Clear selected state while browsing the list.
		:global(.nimble-card[data-card-selected]) {
			--nimble-card-image-filter: none;
			// The title is `.nimble-heading`, which _heading.scss colours by a directly
			// matching rule — an inherited `color` would never reach it.
			--nimble-heading-color: var(--nimble-selected-tag-text-color);

			border-color: var(--nimble-accent-color);
			background: var(--nimble-accent-color);
			color: var(--nimble-selected-tag-text-color);
		}

		:global(.nimble-card[data-card-selected] .nimble-card__source-label) {
			color: var(--nimble-selected-tag-text-color);
			border-color: var(--nimble-selected-tag-text-color);
		}

		// The badge shares the accent background with the selected card, so give it its
		// own surface there or it disappears into the card.
		:global(.nimble-card[data-card-selected] .nimble-card__metadata) {
			background: var(--nimble-selected-tag-background-color);
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
			// `basic` variant buttons don't consume --nimble-button-border-radius, so round explicitly.
			border-radius: 4px;
		}
	}
</style>

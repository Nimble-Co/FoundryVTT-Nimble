<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import prepareAncestryBonusTooltip from '../../../dataPreparationHelpers/documentTooltips/prepareAncestryBonusTooltip.js';
	import getDocumentSourceLabel from '../../../../utils/getDocumentSourceLabel.js';
	import DocumentCard from './DocumentCard.svelte';

	let { active, ancestryBonuses, selectedAncestry, selectedAncestryBonus = $bindable() } = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const defaultBonusUuid = $derived(selectedAncestry?.system?.defaultBonus ?? '');

	function handleBonusSelection(bonus) {
		selectedAncestryBonus = bonus;
	}

	const hintText =
		'Every ancestry comes with a default bonus trait, but you may swap it for any other ancestry bonus that fits your character concept. Select the trait you want.';
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
					onclick={() => (selectedAncestryBonus = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

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
		<DocumentCard
			document={selectedAncestryBonus}
			handler={null}
			data-card-option="non-clickable"
			getTooltip={prepareAncestryBonusTooltip}
		/>
	{/if}
</section>

<style lang="scss">
	.nimble-document-list {
		--nimble-document-list-columns: repeat(auto-fill, minmax(180px, 1fr));
		--nimble-document-list-gap: 0.375rem;
	}
</style>

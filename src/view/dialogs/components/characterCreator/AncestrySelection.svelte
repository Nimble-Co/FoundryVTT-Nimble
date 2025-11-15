<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import prepareAncestryTooltip from '../../../dataPreparationHelpers/documentTooltips/prepareAncestryTooltip';
	import prepareAncestryMetadata from '../../../dataPreparationHelpers/metaData/prepareAncestryMetadata';
	import DocumentCard from './DocumentCard.svelte';

	async function handleAncestrySelection(ancestry) {
		selectedAncestry = await fromUuid(ancestry.uuid);

		if (selectedAncestry?.system?.size?.length > 1) {
			selectedAncestrySize = null;
		} else if (selectedAncestry?.system?.size?.length) {
			selectedAncestrySize = selectedAncestry?.system?.size[0];
		} else {
			selectedAncestrySize = 'medium';
		}
	}

	let {
		active,
		ancestries,
		selectedAncestry = $bindable(),
		selectedAncestrySize = $bindable(),
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const ancestryOptionsCount = Object.values(ancestries).reduce((count, category) => {
		return count + category.length;
	}, 0);

	const hintText =
		'Your ancestry determines how your character was born and how others see you at first glance. Select one option from the following list.';
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 2. Select an Ancestry

			{#if !active}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Ancestry Selection"
					data-tooltip="Edit Ancestry Selection"
					onclick={() => (selectedAncestry = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		{#each Object.entries(ancestries) as [type, options]}
			<section class="nimble-ancestry-group">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{type === 'exotic' ? 'Exotic Ancestries' : 'Core Ancestries'}

						{#if type === 'exotic'}
							<i
								class="nimble-ancestries-header-icon fa-solid fa-lock"
								data-tooltip="Your adventure setting may or may not support these ancestries. Check with your GM first before selecting one."
							></i>
						{/if}
					</h3>
				</header>

				<ul class="nimble-document-list">
					{#each options as ancestry}
						{@const metadata = prepareAncestryMetadata(ancestry)}
						{@const tooltip = prepareAncestryTooltip(ancestry)}

						<li class="u-semantic-only">
							<DocumentCard
								style={metadata ? '' : '--nimble-card-content-grid: "img title";'}
								document={ancestry}
								handler={handleAncestrySelection}
								{metadata}
								{tooltip}
							/>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{:else if !ancestryOptionsCount}
		<Hint
			hintIcon="fa-solid fa-circle-exclamation"
			hintText="There are no ancestries available in this world's compendium packs."
			hintType="warning"
		/>
	{:else if selectedAncestry}
		{@const tooltip = prepareAncestryTooltip(selectedAncestry)}

		<DocumentCard
			document={selectedAncestry}
			handler={null}
			data-card-option="non-clickable"
			{tooltip}
		/>
	{/if}
</section>

<style lang="scss">
	.nimble-ancestry-group {
		--nimble-card-content-grid: 'img title' 'img meta';
		--nimble-card-column-dimensions: 2.5rem 1fr;
		--nimble-card-row-dimensions: repeat(2, max-content);
		--nimble-card-width: 100%;

		--nimble-document-list-columns: repeat(3, 1fr);
		--nimble-document-list-gap: 0.375rem;
	}

	.nimble-ancestries-header-icon {
		transform: translateY(-2px);
		color: inherit;
		cursor: help;
	}
</style>

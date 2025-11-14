<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import prepareBackgroundTooltip from '../../../dataPreparationHelpers/documentTooltips/prepareBackgroundTooltip.js';
	import DocumentCard from './DocumentCard.svelte';

	let { active, backgrounds, selectedBackground = $bindable() } = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText =
		'Your background represents how you were raised, a key feature or personality trait, your job before adventuring, etc. Select one option from the following list.';
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.BACKGROUND}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 3. Select a Background

			{#if !active}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Background Selection"
					data-tooltip="Edit Background Selection"
					onclick={() => (selectedBackground = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<ul class="nimble-document-list">
			{#each backgrounds as background}
				{@const tooltip = prepareBackgroundTooltip(background)}

				<li class="u-semantic-only">
					<DocumentCard
						document={background}
						handler={async (background) => (selectedBackground = await fromUuid(background.uuid))}
						{tooltip}
					/>
				</li>
			{/each}
		</ul>
	{:else if !backgrounds.length}
		<Hint
			hintIcon="fa-solid fa-circle-exclamation"
			hintText="There are no backgrounds available in this world's compendium packs."
			hintType="warning"
		/>
	{:else if selectedBackground}
		{@const tooltip = prepareBackgroundTooltip(selectedBackground)}

		<DocumentCard
			document={selectedBackground}
			handler={null}
			data-card-option="non-clickable"
			{tooltip}
		/>
	{/if}
</section>

<style lang="scss">
	.nimble-document-list {
		--nimble-card-content-grid: 'img title';
		--nimble-card-column-dimensions: 2.5rem 1fr;
		--nimble-card-row-dimensions: max-content;
		--nimble-card-title-alignment: center;
		--nimble-card-width: auto;

		--nimble-document-list-columns: repeat(2, 1fr);
		--nimble-document-list-gap: 0.375rem;
	}
</style>

<script>
	import { getContext } from 'svelte';

	import DocumentCard from './DocumentCard.svelte';
	import Hint from '../../../components/Hint.svelte';

	let { active, classes, selectedClass = $bindable() } = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText =
		'Each class represents a different character archetype, and your choice of class will greatly determine the major capabilities and play style of you character. Choose one from the following list.';
</script>

{#snippet classCard(characterClass)}
	<li class="nimble-list-option">
		<button
			class="nimble-card"
			onclick={async () => {
				selectedClass = await fromUuid(characterClass.uuid);
			}}
		>
			<img class="nimble-card__img" src={characterClass.img} alt={characterClass.name} />

			<h4 class="nimble-card__title nimble-heading">
				{characterClass.name}
			</h4>

			{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(characterClass.system?.description) then description}
				<div class="nimble-card__description">
					{@html description || '<p>No Description Available</p>'}
				</div>
			{/await}

			<div class="nimble-card__complexity">
				Class Complexity:

				{#if characterClass?.system?.complexity}
					{#each { length: characterClass.system.complexity }}
						<i class="fa-solid fa-diamond"></i>
					{/each}
				{:else}
					Unknown
				{/if}
			</div>
		</button>
	</li>
{/snippet}

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.CLASS}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 1: Select Class

			{#if !active}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Class Selection"
					data-tooltip="Edit Class Selection"
					onclick={() => (selectedClass = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<ul class="nimble-document-list">
			{#each classes as characterClass (characterClass?.uuid)}
				{@render classCard(characterClass)}
			{/each}
		</ul>
	{:else if !classes.length}
		<Hint
			hintIcon="fa-solid fa-circle-exclamation"
			hintText="There are no classes available in this world's compendium packs."
			hintType="warning"
		/>
	{:else if selectedClass}
		<DocumentCard document={selectedClass} handler={null} data-card-option="non-clickable" />
	{/if}
</section>

<style lang="scss">
	.nimble-document-list {
		--nimble-card-content-grid: 'img title' 'img description' 'img difficulty';
		--nimble-card-column-dimensions: 6rem 1fr;
		--nimble-card-row-dimensions: max-content 2.25rem max-content;
		--nimble-card-image-height: 6rem;
		--nimble-card-image-width: 6rem;
		--nimble-card-width: 100%;

		--nimble-document-list-gap: 0.5rem;

		--nimble-heading-size: var(--nimble-md-text);
		--nimble-heading-justification: center;
		--nimble-heading-margin: 0.5rem 0 0.25rem 0;

		overflow-y: hidden;
	}

	.nimble-card__complexity {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		margin-block: 0.5rem;
		font-weight: 900;
	}

	.nimble-list-option {
		display: contents;
		overflow-y: hidden;
	}
</style>

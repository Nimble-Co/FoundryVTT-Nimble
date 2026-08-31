<script lang="ts">
	import type {
		AncestryChoiceOption,
		AncestryOptionsSelectionProps,
	} from './AncestryOptionsSelection.types.js';

	import { getContext } from 'svelte';

	import localize from '#utils/localize.js';
	import { variantIcon } from '#utils/ancestryVariants.js';
	import Hint from '../../../components/Hint.svelte';
	import TagGroup from '../../../components/TagGroup.svelte';
	import { createAncestryOptionsSelectionState } from './AncestryOptionsSelection.svelte.js';
	import {
		prepareSaveOptions,
		toSizeOptions,
		toVariantOptions,
	} from './AncestryOptionsSelection.utils.js';

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES') as Record<
		string,
		number | string
	>;
	const dialog = getContext('dialog') as { id: string };

	const { sizeCategories, sizeCategoryDescriptions, ancestryOptions } = CONFIG.NIMBLE;

	let {
		active,
		selectedAncestry,
		selectedAncestryBonus,
		selectedClass,
		selectedAncestryVariant = $bindable(),
		selectedAncestrySize = $bindable(),
		selectedAncestrySave = $bindable(),
	}: AncestryOptionsSelectionProps = $props();

	const state = createAncestryOptionsSelectionState({
		getSelectedAncestry: () => selectedAncestry,
		getSelectedAncestryBonus: () => selectedAncestryBonus,
		getSelectedClass: () => selectedClass,
	});

	const { focusedValue, handleRadioKeydown } = state;
	const ancestryVariants = $derived(state.ancestryVariants);
	const ancestrySizes = $derived(state.ancestrySizes);
	const hasVariantChoice = $derived(state.hasVariantChoice);
	const hasSizeChoice = $derived(state.hasSizeChoice);
	const hasFixedSize = $derived(state.hasFixedSize);
	const hasSaveChoice = $derived(state.hasSaveChoice);
	const hasAnyChoice = $derived(state.hasAnyChoice);
	const stepHeaders = $derived(state.stepHeaders);
</script>

{#snippet radioChoice(
	groupLabel: string,
	options: AncestryChoiceOption[],
	selected: string | null,
	select: (value: string) => void,
)}
	{@const values = options.map((option) => option.value)}
	{@const focused = focusedValue(groupLabel, values, selected)}

	<!-- A radiogroup takes the radios as its own children, so the options cannot be list items. -->
	<div class="nimble-ancestry-choice" role="radiogroup" aria-label={groupLabel}>
		{#each options as option, index (option.value)}
			{@const isSelected = option.value === selected}

			<button
				class="nimble-ancestry-choice__option"
				class:nimble-ancestry-choice__option--selected={isSelected}
				type="button"
				role="radio"
				aria-checked={isSelected}
				tabindex={option.value === focused ? 0 : -1}
				onclick={() => select(option.value)}
				onkeydown={(event) => handleRadioKeydown(event, groupLabel, index, values)}
			>
				<span class="nimble-ancestry-choice__dot" aria-hidden="true"></span>

				{#if option.icon}
					<span
						class="nimble-ancestry-choice__icon"
						style="--nimble-ancestry-choice-icon: url('{option.icon}')"
						aria-hidden="true"
					></span>
				{/if}

				<span>{option.label}</span>

				{#if option.description}
					<span class="nimble-ancestry-choice__description">{option.description}</span>
				{/if}
			</button>
		{/each}
	</div>
{/snippet}

{#if hasAnyChoice}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS}"
	>
		{#if hasVariantChoice}
			<div class="nimble-character-creation-section__subsection">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{stepHeaders.variant}

						{#if selectedAncestryVariant}
							<button
								class="nimble-button"
								data-button-variant="icon"
								aria-label={ancestryOptions.editVariant}
								data-tooltip={ancestryOptions.editVariant}
								onclick={() => (selectedAncestryVariant = null)}
							>
								<i class="fa-solid fa-edit"></i>
							</button>
						{/if}
					</h3>
				</header>

				{#if selectedAncestryVariant}
					<div class="nimble-character-creation-section__body">
						<p class="nimble-ancestry-choice__granted">
							<span
								class="nimble-ancestry-choice__icon"
								style="--nimble-ancestry-choice-icon: url('{variantIcon(selectedAncestryVariant)}')"
								aria-hidden="true"
							></span>

							<strong>{selectedAncestryVariant}</strong>
						</p>
					</div>
				{:else}
					{#if active}
						<Hint hintText={ancestryOptions.variantHint} />
					{/if}

					<div class="nimble-character-creation-section__body">
						{@render radioChoice(
							ancestryOptions.variant,
							toVariantOptions(ancestryVariants),
							selectedAncestryVariant,
							(variant) => (selectedAncestryVariant = variant),
						)}
					</div>
				{/if}
			</div>
		{/if}

		{#if hasSizeChoice}
			<div class="nimble-character-creation-section__subsection">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{stepHeaders.sizeCategory}
					</h3>
				</header>

				{#if active}
					<Hint hintText={ancestryOptions.sizeCategoryHint} />
				{/if}

				<div class="nimble-character-creation-section__body">
					{@render radioChoice(
						ancestryOptions.sizeCategory,
						toSizeOptions(ancestrySizes),
						selectedAncestrySize,
						(sizeCategory) => (selectedAncestrySize = sizeCategory),
					)}

					{#if active}
						<p class="nimble-ancestry-choice__note">
							{localize('NIMBLE.ancestryOptions.sizeGrappleNote')}
						</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if hasFixedSize}
			{@const sizeCategory = ancestrySizes[0]}

			<div class="nimble-character-creation-section__subsection">
				<p class="nimble-ancestry-choice__granted">
					<span class="nimble-ancestry-choice__granted-label">
						{ancestryOptions.sizeCategory}
					</span>

					<strong>{sizeCategories[sizeCategory] ?? sizeCategory}</strong>

					<span class="nimble-ancestry-choice__description">
						{sizeCategoryDescriptions[sizeCategory] ?? ''}
					</span>

					<span class="nimble-ancestry-choice__source">
						{localize('NIMBLE.ancestryOptions.sizeGrantedBy', {
							ancestry: selectedAncestry?.name ?? '',
						})}
					</span>
				</p>
			</div>
		{/if}

		{#if hasSaveChoice && selectedClass}
			<div class="nimble-character-creation-section__subsection">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{stepHeaders.enhancedSave}
					</h3>
				</header>

				{#if active}
					<Hint hintText={ancestryOptions.enhancedSaveHint} />
				{/if}
				<div class="nimble-character-creation-section__body">
					<TagGroup
						options={prepareSaveOptions(selectedClass)}
						selectedOptions={selectedAncestrySave ? [selectedAncestrySave] : []}
						toggleOption={(saveKey) => (selectedAncestrySave = saveKey)}
					/>
				</div>
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	.nimble-ancestry-choice {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		&__option {
			// Foundry's own button rule centres and sizes every button; these options are text rows.
			--button-size: fit-content;

			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 0.4375rem;
			width: 100%;
			margin: 0;
			padding: 0.3125rem 0.4375rem;
			font-family: inherit;
			font-size: var(--nimble-sm-text);
			line-height: 1.2;
			text-align: start;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			transition: var(--nimble-standard-transition);

			&--selected {
				border-color: var(--nimble-accent-color);
				background: color-mix(
					in srgb,
					var(--nimble-selected-tag-background-color) 12%,
					transparent
				);
			}

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&:focus-visible {
				border-color: var(--nimble-accent-color);
				box-shadow: 0 0 0 1px var(--nimble-accent-color);
			}
		}

		// Single-colour silhouettes, masked rather than drawn so the row supplies the colour.
		&__icon {
			flex: 0 0 auto;
			width: 1.125rem;
			height: 1.125rem;
			background-color: var(--nimble-medium-text-color);
			-webkit-mask: var(--nimble-ancestry-choice-icon) center / contain no-repeat;
			mask: var(--nimble-ancestry-choice-icon) center / contain no-repeat;

			.nimble-ancestry-choice__option--selected &,
			.nimble-ancestry-choice__granted & {
				background-color: var(--nimble-selected-tag-background-color);
			}
		}

		&__dot {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			flex: 0 0 auto;
			width: 0.75rem;
			height: 0.75rem;
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 50%;

			.nimble-ancestry-choice__option--selected & {
				border-color: var(--nimble-selected-tag-background-color);
			}

			.nimble-ancestry-choice__option--selected &::after {
				content: '';
				width: 0.375rem;
				height: 0.375rem;
				background: var(--nimble-selected-tag-background-color);
				border-radius: 50%;
			}
		}

		&__description {
			margin-inline-start: auto;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__granted {
			display: flex;
			align-items: center;
			gap: 0.4375rem;
			margin: 0;
			padding: 0.3125rem 0.4375rem;
			font-size: var(--nimble-sm-text);
			line-height: 1.2;
			color: var(--nimble-dark-text-color);
			background: color-mix(in srgb, var(--nimble-accent-color) 8%, transparent);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__granted-label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__source {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__note {
			margin: 0.375rem 0 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
			text-wrap: pretty;
		}
	}
</style>

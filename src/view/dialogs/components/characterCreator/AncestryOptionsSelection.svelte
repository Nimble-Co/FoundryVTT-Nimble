<script>
	import { getContext } from 'svelte';

	import { effectiveVariants } from '../../../../utils/ancestryVariants.js';
	import localize from '../../../../utils/localize.js';
	import { effectiveSizes } from '../../../../utils/sizeSelection.js';
	import Hint from '../../../components/Hint.svelte';
	import TagGroup from '../../../components/TagGroup.svelte';
	import { ancestryBonusRequiresSaveChoice } from '../../characterCreation/utils/ancestryBonusRequiresSaveChoice.js';

	// Smallest to largest, so the list reads the same regardless of the order the sizes were authored
	// in. An ancestry that predates the required-one rule resolves to the same default the character
	// creation flow already falls back to, so the player is still told their size.
	function prepareAncestrySizes(ancestry) {
		if (!ancestry) return [];

		return effectiveSizes(ancestry.system?.size, Object.keys(sizeCategories));
	}

	// Kept in the order the ancestry authored them, which is the order its name reads in.
	function prepareAncestryVariants(ancestry) {
		if (!ancestry) return [];

		return effectiveVariants(ancestry.system?.variants);
	}

	/**
	 * Rows for a pick-exactly-one list. Sizes carry a short description from the Size rules; variant
	 * names stand on their own, so their `description` is empty.
	 */
	function toSizeOptions(sizes) {
		return sizes.map((size) => ({
			value: size,
			label: sizeCategories[size] ?? size,
			description: sizeCategoryDescriptions[size] ?? '',
		}));
	}

	function toVariantOptions(variants) {
		return variants.map((variant) => ({ value: variant, label: variant, description: '' }));
	}

	function getNeutralSaves(selectedClass) {
		if (!selectedClass) return [];

		const savingThrowKeys = Object.keys(CONFIG.NIMBLE.savingThrows);
		const classAdvantage = selectedClass.system?.savingThrows?.advantage;
		const classDisadvantage = selectedClass.system?.savingThrows?.disadvantage;

		return savingThrowKeys.filter((key) => key !== classAdvantage && key !== classDisadvantage);
	}

	function prepareSaveOptions(selectedClass) {
		const neutralSaves = getNeutralSaves(selectedClass);
		const { savingThrows } = CONFIG.NIMBLE;

		return neutralSaves.map((saveKey) => ({
			value: saveKey,
			label: savingThrows[saveKey] ?? saveKey,
		}));
	}

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const { sizeCategories, sizeCategoryDescriptions, ancestryOptions } = CONFIG.NIMBLE;

	let {
		active,
		selectedAncestry,
		selectedAncestryBonus,
		selectedClass,
		selectedAncestryVariant = $bindable(),
		selectedAncestrySize = $bindable(),
		selectedAncestrySave = $bindable(),
	} = $props();

	let ancestryVariants = $derived(prepareAncestryVariants(selectedAncestry));
	// A lone variant is the ancestry's own name, so there is nothing to ask about.
	let hasVariantChoice = $derived(ancestryVariants.length > 1);

	let ancestrySizes = $derived(prepareAncestrySizes(selectedAncestry));
	let hasSizeChoice = $derived(ancestrySizes.length > 1);
	// A single size is stated rather than asked, so the player still learns what they are.
	let hasFixedSize = $derived(ancestrySizes.length === 1);
	let hasSaveChoice = $derived(ancestryBonusRequiresSaveChoice(selectedAncestryBonus));
	let hasAnyChoice = $derived(hasVariantChoice || hasSizeChoice || hasFixedSize || hasSaveChoice);

	const ARROW_STEPS = {
		ArrowDown: 1,
		ArrowRight: 1,
		ArrowUp: -1,
		ArrowLeft: -1,
	};

	// A radiogroup is one stop in the tab order, so focus lands on the chosen option — or on the
	// first one when nothing is chosen yet.
	function focusedValue(values, selected) {
		return values.includes(selected) ? selected : values[0];
	}

	/** Arrow keys move the choice between the radios of a radiogroup, wrapping at both ends. */
	function handleRadioKeydown(event, index, values, select) {
		const step = ARROW_STEPS[event.key];
		if (step === undefined) return;

		event.preventDefault();
		const next = (index + step + values.length) % values.length;
		// In a radiogroup the arrows carry the selection with them, not just the focus.
		select(values[next]);
		// The radios are the group's own children, so the group is the pressed radio's closest one.
		const group = event.currentTarget.closest('[role="radiogroup"]');
		group?.querySelectorAll('[role="radio"]')[next]?.focus();
	}
</script>

<!-- Shared by every ancestry option that is a pick-exactly-one list, with nothing pre-selected. -->
{#snippet radioChoice(groupLabel, options, selected, select)}
	{@const values = options.map((option) => option.value)}
	{@const focused = focusedValue(values, selected)}

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
				onkeydown={(event) => handleRadioKeydown(event, index, values, select)}
			>
				<span class="nimble-ancestry-choice__dot" aria-hidden="true"></span>

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
						{ancestryOptions.variantHeader}
					</h3>
				</header>

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
			</div>
		{/if}

		{#if hasSizeChoice || hasFixedSize}
			<div class="nimble-character-creation-section__subsection">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{ancestryOptions.sizeCategoryHeader}
					</h3>
				</header>

				{#if active && hasSizeChoice}
					<Hint hintText={ancestryOptions.sizeCategoryHint} />
				{/if}

				<div class="nimble-character-creation-section__body">
					{#if hasFixedSize}
						{@const sizeCategory = ancestrySizes[0]}

						<p class="nimble-ancestry-choice__granted">
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
					{:else}
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
					{/if}
				</div>
			</div>
		{/if}

		{#if hasSaveChoice && selectedClass}
			<div class="nimble-character-creation-section__subsection">
				<header class="nimble-section-header" data-header-variant="character-creator">
					<h3 class="nimble-heading" data-heading-variant="section">
						{ancestryOptions.enhancedSaveHeader}
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
			display: flex;
			align-items: center;
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
			align-items: baseline;
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

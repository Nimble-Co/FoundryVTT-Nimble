<script>
	import { getContext } from 'svelte';

	import { effectiveVariants, variantIcon } from '../../../../utils/ancestryVariants.js';
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

	function prepareAncestryVariants(ancestry) {
		if (!ancestry) return [];

		return effectiveVariants(ancestry.system?.variants);
	}

	function toSizeOptions(sizes) {
		return sizes.map((size) => ({
			value: size,
			label: sizeCategories[size] ?? size,
			description: sizeCategoryDescriptions[size] ?? '',
			icon: '',
		}));
	}

	function toVariantOptions(variants) {
		return variants.map((variant) => ({
			value: variant,
			label: variant,
			description: '',
			icon: variantIcon(variant),
		}));
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
	let hasVariantChoice = $derived(ancestryVariants.length > 1);

	let ancestrySizes = $derived(prepareAncestrySizes(selectedAncestry));
	let hasSizeChoice = $derived(ancestrySizes.length > 1);
	// A single size is stated rather than asked, so the player still learns what they are.
	let hasFixedSize = $derived(ancestrySizes.length === 1);
	let hasSaveChoice = $derived(ancestryBonusRequiresSaveChoice(selectedAncestryBonus));
	let hasAnyChoice = $derived(hasVariantChoice || hasSizeChoice || hasFixedSize || hasSaveChoice);

	let stepHeaders = $derived(
		numberSteps([
			[hasVariantChoice, 'variant', ancestryOptions.variant],
			[hasSizeChoice, 'sizeCategory', ancestryOptions.sizeCategory],
			[hasSaveChoice && !!selectedClass, 'enhancedSave', ancestryOptions.enhancedSave],
		]),
	);

	// The ancestry itself is Step 2 and its bonus 2b, so the first thing asked here is 2c.
	const FIRST_STEP_LETTER = 'c';

	function numberSteps(steps) {
		const headers = {};
		let letterCode = FIRST_STEP_LETTER.charCodeAt(0);

		for (const [asked, key, label] of steps) {
			if (!asked) continue;

			headers[key] = localize(ancestryOptions.stepHeader, {
				step: String.fromCharCode(letterCode),
				label,
			});
			letterCode += 1;
		}

		return headers;
	}

	const ARROW_STEPS = {
		ArrowDown: 1,
		ArrowRight: 1,
		ArrowUp: -1,
		ArrowLeft: -1,
	};

	// Roving tabindex: the group is one tab stop, and Tab returns to the last option walked to.
	let focusedValues = $state({});

	function focusedValue(groupLabel, values, selected) {
		const focused = focusedValues[groupLabel] ?? selected;

		return values.includes(focused) ? focused : values[0];
	}

	// Arrows move focus only, unlike the usual radiogroup pattern: choosing a variant closes its list
	// behind an edit control, so an arrow that chose would commit the player to whatever it landed on.
	function handleRadioKeydown(event, groupLabel, index, values) {
		const step = ARROW_STEPS[event.key];
		if (step === undefined) return;

		event.preventDefault();
		const next = (index + step + values.length) % values.length;
		focusedValues[groupLabel] = values[next];
		const group = event.currentTarget.closest('[role="radiogroup"]');
		group?.querySelectorAll('[role="radio"]')[next]?.focus();
	}
</script>

{#snippet radioChoice(groupLabel, options, selected, select)}
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

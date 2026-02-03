<script>
	import { getContext } from 'svelte';
	import localize from '../../../../utils/localize.js';
	import Hint from '../../../components/Hint.svelte';

	let {
		active,
		ancestryOptions,
		selectedBackground: _selectedBackground,
		selectedRaisedByAncestry = $bindable(),
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const { languages, backgroundOptionsSelection } = CONFIG.NIMBLE;

	// Extract language grants from ancestry rules
	function getLanguageFromAncestry(ancestry) {
		const rules = ancestry?.system?.rules ?? [];
		const grantRule = rules.find(
			(r) => r.type === 'grantProficiency' && r.proficiencyType === 'languages',
		);
		if (!grantRule?.values?.length) return null;
		return grantRule.values[0].toLowerCase();
	}

	// Resolved ancestry options state
	let resolvedAncestries = $state([]);

	// Resolve ancestry options when they change
	$effect(() => {
		if (ancestryOptions?.then) {
			ancestryOptions.then((ancestries) => {
				const allAncestries = Object.values(ancestries).flat();
				const options = allAncestries
					.map((ancestry) => {
						const language = getLanguageFromAncestry(ancestry);
						if (!language) return null;
						return {
							ancestryKey: ancestry.name.toLowerCase(),
							language,
							label: ancestry.name,
							languageLabel: localize(languages[language] ?? language),
						};
					})
					.filter(Boolean)
					.sort((a, b) => {
						// Put goblin first as it's the default
						if (a.ancestryKey === 'goblin') return -1;
						if (b.ancestryKey === 'goblin') return 1;
						return a.label.localeCompare(b.label);
					});
				resolvedAncestries = options;
			});
		}
	});

	// Get the language label for the currently selected ancestry
	let selectedLanguageLabel = $derived(() => {
		if (!selectedRaisedByAncestry?.language) return '';
		return localize(
			languages[selectedRaisedByAncestry.language] ?? selectedRaisedByAncestry.language,
		);
	});

	// The current dropdown value (ancestry key)
	let dropdownValue = $state('goblin');

	function confirmSelection() {
		const option = resolvedAncestries.find((o) => o.ancestryKey === dropdownValue);
		if (option) {
			selectedRaisedByAncestry = {
				ancestryKey: option.ancestryKey,
				language: option.language,
				label: option.label,
			};
		}
	}

	// When selection is cleared (edit button), reset dropdown to goblin
	$effect(() => {
		if (selectedRaisedByAncestry === null) {
			dropdownValue = 'goblin';
		}
	});

	// Track if user has made a selection
	let hasSelection = $derived(selectedRaisedByAncestry !== null);
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.BACKGROUND_OPTIONS}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			{backgroundOptionsSelection.header}
			{#if !active && selectedRaisedByAncestry}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label={backgroundOptionsSelection.editSelection}
					data-tooltip={backgroundOptionsSelection.editSelection}
					onclick={() => (selectedRaisedByAncestry = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint hintText={backgroundOptionsSelection.hint} />

		<div class="nimble-heritage-selection">
			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading nimble-field__label" data-heading-variant="field">
					{backgroundOptionsSelection.raisedBy}
				</span>
				<select class="nimble-select" bind:value={dropdownValue}>
					{#each resolvedAncestries as option}
						<option value={option.ancestryKey}>
							{option.label} ({game.i18n.format(backgroundOptionsSelection.speaks, {
								language: option.languageLabel,
							})})
						</option>
					{/each}
				</select>
			</label>

			{#if !hasSelection}
				<button class="nimble-button" data-button-variant="basic" onclick={confirmSelection}>
					{backgroundOptionsSelection.confirmSelection}
				</button>
			{/if}
		</div>
	{:else if selectedRaisedByAncestry}
		<p class="nimble-selected-option">
			{backgroundOptionsSelection.raisedByLabel}
			<strong
				>{selectedRaisedByAncestry.ancestryKey.charAt(0).toUpperCase() +
					selectedRaisedByAncestry.ancestryKey.slice(1)}</strong
			>
			<span class="nimble-language-grant"
				>({game.i18n.format(backgroundOptionsSelection.speaks, {
					language: selectedLanguageLabel(),
				})})</span
			>
		</p>
	{/if}
</section>

<style lang="scss">
	.nimble-heritage-selection {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 20rem;
	}

	.nimble-select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		border-radius: 4px;
		background-color: var(--nimble-input-background, #fff);
		font-size: 0.875rem;
		cursor: pointer;

		&:focus {
			outline: 2px solid var(--nimble-focus-color, hsl(210, 100%, 50%));
			outline-offset: 1px;
		}
	}

	.nimble-selected-option {
		margin: 0;
	}

	.nimble-language-grant {
		opacity: 0.8;
		font-size: 0.875rem;
	}

	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}
</style>

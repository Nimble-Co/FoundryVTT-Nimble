<script>
	import { getContext } from 'svelte';
	import localize from '../../../../utils/localize.js';

	import Hint from '../../../components/Hint.svelte';
	import TagGroup from '../../../components/TagGroup.svelte';

	function lockInBonusLanguages() {
		bonusLanguages = tempBonusLanguages;
	}

	function toggleBonusLanguages(selection) {
		const index = tempBonusLanguages.indexOf(selection);

		if (index === -1) {
			if (remainingLanguagePicks > 0) {
				tempBonusLanguages.push(selection);
			}
		} else {
			tempBonusLanguages.splice(index, 1);
		}

		setTimeout(() => {
			const element = dialog.element.querySelector(
				`#${dialog.id}-stage-${CHARACTER_CREATION_STAGES.LANGUAGES}`,
			);

			element.scrollIntoView({ behavior: 'smooth' });
		}, 0);
	}

	let {
		active,
		bonusLanguages = $bindable(),
		bonusLanguageOptions,
		grantedLanguages = [],
		remainingSkillPoints,
		selectedAbilityScores,
		selectedArray,
	} = $props();

	const hintText =
		'All heroes speak Common by default, and some backgrounds will grant another language. Additionally, each point of INT grants an additional language known.';

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const { languages } = CONFIG.NIMBLE;

	let tempBonusLanguages = $state([]);

	let hasUnassignedAbilityScores = $derived(
		Object.values(selectedAbilityScores).some((mod) => mod === null),
	);

	let intelligenceModifier = $derived(
		selectedArray?.array?.[selectedAbilityScores.intelligence] ?? 0,
	);

	let remainingLanguagePicks = $derived(intelligenceModifier - bonusLanguages.length);

	let remainingTempLanguagePicks = $derived(intelligenceModifier - tempBonusLanguages.length);

	let grantedLanguageKeys = $derived(grantedLanguages.map((l) => l.key));

	let selectableOptions = $derived(
		bonusLanguageOptions.filter((opt) => !grantedLanguageKeys.includes(opt.value)),
	);

	// Reset temp selections when INT drops below current temp selection count
	// Only run after ability scores are fully assigned (not during drag operations)
	$effect(() => {
		if (hasUnassignedAbilityScores) return;
		if (tempBonusLanguages.length > 0 && intelligenceModifier < tempBonusLanguages.length) {
			tempBonusLanguages = [];
		}
	});
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.LANGUAGES}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 7. Select Bonus Languages

			{#if active}
				({remainingTempLanguagePicks})
			{:else if intelligenceModifier > 0 && !hasUnassignedAbilityScores && remainingLanguagePicks === 0 && !remainingSkillPoints}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Bonus Language Selections"
					data-tooltip="Edit Bonus Language Selections"
					onclick={() => (bonusLanguages = [])}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<div class="nimble-language-selection">
			<!-- Granted languages displayed as locked tags -->
			{#if grantedLanguages.length > 0}
				<div class="nimble-language-group">
					<span class="nimble-language-group__label">Granted</span>
					<ul class="nimble-language-tags">
						{#each grantedLanguages as lang}
							<li class="nimble-language-tag nimble-language-tag--granted">
								<span class="nimble-language-tag__name"
									>{localize(languages[lang.key] ?? lang.key)}</span
								>
								<span class="nimble-language-tag__source">({lang.source})</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Bonus language selection (only if INT > 0) -->
			{#if intelligenceModifier > 0}
				<div class="nimble-language-group">
					<span class="nimble-language-group__label">Choose {intelligenceModifier}</span>
					<TagGroup
						disabled={remainingTempLanguagePicks < 1}
						options={selectableOptions}
						selectedOptions={tempBonusLanguages}
						toggleOption={toggleBonusLanguages}
					/>
				</div>

				{#if remainingTempLanguagePicks < 1}
					<button class="nimble-button" data-button-variant="basic" onclick={lockInBonusLanguages}>
						Confirm Bonus Language Selections
					</button>
				{/if}
			{/if}
		</div>
	{:else if !hasUnassignedAbilityScores && !remainingSkillPoints}
		<!-- Summary view: show all languages -->
		<ul class="nimble-language-tags nimble-language-tags--summary">
			<li class="nimble-language-tag">
				<span class="nimble-language-tag__name">{localize(languages.common)}</span>
			</li>

			{#each grantedLanguages as lang}
				<li class="nimble-language-tag nimble-language-tag--granted">
					<span class="nimble-language-tag__name">{localize(languages[lang.key] ?? lang.key)}</span>
					<span class="nimble-language-tag__source">({lang.source})</span>
				</li>
			{/each}

			{#each bonusLanguages as language}
				<li class="nimble-language-tag">
					<span class="nimble-language-tag__name">{localize(languages[language] ?? language)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="scss">
	.nimble-language-selection {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.nimble-language-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-muted-text-color, hsl(0, 0%, 50%));
		}
	}

	.nimble-language-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;

		&--summary {
			gap: 0.5rem;
		}
	}

	.nimble-language-tag {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-xs-text);
		line-height: 1;
		color: var(--nimble-tag-text-color, var(--nimble-dark-text-color));
		background: var(--nimble-tag-background-color, var(--nimble-box-background-color));
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;

		&--granted {
			--nimble-tag-background-color: var(--nimble-selected-tag-background-color);

			color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
		}

		&__name {
			font-weight: 500;
		}

		&__source {
			font-size: 0.65rem;
			opacity: 0.8;
			text-transform: capitalize;
		}
	}

	[data-button-variant='basic'] {
		--nimble-button-margin: 0.5rem 0 0 0;
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}
</style>

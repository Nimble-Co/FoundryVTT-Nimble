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

	$effect(() => {
		void bonusLanguages;
		tempBonusLanguages = [];
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

		<TagGroup
			disabled={remainingTempLanguagePicks < 1}
			options={bonusLanguageOptions}
			selectedOptions={tempBonusLanguages}
			toggleOption={toggleBonusLanguages}
		/>

		{#if remainingTempLanguagePicks < 1}
			<button class="nimble-button" data-button-variant="basic" onclick={lockInBonusLanguages}>
				Confirm Bonus Language Selections
			</button>
		{/if}
	{:else if !hasUnassignedAbilityScores && !remainingSkillPoints}
		<ul class="nimble-selected-languages-list">
			<li class="nimble-selected-languages-list__item">
				<div class="nimble-card">
					<h4 class="nimble-card__title nimble-heading" data-heading-variant="item">
						{localize(languages.common)}
					</h4>
				</div>
			</li>

			{#each bonusLanguages as language}
				<li class="nimble-selected-languages-list__item">
					<div class="nimble-card">
						<h4 class="nimble-card__title nimble-heading" data-heading-variant="item">
							{localize(languages[language] ?? language)}
						</h4>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="scss">
	.nimble-selected-languages-list {
		--nimble-card-content-grid: 'title';
		--nimble-card-column-dimensions: 1fr;
		--nimble-card-row-dimensions: 2rem;
		--nimble-card-padding: 0 0.75rem;
		--nimble-card-title-alignment: center;

		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

		&__item {
			display: contents;
		}
	}

	[data-button-variant='basic'] {
		--nimble-button-margin: 0.5rem 0 0 0;
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}
</style>

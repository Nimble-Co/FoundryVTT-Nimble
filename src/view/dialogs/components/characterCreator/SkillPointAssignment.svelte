<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	let {
		abilityBonuses,
		active,
		assignedSkillPoints = $bindable(),
		remainingSkillPoints,
		selectedAbilityScores,
		selectedArray,
		skillBonuses,
	} = $props();

	function assignSkillPoints(skillKey, newValue) {
		const currentPoints = tempAssignedSkillPoints[skillKey] ?? 0;
		let newPoints = newValue;

		if (newPoints <= currentPoints) newPoints = newValue - 1;

		tempAssignedSkillPoints[skillKey] = newPoints;
	}

	function getAbilityModifier(abilityKey) {
		// If ability score isn't assigned yet (null/undefined), return 0
		const arrayIndex = selectedAbilityScores?.[abilityKey];
		if (arrayIndex === null || arrayIndex === undefined) return 0;

		// If selectedArray or its array property isn't available, return 0
		if (!selectedArray?.array) return 0;

		const baseScore = selectedArray.array[arrayIndex] ?? 0;
		const bonuses = abilityBonuses?.get?.(abilityKey) ?? 0;

		return baseScore + bonuses;
	}

	function lockInSkillPoints() {
		assignedSkillPoints = tempAssignedSkillPoints;
	}

	const { abilityScoreAbbreviations, defaultSkillAbilities, skills } = CONFIG.NIMBLE;

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText = 'You can now assign 4 skills points to increase the modifiers for your skills.';

	let tempAssignedSkillPoints = $state({});

	let remainingTempSkillPoints = $derived(
		4 - Object.values(tempAssignedSkillPoints).reduce((a, b) => a + b, 0),
	);

	let allAbilityScoresAssigned = $derived(
		Object.keys(selectedAbilityScores).length > 0 &&
			!Object.values(selectedAbilityScores).some((mod) => mod === null),
	);

	let maxStarIndex = $derived.by(() => Math.min(4, remainingTempSkillPoints));

	// Initialize tempAssignedSkillPoints from assignedSkillPoints when they change
	$effect(() => {
		if (
			Object.keys(assignedSkillPoints).length > 0 &&
			Object.keys(tempAssignedSkillPoints).length === 0
		) {
			tempAssignedSkillPoints = { ...assignedSkillPoints };
		}
	});
</script>

{#snippet skillPointGem(skillKey, index)}
	{@const skillPoints = active ? tempAssignedSkillPoints : assignedSkillPoints}
	<li class="nimble-skill-point-assignment-list__item">
		<button
			class="nimble-skill-point-star"
			class:nimble-skill-point-star--hidden={remainingTempSkillPoints === 0 ||
				index >= maxStarIndex}
			onclick={() => assignSkillPoints(skillKey, index + 1)}
		>
			{#if skillPoints[skillKey] > index}
				<i class="nimble-skill-point-star__icon fa-solid fa-star"></i>
			{:else}
				<i
					class="nimble-skill-point-star__icon nimble-skill-point-star__icon--inactive fa-regular fa-star"
				></i>
			{/if}
		</button>
	</li>
{/snippet}

{#snippet skill(abilityKey, skillKey, skillLabel)}
	{@const abilityLabel = abilityScoreAbbreviations[abilityKey]}
	{@const abilityModifier = getAbilityModifier(abilityKey)}
	{@const skillPoints = active ? tempAssignedSkillPoints : assignedSkillPoints}
	{@const baseSkillScore = Number.parseInt(skillPoints[skillKey] ?? 0, 10)}
	{@const bonuses = skillBonuses?.get?.(skillKey) ?? 0}
	{@const skillModifier = baseSkillScore + abilityModifier + bonuses}

	<li class="nimble-skills__item nimble-skills__item--compact">
		<div class="nimble-skill nimble-skill--character-creator">
			<span class="nimble-skill__ability">{abilityLabel}</span>
			<span class="nimble-skill__name">{skillLabel}</span>

			<ol class="nimble-skill-point-assignment-list">
				{#each { length: 4 } as _, index}
					{@render skillPointGem(skillKey, index)}
				{/each}
			</ol>

			<span class="nimble-skill__value nimble-skill__value--character-creator">
				{replaceHyphenWithMinusSign(
					new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(skillModifier),
				)}
			</span>
		</div>
	</li>
{/snippet}

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.SKILLS}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			Step 6. Assign Skill Points

			{#if active}
				({remainingTempSkillPoints} Points Remaining)
			{:else if remainingSkillPoints === 0 && allAbilityScoresAssigned}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Skill Points"
					data-tooltip="Edit Skill Points"
					onclick={() => (assignedSkillPoints = {})}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />
	{/if}

	{#if allAbilityScoresAssigned}
		<ul
			class="nimble-skills nimble-skills--character-creator"
			class:nimble-skills--locked={!active}
		>
			{#each Object.entries(skills) as [skillKey, skillLabel]}
				{@const abilityKey = defaultSkillAbilities[skillKey]}
				{@render skill(abilityKey, skillKey, skillLabel)}
			{/each}
		</ul>
	{/if}

	{#if active && remainingTempSkillPoints < 1}
		<button class="nimble-button" data-button-variant="basic" onclick={lockInSkillPoints}>
			Confirm Skill Point Assignments
		</button>
	{/if}
</section>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-margin: 0.5rem 0 0 0;
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}

	.nimble-skill-point-assignment-list {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.125rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-skill-point-star {
		--button-size: fit-content;

		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		padding: 0 0.25rem;
		border: 0;
		background: transparent;

		&:hover {
			background: transparent;
			color: inherit;
			box-shadow: none;
		}

		&--hidden {
			--nimble-inactive-gem-opacity: 0.25;

			&:has(.nimble-skill-point-star__icon--inactive) {
				pointer-events: none;
			}
		}

		&__icon {
			margin: 0;

			&--inactive {
				color: var(--nimble-medium-text-color);
				opacity: var(--nimble-inactive-gem-opacity);
			}
		}
	}

	.nimble-button {
		--nimble-button-min-width: 100%;
		--nimble-button-padding: 0.5rem 1rem;

		margin-block-start: 0.5rem;
	}
</style>

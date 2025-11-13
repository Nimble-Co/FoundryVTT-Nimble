<script>
	import { getContext } from 'svelte';

	import localize from '../../../utils/localize.js';
	import replaceHyphenWithMinusSign from '../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function getSkillValueLabel(modifier) {
		return replaceHyphenWithMinusSign(
			new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(modifier),
		);
	}

	function getPassiveScore(modifier) {
		const passiveScore = 10 + Number.parseInt(modifier, 10);
		return `(${passiveScore})`;
	}

	let { skills } = $props();

	const { abilityScoreAbbreviations, defaultSkillAbilities, skills: skillNames } = CONFIG.NIMBLE;

	const actor = getContext('actor');

	let flags = $derived(actor.reactive.flags.nimble);
	let compactSkillsView = $derived(flags?.compactSkillsView ?? true);
	let showPassiveSkillScores = $derived(flags?.showPassiveSkillScores ?? false);

	let sortedSkills = $derived(
		Object.entries(skills).sort(([keyA], [keyB]) =>
			skillNames[keyA].localeCompare(skillNames[keyB]),
		),
	);
</script>

{#snippet skillSnippet(skill, skillKey, skillName, defaultAbility)}
	{@const tooltip = localize('NIMBLE.prompts.rollSkillCheckSpecific', {
		skill: skillName,
	})}

	<li
		class="nimble-skills__item"
		class:nimble-skills__item--compact={compactSkillsView}
		class:nimble-skills__item--show-passive={showPassiveSkillScores}
	>
		<button
			class="nimble-skill"
			class:nimble-skill--compact={compactSkillsView}
			class:nimble-skill--show-passive={showPassiveSkillScores}
			type="button"
			aria-label={localize(tooltip)}
			data-tooltip={tooltip}
			onclick={() => actor.rollSkillCheckToChat(skillKey)}
		>
			{#if !compactSkillsView}
				<span class="nimble-skill__ability">{defaultAbility}</span>
			{/if}

			<span class="nimble-skill__name">{skillName}</span>
			<span class="nimble-skill__value">{getSkillValueLabel(skill.mod)}</span>

			{#if showPassiveSkillScores}
				<span class="nimble-skill__passive-score">{getPassiveScore(skill.mod)}</span>
			{/if}
		</button>
	</li>
{/snippet}

<section style="grid-area: skills;">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">Skills</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			aria-label={localize('NIMBLE.prompts.configureSkills')}
			data-tooltip={localize('NIMBLE.prompts.configureSkills')}
			onclick={() => actor.configureSkills()}
		>
			<i class="fa-solid fa-edit"></i>
		</button>
	</header>

	<ul class="nimble-skills" class:nimble-skills--compact={compactSkillsView}>
		{#each sortedSkills as [skillKey, skill]}
			{@const skillName = skillNames[skillKey]}
			{@const defaultAbilityKey = defaultSkillAbilities[skillKey]}
			{@const abilityScoreAbbreviation = abilityScoreAbbreviations[defaultAbilityKey]}

			{@render skillSnippet(skill, skillKey, skillName, abilityScoreAbbreviation)}
		{/each}
	</ul>
</section>

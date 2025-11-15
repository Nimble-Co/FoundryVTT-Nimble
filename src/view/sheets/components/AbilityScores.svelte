<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize';
	import replaceHyphenWithMinusSign from '../../dataPreparationHelpers/replaceHyphenWithMinusSign';

	let { abilities } = $props();

	const { abilityScores, abilityScoreAbbreviations } = CONFIG.NIMBLE;
	const actor = getContext('actor');
</script>

{#snippet abilityScoreSnippet(abilityScore, abilityKey)}
	{@const abilityAbbreviation = abilityScoreAbbreviations[abilityKey]}
	{@const abilityName = abilityScores[abilityKey]}
	{@const tooltip = localize('NIMBLE.prompts.rollAbilityCheckSpecific', {
		ability: abilityName,
	})}

	<button
		class="nimble-ability-score"
		type="button"
		aria-label={tooltip}
		data-tooltip={tooltip}
		onclick={() => actor.rollAbilityCheckToChat(abilityKey)}
	>
		<dt class="nimble-heading" data-heading-variant="section">{abilityAbbreviation}</dt>
		<dd class="nimble-ability-score__value">
			{replaceHyphenWithMinusSign(
				new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(abilityScore.mod),
			)}
		</dd>
	</button>
{/snippet}

<section style="grid-area: abilityScores;">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">Ability Scores</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			data-tooltip="NIMBLE.prompts.configureSkills"
			aria-label={localize('NIMBLE.prompts.configureSkills')}
			onclick={() => actor.configureAbilityScores()}
		>
			<i class="fa-solid fa-edit"></i>
		</button>
	</header>

	<dl class="nimble-stats">
		{#each Object.entries(abilities) as [abilityKey, abilityScore]}
			{@render abilityScoreSnippet(abilityScore, abilityKey)}
		{/each}
	</dl>
</section>

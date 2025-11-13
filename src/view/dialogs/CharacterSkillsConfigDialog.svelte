<script>
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function incrementSkillPoints(skillKey, skill) {
		const newValue = skill.points + 1;

		if (newValue > 12) return;

		document.update({
			[`system.skills.${skillKey}.points`]: newValue,
		});
	}

	function decrementSkillPoints(skillKey, skill) {
		const newValue = skill.points - 1;

		if (newValue < 0) return;

		document.update({
			[`system.skills.${skillKey}.points`]: newValue,
		});
	}

	let { document } = $props();

	const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;
</script>

<section class="nimble-sheet__body nimble-sheet__body--skill-config">
	<table class="nimble-skill-config-table">
		<thead>
			<tr>
				<th>Skill</th>
				<th>Ability Modifier</th>
				<th>Skill Bonus</th>
				<th>Skill Points</th>
				<th>Total</th>
			</tr>
		</thead>

		<tbody>
			{#each Object.entries(document?.reactive?.system?.skills) as [key, skill]}
				{@const skillName = skills[key] ?? key}
				{@const defaultAbility = defaultSkillAbilities[key] ?? 'Strength'}
				{@const abilityMod = document?.reactive?.system?.abilities[defaultAbility]?.mod ?? 0}

				<tr>
					<th class="nimble-skill-config-table__skill-name">{skillName}</th>
					<td>{replaceHyphenWithMinusSign(abilityMod)}</td>
					<td>{replaceHyphenWithMinusSign(skill.bonus)}</td>

					<td class="nimble-skill-config-table__skill-points">
						<button
							class="nimble-button"
							style="grid-area: decrementButton;"
							data-button-variant="basic"
							disabled={skill.points <= 0}
							aria-label="Decrement Skill Points"
							onclick={() => decrementSkillPoints(key, skill)}
						>
							-
						</button>

						<span class="nimble-skill-config__value">
							{replaceHyphenWithMinusSign(skill.points)}
						</span>

						<button
							class="nimble-button"
							style="grid-area: incrementButton;"
							data-button-variant="basic"
							disabled={skill.points >= 12}
							aria-label="Increment Skill Points"
							onclick={() => incrementSkillPoints(key, skill)}
						>
							+
						</button>
					</td>

					<td>{replaceHyphenWithMinusSign(skill.mod)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style lang="scss">
	.nimble-skill-config-table {
		--nimble-button-min-width: 4ch;

		text-align: center;
		vertical-align: middle;

		thead {
			text-align: center;
		}

		th {
			padding-inline: 0;
		}

		td {
			font-size: var(--nimble-md-text);
		}

		&__skill-name {
			font-weight: 900 !important;
			text-transform: uppercase;
		}

		&__skill-points {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}
	}

	.nimble-skill-config__value {
		width: 3ch;
	}
</style>

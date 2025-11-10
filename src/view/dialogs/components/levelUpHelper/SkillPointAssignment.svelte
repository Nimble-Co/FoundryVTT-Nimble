<script>
	import Hint from '../../../components/Hint.svelte';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function canAdd(skill, skillKey) {
		let quantityOfSkillsWithPointsAdded = Object.values(skillPointChanges).reduce((count, mod) =>
			mod > 0 ? count + mod : count,
		);

		// skill points capped at 12
		if (skill.points >= 12) return false;
		if (skillPointRemoved && skillPointChanges[skillKey] === 2) return false;
		if (!skillPointRemoved && skillPointAdded) return false;
		if (quantityOfSkillsWithPointsAdded === 2) return false;
		if (totalSkillAssignments === 1) return false;

		return true;
	}

	function getAddTooltip(skill, skillKey) {
		let quantityOfSkillsWithPointsAdded = Object.values(skillPointChanges).reduce((count, mod) =>
			mod > 0 ? count + mod : count,
		);

		// skill points capped at 12
		if (skill.points >= 12) return 'Max skill bonus is +12.';
		if (skillPointRemoved && skillPointChanges[skillKey] === 2)
			return 'Only 1 new point and 1 transfer are allowed per level-up.';
		if (!skillPointRemoved && skillPointAdded)
			return 'Reduce another skill first to add a skill point.';
		if (quantityOfSkillsWithPointsAdded === 2)
			return 'Limit reached: Only 1 new point and 1 transfer are allowed per level-up.';
		if (totalSkillAssignments === 1)
			return 'Only 1 new point and 1 transfer are allowed per level-up.';

		return '';
	}

	function canSubtract(skill, skillKey) {
		if (skill.points + skillPointChanges[skillKey] < 1) return false;
		if (skillPointChanges[skillKey] === -1) return false;
		if (skillPointChanges[skillKey] > 0) return true;
		if (skillPointRemoved) return false;
		if (Object.values(skillPointChanges).some((value) => value === 1)) return true;
		if (Object.values(skillPointChanges).some((value) => value === -1)) return false;

		return true;
	}

	function getSubtractTooltip(skill, skillKey) {
		if (skill.points + skillPointChanges[skillKey] < 1) return 'Skill points can’t go below 0.';
		if (skillPointChanges[skillKey] === -1) return 'Already marked to transfer 1 point.';
		if (skillPointAdded) return '';
		if (skillPointRemoved) return 'Only one transfer per level-up.';

		return '';
	}

	function getSkillMod(skill, skillKey, change) {
		let defaultAbility = defaultSkillAbilities[skillKey];
		let abilityBonus = 0;

		if (!selectedBoon && selectedAbilityScores) {
			// Handle both single selection (string) and multiple selections (array)
			let isSelected = Array.isArray(selectedAbilityScores)
				? selectedAbilityScores.includes(defaultAbility)
				: selectedAbilityScores === defaultAbility;

			if (isSelected) {
				abilityBonus += 1;
			}
		}

		return skill.mod + (change ?? 0) + abilityBonus;
	}

	let {
		chooseBoon,
		document,
		selectedBoon,
		selectedAbilityScores = $bindable(),
		skillPointChanges = $bindable(),
		skillPointsOverMax = $bindable(),
	} = $props();

	let remainingSkillPoints = $derived.by(
		() => 1 - Object.values(skillPointChanges).reduce((count, mod) => count + mod, 0),
	);
	let totalSkillAssignments = $derived.by(() =>
		Object.values(skillPointChanges).reduce((count, mod) => count + mod, 0),
	);
	let skillPointRemoved = $derived.by(() =>
		Object.values(skillPointChanges).some((value) => value === -1),
	);
	let skillPointAdded = $derived.by(() =>
		Object.values(skillPointChanges).some((value) => value >= 1),
	);

	// Check if any skill would exceed the 12 point cap after applying ability bonuses and skill point changes
	$effect(() => {
		if (!document?.reactive?.system?.skills) {
			skillPointsOverMax = false;
			return;
		}

		skillPointsOverMax = Object.entries(document.reactive.system.skills).some(
			([skillKey, skill]) => {
				const defaultAbility = defaultSkillAbilities[skillKey];
				const skillPointChange = skillPointChanges[skillKey] ?? 0;

				// Check if this skill's ability is getting a bonus
				let abilityBonus = 0;
				if (!selectedBoon && selectedAbilityScores) {
					const isSelected = Array.isArray(selectedAbilityScores)
						? selectedAbilityScores.includes(defaultAbility)
						: selectedAbilityScores === defaultAbility;

					if (isSelected) {
						abilityBonus = 1;
					}
				}

				const totalPoints = skill.points + skillPointChange + abilityBonus;
				return totalPoints > 12;
			},
		);
	});

	const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;

	const hintText =
		'You may assign a single skill point to a skill of your choice. In addition, you may transfer one of your assigned skill points to another skill of your choice.';
</script>

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			Skill Points ({remainingSkillPoints} Points Remaining)
		</h3>
	</header>

	<Hint {hintText} />

	<table class="nimble-skill-config-table">
		<thead>
			<tr>
				<th>Skill</th>
				<th>Ability Mod</th>
				<th>Skill Bonus</th>
				<th>Skill Points</th>
				<th>Total</th>
			</tr>
		</thead>

		<tbody>
			{#each Object.entries(document?.reactive?.system?.skills) as [key, skill]}
				{@const skillName = skills[key] ?? key}
				{@const defaultAbility = defaultSkillAbilities[key] ?? 'Strength'}
				{@const baseAbilityMod = document?.reactive?.system?.abilities[defaultAbility]?.mod ?? 0}
				{@const isAbilitySelected =
					selectedAbilityScores &&
					(Array.isArray(selectedAbilityScores)
						? selectedAbilityScores.includes(defaultAbility)
						: selectedAbilityScores === defaultAbility)}
				{@const abilityMod = baseAbilityMod + (isAbilitySelected ? 1 : 0)}
				{@const skillPointChange = skillPointChanges[key] ?? 0}
				{@const abilityBonus = isAbilitySelected ? 1 : 0}
				{@const totalSkillPoints = skill.points + skillPointChange + abilityBonus}
				{@const isOverCap = totalSkillPoints > 12}

				<tr class:nimble-skill-over-cap={isOverCap}>
					<th class="nimble-skill-config-table__skill-name">{skillName}</th>
					<td>{replaceHyphenWithMinusSign(abilityMod)}</td>
					<td>{replaceHyphenWithMinusSign(skill.bonus)}</td>

					<td class="nimble-skill-config-table__skill-points">
						<button
							class="nimble-button"
							style="grid-area: decrementButton;"
							data-button-variant="basic"
							disabled={!canSubtract(skill, key)}
							aria-label="Decrement Skill Points"
							data-tooltip={getSubtractTooltip(skill, key)}
							onclick={() => skillPointChanges[key]--}
						>
							-
						</button>

						<span class="nimble-skill-config__value">
							{replaceHyphenWithMinusSign(
								abilityBonus + skill.points + (skillPointChanges[key] ?? 0),
							)}
						</span>

						<button
							class="nimble-button"
							style="grid-area: incrementButton;"
							data-button-variant="basic"
							disabled={!canAdd(skill, key)}
							aria-label="Increment Skill Points"
							data-tooltip={getAddTooltip(skill, key)}
							onclick={() => skillPointChanges[key]++}
						>
							+
						</button>
					</td>

					<td>
						{getSkillMod(skill, key, skillPointChanges[key])}

						{#if skillPointChanges[key] || abilityBonus}
							<span class="nimble-skill-point-delta">
								({replaceHyphenWithMinusSign(
									new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
										parseInt(skillPointChanges?.[key] ?? 0) + abilityBonus,
									),
								)})
							</span>
						{/if}
					</td>
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

		.nimble-button[disabled] {
			opacity: 0.5;
			cursor: not-allowed;
		}

		thead {
			text-align: center;
		}

		th {
			padding-inline: 0;
		}

		td {
			font-size: var(--nimble-md-text);

			&:last-of-type {
				position: relative;
			}
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

	.nimble-skill-point-delta {
		position: absolute;
		right: 1rem;
		color: var(--nimble-medium-text-color);
	}

	.nimble-skill-over-cap {
		background-color: rgba(255, 0, 0, 0.1);

		th,
		td {
			color: var(--color-text-dark-error);
			font-weight: 600;
		}
	}
</style>

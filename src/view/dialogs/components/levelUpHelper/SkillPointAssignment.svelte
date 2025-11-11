<script>
	import Hint from '../../../components/Hint.svelte';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	const { data, ruleTypes, defaultSkillAbilities, skills, hints, skillPointAssignment } =
		CONFIG.NIMBLE;

	function canAdd(skillKey, skillMod) {
		let quantityOfSkillsWithPointsAdded = Object.values(skillPointChanges).reduce((count, mod) =>
			mod > 0 ? count + mod : count,
		);

		// skill points capped at 12
		if (skillMod >= 12) return false;
		if (skillPointRemoved && skillPointChanges[skillKey] === 2) return false;
		if (!skillPointRemoved && skillPointAdded) return false;
		if (quantityOfSkillsWithPointsAdded === 2) return false;
		if (totalSkillAssignments === 1) return false;

		return true;
	}

	function getAddTooltip(skillKey, skillMod) {
		let quantityOfSkillsWithPointsAdded = Object.values(skillPointChanges).reduce((count, mod) =>
			mod > 0 ? count + mod : count,
		);

		// skill points capped at 12
		if (skillMod >= 12) return skillPointAssignment.maxSkillBonus;
		if (skillPointRemoved && skillPointChanges[skillKey] === 2)
			return skillPointAssignment.onlyOneNewPointAndOneTransferAllowed;
		if (!skillPointRemoved && skillPointAdded)
			return skillPointAssignment.reduceAnotherSkillFirstToAddSkillPoint;
		if (quantityOfSkillsWithPointsAdded === 2) return skillPointAssignment.limitReached;
		if (totalSkillAssignments === 1)
			return skillPointAssignment.onlyOneNewPointAndOneTransferAllowed;

		return '';
	}

	function canSubtract(skillKey, skillMod) {
		let skillPointChange = parseInt(skillPointChanges[skillKey] ?? 0, 10);
		if (skillMod < 1) return false;
		if (skillPointAdded && skillPointChange > 0) return true;
		if (skillPointChange === -1) return false;
		if (skillPointRemoved) return false;
		if (Object.values(skillPointChanges).some((value) => value === 1)) return true;
		if (Object.values(skillPointChanges).some((value) => value === -1)) return false;

		return true;
	}

	function getSubtractTooltip(skillKey, skillMod) {
		let skillPointChange = parseInt(skillPointChanges[skillKey] ?? 0, 10);
		if (skillMod < 1) return skillPointAssignment.skillPointsCantGoBelowZero;
		if (skillPointAdded && skillPointChange > 0) return '';
		if (skillPointChange === -1) return skillPointAssignment.alreadyMarkedToTransferOnePoint;
		if (skillPointRemoved) return skillPointAssignment.onlyOneTransferPerLevelUp;

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

		// Force tracking of dependencies
		const currentAbilityScores = selectedAbilityScores;
		const currentBoon = selectedBoon;
		const currentSkillChanges = skillPointChanges;
		const overMaxSkills = [];

		skillPointsOverMax = Object.entries(document.reactive.system.skills).some(
			([skillKey, skill]) => {
				const defaultAbility = defaultSkillAbilities[skillKey];
				const skillPointChange = currentSkillChanges[skillKey] ?? 0;

				// Check if this skill's ability is getting a bonus
				let abilityBonus = 0;
				if (!currentBoon && currentAbilityScores) {
					const isSelected = Array.isArray(currentAbilityScores)
						? currentAbilityScores.includes(defaultAbility)
						: currentAbilityScores === defaultAbility;

					if (isSelected) {
						abilityBonus = 1;
					}
				}

				// Use the same calculation as getSkillMod to match what's displayed in the UI
				const totalMod = skill.mod + skillPointChange + abilityBonus;
				const isOverMax = totalMod > 12;

				if (isOverMax) {
					overMaxSkills.push(skillKey);
				}

				return isOverMax;
			},
		);
	});
</script>

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.skillPointAssignment.pointsRemaining', {
				remainingSkillPoints: remainingSkillPoints,
			})}
		</h3>
	</header>

	<Hint hintText={hints.skillPointAssignment} />

	<table class="nimble-skill-config-table">
		<thead>
			<tr>
				<th>{skillPointAssignment.skill}</th>
				<th>{skillPointAssignment.abilityMod}</th>
				<th>{ruleTypes.skillBonus}</th>
				<th>{skillPointAssignment.skillPoints}</th>
				<th>{data.total}</th>
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
				{@const isOverMax = totalSkillPoints > 12}
				{@const skillMod = getSkillMod(skill, key, skillPointChange)}

				<tr class:nimble-skill-over-cap={isOverMax}>
					<th class="nimble-skill-config-table__skill-name">{skillName}</th>
					<td>{replaceHyphenWithMinusSign(abilityMod)}</td>
					<td>{replaceHyphenWithMinusSign(skill.bonus)}</td>

					<td class="nimble-skill-config-table__skill-points">
						<button
							class="nimble-button"
							style="grid-area: decrementButton;"
							data-button-variant="basic"
							disabled={!canSubtract(key, skillMod)}
							aria-label={skillPointAssignment.decrementSkillPoints}
							data-tooltip={getSubtractTooltip(key, skillMod)}
							onclick={() => {
								if (Number.isInteger(skillPointChanges[key])) {
									skillPointChanges[key]--;
								} else {
									skillPointChanges[key] = -1;
								}
							}}
						>
							-
						</button>

						<span class="nimble-skill-config__value">
							{replaceHyphenWithMinusSign(skillMod)}
						</span>

						<button
							class="nimble-button"
							style="grid-area: incrementButton;"
							data-button-variant="basic"
							disabled={!canAdd(key, skillMod)}
							aria-label={skillPointAssignment.incrementSkillPoints}
							data-tooltip={getAddTooltip(key, skillMod)}
							onclick={() => {
								if (Number.isInteger(skillPointChanges[key])) {
									skillPointChanges[key]++;
								} else {
									skillPointChanges[key] = 1;
								}
							}}
						>
							+
						</button>
					</td>

					<td>
						{skillMod}

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
		background-color: var(--nimble-error-background-color);

		th,
		td {
			color: var(--color-text-dark-error);
			font-weight: 600;
		}
	}
</style>

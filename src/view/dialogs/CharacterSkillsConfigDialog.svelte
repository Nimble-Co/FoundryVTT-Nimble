<script>
	import localize from '../../utils/localize.js';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function buildSkillHistory(levelUpHistory, currentSkills, abilityScoreData, characterAbilities) {
		// Build a map of level → ability keys granted as ASIs at that level.
		const asiByLevel = {};
		for (const [level, data] of Object.entries(abilityScoreData ?? {})) {
			if (data.type !== 'statIncrease') continue;
			const values = Array.isArray(data.value)
				? data.value
				: data.value
					? String(data.value).split(',').filter(Boolean)
					: [];
			if (values.length > 0) asiByLevel[Number(level)] = values;
		}

		// Ability mod at a given level: base + bonus + ASIs granted up to that level, capped at 12.
		function abilityModAtLevel(abilityKey, upToLevel) {
			const ability = characterAbilities[abilityKey];
			if (!ability) return 0;
			const base = (ability.baseValue ?? 0) + (ability.bonus ?? 0);
			const asiCount = Object.entries(asiByLevel)
				.filter(([lvl]) => Number(lvl) <= upToLevel)
				.reduce((acc, [, abilities]) => acc + abilities.filter((a) => a === abilityKey).length, 0);
			return Math.min(base + asiCount, 12);
		}

		// Full skill modifier at a level: abilityMod + skillPoints + skillBonus, capped at 12.
		function skillModAtLevel(skillKey, skillPointsAtLevel, level) {
			const skill = currentSkills[skillKey];
			const defaultAbility = defaultSkillAbilities[skillKey] ?? 'Strength';
			const abilityMod = abilityModAtLevel(defaultAbility, level);
			return Math.min(abilityMod + skillPointsAtLevel + (skill?.bonus ?? 0), 12);
		}

		// Derive level 1 allocation: current points minus the sum of all level-up
		// changes. Level 1 assignment happens at character creation and is not
		// stored in levelUpHistory, so we back it out.
		const allLevelUpChanges = {};
		for (const entry of levelUpHistory) {
			for (const [skillKey, change] of Object.entries(entry.skillIncreases)) {
				allLevelUpChanges[skillKey] = (allLevelUpChanges[skillKey] ?? 0) + change;
			}
		}

		const runningPointTotals = {};
		const entries = [];

		const hasLevel1Entry = levelUpHistory.some((e) => e.level === 1);
		if (!hasLevel1Entry) {
			const level1Changes = Object.entries(currentSkills)
				.filter(([skillKey, skillData]) => {
					const levelUpTotal = allLevelUpChanges[skillKey] ?? 0;
					return skillData.points - levelUpTotal > 0;
				})
				.sort(([keyA, dataA], [keyB, dataB]) => {
					const aLevel1 = dataA.points - (allLevelUpChanges[keyA] ?? 0);
					const bLevel1 = dataB.points - (allLevelUpChanges[keyB] ?? 0);
					return bLevel1 - aLevel1;
				})
				.map(([skillKey, skillData]) => {
					const level1Points = skillData.points - (allLevelUpChanges[skillKey] ?? 0);
					runningPointTotals[skillKey] = level1Points;
					return {
						skillKey,
						change: level1Points,
						total: skillModAtLevel(skillKey, level1Points, 1),
						name: skills[skillKey] ?? skillKey,
					};
				});

			if (level1Changes.length > 0) {
				entries.push({ level: 1, changes: level1Changes });
			}
		}

		const sortedHistory = [...levelUpHistory]
			.sort((a, b) => a.level - b.level)
			.filter((entry) => Object.values(entry.skillIncreases).some((c) => c !== 0));

		for (const entry of sortedHistory) {
			const changes = Object.entries(entry.skillIncreases)
				.filter(([, change]) => change !== 0)
				.sort(([, a], [, b]) => b - a)
				.map(([skillKey, change]) => {
					runningPointTotals[skillKey] = (runningPointTotals[skillKey] ?? 0) + change;
					return {
						skillKey,
						change,
						total: skillModAtLevel(skillKey, runningPointTotals[skillKey], entry.level),
						name: skills[skillKey] ?? skillKey,
					};
				});

			entries.push({ level: entry.level, changes });
		}

		return entries;
	}

	let { document } = $props();

	const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;

	let sortedSkillEntries = $derived(
		Object.entries(document.reactive.system.skills).sort(([keyA], [keyB]) =>
			(skills[keyA] ?? keyA).localeCompare(skills[keyB] ?? keyB),
		),
	);

	let classItem = $derived(document.reactive.items.find((item) => item.type === 'class'));

	let skillHistory = $derived(
		buildSkillHistory(
			document.reactive.system.levelUpHistory,
			document.reactive.system.skills,
			classItem?.system?.abilityScoreData ?? {},
			document.reactive.system.abilities,
		),
	);

	let editingLevel = $state(null);
	let editingChanges = $state({});
	let editingBudget = $state(0);

	let remainingPoints = $derived(
		editingBudget - Object.values(editingChanges).reduce((sum, v) => sum + v, 0),
	);

	function getLevel1Changes() {
		const allLevelUpChanges = {};
		for (const entry of document.reactive.system.levelUpHistory) {
			for (const [skillKey, change] of Object.entries(entry.skillIncreases)) {
				allLevelUpChanges[skillKey] = (allLevelUpChanges[skillKey] ?? 0) + change;
			}
		}
		const changes = {};
		for (const [skillKey, skillData] of Object.entries(document.reactive.system.skills)) {
			const level1Points = skillData.points - (allLevelUpChanges[skillKey] ?? 0);
			if (level1Points > 0) changes[skillKey] = level1Points;
		}
		return changes;
	}

	function startEditing(level) {
		if (level === 1) {
			const changes = getLevel1Changes();
			editingBudget = Object.values(changes).reduce((sum, v) => sum + v, 0);
			editingChanges = changes;
		} else {
			const entry = document.reactive.system.levelUpHistory.find((e) => e.level === level);
			const raw = entry?.skillIncreases ?? {};
			editingChanges = Object.fromEntries(Object.entries(raw).filter(([, v]) => v > 0));
			editingBudget = 1;
		}
		editingLevel = level;
	}

	function adjustChange(skillKey, delta) {
		const current = editingChanges[skillKey] ?? 0;
		const next = current + delta;
		if (next < 0) return;
		if (delta > 0 && remainingPoints <= 0) return;
		editingChanges[skillKey] = next;
	}

	function cancelEdit() {
		editingLevel = null;
		editingChanges = {};
		editingBudget = 0;
	}

	async function saveEdits() {
		if (remainingPoints !== 0) return;

		const updates = {};

		const oldChanges =
			editingLevel === 1
				? getLevel1Changes()
				: (document.system.levelUpHistory.find((e) => e.level === editingLevel)?.skillIncreases ??
					{});

		const allSkillKeys = new Set([...Object.keys(oldChanges), ...Object.keys(editingChanges)]);
		for (const skillKey of allSkillKeys) {
			const delta = (editingChanges[skillKey] ?? 0) - (oldChanges[skillKey] ?? 0);
			if (delta !== 0) {
				updates[`system.skills.${skillKey}.points`] =
					(document.system.skills[skillKey]?.points ?? 0) + delta;
			}
		}

		if (editingLevel !== 1) {
			const cleanedChanges = Object.fromEntries(
				Object.entries(editingChanges).filter(([, v]) => v !== 0),
			);
			updates['system.levelUpHistory'] = document.system.levelUpHistory.map((entry) =>
				entry.level === editingLevel ? { ...entry, skillIncreases: cleanedChanges } : entry,
			);
		}

		if (Object.keys(updates).length > 0) {
			await document.update(updates);
		}

		editingLevel = null;
		editingChanges = {};
		editingBudget = 0;
	}
</script>

<section
	class="nimble-sheet__body nimble-sheet__body--skill-config"
	style="padding-inline: 0.75rem;"
>
	{#if editingLevel !== null}
		<div class="nimble-skill-editor__banner">
			<div class="nimble-skill-editor__banner-info">
				<span class="nimble-skill-editor__banner-title">
					{localize('NIMBLE.skillsConfig.editingLevel', { level: String(editingLevel) })}
				</span>
				<span
					class="nimble-skill-editor__banner-points"
					class:nimble-skill-editor__banner-points--spent={remainingPoints === 0}
				>
					{localize('NIMBLE.skillsConfig.remainingPoints', {
						remaining: String(remainingPoints),
						total: String(editingBudget),
					})}
				</span>
			</div>
			<div class="nimble-skill-editor__banner-actions">
				<button
					class="nimble-skill-editor__btn nimble-skill-editor__btn--cancel"
					onclick={cancelEdit}
				>
					{localize('NIMBLE.skillsConfig.cancel')}
				</button>
				<button
					class="nimble-skill-editor__btn nimble-skill-editor__btn--save"
					disabled={remainingPoints !== 0}
					onclick={saveEdits}
				>
					{localize('NIMBLE.skillsConfig.save')}
				</button>
			</div>
		</div>

		<table class="nimble-skill-config-table">
			<thead>
				<tr>
					<th class="nimble-skill-config-table__col--skill"
						>{localize('NIMBLE.skillsConfig.skill')}</th
					>
					<th>{localize('NIMBLE.skillsConfig.change')}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSkillEntries as [key]}
					{@const skillName = skills[key] ?? key}
					{@const change = editingChanges[key] ?? 0}
					<tr>
						<th class="nimble-skill-config-table__skill-name">{skillName}</th>
						<td
							class="nimble-skill-config-table__change"
							class:nimble-skill-config-table__change--positive={change > 0}
							>{change > 0 ? `+${change}` : change}</td
						>
						<td class="nimble-skill-config-table__controls">
							<button
								class="nimble-skill-editor__ctrl"
								disabled={change <= 0}
								onclick={() => adjustChange(key, -1)}>−</button
							>
							<button
								class="nimble-skill-editor__ctrl"
								disabled={remainingPoints <= 0}
								onclick={() => adjustChange(key, 1)}>+</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<table class="nimble-skill-config-table">
			<thead>
				<tr>
					<th class="nimble-skill-config-table__col--skill"
						>{localize('NIMBLE.skillsConfig.skill')}</th
					>
					<th>{localize('NIMBLE.skillsConfig.abilityModifier')}</th>
					<th>{localize('NIMBLE.skillsConfig.skillBonus')}</th>
					<th>{localize('NIMBLE.skillsConfig.skillPoints')}</th>
					<th>{localize('NIMBLE.skillsConfig.total')}</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSkillEntries as [key, skill]}
					{@const skillName = skills[key] ?? key}
					{@const defaultAbility = defaultSkillAbilities[key] ?? 'Strength'}
					{@const abilityMod = document?.reactive?.system?.abilities[defaultAbility]?.mod ?? 0}
					<tr>
						<th class="nimble-skill-config-table__skill-name">{skillName}</th>
						<td>{replaceHyphenWithMinusSign(abilityMod)}</td>
						<td>{replaceHyphenWithMinusSign(skill.bonus)}</td>
						<td>{replaceHyphenWithMinusSign(skill.points)}</td>
						<td class="nimble-skill-config-table__total">{replaceHyphenWithMinusSign(skill.mod)}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if skillHistory.length > 0}
		<div class="nimble-skill-history">
			<div class="nimble-skill-history__header">
				<span class="nimble-skill-history__header-title"
					>{localize('NIMBLE.skillsConfig.levelUpHistory')}</span
				>
				<span class="nimble-skill-history__header-subtitle"
					>{localize('NIMBLE.skillsConfig.levelUpHistorySubtitle')}</span
				>
			</div>

			<div class="nimble-skill-history__grid">
				{#each skillHistory as { level, changes }}
					<div
						class="nimble-skill-history__entry"
						class:nimble-skill-history__entry--editing={editingLevel === level}
					>
						<span class="nimble-skill-history__level">
							{localize('NIMBLE.skillsConfig.levelLabel', { level: String(level) })}
						</span>
						<div class="nimble-skill-history__changes">
							{#each changes as { name, change, total }}
								<span
									class="nimble-skill-history__chip"
									class:nimble-skill-history__chip--positive={change > 0}
									class:nimble-skill-history__chip--negative={change < 0}
								>
									<span class="nimble-skill-history__chip-name">{name}</span>
									<span
										class="nimble-skill-history__chip-delta"
										class:nimble-skill-history__chip-delta--positive={change > 0}
										class:nimble-skill-history__chip-delta--negative={change < 0}
									>
										{change > 0 ? `+${change}` : change}
									</span>
									<span class="nimble-skill-history__chip-arrow">→</span>
									<span class="nimble-skill-history__chip-total">{total}</span>
								</span>
							{/each}
						</div>
						<button
							class="nimble-skill-history__edit-btn"
							aria-label={localize('NIMBLE.skillsConfig.edit')}
							data-tooltip="NIMBLE.skillsConfig.edit"
							onclick={() => startEditing(level)}><i class="fa-solid fa-pen"></i></button
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style lang="scss">
	.nimble-sheet__body--skill-config {
		padding-block-end: 0.75rem;
	}

	.nimble-skill-config-table {
		width: 100%;
		text-align: center;
		vertical-align: middle;
		border-collapse: collapse;

		thead {
			background: hsla(0, 0%, 0%, 0.04);
			border-bottom: 2px solid var(--nimble-card-border-color);

			th {
				padding: 0.5rem 0.5rem;
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				color: var(--nimble-dark-text-color);
				text-align: center;
			}
		}

		tbody tr {
			border-bottom: 1px solid hsla(0, 0%, 0%, 0.05);

			&:last-of-type {
				border-bottom: none;
			}

			&:hover {
				background: hsla(0, 0%, 0%, 0.02);
			}
		}

		td {
			font-size: var(--nimble-md-text);
			padding: 0.4rem 0.5rem;
			text-align: center;
		}

		&__col--skill {
			text-align: left;
		}

		&__skill-name {
			text-align: left;
			padding: 0.4rem 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: var(--nimble-dark-text-color);
		}

		&__total {
			font-weight: 700;
		}
	}

	.nimble-skill-history {
		margin-block-start: 0.75rem;
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&__header {
			display: flex;
			align-items: baseline;
			gap: 0.6rem;
			padding: 0.5rem 0.75rem;
			background: hsla(0, 0%, 0%, 0.04);
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__header-title {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-dark-text-color);
		}

		&__header-subtitle {
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__grid {
			padding: 0.625rem 0.75rem 0.75rem;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
		}

		&__entry {
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 0.625rem;
			padding: 0.625rem 0.75rem;
			border-radius: 4px;
			background: var(--nimble-card-background-color, transparent);
			border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
			box-shadow: var(--nimble-card-box-shadow);
		}

		&__level {
			flex-shrink: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__changes {
			flex: 1;
			display: flex;
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 0.375rem;
		}

		&__chip {
			display: inline-flex;
			align-items: center;
			gap: 0.35rem;
			padding: 0.375rem 0.625rem;
			border-radius: 4px;
			border: 1px solid transparent;
			box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.06);

			&--positive {
				background: hsla(145, 50%, 40%, 0.08);
				border-color: hsla(145, 50%, 40%, 0.22);
			}

			&--negative {
				background: hsla(355, 55%, 52%, 0.07);
				border-color: hsla(355, 55%, 52%, 0.18);
			}
		}

		&__chip-name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__chip-delta {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			min-width: 2ch;
			text-align: center;

			&--positive {
				color: hsl(145, 50%, 28%);
			}

			&--negative {
				color: hsl(355, 55%, 42%);
			}
		}

		&__chip-arrow {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			opacity: 0.55;
			line-height: 1;
		}

		&__chip-total {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			background: hsla(0, 0%, 0%, 0.07);
			padding: 0.1rem 0.375rem;
			border-radius: 3px;
			font-variant-numeric: tabular-nums;
		}

		&__edit-btn {
			flex-shrink: 0;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			border-radius: 3px;
			border: 1px solid var(--nimble-card-border-color);
			background: transparent;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background: hsla(0, 0%, 0%, 0.05);
				color: var(--nimble-dark-text-color);
			}
		}

		&__entry--editing {
			border-color: hsl(220, 70%, 50%);
			background: hsla(220, 70%, 50%, 0.06);
		}
	}

	.nimble-skill-editor {
		&__banner {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.5rem 0;
			margin-block-end: 0.25rem;
			border-bottom: 2px solid var(--nimble-card-border-color);
		}

		&__banner-info {
			display: flex;
			align-items: baseline;
			gap: 0.625rem;
		}

		&__banner-title {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--nimble-dark-text-color);
		}

		&__banner-points {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			&--spent {
				color: hsl(145, 50%, 28%);
				font-weight: 600;
			}
		}

		&__banner-actions {
			display: flex;
			gap: 0.375rem;
		}

		&__btn {
			padding: 0.25rem 0.75rem;
			border-radius: 4px;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			cursor: pointer;
			border: 1px solid transparent;
			line-height: 1.4;

			&--cancel {
				background: transparent;
				border-color: var(--nimble-card-border-color);
				color: var(--nimble-medium-text-color);

				&:hover {
					background: hsla(0, 0%, 0%, 0.05);
				}
			}

			&--save {
				background: hsl(145, 50%, 35%);
				color: hsl(145, 50%, 95%);

				&:hover:not(:disabled) {
					background: hsl(145, 50%, 30%);
				}

				&:disabled {
					opacity: 0.4;
					cursor: not-allowed;
				}
			}
		}

		&__ctrl {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 3px;
			border: 1px solid var(--nimble-card-border-color);
			background: transparent;
			cursor: pointer;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			line-height: 1;

			&:hover:not(:disabled) {
				background: hsla(0, 0%, 0%, 0.07);
			}

			&:disabled {
				opacity: 0.25;
				cursor: not-allowed;
			}
		}
	}

	.nimble-skill-config-table {
		&__change {
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);

			&--positive {
				color: hsl(145, 50%, 28%);
				font-weight: 700;
			}
		}

		&__controls {
			display: flex;
			gap: 0.3rem;
			justify-content: center;
			align-items: center;
		}
	}
</style>

<script lang="ts">
	import type { CharacterSkillsConfigDialogProps } from '#types/components/CharacterSkillsConfigDialog.d.ts';
	import localize from '#utils/localize.ts';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';
	import { createCharacterSkillsConfigDialogState } from './CharacterSkillsConfigDialogState.svelte.ts';

	let { document }: CharacterSkillsConfigDialogProps = $props();

	const state = createCharacterSkillsConfigDialogState(() => document);
	const { skills, defaultSkillAbilities, startEditing, adjustChange, cancelEdit, saveEdits } =
		state;
	const sortedSkillEntries = $derived(state.sortedSkillEntries);
	const skillHistory = $derived(state.skillHistory);
	const editingLevel = $derived(state.editingLevel);
	const editingChanges = $derived(state.editingChanges);
	const editingBudget = $derived(state.editingBudget);
	const remainingPoints = $derived(state.remainingPoints);
</script>

<section class="nimble-sheet__body nimble-sheet__body--skill-config">
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
	:global(.nimble-window) .nimble-sheet__body.nimble-sheet__body--skill-config {
		padding: 12px;
	}

	.nimble-sheet__body--skill-config {
		padding-block-end: 0.75rem;
		padding-inline: 0.75rem;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}

	.nimble-skill-config-table {
		width: 100%;
		margin: 0;
		border: 0;
		border-collapse: collapse;
		border-spacing: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		overflow: visible;
		text-align: center;

		thead,
		tbody,
		tr,
		tr:nth-child(even),
		tr:nth-child(odd) {
			border: 0;
			background: none;
			color: var(--nimble-ui-ink);
			text-shadow: none;
		}

		th,
		td {
			padding: 0 4px;
			background: none;
			vertical-align: middle;
		}

		thead th {
			height: 26px;
			padding-bottom: 5px;
			border-bottom: 1px solid var(--nimble-ui-soft);
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			text-align: center;
			color: var(--nimble-ui-ink-dim);
		}

		tbody th,
		tbody td {
			height: 30px;
			border-bottom: 1px solid var(--nimble-ui-soft);
			font-size: 0.813rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
		}

		tbody tr:last-child th,
		tbody tr:last-child td {
			border-bottom: 0;
		}

		thead th.nimble-skill-config-table__col--skill {
			text-align: left;
		}

		&__skill-name {
			text-align: left;
			white-space: nowrap;
		}

		tbody td.nimble-skill-config-table__total {
			font-weight: 900;
		}

		tbody td.nimble-skill-config-table__change {
			color: var(--nimble-ui-ink-muted);
		}

		tbody td.nimble-skill-config-table__change--positive {
			font-weight: 700;
			color: var(--nimble-ui-action);
		}

		&__controls {
			white-space: nowrap;
			text-align: center;
		}
	}

	.nimble-skill-history {
		margin: 0;
		border: 0;
		background: none;

		&__header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin: 12px 0 4px;
			padding: 0 0 5px;
			border-bottom: 1px solid var(--nimble-ui-soft);
			background: none;
		}

		&__header-title {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--nimble-ui-ink-dim);
		}

		&__header-subtitle {
			font-size: 0.688rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__grid {
			display: flex;
			flex-direction: column;
			padding: 0;
		}

		&__entry {
			display: flex;
			align-items: center;
			gap: 14px;
			min-height: 34px;
			padding: 4px;
			border: 0;
			border-bottom: 1px solid var(--nimble-ui-soft);
			border-radius: 0;
			background: none;
			box-shadow: none;

			&:last-child {
				border-bottom: 0;
			}
		}

		&__entry--editing {
			background: var(--nimble-ui-hover);
			box-shadow: inset 2px 0 0 var(--nimble-ui-highlight);
		}

		&__level {
			flex-shrink: 0;
			font-size: 0.813rem;
			font-weight: 700;
			color: var(--nimble-ui-ink);
			white-space: nowrap;
		}

		&__changes {
			display: flex;
			flex: 1;
			flex-wrap: wrap;
			gap: 4px;
		}

		&__chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 0 5px;
			border: 0;
			border-radius: 3px;
			background: none;
			box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
			font-size: 0.656rem;
			font-weight: 800;
			line-height: 16px;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-ui-ink);
			white-space: nowrap;
		}

		&__chip-delta {
			&--positive {
				color: var(--nimble-ui-action);
			}

			&--negative {
				color: var(--nimble-ui-vital);
			}
		}

		&__chip-arrow {
			color: var(--nimble-ui-ink-dim);
		}

		&__chip-total {
			font-variant-numeric: tabular-nums;
		}

		&__edit-btn {
			display: inline-flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			min-height: 0;
			margin: 0 0 0 auto;
			padding: 0;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-size: 0.688rem;
			line-height: 1;
			color: var(--nimble-ui-ink-dim);
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}
	}

	.nimble-skill-editor {
		&__banner {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			min-height: 34px;
			margin: 0 0 4px;
			padding: 4px 4px 0;
			border: 0;
		}

		&__banner-info {
			display: flex;
			align-items: baseline;
			gap: 8px;
		}

		&__banner-title {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--nimble-ui-ink-dim);
		}

		&__banner-points {
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);

			&--spent {
				font-weight: 700;
				color: var(--nimble-ui-action);
			}
		}

		&__banner-actions {
			display: flex;
			gap: 6px;
		}

		&__btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			height: 26px;
			min-height: 0;
			margin: 0;
			padding: 0 9px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.75rem;
			font-weight: 700;
			line-height: 1;
			color: var(--nimble-ui-ink);
			white-space: nowrap;
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			&:disabled {
				border-style: dashed;
				background: none;
				color: var(--nimble-ui-ink-muted);
				cursor: not-allowed;
			}
		}

		&__ctrl {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			min-height: 0;
			margin: 0 1px;
			padding: 0;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.875rem;
			font-weight: 700;
			line-height: 1;
			color: var(--nimble-ui-ink-dim);
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}
		}
	}
</style>

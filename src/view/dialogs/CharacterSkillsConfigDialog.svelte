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
	.nimble-sheet__body--skill-config {
		padding-block-end: 0.75rem;
		padding-inline: 0.75rem;
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
</style>

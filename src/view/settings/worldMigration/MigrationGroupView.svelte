<script lang="ts">
	import type { MigrationGroupViewProps } from './MigrationGroupView.types.ts';
	import { type CopyRow, checkState } from '../../../migration/copyList.js';
	import { windowWord } from './worldMigrationWords.js';

	let { migration, copyList }: MigrationGroupViewProps = $props();

	const group = $derived(copyList.selectedGroup);
	const reviewing = $derived(copyList.reviewing);
	const showBoxes = $derived(copyList.showBoxes);
	const showRunState = $derived(copyList.showRunState);
</script>

{#snippet copyTitles(row: CopyRow, off: boolean)}
	<div class="nimble-world-migration__titles">
		{#each row.titles as entry (entry.title)}
			<span class:nimble-world-migration__skipped={off && !entry.always}>
				{#if entry.always}
					<i
						class="fa-solid fa-lock"
						data-tooltip={windowWord('alwaysRuns')}
						aria-label={windowWord('alwaysRuns')}
					></i>
				{/if}
				{entry.title}
			</span>
		{/each}
	</div>
{/snippet}

{#snippet rowCell(row: CopyRow)}
	{@const runState = copyList.rowState(row)}
	{#if showBoxes && row.excludable}
		<input
			type="checkbox"
			checked={checkState(row, migration.excluded) === 'on'}
			disabled={migration.locked}
			aria-label={windowWord('migrateCopy', { name: copyList.rowLabel(row) })}
			onchange={() => migration.toggle(row.uuids)}
		/>
	{:else if showRunState || runState === 'off'}
		<span class="nimble-world-migration__state nimble-world-migration__state--{runState}">
			{#if runState === 'done'}<i class="fa-solid fa-check"></i>{/if}
			{#if runState === 'now'}<i class="fa-solid fa-spinner fa-spin"></i>{/if}
			{#if runState === 'off'}<i class="fa-solid fa-ban"></i>{/if}
			{windowWord(`state.${runState}`)}
		</span>
	{/if}
{/snippet}

{#if reviewing}
	<div class="nimble-world-migration__choose-row">
		<label class="nimble-world-migration__choose" data-tooltip={windowWord('chooseHint')}>
			<input type="checkbox" bind:checked={migration.chooseCopies} disabled={migration.locked} />
			{windowWord('chooseCopies')}
		</label>
	</div>
{/if}

{#if group}
	{@const checked = checkState(group, migration.excluded)}
	<div class="nimble-world-migration__group-head">
		<h2 class="nimble-world-migration__heading">{copyList.groupName(group)}</h2>
		{#if copyList.hasGroupBox(group) && checked !== 'none'}
			<input
				type="checkbox"
				checked={checked === 'on'}
				{@attach (node) => {
					node.indeterminate = checked === 'mixed';
				}}
				disabled={migration.locked}
				aria-label={windowWord('migrateCopy', { name: copyList.groupName(group) })}
				onchange={() => migration.toggle(group.uuids)}
			/>
		{/if}
	</div>
	<p class="nimble-world-migration__meta">{copyList.groupWhere(group)}</p>

	<div class="nimble-world-migration__rows">
		{#each group.rows as row (row.key)}
			{@const off = row.excludable && checkState(row, migration.excluded) === 'off'}
			<div class="nimble-world-migration__row" class:nimble-world-migration__row--off={off}>
				<div>
					<span class="nimble-world-migration__name">{copyList.rowLabel(row)}</span>
					{#if row.matchedByName}
						<span class="nimble-world-migration__tag" data-tooltip={windowWord('matchedByNameHint')}
							>{windowWord('matchedByName')}</span
						>
					{/if}
					{#if row.isActor}
						<span class="nimble-world-migration__tag">{windowWord('monster')}</span>
					{/if}
					{@render copyTitles(row, off)}
				</div>
				{@render rowCell(row)}
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	.nimble-world-migration {
		&__choose-row {
			display: flex;
			justify-content: flex-end;
			margin-bottom: 0.25rem;
		}

		&__choose {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			white-space: nowrap;

			input {
				margin: 0;
			}
		}

		&__group-head {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
		}

		&__heading {
			margin: 0.125rem 0 0.25rem;
			padding: 0;
			border: 0;
			font-size: var(--nimble-lg-text);
			font-weight: 900;
		}

		&__meta {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__rows {
			display: flex;
			flex-direction: column;
			margin-top: 0.375rem;
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0;

			& + & {
				border-top: 1px dashed var(--nimble-card-border-color);
			}

			.nimble-world-migration__name {
				font-weight: 600;
			}

			&--off .nimble-world-migration__name {
				text-decoration: line-through;
				opacity: 0.65;
			}
		}

		&__titles {
			display: flex;
			flex-wrap: wrap;
			gap: 0.125rem 0.5rem;
			margin-top: 0.125rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			i {
				margin-right: 0.2rem;
				font-size: 0.6rem;
			}
		}

		&__skipped {
			text-decoration: line-through;
		}

		&__tag {
			margin-left: 0.375rem;
			padding: 0.05rem 0.3rem;
			font-size: var(--nimble-xxs-text);
			font-weight: 700;
			letter-spacing: 0.03em;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
		}

		&__state {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			white-space: nowrap;
			color: var(--nimble-medium-text-color);

			&--done {
				color: var(--nimble-roll-success-color);
			}

			&--now {
				font-weight: 700;
				color: var(--nimble-dark-text-color);
			}
		}
	}
</style>

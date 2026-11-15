<script lang="ts">
	import type { MigrationCopyListProps } from './MigrationCopyList.types.ts';
	import { type CopyRow, checkState } from '../../../migration/copyList.js';
	import { createMigrationCopyListState } from './MigrationCopyListState.svelte.ts';
	import { windowWord } from './worldMigrationWords.js';

	let { migration }: MigrationCopyListProps = $props();

	const copyList = createMigrationCopyListState(() => ({ migration }));
	const {
		isOpen,
		toggleOpen,
		rowLabel,
		groupName,
		groupCount,
		groupIcon,
		groupImage,
		rowState,
		groupState,
	} = copyList;
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
	{@const runState = rowState(row)}
	{#if showBoxes && row.excludable}
		<input
			type="checkbox"
			checked={checkState(row, migration.excluded) === 'on'}
			disabled={migration.locked}
			aria-label={windowWord('migrateCopy', { name: rowLabel(row) })}
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

<div class="nimble-world-migration__bar-row">
	<div class="nimble-world-migration__sort" role="group" aria-label={windowWord('sort')}>
		<button
			type="button"
			aria-pressed={migration.sort === 'item'}
			onclick={() => (migration.sort = 'item')}>{windowWord('byItem')}</button
		>
		<button
			type="button"
			aria-pressed={migration.sort === 'actor'}
			onclick={() => (migration.sort = 'actor')}>{windowWord('byActor')}</button
		>
	</div>
	{#if reviewing}
		<label class="nimble-world-migration__choose" data-tooltip={windowWord('chooseHint')}>
			<input type="checkbox" bind:checked={migration.chooseCopies} disabled={migration.locked} />
			{windowWord('chooseCopies')}
		</label>
	{/if}
</div>

<div class="nimble-world-migration__box nimble-world-migration__list">
	{#each migration.groups as group (group.key)}
		{@const open = isOpen(group.key)}
		{@const checked = checkState(group, migration.excluded)}
		{@const icon = groupIcon(group)}
		<section class="nimble-world-migration__group">
			<div class="nimble-world-migration__group-head">
				<button
					type="button"
					class="nimble-world-migration__expand"
					aria-expanded={open}
					onclick={() => toggleOpen(group.key)}
				>
					<i class="fa-solid fa-chevron-{open ? 'down' : 'right'}" aria-hidden="true"></i>
					{#if icon}
						<span class="nimble-world-migration__img"><i class={icon}></i></span>
					{:else}
						<img class="nimble-world-migration__img" src={groupImage(group)} alt="" />
					{/if}
					<span class="nimble-world-migration__name">{groupName(group)}</span>
					{#if group.sceneName}
						<span class="nimble-world-migration__meta"
							>{windowWord('inScene', { scene: group.sceneName })}</span
						>
					{/if}
				</button>
				<span class="nimble-world-migration__count">{groupCount(group)}</span>
				{#if showRunState}
					{@const runState = groupState(group)}
					<span class="nimble-world-migration__state nimble-world-migration__state--{runState}">
						{#if runState === 'done'}<i
								class="fa-solid fa-check"
								aria-label={windowWord('state.done')}
							></i>{/if}
						{#if runState === 'now'}<i
								class="fa-solid fa-spinner fa-spin"
								aria-label={windowWord('state.now')}
							></i>{/if}
					</span>
				{:else if showBoxes && checked !== 'none'}
					<input
						type="checkbox"
						checked={checked === 'on'}
						{@attach (node) => {
							node.indeterminate = checked === 'mixed';
						}}
						disabled={migration.locked}
						aria-label={windowWord('migrateCopy', { name: groupName(group) })}
						onchange={() => migration.toggle(group.uuids)}
					/>
				{/if}
			</div>
			{#if open}
				<div class="nimble-world-migration__rows">
					{#each group.rows as row (row.key)}
						{@const off = row.excludable && checkState(row, migration.excluded) === 'off'}
						<div class="nimble-world-migration__row" class:nimble-world-migration__row--off={off}>
							<div>
								<span class="nimble-world-migration__name">{rowLabel(row)}</span>
								{#if row.matchedByName}
									<span
										class="nimble-world-migration__tag"
										data-tooltip={windowWord('matchedByNameHint')}
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
		</section>
	{/each}
</div>

<style lang="scss">
	.nimble-world-migration {
		&__meta {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__box {
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__bar-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__sort {
			display: inline-flex;
			gap: 2px;
			padding: 2px;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 999px;

			button {
				all: unset;
				cursor: pointer;
				padding: 0.25rem 0.75rem;
				border-radius: 999px;
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: var(--nimble-dark-text-color);

				&[aria-pressed='true'] {
					background: var(--nimble-crimson);
					color: var(--nimble-navigation-active-text-color);
				}

				&:focus-visible {
					outline: 2px solid var(--nimble-input-focus-border-color);
				}
			}
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

		&__list {
			padding: 0 0.5rem;
		}

		&__group + &__group {
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__group-head {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0;
		}

		&__expand {
			all: unset;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			min-width: 0;

			> i {
				width: 0.75rem;
				font-size: 0.7rem;
				text-align: center;
				color: var(--nimble-medium-text-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-focus-border-color);
			}

			.nimble-world-migration__name {
				font-weight: 700;
			}
		}

		&__img {
			display: grid;
			flex: none;
			place-items: center;
			width: 1.75rem;
			height: 1.75rem;
			object-fit: cover;
			background: var(--nimble-image-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
		}

		&__count {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__rows {
			display: flex;
			flex-direction: column;
			margin: 0 0 0.375rem 1.25rem;
			padding-left: 0.5rem;
			border-left: 2px solid var(--nimble-card-border-color);
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

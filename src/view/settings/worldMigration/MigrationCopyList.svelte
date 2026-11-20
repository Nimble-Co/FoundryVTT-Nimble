<script lang="ts">
	import type { MigrationCopyListProps } from './MigrationCopyList.types.ts';
	import type { CopyGroup } from '../../../migration/copyList.js';
	import MigrationGroupView from './MigrationGroupView.svelte';
	import MigrationPanes from './MigrationPanes.svelte';
	import MigrationPickList from './MigrationPickList.svelte';
	import { createMigrationCopyListState } from './MigrationCopyListState.svelte.ts';
	import { windowWord } from './worldMigrationWords.js';

	let { migration }: MigrationCopyListProps = $props();

	const copyList = createMigrationCopyListState(() => ({ migration }));
	const {
		selectGroup,
		setSort,
		groupName,
		groupCount,
		groupLabel,
		groupIcon,
		groupImage,
		hasKeptOut,
		groupState,
	} = copyList;
	const selectedIndex = $derived(copyList.selectedIndex);
	const showRunState = $derived(copyList.showRunState);
</script>

{#snippet groupPick(group: CopyGroup)}
	{@const icon = groupIcon(group)}
	{@const runState = showRunState ? groupState(group) : null}
	{#if icon}
		<span class="nimble-world-migration__img"><i class={icon}></i></span>
	{:else}
		<img class="nimble-world-migration__img" src={groupImage(group)} alt="" />
	{/if}
	<span class="nimble-world-migration__name">{groupName(group)}</span>
	{#if runState === 'done'}
		<i class="fa-solid fa-check nimble-world-migration__state nimble-world-migration__state--done"
		></i>
	{:else if runState === 'now'}
		<i class="fa-solid fa-spinner fa-spin nimble-world-migration__state"></i>
	{:else}
		<span class="nimble-world-migration__count" data-tooltip={groupCount(group)}>
			{group.count}
			{#if !showRunState && hasKeptOut(group)}
				<i class="fa-solid fa-ban" data-tooltip={windowWord('state.off')}></i>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet side()}
	<div class="nimble-world-migration__sort" role="group" aria-label={windowWord('sort')}>
		<button type="button" aria-pressed={migration.sort === 'item'} onclick={() => setSort('item')}
			>{windowWord('byItem')}</button
		>
		<button type="button" aria-pressed={migration.sort === 'actor'} onclick={() => setSort('actor')}
			>{windowWord('byActor')}</button
		>
	</div>
	<MigrationPickList
		items={migration.groups}
		{selectedIndex}
		label={windowWord('groups')}
		itemKey={(group) => group.key}
		itemLabel={groupLabel}
		onSelect={selectGroup}
		pick={groupPick}
	/>
{/snippet}

{#snippet main()}
	<MigrationGroupView {migration} {copyList} />
{/snippet}

<MigrationPanes {side} {main} />

<style lang="scss">
	.nimble-world-migration {
		&__sort {
			display: inline-flex;
			align-self: flex-start;
			gap: 2px;
			margin-bottom: 0.375rem;
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

		&__img {
			display: grid;
			place-items: center;
			width: 1.75rem;
			height: 1.75rem;
			object-fit: cover;
			background: var(--nimble-image-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
		}

		&__name {
			font-weight: 600;
		}

		&__count {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-variant-numeric: tabular-nums;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__state--done {
			color: var(--nimble-roll-success-color);
		}
	}
</style>

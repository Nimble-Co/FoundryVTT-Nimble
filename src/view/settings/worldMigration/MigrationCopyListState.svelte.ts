import {
	type CopyGroup,
	type CopyRow,
	type CopySort,
	checkState,
} from '../../../migration/copyList.js';
import type { Holder } from '../../../migration/planMigration.js';
import type { RowState } from '../../../migration/worldMigration.svelte.js';
import type { MigrationCopyListProps } from './MigrationCopyList.types.ts';
import { windowWord } from './worldMigrationWords.js';

function holderLabel(holder: Holder, count: number, isActor: boolean): string {
	switch (holder.kind) {
		case 'actor':
			return holder.actorName ?? '';
		case 'token':
			return windowWord(count === 1 ? 'rowTokenOne' : 'rowToken', {
				count,
				name: holder.actorName ?? '',
				scene: holder.sceneName ?? '',
			});
		case 'compendium':
			return holder.packLabel ?? '';
		default:
			return isActor ? windowWord('actorsSidebar') : windowWord('itemsSidebar');
	}
}

function groupName(group: CopyGroup): string {
	if (group.kind === 'token')
		return windowWord(group.tokens === 1 ? 'groupTokenOne' : 'groupToken', {
			name: group.name,
			count: group.tokens ?? 0,
		});
	if (group.kind === 'sidebar') return windowWord('itemsSidebar');
	if (group.kind === 'compendium') return group.packLabel ?? '';
	return group.name;
}

/** The line under the group heading: where the group's copies are. */
function groupWhere(group: CopyGroup): string {
	switch (group.kind) {
		case 'item':
			return windowWord(group.count === 1 ? 'whereItemOne' : 'whereItem', { count: group.count });
		case 'token':
			return windowWord(group.tokens === 1 ? 'whereTokensOne' : 'whereTokens', {
				count: group.tokens ?? 0,
				scene: group.sceneName ?? '',
			});
		case 'actor':
			return windowWord('whereActor');
		case 'compendium':
			return windowWord('whereCompendium');
		default:
			return windowWord('whereSidebar');
	}
}

function groupIcon(group: CopyGroup): string | null {
	if (group.kind === 'sidebar') return 'fa-solid fa-suitcase';
	if (group.kind === 'compendium') return 'fa-solid fa-book';
	return null;
}

function groupImage(group: CopyGroup): string {
	return (
		group.img ?? (group.kind === 'item' ? 'icons/svg/item-bag.svg' : 'icons/svg/mystery-man.svg')
	);
}

export function createMigrationCopyListState(getProps: () => MigrationCopyListProps) {
	const migration = $derived(getProps().migration);
	const reviewing = $derived(migration.phase === 'review');
	const stopped = $derived(migration.phase === 'stopped');
	const showBoxes = $derived(reviewing && migration.chooseCopies);
	const showRunState = $derived(migration.phase === 'running' || stopped);

	let selectedKey = $state<string | null>(null);
	const selectedIndex = $derived(
		Math.max(
			0,
			migration.groups.findIndex((group) => group.key === selectedKey),
		),
	);
	const selectedGroup: CopyGroup | undefined = $derived(migration.groups[selectedIndex]);

	function selectGroup(index: number): void {
		selectedKey = migration.groups[index]?.key ?? null;
	}

	/** A new sort starts at its first group. */
	function setSort(sort: CopySort): void {
		if (migration.sort === sort) return;
		migration.sort = sort;
		selectedKey = null;
	}

	function rowLabel(row: CopyRow): string {
		if (migration.sort === 'actor') return row.name;
		return holderLabel(row.holder, row.uuids.length, row.isActor);
	}

	function groupCount(group: CopyGroup): string {
		if (migration.sort === 'item')
			return windowWord(group.count === 1 ? 'oneCopy' : 'copies', { count: group.count });
		return windowWord(group.count === 1 ? 'oneItem' : 'items', { count: group.count });
	}

	function hasKeptOut(group: CopyGroup): boolean {
		const state = checkState(group, migration.excluded);
		return state === 'off' || state === 'mixed';
	}

	/** A group of one row needs no box of its own: the row's box covers it. */
	function hasGroupBox(group: CopyGroup): boolean {
		return showBoxes && group.rows.filter((row) => row.excludable).length > 1;
	}

	/** A run that stopped writes nothing now, so a row it was writing waits. */
	function settled(runState: RowState): RowState {
		return stopped && runState === 'now' ? 'waiting' : runState;
	}

	function rowState(row: CopyRow): RowState {
		return settled(migration.rowState(row));
	}

	function groupState(group: CopyGroup): RowState {
		return settled(migration.groupState(group));
	}

	/** What a screen reader says for a pick: name, count, and its run state or a kept-out copy. */
	function groupLabel(group: CopyGroup): string {
		const parts = [groupName(group), groupCount(group)];
		const runState = showRunState ? groupState(group) : null;
		if (runState === 'done' || runState === 'now') parts.push(windowWord(`state.${runState}`));
		else if (!showRunState && hasKeptOut(group)) parts.push(windowWord('state.off'));
		return parts.join(', ');
	}

	return {
		get reviewing() {
			return reviewing;
		},
		get showBoxes() {
			return showBoxes;
		},
		get showRunState() {
			return showRunState;
		},
		get selectedIndex() {
			return selectedIndex;
		},
		get selectedGroup() {
			return selectedGroup;
		},
		selectGroup,
		setSort,
		rowLabel,
		groupName,
		groupWhere,
		groupCount,
		groupLabel,
		groupIcon,
		groupImage,
		hasKeptOut,
		hasGroupBox,
		rowState,
		groupState,
	};
}

export type MigrationCopyListState = ReturnType<typeof createMigrationCopyListState>;

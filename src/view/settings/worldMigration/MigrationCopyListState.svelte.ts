import type { CopyGroup, CopyRow } from '../../../migration/copyList.js';
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

	let openGroups = $state.raw<Set<string>>(new Set());

	function isOpen(key: string): boolean {
		return openGroups.has(key);
	}

	function toggleOpen(key: string): void {
		const next = new Set(openGroups);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		openGroups = next;
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
		isOpen,
		toggleOpen,
		rowLabel,
		groupName,
		groupCount,
		groupIcon,
		groupImage,
		rowState,
		groupState,
	};
}

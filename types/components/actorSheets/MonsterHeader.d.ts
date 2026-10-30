import type { MonsterAbilitiesTabView } from '#view/actorSheets/monster/monsterAbilitiesTab.ts';
import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterRailView } from '#view/actorSheets/monster/monsterRail.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterHeaderProps {
	view: MonsterRailView;
	ui: SheetUiState;
	perform: MonsterPerform;
	/** Expand all of the Abilities tab; null on the other tabs */
	expandAll: { allOpen: boolean; onclick: () => void } | null;
	/** edit mode on the Abilities tab; null on the other tabs or for a user who cannot change the monster */
	createFeature: MonsterAbilitiesTabView['createFeature'];
}

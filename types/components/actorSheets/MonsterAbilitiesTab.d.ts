import type { MonsterAbilitiesTabView } from '#view/actorSheets/monster/monsterAbilitiesTab.ts';
import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterAbilitiesTabProps {
	view: MonsterAbilitiesTabView;
	ui: SheetUiState;
	perform: MonsterPerform;
}

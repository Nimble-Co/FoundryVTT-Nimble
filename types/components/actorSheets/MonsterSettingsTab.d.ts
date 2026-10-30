import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterSettingsTabView } from '#view/actorSheets/monster/monsterSettingsTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterSettingsTabProps {
	view: MonsterSettingsTabView;
	ui: SheetUiState;
	perform: MonsterPerform;
}

import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterSource } from '#view/actorSheets/monster/monsterSource.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterSheetProps {
	source: () => MonsterSource;
	ui: SheetUiState;
	perform: MonsterPerform;
}

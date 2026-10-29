import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { EffectsTabView } from '#view/actorSheets/shared/effectsTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterEffectsTabProps {
	view: EffectsTabView;
	ui: SheetUiState;
	perform: MonsterPerform;
}

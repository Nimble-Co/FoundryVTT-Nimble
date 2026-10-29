import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroSettingsTabView } from '#view/actorSheets/hero/heroSettingsTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroSettingsTabProps {
	view: HeroSettingsTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}

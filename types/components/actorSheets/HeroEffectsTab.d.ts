import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroEffectsTabView } from '#view/actorSheets/hero/heroEffectsTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroEffectsTabProps {
	view: HeroEffectsTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}

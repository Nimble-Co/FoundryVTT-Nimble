import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroFeaturesTabView } from '#view/actorSheets/hero/heroFeaturesTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroFeaturesTabProps {
	view: HeroFeaturesTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}

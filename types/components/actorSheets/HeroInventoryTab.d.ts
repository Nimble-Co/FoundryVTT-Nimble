import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroInventoryTabView } from '#view/actorSheets/hero/heroInventoryTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroInventoryTabProps {
	view: HeroInventoryTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}

import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroSpellsTabView } from '#view/actorSheets/hero/heroSpellsTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroSpellsTabProps {
	view: HeroSpellsTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}

import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRowView } from '#view/actorSheets/hero/heroRows.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroRowProps {
	row: HeroRowView;
	ui: SheetUiState;
	perform: HeroPerform;
}

import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRowGroup } from '#view/actorSheets/hero/heroRows.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroRowGroupListProps {
	groups: HeroRowGroup[];
	ui: SheetUiState;
	perform: HeroPerform;
	/** the groups flow in columns about 300 px wide */
	flow?: boolean;
	/** the line in an empty group; leave it out to hide nothing and show nothing */
	none?: string;
}

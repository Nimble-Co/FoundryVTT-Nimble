import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroSource } from '#view/actorSheets/hero/heroSource.ts';

export interface HeroSheetStoryProps {
	source: () => HeroSource;
	perform: HeroPerform;
	width: number;
	height: number;
	editing: boolean;
	/** the tab at the start; default core */
	tab?: string;
	/** theme-light or theme-dark; leave it out to follow the toolbar */
	theme?: string;
}

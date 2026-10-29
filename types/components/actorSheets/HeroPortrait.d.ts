import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';

export interface HeroPortraitProps {
	view: HeroRailView;
	/** `rail`: fills the box; `header`: the right part of the narrow header */
	form: 'rail' | 'header';
}

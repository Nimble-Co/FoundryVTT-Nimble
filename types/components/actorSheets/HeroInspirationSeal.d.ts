import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';

export interface HeroInspirationSealProps {
	inspiration: HeroRailView['inspiration'];
	perform: HeroPerform;
}

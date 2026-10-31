import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroSettingsTabView } from '#view/actorSheets/hero/heroSettingsTab.ts';

export interface HeroSettingsTabProps {
	view: HeroSettingsTabView;
	perform: HeroPerform;
}

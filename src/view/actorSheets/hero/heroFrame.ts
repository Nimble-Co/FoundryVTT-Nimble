import type { SheetTab } from '../parts/types.ts';
import type { HeroSheetContext } from './heroSource.ts';

/** The eight fixed slots of the character sheet. Each tab comes in with the PR that builds it. */
export type HeroTabId =
	| 'core'
	| 'actions'
	| 'features'
	| 'inventory'
	| 'spells'
	| 'effects'
	| 'bio'
	| 'settings';

const BUILT: { id: HeroTabId; icon: string }[] = [{ id: 'core', icon: 'fa-solid fa-home' }];

export function heroTabs(context: HeroSheetContext): SheetTab[] {
	return BUILT.map(({ id, icon }) => ({
		id,
		icon,
		label: context.localize(`NIMBLE.actorSheet.hero.tabs.${id}`),
	}));
}

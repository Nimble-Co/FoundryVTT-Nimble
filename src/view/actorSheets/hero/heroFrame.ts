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
const FRAME = 'NIMBLE.actorSheet.hero.frame';

export interface HeroFrameView {
	tabsLabel: string;
	tabs: SheetTab[];
	/** the band at the top of the tab in edit mode */
	editBand: { title: string; hint: string; done: string };
}

/** The tabs and the edit band of the character sheet. */
export function heroFrame(context: HeroSheetContext): HeroFrameView {
	const { localize } = context;
	return {
		tabsLabel: localize('NIMBLE.actorSheet.hero.tabs.label'),
		tabs: BUILT.map(({ id, icon }) => ({
			id,
			icon,
			label: localize(`NIMBLE.actorSheet.hero.tabs.${id}`),
		})),
		editBand: {
			title: localize(`${FRAME}.editing`),
			hint: localize(`${FRAME}.editingHint`),
			done: localize(`${FRAME}.done`),
		},
	};
}

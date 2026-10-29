import type { SheetTab } from '../parts/types.ts';
import { effectsOnHero } from './heroEffectsTab.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

/** The eight fixed slots of the character sheet. */
export type HeroTabId =
	| 'core'
	| 'actions'
	| 'features'
	| 'inventory'
	| 'spells'
	| 'effects'
	| 'bio'
	| 'settings';

const TABS: { id: HeroTabId; icon: string }[] = [
	{ id: 'core', icon: 'fa-solid fa-home' },
	{ id: 'actions', icon: 'fa-solid fa-bolt' },
	{ id: 'features', icon: 'fa-solid fa-table-list' },
	{ id: 'inventory', icon: 'fa-solid fa-box-open' },
	{ id: 'spells', icon: 'fa-solid fa-wand-sparkles' },
	{ id: 'effects', icon: 'fa-solid fa-heart-pulse' },
	{ id: 'bio', icon: 'fa-solid fa-file-lines' },
	{ id: 'settings', icon: 'fa-solid fa-cog' },
];
const FRAME = 'NIMBLE.actorSheet.hero.frame';

export interface HeroFrameView {
	tabsLabel: string;
	tabs: SheetTab[];
	/** the band at the top of the tab in edit mode */
	editBand: { title: string; hint: string; done: string };
}

/** The tabs, with the count of what is on the hero on Effects, and the edit band. */
export function heroFrame(actor: HeroActorLike, context: HeroSheetContext): HeroFrameView {
	const { localize, format } = context;
	const onHero = effectsOnHero(actor, context);
	return {
		tabsLabel: localize('NIMBLE.actorSheet.hero.tabs.label'),
		tabs: TABS.map(({ id, icon }) => ({
			id,
			icon,
			label: localize(`NIMBLE.actorSheet.hero.tabs.${id}`),
			...(id === 'effects'
				? {
						badge: onHero,
						badgeTitle: format('NIMBLE.actorSheet.hero.tabs.effectsBadge', {
							count: String(onHero),
						}),
					}
				: {}),
		})),
		editBand: {
			title: localize(`${FRAME}.editing`),
			hint: localize(`${FRAME}.editingHint`),
			done: localize(`${FRAME}.done`),
		},
	};
}

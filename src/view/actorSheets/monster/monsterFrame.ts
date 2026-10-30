import type { SheetTab } from '../parts/types.ts';
import { effectLists, effectsOnCount } from '../shared/effectLists.ts';
import type { MonsterActorLike, MonsterSheetContext } from './monsterSource.ts';

/** The four tabs of the NPC sheet. */
export type MonsterTabId = 'abilities' | 'effects' | 'notes' | 'settings';

const TABS: { id: MonsterTabId; icon: string }[] = [
	{ id: 'abilities', icon: 'fa-solid fa-home' },
	{ id: 'effects', icon: 'fa-solid fa-heart-pulse' },
	{ id: 'notes', icon: 'fa-solid fa-scroll' },
	{ id: 'settings', icon: 'fa-solid fa-cog' },
];

export interface MonsterFrameView {
	tabsLabel: string;
	tabs: SheetTab[];
	/** the band at the top of the tab in edit mode */
	editBand: { title: string; hint: string; done: string };
}

const FRAME = 'NIMBLE.actorSheet.monster.frame';

/** The tabs, with the count of what is on the monster on Effects, and the edit band. */
export function monsterFrame(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): MonsterFrameView {
	const { localize, format } = context;
	const onMonster = effectsOnCount(
		effectLists(actor.effects, context.conditions, context.labels.conditions),
	);
	return {
		tabsLabel: localize('NIMBLE.actorSheet.monster.tabs.label'),
		tabs: TABS.map(({ id, icon }) => ({
			id,
			icon,
			label: localize(`NIMBLE.actorSheet.monster.tabs.${id}`),
			...(id === 'effects'
				? {
						badge: onMonster,
						badgeTitle: format('NIMBLE.actorSheet.monster.tabs.effectsBadge', {
							count: String(onMonster),
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

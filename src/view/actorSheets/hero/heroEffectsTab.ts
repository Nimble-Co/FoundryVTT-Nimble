import { effectLists, effectsOnCount } from '../shared/effectLists.ts';
import { type EffectRowView, type EffectsTabView, effectsTab } from '../shared/effectsTab.ts';
import type { HeroRowGroup, HeroRowView } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

export interface HeroEffectsTabView {
	/** Active effects, Conditions on you, Passive effects: always all three */
	groups: HeroRowGroup[];
	/** the line in an empty group */
	none: string;
	conditions: EffectsTabView['conditions'];
}

/** The count on the Effects tab: what is on the hero now, not the passive effects. */
export function effectsOnHero(actor: HeroActorLike, context: HeroSheetContext): number {
	return effectsOnCount(effectLists(actor.effects, context.conditions, context.labels.conditions));
}

function heroRow({ lasts, ...row }: EffectRowView): HeroRowView {
	return { ...row, cost: { text: lasts }, choice: null, drag: null, fields: [] };
}

/** Active effects, the conditions on the hero and the passive effects; under them, every condition. */
export function heroEffectsTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroEffectsTabView {
	const view = effectsTab({
		effects: actor.effects,
		items: actor.items,
		conditions: context.conditions,
		conditionLabels: context.labels.conditions,
		localize: context.localize,
		format: context.format,
		conditionsOnLabel: context.localize('NIMBLE.actorSheet.hero.effects.conditionsOn'),
	});
	return {
		...view,
		groups: view.groups.map((group) => ({ ...group, rows: group.rows.map(heroRow) })),
	};
}

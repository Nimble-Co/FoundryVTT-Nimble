import { effectLists, effectsOnCount } from '../shared/effectLists.ts';
import { type EffectRowView, type EffectsTabView, effectsTab } from '../shared/effectsTab.ts';
import { byName } from '../shared/rowOrder.ts';
import type { HeroRowGroup, HeroRowView } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const INSPIRATION = 'NIMBLE.actorSheet.hero.effects.inspiration';

export interface HeroEffectsTabView {
	/** Active effects, Conditions on you, Passive effects: always all three */
	groups: HeroRowGroup[];
	/** the line in an empty group */
	none: string;
	conditions: EffectsTabView['conditions'];
}

/** The count on the Effects tab: what is on the hero now, not the passive effects. */
export function effectsOnHero(actor: HeroActorLike, context: HeroSheetContext): number {
	const count = effectsOnCount(
		effectLists(actor.effects, context.conditions, context.labels.conditions),
	);
	return count + (actor.system.resources.inspiration ? 1 : 0);
}

function heroRow({ lasts, ...row }: EffectRowView): HeroRowView {
	return { ...row, cost: { text: lasts }, choice: null, drag: null, fields: [] };
}

/** Inspiration is not an ActiveEffect, but it is on the hero until it is spent or a Safe Rest. */
function inspirationRow(context: HeroSheetContext): HeroRowView {
	const { localize, format } = context;
	const name = localize(`${INSPIRATION}.name`);
	const lasts = localize(`${INSPIRATION}.lasts`);
	return {
		id: 'inspiration',
		name,
		icon: 'fa-solid fa-star',
		summary: localize(`${INSPIRATION}.summary`),
		description: localize(`${INSPIRATION}.description`),
		cost: { text: lasts },
		facts: [[localize('NIMBLE.actorSheet.shared.effects.facts.lasts'), lasts]],
		use: {
			kind: 'act',
			label: format('NIMBLE.actorSheet.shared.endName', { name }),
			intent: { kind: 'setInspiration', value: false },
		},
		choice: null,
		edit: null,
		drag: null,
		fields: [],
	};
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
	const groups = view.groups.map((group): HeroRowGroup => {
		const rows = group.rows.map(heroRow);
		if (group.id !== 'active' || !actor.system.resources.inspiration) return { ...group, rows };
		const withInspiration = byName([...rows, inspirationRow(context)]);
		return { ...group, note: String(withInspiration.length), rows: withInspiration };
	});
	return { ...view, groups };
}

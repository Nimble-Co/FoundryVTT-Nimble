import type { ViewOption } from '../parts/types.ts';
import { spellsBySchool, spellsByTier } from '../shared/rowOrder.ts';
import type { HeroIntent } from './heroIntent.ts';
import { type HeroRowGroup, itemRow } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext, SpellsBy } from './heroSource.ts';

const SPELLS = 'NIMBLE.actorSheet.hero.spells';

export interface HeroSpellsTabView {
	by: SpellsBy;
	groupBy: { label: string; options: ViewOption[]; intents: Record<SpellsBy, HeroIntent> };
	groups: HeroRowGroup[];
	/** shown in edit mode */
	createSpell: { label: string; intent: HeroIntent };
	/** the hero has no spells */
	empty: string | null;
}

/** By tier (A to Z in each tier) or by school (cantrips, then each tier, then A to Z). */
export function heroSpellsTab(actor: HeroActorLike, context: HeroSheetContext): HeroSpellsTabView {
	const { localize } = context;
	const by: SpellsBy = actor.flags.spellsBy === 'school' ? 'school' : 'tier';
	const spells = actor.items.filter((item) => item.type === 'spell');
	const groups: HeroRowGroup[] =
		by === 'tier'
			? spellsByTier(spells).map(({ tier, spells: entries }) => ({
					id: `tier-${tier}`,
					label: localize(`NIMBLE.spells.tierHeadings.tier${tier}`),
					rows: entries.map((spell) => itemRow(actor, spell, context)),
				}))
			: spellsBySchool(spells).map(({ school, spells: entries }) => ({
					id: `school-${school || 'none'}`,
					label: context.labels.spellSchools[school] ?? (school || localize(`${SPELLS}.noSchool`)),
					rows: entries.map((spell) => itemRow(actor, spell, context, { withTier: true })),
				}));
	return {
		by,
		groupBy: {
			label: localize(`${SPELLS}.groupBy`),
			options: [
				{ value: 'tier', label: localize(`${SPELLS}.byTier`) },
				{ value: 'school', label: localize(`${SPELLS}.bySchool`) },
			],
			intents: {
				tier: { kind: 'setSpellsBy', value: 'tier' },
				school: { kind: 'setSpellsBy', value: 'school' },
			},
		},
		groups,
		createSpell: {
			label: localize(`${SPELLS}.create`),
			intent: { kind: 'createItem', itemType: 'spell' },
		},
		empty: spells.length ? null : localize(`${SPELLS}.none`),
	};
}

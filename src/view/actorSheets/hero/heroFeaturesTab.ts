import { isAutoGrantGroup } from '#utils/classProgression/getClassFeatures.ts';
import formatGroupName from '#utils/formatGroupName.ts';
import { placeOf } from '../shared/placeOf.ts';
import { byName } from '../shared/rowOrder.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import type { HeroIntent } from './heroIntent.ts';
import { type HeroRowGroup, type HeroRowView, itemRow } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const FEAT = 'NIMBLE.actorSheet.hero.features';

/** The cards that stand for a class, an ancestry or a background come before what they give. */
const CARD_TYPES = new Set(['class', 'subclass', 'ancestry', 'background']);

export interface HeroFeaturesTabView {
	groups: HeroRowGroup[];
	/** shown in edit mode */
	createFeature: { label: string; intent: HeroIntent };
	empty: string | null;
}

/** The level at which you got the item; no level sorts last. */
function levelOf(item: ItemLike): number {
	const { gainedAtLevel, gainedAtLevels } = item.system as {
		gainedAtLevel?: number | null;
		gainedAtLevels?: number[];
	};
	if (typeof gainedAtLevel === 'number') return gainedAtLevel;
	if (Array.isArray(gainedAtLevels) && gainedAtLevels.length) return Math.min(...gainedAtLevels);
	return Number.POSITIVE_INFINITY;
}

/** Cards first, then by level, then A to Z. */
function byLevel(items: ItemLike[]): ItemLike[] {
	const rank = (item: ItemLike) => (CARD_TYPES.has(item.type) ? -1 : levelOf(item));
	return byName(items).sort((a, b) => rank(a) - rank(b));
}

const groupOf = (item: ItemLike) => String(item.system.group || 'ungrouped');

function featureRow(actor: HeroActorLike, item: ItemLike, context: HeroSheetContext): HeroRowView {
	const { localize, format } = context;
	const row = itemRow(actor, item, context);
	const facts = [...row.facts];
	const level = levelOf(item);
	if (Number.isFinite(level)) facts.push([localize(`${FEAT}.facts.level`), String(level)]);
	const boonType = item.type === 'boon' ? String(item.system.boonType ?? '') : '';
	if (boonType)
		facts.push([localize(`${FEAT}.facts.boonType`), localize(`NIMBLE.boonTypes.${boonType}`)]);
	if (item.type === 'feature' && placeOf(item) !== 'passive') return { ...row, facts };
	return {
		...row,
		cost: { uses: row.cost.uses },
		facts: facts.filter(([label]) => label !== localize('NIMBLE.actorSheet.shared.facts.cost')),
		use:
			row.use?.kind === 'act'
				? { ...row.use, label: format(`${FEAT}.post`, { name: item.name }) }
				: row.use,
	};
}

/**
 * The groups of today's Features tab (#570): a class holds its class features, its subclass and
 * each selection group under a subheading; an ancestry holds its bonuses. With no card to nest
 * under, those stand as groups of their own. In each group: by level, then A to Z.
 */
export function heroFeaturesTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroFeaturesTabView {
	const { localize } = context;
	const rows = (items: ItemLike[]) =>
		byLevel(items).map((item) => featureRow(actor, item, context));
	const ofType = (type: string) => actor.items.filter((item) => item.type === type);
	const features = ofType('feature');
	const subclassFeatures = features.filter((item) => item.system.subclass);
	const classFeatures = features.filter(
		(item) => !item.system.subclass && isAutoGrantGroup(groupOf(item)),
	);
	const selections = new Map<string, ItemLike[]>();
	for (const item of features) {
		if (item.system.subclass || isAutoGrantGroup(groupOf(item))) continue;
		selections.set(groupOf(item), [...(selections.get(groupOf(item)) ?? []), item]);
	}
	const selectionGroups = [...selections.entries()]
		.map(([key, items]) => ({
			id: `group-${key}`,
			label: context.labels.featureGroups[key] ?? formatGroupName(key),
			rows: rows(items),
			lowest: Math.min(...items.map(levelOf)),
			key,
		}))
		.sort((a, b) => a.lowest - b.lowest || a.key.localeCompare(b.key))
		.map(({ id, label, rows: entries }) => ({ id, label, rows: entries }));

	const classes = ofType('class');
	const subclasses = ofType('subclass');
	const ancestries = ofType('ancestry');
	const bonuses = ofType('ancestryBonus');
	const subclassItems = [...subclasses, ...subclassFeatures];
	const subclassLabel = subclasses[0]?.name ?? localize(`${FEAT}.subclass`);
	const group = (id: string, label: string, items: ItemLike[]): HeroRowGroup => ({
		id,
		label,
		rows: rows(items),
	});

	const groups: HeroRowGroup[] = [];
	if (classes.length) {
		groups.push({
			...group('class', localize('NIMBLE.featureTypes.class'), [...classes, ...classFeatures]),
			subgroups: [
				...(subclassItems.length
					? [{ id: 'subclass', label: subclassLabel, rows: rows(subclassItems) }]
					: []),
				...selectionGroups,
			],
		});
	} else {
		if (subclassItems.length) groups.push(group('subclass', subclassLabel, subclassItems));
		if (classFeatures.length)
			groups.push(group('feature', localize('NIMBLE.featureTypeHeadings.feature'), classFeatures));
		groups.push(...selectionGroups);
	}
	const exotic = ancestries.some((item) => item.system.exotic === true);
	if (ancestries.length || bonuses.length) {
		groups.push({
			...group(
				'ancestry',
				localize(`NIMBLE.featureTypeHeadings.${ancestries.length ? 'ancestry' : 'ancestryBonus'}`),
				[...ancestries, ...bonuses],
			),
			note: exotic ? localize(`${FEAT}.exotic`) : undefined,
		});
	}
	for (const type of ['background', 'boon']) {
		const items = ofType(type);
		if (items.length)
			groups.push(group(type, localize(`NIMBLE.featureTypeHeadings.${type}`), items));
	}

	return {
		groups,
		createFeature: {
			label: localize(`${FEAT}.create`),
			intent: { kind: 'createItem', itemType: 'feature' },
		},
		empty: groups.length ? null : localize(`${FEAT}.none`),
	};
}

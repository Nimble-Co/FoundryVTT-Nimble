import { byName } from '../shared/rowOrder.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import type { HeroIntent } from './heroIntent.ts';
import { type HeroRowGroup, type HeroRowView, itemRow } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const INV = 'NIMBLE.actorSheet.hero.inventory';

/** The Inventory groups in order. Shields go with the armor. */
const GROUPS: { id: string; types: string[] }[] = [
	{ id: 'weapon', types: ['weapon'] },
	{ id: 'armor', types: ['armor', 'shield'] },
	{ id: 'consumable', types: ['consumable'] },
	{ id: 'misc', types: ['misc'] },
];
const COINS = ['gp', 'sp', 'cp'];
const EQUIPPABLE = new Set(['weapon', 'armor', 'shield']);

export interface HeroCoinView {
	coin: string;
	label: string;
	/** the label of the number field */
	name: string;
	value: number;
}

export interface HeroInventoryTabView {
	coins: HeroCoinView[];
	/** null: the hero does not track inventory slots */
	slots: { text: string; label: string; over: string | null } | null;
	createObject: { label: string; intent: HeroIntent };
	groups: HeroRowGroup[];
	/** the hero carries no objects */
	empty: string | null;
}

type Container = { enabled?: boolean; capacity?: number | null; requiresEquipped?: boolean };

const objectType = (item: ItemLike) => String(item.system.objectType ?? 'misc');
const containerOf = (item: ItemLike) => (item.system.container ?? {}) as Container;
const isContainer = (item: ItemLike) => containerOf(item).enabled === true;
const storedIn = (item: ItemLike) => String(item.system.containerId ?? '');
const quantityOf = (item: ItemLike) => {
	const quantity = Number(item.system.quantity ?? 1);
	return Number.isFinite(quantity) ? quantity : 1;
};

/**
 * Weapons, armor and shields have the EQUIP tag, and so does each object whose rules the tag
 * switches, or a container that applies its rule only while equipped. A stored object is packed away.
 */
function canEquip(item: ItemLike): boolean {
	if (storedIn(item)) return false;
	if (EQUIPPABLE.has(objectType(item)) || item.rules.length > 0) return true;
	return isContainer(item) && containerOf(item).requiresEquipped === true;
}

function objectRow(
	actor: HeroActorLike,
	item: ItemLike,
	context: HeroSheetContext,
	options: { containers: ItemLike[]; stored: ItemLike[]; indent: boolean },
): HeroRowView {
	const { localize, format } = context;
	const row = itemRow(actor, item, context);
	const name = item.name;
	const quantity = quantityOf(item);
	const facts = [...row.facts];
	let text: string | undefined;
	let summary = row.summary;
	let summaryTone: HeroRowView['summaryTone'];
	let remove = row.remove;

	if (isContainer(item)) {
		const { capacity } = containerOf(item);
		const used = actor.system.inventory.containerCapacityUsage[item.id] ?? 0;
		if (!options.stored.length) text = localize(`${INV}.empty`);
		else if (typeof capacity === 'number') {
			text = format(`${INV}.capacity`, { used: String(used), capacity: String(capacity) });
			if (used > capacity) {
				summary = format(`${INV}.overCapacity`, { used: String(used), capacity: String(capacity) });
				summaryTone = 'warn';
			}
		}
		if (options.stored.length && remove) {
			remove = {
				...remove,
				question: format('NIMBLE.containers.deleteStocked', {
					container: name,
					count: String(options.stored.length),
				}),
			};
		}
	} else {
		if (quantity !== 1) text = format(`${INV}.quantity`, { count: String(quantity) });
		facts.push([localize(`${INV}.facts.quantity`), String(quantity)]);
	}

	const holder = options.containers.find((container) => container.id === storedIn(item));
	if (holder) facts.push([localize(`${INV}.facts.storedIn`), holder.name]);

	const others = isContainer(item)
		? []
		: options.containers.filter((entry) => entry.id !== item.id);
	return {
		...row,
		summary,
		summaryTone,
		cost: { ...row.cost, text },
		facts,
		indent: options.indent || undefined,
		equip: canEquip(item)
			? { on: item.system.equipped === true, intent: { kind: 'toggleEquip', itemId: item.id } }
			: undefined,
		storeIn: others.length
			? {
					itemId: item.id,
					label: format(`${INV}.storeIn`, { name }),
					value: holder?.id ?? '',
					options: [
						{ value: '', label: localize(`${INV}.loose`) },
						...others.map((container) => ({ value: container.id, label: container.name })),
					],
				}
			: undefined,
		dropInto: isContainer(item) ? item.id : storedIn(item),
		remove,
		fields: isContainer(item)
			? row.fields
			: [
					{
						kind: 'quantity',
						itemId: item.id,
						label: format(`${INV}.quantityOf`, { name }),
						value: quantity,
					},
					...row.fields,
				],
	};
}

/** Groups by object type, A to Z; the objects in a container show under it. */
export function heroInventoryTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroInventoryTabView {
	const { localize, format } = context;
	const objects = actor.items.filter((item) => item.type === 'object');
	const containers = byName(objects.filter(isContainer));
	const containerIds = new Set(containers.map((container) => container.id));
	const storedBy = (id: string) => byName(objects.filter((item) => storedIn(item) === id));
	const loose = objects.filter((item) => !containerIds.has(storedIn(item)));

	const groups = GROUPS.map(({ id, types }): HeroRowGroup => {
		const inGroup = loose.filter((item) =>
			id === 'misc'
				? !GROUPS.some((group) => group.id !== 'misc' && group.types.includes(objectType(item)))
				: types.includes(objectType(item)),
		);
		return {
			id,
			label: localize(`NIMBLE.objectTypeHeadings.${id}`),
			rows: byName(inGroup).flatMap((item) => {
				const stored = isContainer(item) ? storedBy(item.id) : [];
				return [
					objectRow(actor, item, context, { containers, stored, indent: false }),
					...stored.map((entry) =>
						objectRow(actor, entry, context, { containers, stored: [], indent: true }),
					),
				];
			}),
		};
	}).filter((group) => group.rows.length);

	const { usedSlots, totalSlots } = actor.system.inventory;
	const slotData = { used: String(usedSlots), total: String(totalSlots) };
	return {
		coins: COINS.map((coin) => {
			const label = localize(`NIMBLE.currencyAbbreviations.${coin}`);
			return {
				coin,
				label,
				name: format(`${INV}.coin`, { coin: label }),
				value: Number(actor.system.currency[coin] ?? 0),
			};
		}),
		slots:
			actor.flags.trackInventorySlots === false
				? null
				: {
						text: format(`${INV}.slots`, slotData),
						label: localize(`${INV}.slotsLabel`),
						over: usedSlots > totalSlots ? format(`${INV}.overSlots`, slotData) : null,
					},
		createObject: {
			label: localize(`${INV}.create`),
			intent: { kind: 'createItem', itemType: 'object' },
		},
		groups,
		empty: objects.length ? null : localize(`${INV}.none`),
	};
}

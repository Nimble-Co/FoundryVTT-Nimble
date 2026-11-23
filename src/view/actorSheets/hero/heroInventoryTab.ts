import { COIN_ABBREVIATION, COIN_DENOMINATIONS } from '#utils/coins.ts';
import { OBJECT_SIZE_TYPES_WITH_QUANTITY } from '../../../models/item/objectQuantity.js';
import { byName } from '../shared/rowOrder.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import type { HeroIntent } from './heroIntent.ts';
import { type HeroRowGroup, type HeroRowView, itemRow } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

/** The Inventory groups in order. Shields go with the armor. */
const GROUPS: { id: string; types: string[] }[] = [
	{ id: 'weapon', types: ['weapon'] },
	{ id: 'armor', types: ['armor', 'shield'] },
	{ id: 'consumable', types: ['consumable'] },
	{ id: 'misc', types: ['misc'] },
];
const EQUIPPABLE = new Set(['weapon', 'armor', 'shield']);

export interface HeroCoinView {
	coin: string;
	label: string;
	/** the label of the number field */
	name: string;
	value: number;
}

export interface HeroCurrencyDestination {
	id: string;
	label: string;
	intent: HeroIntent;
}

export interface HeroInventoryTabView {
	/** the list is the party inventory */
	party: boolean;
	/** accessible name of the My Inventory / Party Inventory tabs */
	listsLabel: string;
	mineLabel: string;
	partyLabel: string;
	coins: HeroCoinView[];
	/** the coin fields do not edit: this user cannot move objects from the party inventory */
	coinsLocked: boolean;
	/** null: this user has nowhere to send the coins on this list */
	currencyGive: {
		/** the tooltip on the button beside the coins */
		label: string;
		move: { label: string; entries: HeroCurrencyDestination[] } | null;
		give: { label: string; entries: HeroCurrencyDestination[] } | null;
	} | null;
	/** null: the hero does not track inventory slots, or the list is the party inventory */
	slots: { text: string; label: string; over: string | null } | null;
	createObject: { label: string; intent: HeroIntent };
	groups: HeroRowGroup[];
	/** the list has no objects */
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
const carriesQuantity = (item: ItemLike) =>
	OBJECT_SIZE_TYPES_WITH_QUANTITY.has(String(item.system.objectSizeType ?? ''));

/**
 * Weapons, armor and shields have the EQUIP tag, and so does each object whose rules the tag
 * switches, or a container that applies its rule only while equipped. A stored object is packed away.
 */
function canEquip(item: ItemLike): boolean {
	if (storedIn(item)) return false;
	if (EQUIPPABLE.has(objectType(item)) || item.rules.length > 0) return true;
	return isContainer(item) && containerOf(item).requiresEquipped === true;
}

function transferIntent(
	actor: HeroActorLike,
	itemId: string,
	source: 'actor' | 'party',
	destination: { kind: 'party' } | { kind: 'actor'; actorId: string },
): HeroIntent {
	return {
		kind: 'transferObject',
		itemId,
		source,
		sourceActorId: actor.id,
		destination,
	};
}

function giveCurrencyIntent(
	actor: HeroActorLike,
	source: 'actor' | 'party',
	destination: { kind: 'party' } | { kind: 'actor'; actorId: string },
): HeroIntent {
	return { kind: 'giveCurrency', source, sourceActorId: actor.id, destination };
}

/** A trusted player can send to any character. Anyone can send their own objects to the party inventory. */
function canSendToOthers(context: HeroSheetContext, source: 'actor' | 'party'): boolean {
	return context.party.canGiveAway && (source === 'party' || context.party.canGive);
}

/** Move to the party inventory, a container, or back onto this sheet. Give to is the other characters. */
function shareMenu(
	actor: HeroActorLike,
	item: ItemLike,
	context: HeroSheetContext,
	source: 'actor' | 'party',
	containers: ItemLike[],
): HeroRowView['share'] {
	const { localize, format } = context;
	const moveEntries: { id: string; label: string; intent: HeroIntent }[] = [];
	if (source === 'actor' && context.party.canGive) {
		moveEntries.push({
			id: 'party',
			label: localize('NIMBLE.actorSheet.hero.inventory.party'),
			intent: transferIntent(actor, item.id, 'actor', { kind: 'party' }),
		});
	}
	if (source === 'party' && context.party.canTake) {
		moveEntries.push({
			id: 'mine',
			label: localize('NIMBLE.actorSheet.hero.inventory.mine'),
			intent: transferIntent(actor, item.id, 'party', { kind: 'actor', actorId: actor.id }),
		});
	}
	if (source === 'actor' && !isContainer(item)) {
		const heldIn = storedIn(item);
		for (const container of containers) {
			if (container.id === item.id || container.id === heldIn) continue;
			moveEntries.push({
				id: container.id,
				label: container.name,
				intent: { kind: 'storeIn', itemId: item.id, containerId: container.id },
			});
		}
	}
	const giveEntries = canSendToOthers(context, source)
		? context.party.characters.map((character) => ({
				id: character.id,
				label: character.name,
				intent: transferIntent(actor, item.id, source, { kind: 'actor', actorId: character.id }),
			}))
		: [];
	if (!moveEntries.length && !giveEntries.length) return undefined;
	return {
		label: format('NIMBLE.actorSheet.hero.inventory.actions', { name: item.name }),
		move: moveEntries.length
			? { label: localize('NIMBLE.actorSheet.hero.inventory.moveTo'), entries: moveEntries }
			: null,
		give: giveEntries.length
			? { label: localize('NIMBLE.actorSheet.hero.inventory.giveTo'), entries: giveEntries }
			: null,
	};
}

function objectRow(
	actor: HeroActorLike,
	item: ItemLike,
	context: HeroSheetContext,
	options: { containers: ItemLike[]; stored: ItemLike[]; indent: boolean; party: boolean },
): HeroRowView {
	const { localize, format } = context;
	const row = itemRow(actor, item, context);
	const name = item.name;
	const quantity = quantityOf(item);
	const counted = !isContainer(item) && carriesQuantity(item);
	const facts = [...row.facts];
	let text: string | undefined;
	let summary = row.summary;
	let summaryTone: HeroRowView['summaryTone'];
	let remove = row.remove;

	if (isContainer(item)) {
		const { capacity } = containerOf(item);
		const used = options.party ? 0 : (actor.system.inventory.containerCapacityUsage[item.id] ?? 0);
		if (!options.stored.length) text = localize('NIMBLE.actorSheet.hero.inventory.empty');
		else if (!options.party && typeof capacity === 'number') {
			text = format('NIMBLE.actorSheet.hero.inventory.capacity', {
				used: String(used),
				capacity: String(capacity),
			});
			if (used > capacity) {
				summary = format('NIMBLE.actorSheet.hero.inventory.overCapacity', {
					used: String(used),
					capacity: String(capacity),
				});
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
	} else if (counted) {
		if (quantity !== 1)
			text = format('NIMBLE.actorSheet.hero.inventory.quantity', { count: String(quantity) });
		facts.push([localize('NIMBLE.actorSheet.hero.inventory.facts.quantity'), String(quantity)]);
	}

	const holder = options.containers.find((container) => container.id === storedIn(item));
	if (holder)
		facts.push([localize('NIMBLE.actorSheet.hero.inventory.facts.storedIn'), holder.name]);

	const others = isContainer(item)
		? []
		: options.containers.filter((entry) => entry.id !== item.id);
	// an object that you use with no action is not "Free": it has no cost, as on the old sheet
	const free = row.cost.free === true;
	const costLabel = localize('NIMBLE.actorSheet.shared.facts.cost');
	const view: HeroRowView = {
		...row,
		summary,
		summaryTone,
		cost: { ...row.cost, free: undefined, text },
		facts: free ? facts.filter(([label]) => label !== costLabel) : facts,
		indent: options.indent || undefined,
		equip: canEquip(item)
			? { on: item.system.equipped === true, intent: { kind: 'toggleEquip', itemId: item.id } }
			: undefined,
		storeIn: others.length
			? {
					itemId: item.id,
					label: format('NIMBLE.actorSheet.hero.inventory.storeIn', { name }),
					value: holder?.id ?? '',
					options: [
						{ value: '', label: localize('NIMBLE.actorSheet.hero.inventory.loose') },
						...others.map((container) => ({ value: container.id, label: container.name })),
					],
				}
			: undefined,
		dropInto: isContainer(item) ? item.id : storedIn(item),
		remove,
		fields: counted
			? [
					{
						kind: 'quantity',
						itemId: item.id,
						label: format('NIMBLE.actorSheet.hero.inventory.quantityOf', { name }),
						value: quantity,
					},
					...row.fields,
				]
			: row.fields,
		share: shareMenu(actor, item, context, options.party ? 'party' : 'actor', options.containers),
	};
	// A party inventory row is data, not an item on this actor: it cannot be used, equipped, or edited.
	if (!options.party) return view;
	return {
		...view,
		use: null,
		choice: null,
		edit: null,
		drag: null,
		equip: undefined,
		storeIn: undefined,
		dropInto: undefined,
		remove: undefined,
		fields: [],
	};
}

function currencySection(
	label: string,
	entries: HeroCurrencyDestination[],
): { label: string; entries: HeroCurrencyDestination[] } | null {
	return entries.length ? { label, entries } : null;
}

/** Coins belong to the list they are on. Move to sends them to the other list. Give to is a character. */
function currencyGive(
	actor: HeroActorLike,
	context: HeroSheetContext,
	party: boolean,
): HeroInventoryTabView['currencyGive'] {
	const { localize } = context;
	const source: 'actor' | 'party' = party ? 'party' : 'actor';
	const moveEntries: HeroCurrencyDestination[] = [];
	if (!party && context.party.canGive) {
		moveEntries.push({
			id: 'party',
			label: localize('NIMBLE.actorSheet.hero.inventory.party'),
			intent: giveCurrencyIntent(actor, 'actor', { kind: 'party' }),
		});
	}
	if (party && context.party.canTake) {
		moveEntries.push({
			id: 'mine',
			label: localize('NIMBLE.actorSheet.hero.inventory.mine'),
			intent: giveCurrencyIntent(actor, 'party', { kind: 'actor', actorId: actor.id }),
		});
	}
	const giveEntries: HeroCurrencyDestination[] = [];
	if (party && !context.party.canTake && context.party.canGiveAway) {
		giveEntries.push({
			id: actor.id,
			label: actor.name,
			intent: giveCurrencyIntent(actor, 'party', { kind: 'actor', actorId: actor.id }),
		});
	}
	if (canSendToOthers(context, source)) {
		for (const character of context.party.characters) {
			giveEntries.push({
				id: character.id,
				label: character.name,
				intent: giveCurrencyIntent(actor, source, { kind: 'actor', actorId: character.id }),
			});
		}
	}
	const move = currencySection(localize('NIMBLE.actorSheet.hero.inventory.moveTo'), moveEntries);
	const give = currencySection(localize('NIMBLE.actorSheet.hero.inventory.giveTo'), giveEntries);
	if (!move && !give) return null;
	return { label: localize('NIMBLE.actorSheet.hero.inventory.moveCurrency'), move, give };
}

/** Groups by object type, A to Z; the objects in a container show under it. */
export function heroInventoryTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
	options: { party?: boolean } = {},
): HeroInventoryTabView {
	const { localize, format } = context;
	const party = options.party === true;
	const objects = (party ? context.party.items : actor.items).filter(
		(item) => item.type === 'object',
	);
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
					objectRow(actor, item, context, { containers, stored, indent: false, party }),
					...stored.map((entry) =>
						objectRow(actor, entry, context, { containers, stored: [], indent: true, party }),
					),
				];
			}),
		};
	}).filter((group) => group.rows.length);

	const { usedSlots, totalSlots } = actor.system.inventory;
	const slotData = { used: String(usedSlots), total: String(totalSlots) };
	const currency = party ? context.party.currency : actor.system.currency;
	return {
		party,
		listsLabel: localize('NIMBLE.actorSheet.hero.tabs.inventory'),
		mineLabel: localize('NIMBLE.actorSheet.hero.inventory.mine'),
		partyLabel: localize('NIMBLE.actorSheet.hero.inventory.party'),
		currencyGive: currencyGive(actor, context, party),
		coins: COIN_DENOMINATIONS.map((coin) => {
			const label = localize(COIN_ABBREVIATION[coin]);
			return {
				coin,
				label,
				name: format('NIMBLE.actorSheet.hero.inventory.coin', { coin: label }),
				value: Number(currency[coin] ?? 0),
			};
		}),
		coinsLocked: party && !context.party.canTake,
		slots:
			party || actor.flags.trackInventorySlots === false
				? null
				: {
						text: format('NIMBLE.actorSheet.hero.inventory.slots', slotData),
						label: localize('NIMBLE.actorSheet.hero.inventory.slotsLabel'),
						over:
							usedSlots > totalSlots
								? format('NIMBLE.actorSheet.hero.inventory.overSlots', slotData)
								: null,
					},
		createObject: {
			label: localize('NIMBLE.actorSheet.hero.inventory.create'),
			intent: { kind: 'createItem', itemType: 'object' },
		},
		groups,
		empty: objects.length
			? null
			: localize(
					party
						? 'NIMBLE.actorSheet.hero.inventory.partyEmpty'
						: 'NIMBLE.actorSheet.hero.inventory.none',
				),
	};
}

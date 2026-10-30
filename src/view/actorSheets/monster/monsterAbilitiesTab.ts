import type { RowUses } from '../parts/types.ts';
import type { DragDescriptor } from '../shared/drag.ts';
import { activationOf } from '../shared/itemFields.ts';
import { plainText } from '../shared/plainText.ts';
import type { MonsterIntent } from './monsterIntent.ts';
import type { ReorderEntry } from './monsterReorder.ts';
import type { MonsterActorLike, MonsterItemLike, MonsterSheetContext } from './monsterSource.ts';

const ABILITIES = 'NIMBLE.actorSheet.monster.abilities';
const SHARED = 'NIMBLE.actorSheet.shared';

/** The groups of the Abilities tab, in this order. An attack sequence is in the Actions group. */
export type MonsterAbilityGroupId = 'feature' | 'action' | 'bloodied' | 'lastStand';
const GROUPS: MonsterAbilityGroupId[] = ['feature', 'action', 'bloodied', 'lastStand'];

/** A question in a ConfirmBar under the entry; Yes sends the intent. */
export interface MonsterAsk {
	/** the label of the control that asks */
	label: string;
	question: string;
	confirmLabel: string;
	intent: MonsterIntent;
}

/** Edit mode: the uses left of a charge pool, as a number that you type. */
export interface MonsterUsesField {
	poolId: string;
	label: string;
	value: number;
	max: number;
	per: string;
}

interface EntryBase {
	id: string;
	name: string;
	/** the pen: open the item window */
	edit: { label: string; intent: MonsterIntent };
	/** edit mode: the trash button, which asks first; null: the user cannot change the monster */
	remove: MonsterAsk | null;
	/** null: the user cannot change the monster */
	drag: DragDescriptor | null;
	reorder: ReorderEntry;
}

/** One ability: a card that rolls or posts. */
export interface MonsterCardView extends EntryBase {
	kind: 'card';
	img: string;
	/** it has activation effects: a click opens the roll window; else it posts to chat */
	roll: boolean;
	range?: string;
	uses?: RowUses;
	fields: MonsterUsesField[];
	/** plain text */
	description: string;
	/** the description as Foundry enriched it, once the sheet has it */
	descriptionHtml?: string;
	/** under an attack sequence */
	nested: boolean;
	use: { label: string; intent: MonsterIntent };
}

/** The note of an attack sequence, above the actions that it holds. */
export interface MonsterSequenceView extends EntryBase {
	kind: 'sequence';
	/** plain text */
	text: string;
	html?: string;
}

/** An item with no description and no effects: a heading line. */
export interface MonsterHeadingView extends EntryBase {
	kind: 'heading';
}

export type MonsterAbilityEntry = MonsterCardView | MonsterSequenceView | MonsterHeadingView;

export interface MonsterAbilityGroup {
	id: MonsterAbilityGroupId;
	label: string;
	tone?: 'bloodied' | 'lastStand';
	entries: MonsterAbilityEntry[];
}

export interface MonsterAbilitiesTabView {
	groups: MonsterAbilityGroup[];
	/** the line when the monster has no abilities */
	empty: string;
	/** the ids of the cards with text, for Expand all */
	cardIds: string[];
	/** edit mode; null: the user cannot change the monster */
	createFeature: { label: string; intent: MonsterIntent } | null;
}

const subtypeOf = (item: MonsterItemLike) => String(item.system.subtype || 'feature');
const groupOf = (item: MonsterItemLike): MonsterAbilityGroupId => {
	const subtype = subtypeOf(item);
	return subtype === 'attackSequence' ? 'action' : (subtype as MonsterAbilityGroupId);
};
const bySort = (items: MonsterItemLike[]) => [...items].sort((a, b) => a.sort - b.sort);

/** Loose actions first, then each attack sequence with the actions that it holds. */
function actionOrder(
	items: MonsterItemLike[],
): { item: MonsterItemLike; parentId: string | null }[] {
	const sequences = bySort(items.filter((item) => subtypeOf(item) === 'attackSequence'));
	const sequenceIds = new Set(sequences.map((item) => item.id));
	const parentOf = (item: MonsterItemLike) => {
		const parent = String(item.system.parentItemId ?? '');
		return sequenceIds.has(parent) ? parent : null;
	};
	const actions = bySort(items.filter((item) => subtypeOf(item) !== 'attackSequence'));
	return [
		...actions.filter((item) => !parentOf(item)).map((item) => ({ item, parentId: null })),
		...sequences.flatMap((sequence) => [
			{ item: sequence, parentId: null },
			...actions
				.filter((item) => parentOf(item) === sequence.id)
				.map((item) => ({ item, parentId: sequence.id })),
		]),
	];
}

function rangeOf(item: MonsterItemLike, context: MonsterSheetContext): string | undefined {
	const targets = (activationOf(item).targets ?? {}) as { attackType?: string; distance?: number };
	if (targets.attackType !== 'reach' && targets.attackType !== 'range') return undefined;
	return context.format(`${SHARED}.${targets.attackType}`, {
		distance: String(targets.distance ?? 1),
	});
}

const perOf = (per: string | null, context: MonsterSheetContext) =>
	per ? context.localize(`${SHARED}.per.${per}`) : undefined;

function usesOf(item: MonsterItemLike, context: MonsterSheetContext): RowUses | undefined {
	const pool = context.itemPools[item.id]?.[0];
	if (!pool) return undefined;
	return {
		left: pool.current,
		max: pool.max,
		per: perOf(pool.per, context),
	};
}

function fieldsOf(item: MonsterItemLike, context: MonsterSheetContext): MonsterUsesField[] {
	return (context.itemPools[item.id] ?? []).map((pool) => ({
		poolId: pool.id,
		label: context.format(`${SHARED}.usesOf`, { name: item.name, pool: pool.label }),
		value: pool.current,
		max: pool.max,
		per: perOf(pool.per, context) ?? '',
	}));
}

function removeOf(item: MonsterItemLike, context: MonsterSheetContext): MonsterAsk | null {
	if (!context.editable) return null;
	const { localize, format } = context;
	return {
		label: format(`${SHARED}.deleteName`, { name: item.name }),
		question: format(`${SHARED}.deleteQuestion`, { name: item.name }),
		confirmLabel: localize(`${SHARED}.delete`),
		intent: { kind: 'deleteItem', itemId: item.id },
	};
}

function entryOf(
	item: MonsterItemLike,
	group: MonsterAbilityGroupId,
	parentId: string | null,
	context: MonsterSheetContext,
): MonsterAbilityEntry {
	const { format } = context;
	const raw = String(item.system.description ?? '');
	const description = plainText(raw);
	const sequence = subtypeOf(item) === 'attackSequence';
	const base: EntryBase = {
		id: item.id,
		name: item.name,
		edit: {
			label: format('NIMBLE.prompts.configureItem', { name: item.name }),
			intent: { kind: 'openItem', itemId: item.id },
		},
		remove: removeOf(item, context),
		drag: context.editable ? { kind: 'item', uuid: item.uuid } : null,
		reorder: { id: item.id, group, sequence, parentId },
	};
	if (sequence) {
		return {
			...base,
			kind: 'sequence',
			text: description,
			html: context.enrichedDescriptions[item.id],
		};
	}
	const effects = (activationOf(item).effects ?? []) as unknown[];
	if (!description && effects.length === 0) return { ...base, kind: 'heading' };
	const roll = effects.length > 0;
	return {
		...base,
		kind: 'card',
		img: item.img,
		roll,
		range: rangeOf(item, context),
		uses: usesOf(item, context),
		fields: fieldsOf(item, context),
		description,
		descriptionHtml: context.enrichedDescriptions[item.id],
		nested: parentId !== null,
		use: {
			label: format(`NIMBLE.actorSheet.parts.abilityCard.${roll ? 'roll' : 'post'}`, {
				name: item.name,
			}),
			intent: { kind: 'activate', itemId: item.id },
		},
	};
}

/** The abilities of the monster in their groups, in the hand-sorted order of the `sort` field. */
export function monsterAbilitiesTab(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): MonsterAbilitiesTabView {
	const abilities = actor.items.filter(
		(item) => item.type === 'monsterFeature' && GROUPS.includes(groupOf(item)),
	);
	const groups = GROUPS.map((id): MonsterAbilityGroup => {
		const items = abilities.filter((item) => groupOf(item) === id);
		const ordered =
			id === 'action'
				? actionOrder(items)
				: bySort(items).map((item) => ({ item, parentId: null }));
		return {
			id,
			label: context.localize(`${ABILITIES}.groups.${id}`),
			...(id === 'bloodied' || id === 'lastStand' ? { tone: id } : {}),
			entries: ordered.map(({ item, parentId }) => entryOf(item, id, parentId, context)),
		};
	}).filter((group) => group.entries.length > 0);
	return {
		groups,
		empty: context.localize(`${ABILITIES}.empty`),
		cardIds: groups.flatMap((group) =>
			group.entries
				.filter((entry) => entry.kind === 'card' && entry.description)
				.map((entry) => entry.id),
		),
		createFeature: context.editable
			? {
					label: context.localize('NIMBLE.npcSheet.createFeature'),
					intent: { kind: 'createFeature' },
				}
			: null,
	};
}

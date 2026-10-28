import type { ContainableObject } from '#types/inventoryContainers.js';
import localize from '#utils/localize.js';
import createScrollFromSpell from '#utils/spell/createScrollFromSpell.js';
import getSpellScrollTemplateTier from '#utils/spell/getSpellScrollTemplateTier.js';
import openSpellScrollDialog, {
	type ScrollDialogActor,
} from '#view/dialogs/openSpellScrollDialog.js';
import { shouldIncludeSpellDescriptionOnScrolls } from '../../settings/spellScrollSettings.js';
import { OBJECT_SIZE_TYPES_WITH_QUANTITY } from '../item/object.js';
import type { NimbleCharacter } from './character.js';

type ItemSource = Record<string, unknown>;

type DroppedItemData = {
	type?: unknown;
	name?: unknown;
	system?: {
		parentClass?: unknown;
		identifier?: unknown;
	};
};

/** The fields that decide whether a created object folds into one already carried. */
type ObjectStackingFields = {
	objectSizeType?: string;
	containerId?: string;
};

export type ItemDropOutcome =
	| { kind: 'refused' }
	/** The item is already on this actor. The sheet sorts it. */
	| { kind: 'sort'; itemId: string; itemData: ItemSource }
	| { kind: 'created'; documents: Item.Implementation[] }
	/** No document was created: each copy went into a stack already carried. */
	| { kind: 'stacked'; itemType: unknown; itemIds: string[] };

export interface RouteItemDropParams {
	actor: Actor.Implementation;
	sheet: foundry.applications.sheets.ActorSheetV2.Any;
	data: Record<string, unknown>;
	/** Store dropped objects in this container of a character. */
	containerId?: string;
}

/**
 * The drop route that both actor sheets share. It resolves the drop, then
 * creates the item. A character also gets subclass validation, the spell
 * scroll dialog and container storage.
 */
export async function routeItemDrop(params: RouteItemDropParams): Promise<ItemDropOutcome> {
	const { actor, sheet, data } = params;

	const allowed = Hooks.call(
		'dropActorSheetData',
		actor,
		sheet,
		data as foundry.appv1.sheets.ActorSheet.DropData,
	);
	if (allowed === false) return { kind: 'refused' };
	if (!actor.isOwner) return { kind: 'refused' };

	const item = await Item.implementation.fromDropData(data);
	if (!item) return { kind: 'refused' };
	const itemData = item.toObject() as ItemSource;
	if (item.uuid && !itemData.uuid) itemData.uuid = item.uuid;

	if (actor.items.has(item.id ?? '')) {
		return { kind: 'sort', itemId: item.id ?? '', itemData };
	}

	let itemsToCreate: ItemSource[] = [itemData];

	if (actor.type === 'character') {
		const character = actor as object as NimbleCharacter;

		if (itemData.type === 'subclass') {
			const documents = await createValidatedSubclasses(character, [itemData]);
			return documents.length > 0 ? { kind: 'created', documents } : { kind: 'refused' };
		}

		const scrollItems = await resolveSpellScrollDrop(character, itemData);
		if (scrollItems === null) return { kind: 'refused' };
		if (scrollItems) itemsToCreate = scrollItems;

		if (!routeCreatesIntoContainer(character, itemsToCreate, params.containerId ?? '')) {
			return { kind: 'refused' };
		}
	}

	const result = await actor.createEmbeddedDocuments(
		'Item',
		itemsToCreate as unknown as ReturnType<Item.Implementation['toObject']>[],
	);
	const documents = (Array.isArray(result) ? result : []) as Item.Implementation[];
	if (documents.length > 0) return { kind: 'created', documents };

	const stackedIds = itemsToCreate
		.map((source) => findStackedItemId(actor, source))
		.filter((itemId): itemId is string => itemId !== null);
	if (stackedIds.length > 0) {
		return { kind: 'stacked', itemType: itemsToCreate[0]?.type, itemIds: stackedIds };
	}

	return { kind: 'refused' };
}

/**
 * Marks the objects about to be created as stored in the container they were
 * dropped on, so the stack check in `NimbleObjectItem#_preCreate` runs against
 * that container's contents rather than the loose pile. Returns false when the
 * container refuses one of them, which it reports to the player itself.
 *
 * A stored object is never equipped, so anything dropped straight into a
 * container arrives stowed.
 */
function routeCreatesIntoContainer(
	actor: NimbleCharacter,
	itemsToCreate: ItemSource[],
	containerId: string,
): boolean {
	if (!containerId) return true;

	for (const item of itemsToCreate) {
		if (item.type !== 'object') continue;

		const system = (item.system ?? {}) as Record<string, unknown>;
		const candidate = { ...item, system } as object as ContainableObject;

		if (!actor.canStoreDroppedObjectInContainer(containerId, candidate)) {
			return false;
		}

		system.containerId = containerId;
		system.equipped = false;
		item.system = system;
	}

	return true;
}

/**
 * Routes a dropped spell or scroll blank through the spell scroll dialog.
 *
 * Returns the item data to create in place of the drop, `undefined` when the
 * drop is not scroll-related and should proceed untouched, or `null` when the
 * player cancelled and nothing should be created.
 */
async function resolveSpellScrollDrop(
	character: NimbleCharacter,
	item: ItemSource,
): Promise<ItemSource[] | undefined | null> {
	const actor = character as object as ScrollDialogActor;
	const includeSpellDescription = shouldIncludeSpellDescriptionOnScrolls();

	const template = getSpellScrollTemplateTier(item);
	if (template !== null) {
		const result = await openSpellScrollDialog({
			mode: 'picker',
			actor,
			tier: template,
			scrollName: String(item.name ?? ''),
		});
		if (!result?.spellUuid) return null;

		const spell = await fromUuid(result.spellUuid as Parameters<typeof fromUuid>[0]);
		if (!spell) return null;

		return [createScrollFromSpell(spell as object, { includeSpellDescription })];
	}

	if (item.type !== 'spell') return undefined;

	// A spell with no school is broken data. Report it and let the drop carry on
	// as an ordinary spell rather than inscribing a scroll with no check to make.
	const { school } = (item.system ?? {}) as { school?: string };
	if (!school) {
		ui.notifications?.error(
			localize('NIMBLE.spellScroll.missingSchool', { spell: String(item.name ?? '') }),
		);
		return undefined;
	}

	const result = await openSpellScrollDialog({ mode: 'chooser', actor, spell: item });
	if (!result) return null;
	if (result.destination !== 'scroll') return undefined;

	return [createScrollFromSpell(item as object, { includeSpellDescription })];
}

/**
 * Id of the existing item this create was stacked into, if any.
 *
 * Matches the same conditions as `NimbleObjectItem#_preCreate`, including the
 * size check on both items. Matching by name alone could flash an unrelated
 * same-named object when creation was blocked for another reason.
 */
function findStackedItemId(actor: Actor.Implementation, item: ItemSource): string | null {
	if (item.type !== 'object') return null;

	const { objectSizeType, containerId } = (item.system ?? {}) as ObjectStackingFields;
	if (!OBJECT_SIZE_TYPES_WITH_QUANTITY.has(objectSizeType ?? '')) return null;

	const existing = actor.items.find((candidate) => {
		if (candidate.type !== 'object' || candidate.name !== item.name) return false;

		const candidateSystem = (candidate as { system?: ObjectStackingFields }).system;

		return (
			(candidateSystem?.containerId ?? '') === (containerId ?? '') &&
			OBJECT_SIZE_TYPES_WITH_QUANTITY.has(candidateSystem?.objectSizeType ?? '')
		);
	});

	return existing?.id ?? null;
}

async function createValidatedSubclasses(
	actor: NimbleCharacter,
	items: DroppedItemData[],
): Promise<Item.Implementation[]> {
	const validatedItems: DroppedItemData[] = [];

	for (const item of items) {
		if (item.type === 'subclass') {
			const subclass = item;
			const parentClass =
				typeof subclass.system?.parentClass === 'string' ? subclass.system.parentClass : undefined;

			const characterLevel = actor.levels?.character ?? 0;
			if (characterLevel < 3) {
				ui.notifications?.warn(
					`You must be at least level 3 to select a subclass. You are currently level ${characterLevel}.`,
				);
				continue;
			}

			const hasMatchingClass = Object.values(actor.classes ?? {}).some(
				(cls) => cls.identifier === parentClass,
			);

			if (!hasMatchingClass) {
				const className = parentClass ? (CONFIG.NIMBLE?.classes?.[parentClass] ?? parentClass) : '';
				ui.notifications?.warn(`The subclass "${subclass.name}" requires the ${className} class.`);
				continue;
			}

			type SubclassSystem = { parentClass?: string; identifier?: string };
			const existingSubclass = actor.items.find(
				(i) =>
					i.type === 'subclass' &&
					parentClass !== undefined &&
					(i.system as unknown as SubclassSystem)?.parentClass === parentClass,
			);

			if (existingSubclass) {
				const existingIdentifier = (existingSubclass.system as unknown as SubclassSystem)
					?.identifier;
				const newIdentifier =
					typeof subclass.system?.identifier === 'string' ? subclass.system.identifier : null;

				if (existingIdentifier && newIdentifier && existingIdentifier === newIdentifier) {
					ui.notifications?.warn(`You already have the "${existingSubclass.name}" subclass.`);
					continue;
				}

				const confirmed = await foundry.applications.api.DialogV2.confirm({
					content: `<p>You already have the <strong>${existingSubclass.name}</strong> subclass.<br />Do you want to replace it with <strong>${subclass.name}</strong>?</p>`,
					rejectClose: false,
					modal: true,
				});

				if (!confirmed) {
					continue;
				}

				await actor.deleteEmbeddedDocuments('Item', [existingSubclass.id!]);
			}
		}

		validatedItems.push(item);
	}

	if (validatedItems.length === 0) return [];

	const result = await actor.createEmbeddedDocuments(
		'Item',
		validatedItems as unknown as ReturnType<Item.Implementation['toObject']>[],
	);
	return (Array.isArray(result) ? result : []) as Item.Implementation[];
}

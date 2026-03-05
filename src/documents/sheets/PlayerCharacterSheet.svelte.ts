import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import {
	getDroppedItemFlashIds,
	type SheetDropItemFlashState,
} from '../../view/sheets/dropItemFlashState.js';
import PlayerCharacterSheetComponent from '../../view/sheets/PlayerCharacterSheet.svelte';
import {
	DEFAULT_PRIMARY_TAB,
	ITEM_TYPE_TO_PRIMARY_TAB,
	type PrimaryTabName,
} from '../../view/sheets/playerCharacterPrimaryTabs.js';
import type { NimbleCharacter } from '../actor/character.js';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

type DroppedItemData = {
	type?: unknown;
	name?: unknown;
	system?: {
		parentClass?: unknown;
		identifier?: unknown;
	};
};

type PlayerCharacterSheetState = Record<string, unknown> & SheetDropItemFlashState;

export default class PlayerCharacterSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected _actor: Actor;

	protected root;

	protected props: { actor: Actor; sheet: PlayerCharacterSheet };

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as ConstructorParameters<typeof foundry.applications.sheets.ActorSheetV2>[0],
		);

		this.root = PlayerCharacterSheetComponent;
		// For synthetic token actors, get the actor via the parent TokenDocument
		const resolvedActor = actor.document.isToken
			? (actor.document.parent as TokenDocument | undefined)?.actor
			: actor.document;
		this._actor = resolvedActor ?? actor.document;

		this.props = {
			actor: this.document,
			sheet: this,
		};
	}

	override get actor(): Actor {
		return this._actor;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--player-character'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: SHEET_DEFAULTS.playerCharacter,
	};

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		const appState = this.$state as PlayerCharacterSheetState;

		if (!Array.isArray(appState.droppedItemFlashIds)) {
			appState.droppedItemFlashIds = [];
		}

		return {
			...context,
			actor: this._actor,
			sheet: this,
		} as object as Awaited<ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>>;
	}

	/**
	 * Handle drop events on the character sheet
	 */
	async _onDropItem(event: DragEvent, data: Record<string, unknown>) {
		event.preventDefault();
		event.stopPropagation();

		const actor = this.document as NimbleCharacter;

		const allowed = Hooks.call(
			'dropActorSheetData',
			actor,
			this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
			data as foundry.appv1.sheets.ActorSheet.DropData,
		);
		if (allowed === false) return false;

		if (!this.document.isOwner) {
			return false;
		}

		const item = await Item.implementation.fromDropData(data);
		if (!item) return false;
		const itemData = item.toObject() as ReturnType<Item.Implementation['toObject']> & {
			uuid?: string;
			id?: typeof item.id;
		};
		itemData.id = item.id;

		if (item.uuid && !itemData.uuid) {
			// Preserve the UUID from the source document
			itemData.uuid = item.uuid;
		}

		// Handle arrays
		const items = Array.isArray(itemData) ? itemData : [itemData];

		// Handle item sorting within the same Actor
		const keepId = !this._actor.items.has(item.id ?? '');
		if (!keepId) {
			const result = (this as object as { _onSortItem(e: DragEvent, d: object): void })._onSortItem(
				event,
				itemData,
			);
			this.#requestPrimaryTabForDroppedItems(items);
			this.#requestDroppedItemFlash(this.#extractDroppedItemIds(items));
			return result;
		}

		// Check if any item is a subclass
		const hasSubclass = items.some((item) => (item as { type?: unknown }).type === 'subclass');

		if (hasSubclass) {
			// Use special subclass creation logic that includes validation
			const result = await this._onDropSubclassCreate(items);
			if (Array.isArray(result) && result.length > 0) {
				this.#requestPrimaryTabForDroppedItems(items);
				this.#requestDroppedItemFlash(this.#extractDroppedItemIds(result));
			}
			return result;
		}

		// Create regular items
		const result = await this._actor.createEmbeddedDocuments('Item', items);
		if (Array.isArray(result) && result.length > 0) {
			this.#requestPrimaryTabForDroppedItems(items);
			this.#requestDroppedItemFlash(this.#extractDroppedItemIds(result));
		}
		return result;
	}

	async _onDropSubclassCreate(itemData: DroppedItemData | DroppedItemData[]) {
		// Handle arrays
		const items = Array.isArray(itemData) ? itemData : [itemData];
		const actor = this.document as NimbleCharacter;

		// Validate each item
		const validatedItems: DroppedItemData[] = [];

		for (const item of items) {
			// Check if it's a subclass
			if (item.type === 'subclass') {
				const subclass = item;
				const parentClass =
					typeof subclass.system?.parentClass === 'string'
						? subclass.system.parentClass
						: undefined;

				// Check if character level is >= 3
				const characterLevel = actor.levels?.character ?? 0;
				if (characterLevel < 3) {
					ui.notifications?.warn(
						`You must be at least level 3 to select a subclass. You are currently level ${characterLevel}.`,
					);
					continue;
				}

				// Check if character has the matching class
				const hasMatchingClass = Object.values(actor.classes ?? {}).some(
					(cls) => cls.identifier === parentClass,
				);

				if (!hasMatchingClass) {
					const className = parentClass
						? (CONFIG.NIMBLE?.classes?.[parentClass] ?? parentClass)
						: '';
					ui.notifications?.warn(
						`The subclass "${subclass.name}" requires the ${className} class.`,
					);
					continue;
				}

				// Check if character already has a subclass for this class
				type SubclassSystem = { parentClass?: string; identifier?: string };
				const existingSubclass = actor.items.find(
					(i) =>
						i.type === 'subclass' &&
						parentClass !== undefined &&
						(i.system as unknown as SubclassSystem)?.parentClass === parentClass,
				);

				if (existingSubclass) {
					// Check if it's the exact same subclass (compare by system.identifier)
					const existingIdentifier = (existingSubclass.system as unknown as SubclassSystem)
						?.identifier;
					const newIdentifier =
						typeof subclass.system?.identifier === 'string' ? subclass.system.identifier : null;

					if (existingIdentifier && newIdentifier && existingIdentifier === newIdentifier) {
						ui.notifications?.warn(`You already have the "${existingSubclass.name}" subclass.`);
						continue;
					}

					// Show confirmation dialog
					const confirmed = await foundry.applications.api.DialogV2.confirm({
						content: `<p>You already have the <strong>${existingSubclass.name}</strong> subclass.<br />Do you want to replace it with <strong>${subclass.name}</strong>?</p>`,
						rejectClose: false,
						modal: true,
					});

					if (!confirmed) {
						continue;
					}

					// Delete the existing subclass
					await actor.deleteEmbeddedDocuments('Item', [existingSubclass.id!]);
				}
			}

			// Add item to validated list
			validatedItems.push(item);
		}

		// Create the validated items
		if (validatedItems.length > 0) {
			return actor.createEmbeddedDocuments(
				'Item',
				validatedItems as unknown as ReturnType<Item.Implementation['toObject']>[],
			);
		}

		return [];
	}

	#getPrimaryTabForDroppedItemType(itemType: unknown): PrimaryTabName {
		if (typeof itemType !== 'string') return DEFAULT_PRIMARY_TAB;

		return ITEM_TYPE_TO_PRIMARY_TAB[itemType] ?? DEFAULT_PRIMARY_TAB;
	}

	#requestPrimaryTabForDroppedItems(
		items: Array<{
			type?: unknown;
		}>,
	): void {
		if (!Array.isArray(items) || items.length === 0) return;

		const requestedTab = this.#getPrimaryTabForDroppedItemType(items[0]?.type);
		const appState = this.$state as PlayerCharacterSheetState;
		appState.activePrimaryTab = requestedTab;
	}

	#extractDroppedItemIds(
		items: Array<{
			id?: unknown;
			_id?: unknown;
		}>,
	): string[] {
		const itemIds = items
			.map((item) => {
				if (typeof item.id === 'string' && item.id.length > 0) return item.id;
				if (typeof item._id === 'string' && item._id.length > 0) return item._id;
				return null;
			})
			.filter((itemId): itemId is string => itemId !== null);

		return Array.from(new Set(itemIds));
	}

	#requestDroppedItemFlash(itemIds: string[]): void {
		if (!Array.isArray(itemIds) || itemIds.length === 0) return;

		const appState = this.$state as PlayerCharacterSheetState;
		const currentFlashIds = getDroppedItemFlashIds(appState);
		appState.droppedItemFlashIds = Array.from(new Set([...currentFlashIds, ...itemIds]));
	}

	clearDroppedItemFlash(itemId: unknown): void {
		if (typeof itemId !== 'string' || itemId.length < 1) return;

		const appState = this.$state as PlayerCharacterSheetState;
		const currentFlashIds = getDroppedItemFlashIds(appState);
		const nextFlashIds = currentFlashIds.filter((flashItemId) => flashItemId !== itemId);
		if (nextFlashIds.length === currentFlashIds.length) return;
		appState.droppedItemFlashIds = nextFlashIds;
	}
}

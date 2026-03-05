import type { DeepPartial } from 'fvtt-types/utils';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import PlayerCharacterSheetComponent from '../../view/sheets/PlayerCharacterSheet.svelte';
import type { NimbleCharacter } from '../actor/character.js';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

const DROP_ITEM_FLASH_DURATION_MS = 1200;
const DROP_ITEM_FLASH_CLASS = 'nimble-document-card--drop-flash';

const ITEM_TYPE_TO_PRIMARY_TAB = {
	object: 'inventory',
	spell: 'spells',
} as const;

type PrimaryTabName =
	| 'core'
	| 'conditions'
	| 'inventory'
	| 'features'
	| 'spells'
	| 'bio'
	| 'settings';

export default class PlayerCharacterSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected _actor: Actor;

	protected root;

	protected props: { actor: Actor; sheet: PlayerCharacterSheet };

	#pendingPrimaryTab: PrimaryTabName | null = null;
	#pendingDroppedItemFlashIds: string[] = [];
	#dropItemFlashClearTimeout: ReturnType<typeof setTimeout> | null = null;

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
		const appState = this.$state as Record<string, unknown>;

		if (this.#pendingPrimaryTab) {
			appState.activePrimaryTab = this.#pendingPrimaryTab;
			this.#pendingPrimaryTab = null;
		}

		return {
			...context,
			actor: this._actor,
			sheet: this,
		} as object as Awaited<ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>>;
	}

	/**
	 * Attach drop event listener for drag and drop functionality
	 */
	protected override _attachFrameListeners() {
		super._attachFrameListeners();
	}

	protected override _replaceHTML(
		result: SvelteApplicationRenderContext,
		content: HTMLElement,
		options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
	): void {
		super._replaceHTML(result, content, options);

		if (this.#pendingDroppedItemFlashIds.length < 1) return;
		this.#pendingDroppedItemFlashIds = this.#flashDroppedItemCards(
			this.#pendingDroppedItemFlashIds,
		);
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
			void this.render();
			return result;
		}

		// Check if any item is a subclass
		const hasSubclass = items.some((item: any) => item.type === 'subclass');

		if (hasSubclass) {
			// Use special subclass creation logic that includes validation
			const result = await this._onDropSubclassCreate(items);
			if (Array.isArray(result) && result.length > 0) {
				this.#requestPrimaryTabForDroppedItems(items);
				this.#requestDroppedItemFlash(this.#extractDroppedItemIds(result));
				void this.render();
			}
			return result;
		}

		// Create regular items
		const result = await this._actor.createEmbeddedDocuments('Item', items);
		if (Array.isArray(result) && result.length > 0) {
			this.#requestPrimaryTabForDroppedItems(items);
			this.#requestDroppedItemFlash(this.#extractDroppedItemIds(result));
			void this.render();
		}
		return result;
	}

	async _onDropSubclassCreate(itemData: any) {
		// Handle arrays
		const items = Array.isArray(itemData) ? itemData : [itemData];
		const actor = this.document as NimbleCharacter;

		// Validate each item
		const validatedItems: any[] = [];

		for (const item of items) {
			// Check if it's a subclass
			if (item.type === 'subclass') {
				const subclass = item;
				const parentClass = subclass.system?.parentClass;

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
					const className = CONFIG.NIMBLE?.classes?.[parentClass] ?? parentClass;
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
						(i.system as unknown as SubclassSystem)?.parentClass === parentClass,
				);

				if (existingSubclass) {
					// Check if it's the exact same subclass (compare by system.identifier)
					const existingIdentifier = (existingSubclass.system as unknown as SubclassSystem)
						?.identifier;
					const newIdentifier = subclass.system?.identifier;

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
			return actor.createEmbeddedDocuments('Item', validatedItems);
		}

		return [];
	}

	#getPrimaryTabForDroppedItemType(itemType: unknown): PrimaryTabName {
		if (typeof itemType !== 'string') return 'features';

		return (
			ITEM_TYPE_TO_PRIMARY_TAB[itemType as keyof typeof ITEM_TYPE_TO_PRIMARY_TAB] ?? 'features'
		);
	}

	#requestPrimaryTabForDroppedItems(
		items: Array<{
			type?: unknown;
		}>,
	): void {
		if (!Array.isArray(items) || items.length === 0) return;

		const requestedTab = this.#getPrimaryTabForDroppedItemType(items[0]?.type);
		this.#pendingPrimaryTab = requestedTab;
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

	#flashDroppedItemCards(itemIds: string[]): string[] {
		if (!Array.isArray(itemIds) || itemIds.length === 0) return [];

		const rootElement = this.element;
		if (!(rootElement instanceof HTMLElement)) {
			return itemIds;
		}

		const unresolvedItemIds: string[] = [];
		for (const itemId of itemIds) {
			const escapedItemId = globalThis.CSS?.escape ? globalThis.CSS.escape(itemId) : itemId;
			const itemCard = rootElement.querySelector<HTMLElement>(`[data-item-id="${escapedItemId}"]`);
			if (!itemCard) {
				unresolvedItemIds.push(itemId);
				continue;
			}

			itemCard.classList.remove(DROP_ITEM_FLASH_CLASS);
			void itemCard.offsetWidth;
			itemCard.classList.add(DROP_ITEM_FLASH_CLASS);
		}
		return unresolvedItemIds;
	}

	#clearDroppedItemFlashCards(itemIds: string[]): void {
		if (!Array.isArray(itemIds) || itemIds.length === 0) return;

		const rootElement = this.element;
		if (!(rootElement instanceof HTMLElement)) return;

		for (const itemId of itemIds) {
			const escapedItemId = globalThis.CSS?.escape ? globalThis.CSS.escape(itemId) : itemId;
			const itemCard = rootElement.querySelector<HTMLElement>(`[data-item-id="${escapedItemId}"]`);
			itemCard?.classList.remove(DROP_ITEM_FLASH_CLASS);
		}
	}

	#requestDroppedItemFlash(itemIds: string[]): void {
		if (!Array.isArray(itemIds) || itemIds.length === 0) return;

		const flashItemIds = [...itemIds];
		this.#pendingDroppedItemFlashIds = flashItemIds;
		const appState = this.$state as Record<string, unknown>;
		appState.droppedItemFlashIds = flashItemIds;

		if (this.#dropItemFlashClearTimeout) {
			clearTimeout(this.#dropItemFlashClearTimeout);
		}

		this.#dropItemFlashClearTimeout = setTimeout(() => {
			this.#dropItemFlashClearTimeout = null;
			this.#pendingDroppedItemFlashIds = [];
			(this.$state as Record<string, unknown>).droppedItemFlashIds = [];
			this.#clearDroppedItemFlashCards(flashItemIds);
			void this.render();
		}, DROP_ITEM_FLASH_DURATION_MS);
	}
}

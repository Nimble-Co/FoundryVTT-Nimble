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
} from '../../view/sheets/playerCharacterPrimaryTabConfig.js';
import type { NimbleCharacter } from '../actor/character.js';
import { routeItemDrop } from '../actor/routeItemDrop.js';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

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
	// v14's ActorSheetV2 resolves the drop into an Item before calling
	// `_onDropItem(event, item: Item)`. Nimble never uses that core dispatch: its Svelte sheet
	// components (PlayerCharacterInventoryTab.svelte) call this method directly with raw drop *data*,
	// so the override resolves the Item itself via fromDropData. The signature diverges from the base.
	// @ts-expect-error TS2416: deliberate divergence from the v14 base signature (see comment above).
	override async _onDropItem(
		event: DragEvent,
		dropArg: Record<string, unknown> | Item.Implementation,
		options: { containerId?: string } = {},
	) {
		event.preventDefault();
		event.stopPropagation();

		const outcome = await routeItemDrop({
			actor: this.document as Actor.Implementation,
			sheet: this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
			data: dropArg as Record<string, unknown>,
			containerId: options.containerId,
		});

		switch (outcome.kind) {
			case 'refused':
				return false;
			case 'sort': {
				const result = (
					this as object as { _onSortItem(e: DragEvent, d: object): void }
				)._onSortItem(event, { ...outcome.itemData, id: outcome.itemId });
				this.#requestPrimaryTab(outcome.itemData.type);
				this.#requestDroppedItemFlash([outcome.itemId]);
				return result;
			}
			case 'created':
				// The tab comes from what was created, so a spell inscribed onto a
				// scroll opens the inventory rather than the spells tab.
				this.#requestPrimaryTab(outcome.documents[0]?.type);
				this.#requestDroppedItemFlash(this.#extractDroppedItemIds(outcome.documents));
				return outcome.documents;
			case 'stacked':
				this.#requestPrimaryTab(outcome.itemType);
				this.#requestDroppedItemFlash(outcome.itemIds);
				return [];
		}
	}

	#getPrimaryTabForDroppedItemType(itemType: unknown): PrimaryTabName {
		if (typeof itemType !== 'string') return DEFAULT_PRIMARY_TAB;

		return ITEM_TYPE_TO_PRIMARY_TAB[itemType] ?? DEFAULT_PRIMARY_TAB;
	}

	#requestPrimaryTab(itemType: unknown): void {
		const appState = this.$state as PlayerCharacterSheetState;
		appState.activePrimaryTab = this.#getPrimaryTabForDroppedItemType(itemType);
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

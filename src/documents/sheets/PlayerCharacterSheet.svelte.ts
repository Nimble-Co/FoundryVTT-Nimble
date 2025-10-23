import { SvelteActorSheet } from '#lib/SvelteActorSheet.svelte.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import PlayerCharacterSheetComponent from '../../view/sheets/PlayerCharacterSheet.svelte';

import type { NimbleCharacter } from '../actor/character.js';

export default class PlayerCharacterSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	public actor: Actor;

	public declare options: any;

	protected root;

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		// @ts-expect-error - Type mismatch with SvelteApplicationMixin
		super(
			// @ts-expect-error
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}),
		);

		this.root = PlayerCharacterSheetComponent;
		this.actor = actor.document.isToken ? actor.document.parent?.actor : actor.document;

		this.props = {
			actor: this.document,
			sheet: this,
		};
	}

	// @ts-expect-error
	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--player-character'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: {
			width: 336,
			height: 'auto',
		},
	};

	protected async _prepareContext() {
		return {
			actor: this.actor,
			sheet: this,
		};
	}

	/**
	 * Attach drop event listener for drag and drop functionality
	 */
	// @ts-expect-error
	protected _attachFrameListeners() {
		// @ts-expect-error
		super._attachFrameListeners();
	}

	/**
	 * Handle drop events on the character sheet
	 */
	async _onDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// @ts-expect-error - TextEditor is a global FoundryVTT class
		const data = TextEditor.getDragEventData(event) as unknown as Record<string, unknown>;
		const actor = this.document as NimbleCharacter;

		// @ts-expect-error - Hooks.call has complex typing
		const allowed = Hooks.call('dropActorSheetData', actor, this, data);
		if (allowed === false) return false;

		// Handle different data types
		switch (data.type) {
			case 'Item':
				return this._onDropItem(event, data);
			default:
				return false;
		}
	}

	/**
	 * Handle item drops
	 */
	async _onDropItem(event: DragEvent, data: Record<string, unknown>) {
		if (!this.document.isOwner) return false;

		// @ts-expect-error
		const item = await Item.implementation.fromDropData(data);
		const itemData = item.toObject();

		// Preserve the UUID from the source document
		if (item.uuid && !itemData.uuid) {
			itemData.uuid = item.uuid;
		}

		// Handle item sorting within the same Actor
		if (this.document.uuid === item.actor?.uuid) return this._onSortItem(event, itemData);

		// Create the owned item
		return this._onDropItemCreate(itemData, event);
	}

	/**
	 * Handle sorting items within the same actor
	 */
	_onSortItem(event: DragEvent, itemData: any) {
		// For now, just create the item - sorting can be implemented later if needed
		return this._onDropItemCreate([itemData], event);
	}

	/**
	 * Override item drop to validate subclass requirements
	 */
	async _onDropItemCreate(itemData, event) {
		// Handle arrays
		const items = itemData instanceof Array ? itemData : [itemData];
		const actor = this.document as NimbleCharacter;

		// Validate each item
		const validatedItems: any[] = [];

		for (const item of items) {
			// Check if it's a subclass
			if (item.type === 'subclass') {
				const subclass = item as any;
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
				const existingSubclass = actor.items.find(
					(i) => i.type === 'subclass' && (i.system as any)?.parentClass === parentClass,
				);

				if (existingSubclass) {
					// Check if it's the exact same subclass (compare by system.identifier)
					const existingIdentifier = existingSubclass.system?.identifier;
					const newIdentifier = subclass.system?.identifier;

					if (existingIdentifier && newIdentifier && existingIdentifier === newIdentifier) {
						ui.notifications?.warn(`You already have the "${existingSubclass.name}" subclass.`);
						continue;
					}

					// Show confirmation dialog
					const confirmed = await foundry.applications.api.DialogV2.confirm({
						content: `<p>You already have the <strong>${existingSubclass.name}</strong> subclass. Do you want to replace it with <strong>${subclass.name}</strong>?</p>`,
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
}

import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import NPCSheetComponent from '../../view/sheets/NPCSheet.svelte';
import type { NimbleNPC } from '../actor/npc.js';

export default class NPCSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected _actor: Actor;

	protected root;

	protected props: { actor: Actor; sheet: NPCSheet };

	constructor(actor: { document: NimbleNPC }, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}),
		);

		this.root = NPCSheetComponent;

		this._actor = actor.document.isToken
			? (actor.document.parent?.actor ?? actor.document)
			: actor.document;

		this.props = {
			actor: this.document,
			sheet: this,
		};
	}

	override get actor(): Actor {
		return this._actor;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--npc'],
		window: {
			icon: 'fa-solid fa-ghost',
			resizable: true,
		},
		position: {
			width: 288,
			height: 'auto' as const,
		},
	};

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		return {
			...context,
			actor: this._actor,
			sheet: this,
		} as object as Awaited<ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>>;
	}

	/**
	 * Handle drop events on the NPC sheet
	 */
	async _onDropItem(event: DragEvent, data: Record<string, unknown>) {
		event.preventDefault();
		event.stopPropagation();

		const actor = this.document as NimbleNPC;

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
		};

		if (item.uuid && !itemData.uuid) {
			// Preserve the UUID from the source document
			itemData.uuid = item.uuid;
		}

		// Handle item sorting within the same Actor
		const keepId = !this._actor.items.has(item.id ?? '');
		if (!keepId) {
			return (this as object as { _onSortItem(e: DragEvent, d: object): void })._onSortItem(
				event,
				itemData,
			);
		}

		// Create the item on this actor
		const items = Array.isArray(itemData) ? itemData : [itemData];
		return this._actor.createEmbeddedDocuments('Item', items);
	}
}

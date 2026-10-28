import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import NPCSheetComponent from '../../view/sheets/NPCSheet.svelte';
import type { NimbleNPC } from '../actor/npc.js';
import { routeItemDrop } from '../actor/routeItemDrop.js';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

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

		// For synthetic token actors, get the actor via the parent TokenDocument
		this._actor = actor.document.isToken
			? ((actor.document.parent as TokenDocument | undefined)?.actor ?? actor.document)
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
		position: SHEET_DEFAULTS.npc,
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
	// v14's ActorSheetV2 resolves the drop into an Item before calling
	// `_onDropItem(event, item: Item)`. Nimble never uses that core dispatch: its Svelte sheet
	// components (NPCCoreTab.svelte) call this method directly with raw drop *data*, so the override
	// resolves the Item itself via fromDropData. The signature intentionally diverges from the base.
	// @ts-expect-error TS2416: deliberate divergence from the v14 base signature (see comment above).
	override async _onDropItem(
		event: DragEvent,
		dropArg: Record<string, unknown> | Item.Implementation,
	) {
		event.preventDefault();
		event.stopPropagation();

		const outcome = await routeItemDrop({
			actor: this.document as Actor.Implementation,
			sheet: this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
			data: dropArg as Record<string, unknown>,
		});

		switch (outcome.kind) {
			case 'refused':
				return false;
			case 'sort':
				// Without an `id` the core sort finds no source item, so a row reorder
				// that bubbles up here is not applied a second time.
				return (this as object as { _onSortItem(e: DragEvent, d: object): void })._onSortItem(
					event,
					outcome.itemData,
				);
			case 'created':
				return outcome.documents;
			case 'stacked':
				return [];
		}
	}
}

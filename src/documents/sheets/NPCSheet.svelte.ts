import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import type { NimbleNPC } from '../actor/npc.js';

import NPCSheetComponent from '../../view/sheets/NPCSheet.svelte';

export default class NPCSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	public actor: Actor;

	public declare options: any;

	protected root;

	constructor(actor: { document: NimbleNPC }, options = {} as SvelteApplicationRenderContext) {
		// @ts-expect-error
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}),
		);

		this.root = NPCSheetComponent;

		this.actor = actor.document.isToken ? actor.document.parent?.actor : actor.document;

		this.props = {
			actor: this.document,
			sheet: this,
		};
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--npc'],
		window: {
			icon: 'fa-solid fa-ghost',
			resizable: true,
		},
		position: {
			width: 288,
			height: 600,
		},
	};

	protected override async _prepareContext() {
		return {
			actor: this.actor,
			sheet: this,
		};
	}
}

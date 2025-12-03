import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import NPCSheetComponent from '../../view/sheets/NPCSheet.svelte';
import type { NimbleNPC } from '../actor/npc.js';

export default class NPCSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected root = NPCSheetComponent;

	constructor(actor: { document: NimbleNPC }, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as Record<string, unknown>,
		);

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
			height: 'auto' as const,
		},
	};
}

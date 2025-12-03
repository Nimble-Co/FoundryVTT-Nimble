import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import PlayerCharacterSheetComponent from '../../view/sheets/PlayerCharacterSheet.svelte';

import type { NimbleCharacter } from '../actor/character.js';

export default class PlayerCharacterSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	declare props: Record<string, unknown>;

	protected root;

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as Record<string, unknown>,
		);

		this.root = PlayerCharacterSheetComponent;

		this.props = {
			actor: this.document,
			sheet: this,
		};
	}

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

	// @ts-expect-error - Override with simplified context
	protected override async _prepareContext() {
		return {
			actor: this.actor,
			sheet: this,
		};
	}
}

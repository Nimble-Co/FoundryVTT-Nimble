import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';

import ActorCreationDialogComponent from '../../view/dialogs/ActorCreationDialog.svelte';
import CharacterCreationDialog from './CharacterCreationDialog.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

export default class ActorCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare data: Record<string, unknown>;

	declare parent: Actor | null;

	declare pack: string | null;

	declare props: Record<string, unknown>;

	protected root;

	constructor(
		data = {},
		{ parent = null, pack = null } = {} as { parent?: Actor | null; pack?: string | null },
	) {
		super();

		this.root = ActorCreationDialogComponent;

		this.data = data;
		this.parent = parent;
		this.pack = pack;
		this.props = { dialog: this };
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: {
			width: 508,
			height: 'auto',
		},
	};

	// @ts-expect-error - Override with simplified context
	protected override async _prepareContext() {
		return {
			dialog: this,
		};
	}

	async submitActorType(actorType: string) {
		const { documentClasses } = CONFIG.NIMBLE.Actor;

		if (actorType === 'character') {
			const characterCreationDialog = new CharacterCreationDialog();
			characterCreationDialog.render(true);
		} else {
			documentClasses[actorType].create(
				{ name: 'New Actor', type: actorType, ...this.data },
				{ pack: this.pack, parent: this.parent, renderSheet: true },
			);
		}

		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	) {
		return super.close(options);
	}
}

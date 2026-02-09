import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';

import ActorCreationDialogComponent from '../../view/dialogs/ActorCreationDialog.svelte';
import CharacterCreationDialog from './CharacterCreationDialog.svelte.js';
import NimbrewImportDialog from '../../import/nimbrew/NimbrewImportDialog.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

export default class ActorCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare data: Record<string, unknown>;

	declare parent: unknown;

	declare pack: unknown;

	protected root;

	protected props: { dialog: ActorCreationDialog };

	constructor(data = {}, { parent = null, pack = null, ..._options } = {}) {
		const width = 508;
		super({
			position: {
				width,
				top: Math.round(window.innerHeight * 0.1),
				left: Math.round((window.innerWidth - width) / 2),
			},
		});

		this.root = ActorCreationDialogComponent;

		this.data = data;
		this.parent = parent;
		this.pack = pack;
		this.props = { dialog: this };
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: {
			width: 508,
			height: 'auto' as const,
		},
	};

	protected override async _prepareContext(
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	) {
		return {
			dialog: this,
		} as foundry.applications.api.ApplicationV2.RenderContext;
	}

	async submitActorType(actorType: 'base' | 'character' | 'npc' | 'soloMonster' | 'minion') {
		const { documentClasses } = CONFIG.NIMBLE.Actor;

		if (actorType === 'character') {
			const characterCreationDialog = new CharacterCreationDialog();
			characterCreationDialog.render(true);
		} else {
			(documentClasses as Record<string, typeof Actor>)[actorType].create(
				{ name: 'New Actor', type: actorType, ...this.data } as object as Actor.CreateData,
				{ pack: this.pack, parent: this.parent, renderSheet: true } as object,
			);
		}

		return super.close();
	}

	async openNimbrewImport() {
		const nimbrewImportDialog = new NimbrewImportDialog();
		nimbrewImportDialog.render(true);
		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	) {
		return super.close(options);
	}
}

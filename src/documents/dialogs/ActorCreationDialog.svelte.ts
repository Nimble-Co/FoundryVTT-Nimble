import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import NimbleNexusImportDialog from '../../import/nimbleNexus/NimbleNexusImportDialog.svelte.js';
import ActorCreationDialogComponent from '../../view/dialogs/ActorCreationDialog.svelte';
import CharacterCreationDialog from './CharacterCreationDialog.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

export default class ActorCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare data: Record<string, unknown>;

	// V14's ApplicationV2 defines a getter-only `parent` (child applications),
	// so the target Document parent must live under a different name.
	declare parentDocument: unknown;

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
		this.parentDocument = parent;
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
			const folder = (this.data.folder as string | null | undefined) ?? null;
			const characterCreationDialog = new CharacterCreationDialog({}, { folder });
			characterCreationDialog.render(true);
		} else {
			(documentClasses as unknown as Record<string, typeof Actor>)[actorType].create(
				{ name: 'New Actor', type: actorType, ...this.data } as object as Actor.CreateData,
				{ pack: this.pack, parent: this.parentDocument, renderSheet: true } as object,
			);
		}

		return super.close();
	}

	async openNimbleNexusImport() {
		const nimbleNexusImportDialog = new NimbleNexusImportDialog();
		nimbleNexusImportDialog.render(true);
		return super.close();
	}

	async importActorFromJson() {
		const { default: ImportPlayerCharacterDialog } = await import(
			'../../import/playerCharacter/ImportPlayerCharacterDialog.svelte.js'
		);

		const folder = (this.data.folder as string | null | undefined) ?? null;
		const dialog = new ImportPlayerCharacterDialog({
			folder,
			parent: this.parentDocument,
			pack: this.pack,
		});
		dialog.render(true);

		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	) {
		return super.close(options);
	}
}

/**
 * Dialog controller for importing a player character from an exported JSON file.
 *
 * Presents a file picker, parses the selected JSON, shows a preview of the
 * character (name, headline details, and the items that will be imported), and
 * only creates the actor once the user confirms.
 */

import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import { SYSTEM_ID } from '#system';
import localize from '#utils/localize.ts';
import ImportPlayerCharacterDialogComponent from '#view/dialogs/ImportPlayerCharacterDialog.svelte';
import buildImportPreview, { type ImportPreview, type ParsedActor } from './buildImportPreview.ts';

const { ApplicationV2 } = foundry.applications.api;

export default class ImportPlayerCharacterDialog extends SvelteApplicationMixin(ApplicationV2) {
	protected root;

	protected props: { dialog: ImportPlayerCharacterDialog };

	declare data: { folder?: string | null; parent?: unknown; pack?: unknown };

	private _parsedData: ParsedActor | null = $state(null);

	private _preview: ImportPreview | null = $state(null);

	private _error: string | null = $state(null);

	private _isImporting = $state(false);

	constructor(
		data: { folder?: string | null; parent?: unknown; pack?: unknown } = {},
		_options = {},
	) {
		const width = 480;
		super({
			position: {
				width,
				height: 'auto' as const,
				top: Math.round(window.innerHeight * 0.1),
				left: Math.round((window.innerWidth - width) / 2),
			},
		});

		this.root = ImportPlayerCharacterDialogComponent;
		this.props = { dialog: this };
		this.data = data;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog'],
		window: {
			icon: 'fa-solid fa-file-import',
			title: 'NIMBLE.actorImport.json.dialogTitle',
			resizable: true,
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

	get error(): string | null {
		return this._error;
	}

	get isImporting(): boolean {
		return this._isImporting;
	}

	get hasFile(): boolean {
		return this._parsedData !== null;
	}

	/** Structured, localized summary of the character that would be imported. */
	get preview(): ImportPreview | null {
		return this._preview;
	}

	/** Read and parse a selected file, populating the preview or an error. */
	async loadFile(file: File | null | undefined): Promise<void> {
		this.clearFile();

		if (!file) return;

		const { json } = CONFIG.NIMBLE.actorImport;

		try {
			const text = await file.text();
			const data = JSON.parse(text) as ParsedActor;

			if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
				throw new Error('Not a valid actor export');
			}

			if (data.type !== 'character') {
				this._error = localize(json.notACharacterError);
				return;
			}

			// Only Nimble exports are supported. The stable and dev builds install
			// under different system ids (`nimble` / `nimble-dev`), so compare with
			// the dev suffix normalized to keep exports portable between them.
			// v13 exports record the system under _stats; pre-v13 used flags.
			const sourceSystem = data._stats?.exportSource?.systemId ?? data.flags?.exportSource?.system;
			if (
				typeof sourceSystem === 'string' &&
				sourceSystem.replace(/-dev$/, '') !== String(SYSTEM_ID).replace(/-dev$/, '')
			) {
				this._error = localize(json.wrongSystemError);
				return;
			}

			this._parsedData = data;
			this._preview = buildImportPreview(data);
		} catch (error) {
			console.error('Player character import: failed to parse JSON', error);
			this._error = localize(json.parseError);
		}
	}

	/** Clear the current selection so the user can pick a different file. */
	clearFile(): void {
		this._parsedData = null;
		this._preview = null;
		this._error = null;
	}

	/** Create the actor from the parsed data and close the dialog. */
	async confirmImport(): Promise<void> {
		if (!this._parsedData || this._isImporting) return;

		this._isImporting = true;

		const { json } = CONFIG.NIMBLE.actorImport;

		try {
			const folder = (this.data.folder as string | null | undefined) ?? null;
			const data: Record<string, unknown> = {
				...(this._parsedData as Record<string, unknown>),
				folder,
			};

			// Drop the source id so Foundry generates a fresh one for this world,
			// and replace the source world's ownership with a grant to the
			// importing user.
			delete data._id;
			data.ownership = {
				default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
				[game.user!.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			};

			// loadFile guarantees type === 'character'.
			const documentClass = (CONFIG.NIMBLE.Actor.documentClasses as Record<string, typeof Actor>)
				.character;

			await documentClass.create(
				data as object as Actor.CreateData,
				{
					parent: this.data.parent,
					pack: this.data.pack,
					renderSheet: true,
				} as object,
			);

			ui.notifications?.info(localize(json.success));
			await this.close();
		} catch (error) {
			console.error('Player character import failed:', error);
			this._error = localize(json.importError);
			this._isImporting = false;
		}
	}
}

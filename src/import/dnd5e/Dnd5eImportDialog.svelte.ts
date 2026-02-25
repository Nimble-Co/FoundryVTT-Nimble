/**
 * Dialog controller for D&D 5e statblock import
 */

import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import Dnd5eImportDialogComponent from '#view/dialogs/Dnd5eImportDialog.svelte';
import { buildConversionReport, importBatch, importFromReport } from './Dnd5eConverter.js';
import { ingestJson, ingestJsonString } from './Dnd5eJsonIngest.js';
import { loadNimbleSpellIndex, matchAllSpells } from './Dnd5eSpellConverter.js';
import { ingestText, ingestTextBatch } from './Dnd5eTextIngest.js';
import type {
	BatchConversionEntry,
	ConversionReport,
	Dnd5eActorJson,
	Dnd5eStatblock,
	ImportOptions,
	SpellMatchResult,
} from './types.js';

const { ApplicationV2 } = foundry.applications.api;

export type InputTab = 'json' | 'text';
export type DialogStep = 'input' | 'review';

export default class Dnd5eImportDialog extends SvelteApplicationMixin(ApplicationV2) {
	protected root;
	protected props: { dialog: Dnd5eImportDialog };

	// Preloaded data (from compendium context menu)
	private _preloadData?: Dnd5eActorJson;

	// Dialog state
	private _step: DialogStep = $state('input');
	private _activeTab: InputTab = $state('json');
	private _inputText = $state('');
	private _isLoading = $state(false);
	private _error: string | null = $state(null);

	// Conversion results
	private _reports: BatchConversionEntry[] = $state([]);
	private _spellIndex: { name: string; uuid: string }[] = [];

	// Folder selection
	private _foldersVersion = $state(0);

	constructor(options: { preloadData?: Dnd5eActorJson } = {}, _appOptions = {}) {
		const width = 700;
		super({
			position: {
				width,
				height: 650,
				top: Math.round(window.innerHeight * 0.1),
				left: Math.round((window.innerWidth - width) / 2),
			},
		});

		this.root = Dnd5eImportDialogComponent;
		this.props = { dialog: this };
		this._preloadData = options.preloadData;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog', 'dnd5e-import-dialog'],
		window: {
			icon: 'fa-solid fa-dragon',
			title: 'NIMBLE.dnd5eImport.dialogTitle',
			resizable: true,
		},
		position: {
			width: 700,
			height: 650,
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

	override async _onFirstRender(
		_context: foundry.applications.api.ApplicationV2.RenderContext,
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
	): Promise<void> {
		// Load spell index for matching
		this._spellIndex = await loadNimbleSpellIndex();

		// If we have preloaded data (from context menu), go straight to review
		if (this._preloadData) {
			const sourceRaw = JSON.stringify(this._preloadData);
			const statblock = ingestJson(this._preloadData, sourceRaw);
			const spellMatches = matchAllSpells(statblock.spellcasting, this._spellIndex);
			const report = buildConversionReport(statblock, spellMatches);
			this._reports = [{ statblock, report }];
			this._step = 'review';
		}
	}

	// ─── Getters ──────────────────────────────────────────────────────────────

	get step(): DialogStep {
		return this._step;
	}

	get activeTab(): InputTab {
		return this._activeTab;
	}

	set activeTab(tab: InputTab) {
		this._activeTab = tab;
	}

	get inputText(): string {
		return this._inputText;
	}

	set inputText(value: string) {
		this._inputText = value;
		this._error = null;
	}

	get isLoading(): boolean {
		return this._isLoading;
	}

	get error(): string | null {
		return this._error;
	}

	get reports(): BatchConversionEntry[] {
		return this._reports;
	}

	get foldersVersion(): number {
		return this._foldersVersion;
	}

	// ─── Actions ──────────────────────────────────────────────────────────────

	/**
	 * Parse the input text and generate conversion reports
	 */
	async parseAndConvert(): Promise<void> {
		const input = this._inputText.trim();
		if (!input) {
			this._error = CONFIG.NIMBLE.dnd5eImport.emptyInput;
			return;
		}

		this._isLoading = true;
		this._error = null;

		try {
			let statblocks: Dnd5eStatblock[];

			if (this._activeTab === 'json') {
				const result = ingestJsonString(input);
				if (!result.ok) {
					this._error = result.error;
					return;
				}
				statblocks = result.statblocks;
			} else {
				statblocks = ingestTextBatch(input);
			}

			if (statblocks.length === 0) {
				this._error = CONFIG.NIMBLE.dnd5eImport.noStatblocks;
				return;
			}

			// Convert each statblock
			const entries: BatchConversionEntry[] = [];
			for (const statblock of statblocks) {
				const spellMatches = matchAllSpells(statblock.spellcasting, this._spellIndex);
				const report = buildConversionReport(statblock, spellMatches);
				entries.push({ statblock, report });
			}

			this._reports = entries;
			this._step = 'review';
		} catch (err) {
			this._error = err instanceof Error ? err.message : CONFIG.NIMBLE.dnd5eImport.unknownError;
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Go back to the input step
	 */
	goBack(): void {
		this._step = 'input';
		this._reports = [];
		this._error = null;
	}

	/**
	 * Import a single monster from the review step
	 */
	async importSingle(report: ConversionReport, options: ImportOptions = {}): Promise<boolean> {
		this._isLoading = true;

		try {
			const result = await importFromReport(report, options);
			if (result.success) {
				const { dnd5eImport } = CONFIG.NIMBLE;
				ui.notifications?.info(dnd5eImport.successMessage.replace('{name}', result.monsterName));
				this._foldersVersion++;
				return true;
			} else {
				this._error = result.error ?? CONFIG.NIMBLE.dnd5eImport.importFailed;
				return false;
			}
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Import all monsters from the review step
	 */
	async importAll(options: ImportOptions = {}): Promise<boolean> {
		if (this._reports.length === 0) return false;

		this._isLoading = true;

		try {
			const reports = this._reports.map((e) => e.report);
			const batchResult = await importBatch(reports, options);

			const successful = batchResult.results.filter((r) => r.success).length;
			const failed = batchResult.results.filter((r) => !r.success).length;
			const { dnd5eImport } = CONFIG.NIMBLE;

			if (failed === 0) {
				ui.notifications?.info(
					dnd5eImport.batchSuccessMessage.replace('{count}', String(successful)),
				);
			} else {
				ui.notifications?.warn(
					dnd5eImport.partialSuccess
						.replace('{successful}', String(successful))
						.replace('{failed}', String(failed)),
				);
			}

			this._foldersVersion++;
			return failed === 0;
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Get actor folders for folder selection
	 */
	getActorFolders(): { id: string; name: string }[] {
		const folders = game.folders?.filter((f) => f.type === 'Actor') ?? [];
		return folders.map((f) => ({ id: f.id, name: f.name ?? 'Unnamed Folder' }));
	}

	/**
	 * Reset the dialog for another import
	 */
	reset(): void {
		this._step = 'input';
		this._activeTab = 'json';
		this._inputText = '';
		this._reports = [];
		this._error = null;
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		return super.close(options);
	}
}

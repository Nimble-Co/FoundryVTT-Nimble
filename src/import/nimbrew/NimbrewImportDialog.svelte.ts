/**
 * Dialog controller for Nimbrew monster import
 */

import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import NimbrewImportDialogComponent from '#view/dialogs/NimbrewImportDialog.svelte';
import { nimbrewApi, type NimbrewApiClient } from './NimbrewApiClient.js';
import { nimbrewParser, type NimbrewParser } from './NimbrewParser.js';
import type {
	BatchImportResult,
	ImportOptions,
	MonsterRoleFilter,
	MonsterTypeFilter,
	NimbreApiSearchOptions,
	NimbleNexusMonster,
} from './types.js';

const { ApplicationV2 } = foundry.applications.api;

export default class NimbrewImportDialog extends SvelteApplicationMixin(ApplicationV2) {
	protected root;
	protected props: { dialog: NimbrewImportDialog };

	// API client and parser
	private api: NimbrewApiClient;
	private parser: NimbrewParser;

	// Search state (reactive)
	private _searchResults: NimbleNexusMonster[] = $state([]);
	private _isLoading = $state(false);
	private _error: string | null = $state(null);
	private _nextCursor: string | undefined = $state(undefined);
	private _lastSearchOptions: NimbreApiSearchOptions = {};

	// Filter state (reactive)
	private _levelFilter: string | null = $state(null);
	private _monsterTypeFilter: MonsterTypeFilter = $state('all');
	private _roleFilter: MonsterRoleFilter = $state('all');

	// Selection state (reactive)
	private _selectedMonsters: Set<string> = $state(new Set());

	// File upload state (reactive)
	private _uploadedMonsters: NimbleNexusMonster[] = $state([]);

	// Folder list version (increment to trigger refresh)
	private _foldersVersion = $state(0);

	constructor(_data = {}, _options = {}) {
		const width = 700;
		super({
			position: {
				width,
				height: 600,
				top: Math.round(window.innerHeight * 0.1),
				left: Math.round((window.innerWidth - width) / 2),
			},
		});

		this.root = NimbrewImportDialogComponent;
		this.props = { dialog: this };
		this.api = nimbrewApi;
		this.parser = nimbrewParser;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog', 'actor-import-dialog'],
		window: {
			icon: 'fa-solid fa-file-import',
			title: 'NIMBLE.actorImport.dialogTitle',
			resizable: true,
		},
		position: {
			width: 700,
			height: 600,
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

	// Getters for reactive state
	get searchResults(): NimbleNexusMonster[] {
		return this._searchResults;
	}

	get isLoading(): boolean {
		return this._isLoading;
	}

	get error(): string | null {
		return this._error;
	}

	get hasMore(): boolean {
		return !!this._nextCursor;
	}

	get selectedMonsters(): Set<string> {
		return this._selectedMonsters;
	}

	get uploadedMonsters(): NimbleNexusMonster[] {
		return this._uploadedMonsters;
	}

	get foldersVersion(): number {
		return this._foldersVersion;
	}

	// Filter getters and setters (setters trigger new API request)
	get levelFilter(): string | null {
		return this._levelFilter;
	}

	set levelFilter(value: string | null) {
		this._levelFilter = value;
		this.refetchWithFilters();
	}

	get monsterTypeFilter(): MonsterTypeFilter {
		return this._monsterTypeFilter;
	}

	set monsterTypeFilter(value: MonsterTypeFilter) {
		this._monsterTypeFilter = value;
		this.refetchWithFilters();
	}

	get roleFilter(): MonsterRoleFilter {
		return this._roleFilter;
	}

	set roleFilter(value: MonsterRoleFilter) {
		this._roleFilter = value;
		this.refetchWithFilters();
	}

	/**
	 * Get filtered uploaded monsters based on current filter settings (client-side for uploads)
	 */
	get filteredUploadedMonsters(): NimbleNexusMonster[] {
		return this.applyFiltersToUploaded(this._uploadedMonsters);
	}

	/**
	 * Apply client-side filters to uploaded monster list
	 */
	private applyFiltersToUploaded(monsters: NimbleNexusMonster[]): NimbleNexusMonster[] {
		return monsters.filter((monster) => {
			const attrs = monster.attributes;

			// Level filter - compare as strings to handle fractional levels
			if (this._levelFilter !== null) {
				const monsterLevel = String(attrs.level);
				if (monsterLevel !== this._levelFilter) return false;
			}

			// Monster type filter
			if (this._monsterTypeFilter !== 'all') {
				if (this._monsterTypeFilter === 'legendary' && !attrs.legendary) return false;
				if (this._monsterTypeFilter === 'minion' && !attrs.minion) return false;
				if (this._monsterTypeFilter === 'standard' && (attrs.legendary || attrs.minion))
					return false;
			}

			// Role filter
			if (this._roleFilter !== 'all' && attrs.role) {
				if (attrs.role.toLowerCase() !== this._roleFilter) return false;
			}

			return true;
		});
	}

	/**
	 * Reset all filters to default values
	 */
	resetFilters(): void {
		// Set values without triggering individual refetches
		this._levelFilter = null;
		this._monsterTypeFilter = 'all';
		this._roleFilter = 'all';
		this.refetchWithFilters();
	}

	/**
	 * Refetch monsters with current filter settings
	 */
	private refetchWithFilters(): void {
		const lastSearch = this._lastSearchOptions.search ?? '';
		this.searchMonsters(lastSearch);
	}

	/**
	 * Search for monsters
	 */
	async searchMonsters(
		query: string,
		options: Omit<NimbreApiSearchOptions, 'search'> = {},
	): Promise<void> {
		this._isLoading = true;
		this._error = null;
		this._searchResults = [];
		this._selectedMonsters = new Set();

		// Build search options with current filters
		const searchOptions: NimbreApiSearchOptions = {
			...options,
			search: query,
			level: this._levelFilter ?? undefined,
			monsterType: this._monsterTypeFilter,
			role: this._roleFilter,
		};
		this._lastSearchOptions = searchOptions;

		try {
			const response = await this.api.search(searchOptions);
			this._searchResults = response.data;
			this._nextCursor = this.api.getNextCursor(response);
		} catch (err) {
			this._error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Load more results (pagination)
	 */
	async loadMore(): Promise<void> {
		if (!this._nextCursor || this._isLoading) return;

		this._isLoading = true;

		try {
			const response = await this.api.search({
				...this._lastSearchOptions,
				cursor: this._nextCursor,
			});
			this._searchResults = [...this._searchResults, ...response.data];
			this._nextCursor = this.api.getNextCursor(response);
		} catch (err) {
			this._error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Browse monsters without search term
	 */
	async browseMonsters(options: NimbreApiSearchOptions = {}): Promise<void> {
		return this.searchMonsters('', options);
	}

	/**
	 * Toggle monster selection
	 */
	toggleSelection(monsterId: string): void {
		const newSet = new Set(this._selectedMonsters);
		if (newSet.has(monsterId)) {
			newSet.delete(monsterId);
		} else {
			newSet.add(monsterId);
		}
		this._selectedMonsters = newSet;
	}

	/**
	 * Select all visible monsters
	 */
	selectAll(): void {
		const newSet = new Set(this._selectedMonsters);
		for (const monster of this._searchResults) {
			newSet.add(monster.id);
		}
		this._selectedMonsters = newSet;
	}

	/**
	 * Deselect all monsters
	 */
	deselectAll(): void {
		this._selectedMonsters = new Set();
	}

	/**
	 * Select all uploaded monsters
	 */
	selectAllUploaded(): void {
		const newSet = new Set(this._selectedMonsters);
		for (const monster of this._uploadedMonsters) {
			newSet.add(monster.id);
		}
		this._selectedMonsters = newSet;
	}

	/**
	 * Handle file upload
	 */
	async handleFileUpload(file: File): Promise<void> {
		this._isLoading = true;
		this._error = null;

		try {
			const text = await file.text();
			const jsonData = JSON.parse(text);
			this._uploadedMonsters = this.parser.parseJsonFile(jsonData);
			this._selectedMonsters = new Set();
		} catch (err) {
			this._error = err instanceof Error ? err.message : 'Failed to parse file';
			this._uploadedMonsters = [];
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Clear uploaded monsters
	 */
	clearUploadedMonsters(): void {
		this._uploadedMonsters = [];
		this._selectedMonsters = new Set();
	}

	/**
	 * Get selected monsters from search results
	 */
	getSelectedSearchMonsters(): NimbleNexusMonster[] {
		return this._searchResults.filter((m) => this._selectedMonsters.has(m.id));
	}

	/**
	 * Get selected monsters from uploaded file
	 */
	getSelectedUploadedMonsters(): NimbleNexusMonster[] {
		return this._uploadedMonsters.filter((m) => this._selectedMonsters.has(m.id));
	}

	/**
	 * Import selected monsters from search
	 */
	async importSelectedFromSearch(options: ImportOptions = {}): Promise<BatchImportResult> {
		const monsters = this.getSelectedSearchMonsters();
		if (monsters.length === 0) return { results: [] };

		this._isLoading = true;

		try {
			const batchResult = await this.parser.importBatch(monsters, options);
			this.showImportResults(batchResult.results);
			this._foldersVersion++;
			return batchResult;
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Import selected monsters from uploaded file
	 */
	async importSelectedFromUpload(options: ImportOptions = {}): Promise<BatchImportResult> {
		const monsters = this.getSelectedUploadedMonsters();
		if (monsters.length === 0) return { results: [] };

		this._isLoading = true;

		try {
			const batchResult = await this.parser.importBatch(monsters, options);
			this.showImportResults(batchResult.results);
			this._foldersVersion++;
			return batchResult;
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Show import results notification
	 */
	private showImportResults(results: ImportResult[]): void {
		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;
		const { actorImport } = CONFIG.NIMBLE;

		if (failed === 0) {
			ui.notifications?.info(
				game.i18n?.format(actorImport.successMessage, { count: String(successful) }) ??
					`Successfully imported ${successful} monster(s)`,
			);
		} else {
			ui.notifications?.warn(
				game.i18n?.format(actorImport.partialSuccessMessage, {
					successful: String(successful),
					failed: String(failed),
				}) ?? `Imported ${successful} monster(s), ${failed} failed`,
			);
		}
	}

	/**
	 * Get actor folders for folder selection
	 */
	getActorFolders(): { id: string; name: string }[] {
		const folders = game.folders?.filter((f) => f.type === 'Actor') ?? [];
		return folders.map((f) => ({ id: f.id, name: f.name ?? 'Unnamed Folder' }));
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		return super.close(options);
	}
}

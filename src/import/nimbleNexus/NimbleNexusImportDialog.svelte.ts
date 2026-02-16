/**
 * Dialog controller for Nimble Nexus monster import
 */

import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import NimbleNexusImportDialogComponent from '#view/dialogs/NimbleNexusImportDialog.svelte';
import { nimbleNexusApi, type NimbleNexusApiClient } from './NimbleNexusApiClient.js';
import { nimbleNexusParser, type NimbleNexusParser } from './NimbleNexusParser.js';
import type {
	BatchImportResult,
	ImportOptions,
	ImportResult,
	MonsterRoleFilter,
	MonsterTypeFilter,
	NimbleNexusApiSearchOptions,
	NimbleNexusMonster,
} from './types.js';

const { ApplicationV2 } = foundry.applications.api;

export default class NimbleNexusImportDialog extends SvelteApplicationMixin(ApplicationV2) {
	protected root;
	protected props: { dialog: NimbleNexusImportDialog };

	// API client and parser
	private api: NimbleNexusApiClient;
	private parser: NimbleNexusParser;

	// Search state (reactive)
	private _searchResults: NimbleNexusMonster[] = $state([]);
	private _isLoading = $state(false);
	private _error: string | null = $state(null);
	private _nextCursor: string | undefined = $state(undefined);
	private _lastSearchOptions: NimbleNexusApiSearchOptions = {};

	// Filter state (reactive)
	private _levelFilter: string | null = $state(null);
	private _monsterTypeFilter: MonsterTypeFilter = $state('all');
	private _roleFilter: MonsterRoleFilter = $state('all');
	private _filterDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Selection state (reactive)
	private _selectedMonsters: Set<string> = $state(new Set());

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

		this.root = NimbleNexusImportDialogComponent;
		this.props = { dialog: this };
		this.api = nimbleNexusApi;
		this.parser = nimbleNexusParser;
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

	get foldersVersion(): number {
		return this._foldersVersion;
	}

	// Filter getters and setters (setters trigger debounced API request)
	get levelFilter(): string | null {
		return this._levelFilter;
	}

	set levelFilter(value: string | null) {
		this._levelFilter = value;
		this.scheduleFilterRefetch();
	}

	get monsterTypeFilter(): MonsterTypeFilter {
		return this._monsterTypeFilter;
	}

	set monsterTypeFilter(value: MonsterTypeFilter) {
		this._monsterTypeFilter = value;
		this.scheduleFilterRefetch();
	}

	get roleFilter(): MonsterRoleFilter {
		return this._roleFilter;
	}

	set roleFilter(value: MonsterRoleFilter) {
		this._roleFilter = value;
		this.scheduleFilterRefetch();
	}

	/**
	 * Reset all filters to default values
	 */
	resetFilters(): void {
		// Clear any pending debounce
		if (this._filterDebounceTimeout) {
			clearTimeout(this._filterDebounceTimeout);
			this._filterDebounceTimeout = null;
		}
		// Set values without triggering individual refetches
		this._levelFilter = null;
		this._monsterTypeFilter = 'all';
		this._roleFilter = 'all';
		this.refetchWithFilters();
	}

	/**
	 * Schedule a debounced filter refetch
	 */
	private scheduleFilterRefetch(): void {
		if (this._filterDebounceTimeout) {
			clearTimeout(this._filterDebounceTimeout);
		}
		this._filterDebounceTimeout = setTimeout(() => {
			this._filterDebounceTimeout = null;
			this.refetchWithFilters();
		}, 150);
	}

	/**
	 * Refetch monsters with current filter settings
	 */
	private refetchWithFilters(): void {
		const lastSearch = this._lastSearchOptions.search ?? '';
		// Don't clear results when just filtering - shows loading overlay instead
		this.searchMonsters(lastSearch, {}, false);
	}

	/**
	 * Search for monsters
	 */
	async searchMonsters(
		query: string,
		options: Omit<NimbleNexusApiSearchOptions, 'search'> = {},
		clearResults = true,
	): Promise<void> {
		this._isLoading = true;
		this._error = null;

		// Only clear results on new searches, not filter changes
		if (clearResults) {
			this._searchResults = [];
			this._selectedMonsters = new Set();
		}

		// Build search options with current filters
		const searchOptions: NimbleNexusApiSearchOptions = {
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
	async browseMonsters(options: NimbleNexusApiSearchOptions = {}): Promise<void> {
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
	 * Get selected monsters from search results
	 */
	getSelectedSearchMonsters(): NimbleNexusMonster[] {
		return this._searchResults.filter((m) => this._selectedMonsters.has(m.id));
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

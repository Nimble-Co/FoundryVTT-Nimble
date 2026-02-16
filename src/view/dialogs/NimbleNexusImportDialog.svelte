<script>
	import { onMount } from 'svelte';
	import BrowseTabContent from './components/monsterImport/BrowseTabContent.svelte';

	let { dialog } = $props();
	const { actorImport } = CONFIG.NIMBLE;

	// Search state
	let searchQuery = $state('');
	let searchTimeout = $state(null);

	// Filter options (localized)
	const { filters } = actorImport;
	const monsterTypeOptions = $derived([
		{ value: 'all', label: game.i18n.localize(filters.allTypes) },
		{ value: 'standard', label: game.i18n.localize(filters.monsterTypes.standard) },
		{ value: 'legendary', label: game.i18n.localize(filters.monsterTypes.legendary) },
		{ value: 'minion', label: game.i18n.localize(filters.monsterTypes.minion) },
	]);

	const roleOptions = $derived([
		{ value: 'all', label: game.i18n.localize(filters.allRoles) },
		{ value: 'ambusher', label: game.i18n.localize(filters.roles.ambusher) },
		{ value: 'aoe', label: game.i18n.localize(filters.roles.aoe) },
		{ value: 'controller', label: game.i18n.localize(filters.roles.controller) },
		{ value: 'defender', label: game.i18n.localize(filters.roles.defender) },
		{ value: 'melee', label: game.i18n.localize(filters.roles.melee) },
		{ value: 'ranged', label: game.i18n.localize(filters.roles.ranged) },
		{ value: 'skirmisher', label: game.i18n.localize(filters.roles.skirmisher) },
		{ value: 'striker', label: game.i18n.localize(filters.roles.striker) },
		{ value: 'summoner', label: game.i18n.localize(filters.roles.summoner) },
		{ value: 'support', label: game.i18n.localize(filters.roles.support) },
	]);

	const levelOptions = $derived([
		{ value: '', label: game.i18n.localize(filters.allLevels) },
		{ value: '-4', label: game.i18n.localize(filters.levelFraction.quarter) },
		{ value: '-3', label: game.i18n.localize(filters.levelFraction.third) },
		{ value: '-2', label: game.i18n.localize(filters.levelFraction.half) },
		...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
	]);

	// Check if any filters are active
	let hasActiveFilters = $derived(
		dialog.levelFilter !== null ||
			dialog.monsterTypeFilter !== 'all' ||
			dialog.roleFilter !== 'all',
	);

	// Import options
	let createFolder = $state(false);
	let folderName = $state('Nimble Nexus Import');
	let selectedFolderId = $state('');

	// References for child components
	let monsterListEl = $state(null);

	// Infinite scroll handler for browse tab
	function handleScroll(event) {
		const el = event.target;
		if (!el || dialog.isLoading || !dialog.hasMore) return;

		const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (scrollBottom < 100) {
			dialog.loadMore();
		}
	}

	// Debounced search
	function handleSearchInput(event) {
		const query = event.target.value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			if (query.trim()) {
				dialog.searchMonsters(query);
			} else {
				dialog.browseMonsters();
			}
		}, 300);
	}

	// Load initial monsters on mount
	onMount(() => {
		dialog.browseMonsters();
	});

	// Import selected monsters
	async function importSelected() {
		const options = {};

		if (createFolder && folderName) {
			options.createFolder = true;
			options.folderName = folderName;
		} else if (selectedFolderId) {
			options.folderId = selectedFolderId;
		}

		const result = await dialog.importSelectedFromSearch(options);

		if (result.results && result.results.length > 0) {
			// Close dialog after successful import
			dialog.close();
		} else if (result.createdFolderId) {
			createFolder = false;
			selectedFolderId = result.createdFolderId;
		}
	}

	// Get selection count
	let selectedCount = $derived(
		dialog.searchResults.filter((m) => dialog.selectedMonsters.has(m.id)).length,
	);

	// Get actor folders (depends on foldersVersion to refresh after import)
	let actorFolders = $derived.by(() => {
		const _version = dialog.foldersVersion;
		return dialog.getActorFolders();
	});
</script>

<article class="actor-import-dialog">
	<!-- Search Bar -->
	<div class="actor-import-search-section">
		<div class="actor-import-search-bar">
			<input
				type="text"
				class="actor-import-search-input"
				placeholder={game.i18n.localize(actorImport.searchPlaceholder)}
				value={searchQuery}
				oninput={handleSearchInput}
			/>
			<i class="fa-solid fa-search actor-import-search-icon"></i>
		</div>
	</div>

	<!-- Filters -->
	<div class="actor-import-filters">
		<div class="actor-import-filters-row">
			<div class="actor-import-filter-group">
				<label class="actor-import-filter-label" for="level-filter">
					{game.i18n.localize(filters.level)}
				</label>
				<select
					id="level-filter"
					class="actor-import-filter-select"
					value={dialog.levelFilter ?? ''}
					onchange={(e) => {
						const val = e.target.value;
						dialog.levelFilter = val || null;
					}}
				>
					{#each levelOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="actor-import-filter-group">
				<label class="actor-import-filter-label" for="type-filter">
					{game.i18n.localize(filters.type)}
				</label>
				<select
					id="type-filter"
					class="actor-import-filter-select"
					value={dialog.monsterTypeFilter}
					onchange={(e) => {
						dialog.monsterTypeFilter = e.target.value;
					}}
				>
					{#each monsterTypeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="actor-import-filter-group">
				<label class="actor-import-filter-label" for="role-filter">
					{game.i18n.localize(filters.role)}
				</label>
				<select
					id="role-filter"
					class="actor-import-filter-select"
					value={dialog.roleFilter}
					onchange={(e) => {
						dialog.roleFilter = e.target.value;
					}}
				>
					{#each roleOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			{#if hasActiveFilters}
				<button
					class="actor-import-filter-clear"
					type="button"
					onclick={() => dialog.resetFilters()}
					title={game.i18n.localize(filters.clearFilters)}
				>
					<i class="fa-solid fa-times"></i>
				</button>
			{/if}
		</div>
	</div>

	<!-- Monster List -->
	<BrowseTabContent {dialog} bind:monsterListEl onScroll={handleScroll} />

	<!-- Import Options -->
	<div class="actor-import-options">
		<label class="actor-import-option">
			<input type="checkbox" bind:checked={createFolder} />
			{game.i18n.localize(actorImport.createFolder)}
		</label>

		{#if createFolder}
			<input
				type="text"
				class="actor-import-folder-name"
				placeholder="Folder name"
				bind:value={folderName}
			/>
		{:else if actorFolders.length > 0}
			<select class="actor-import-folder-select" bind:value={selectedFolderId}>
				<option value="">{game.i18n.localize(actorImport.noFolder)}</option>
				{#each actorFolders as folder}
					<option value={folder.id}>{folder.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	<!-- Import Button -->
	<footer class="actor-import-footer">
		<button
			class="nimble-button actor-import-button"
			data-button-variant="full-width"
			type="button"
			onclick={importSelected}
			disabled={selectedCount === 0 || dialog.isLoading}
		>
			{#if dialog.isLoading}
				<i class="fa-solid fa-spinner fa-spin"></i>
			{:else}
				<i class="fa-solid fa-file-import"></i>
			{/if}
			{game.i18n.localize(actorImport.importSelected)} ({selectedCount})
		</button>
	</footer>
</article>

<style lang="scss">
	.actor-import-dialog {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.5rem;
		gap: 0.5rem;
	}

	.actor-import-search-section {
		padding: 0.5rem 0 0;
	}

	.actor-import-filters {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-light-tertiary);
	}

	.actor-import-filters-row {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.actor-import-filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 100px;
	}

	.actor-import-filter-label {
		font-size: var(--font-size-11);
		font-weight: 500;
		color: var(--color-text-dark-secondary);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.actor-import-filter-select {
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		font-size: var(--font-size-13);
		background: var(--color-bg-option);
		color: var(--color-text-dark-primary);
		cursor: pointer;
		transition: border-color 0.15s ease;

		&:hover {
			border-color: var(--color-border-light-secondary);
		}

		&:focus {
			outline: none;
			border-color: var(--color-border-highlight);
		}
	}

	.actor-import-filter-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: transparent;
		color: var(--color-text-dark-secondary);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
		flex-shrink: 0;

		&:hover {
			background: hsla(0, 60%, 50%, 0.1);
			border-color: hsla(0, 60%, 50%, 0.3);
			color: hsl(0, 60%, 45%);
		}
	}

	.actor-import-search-bar {
		position: relative;
		display: flex;
		align-items: center;
	}

	.actor-import-search-input {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		font-size: var(--font-size-14);

		&:focus {
			outline: none;
			border-color: var(--color-border-highlight);
		}
	}

	.actor-import-search-icon {
		position: absolute;
		left: 0.75rem;
		color: var(--color-text-dark-secondary);
		pointer-events: none;
	}

	.actor-import-options {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.actor-import-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: var(--font-size-14);

		input[type='checkbox'] {
			margin: 0;
			cursor: pointer;
		}
	}

	.actor-import-folder-name,
	.actor-import-folder-select {
		flex: 1;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		font-size: var(--font-size-14);
	}

	.actor-import-footer {
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border-light-tertiary);
	}

	.actor-import-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100% !important;
		max-width: none !important;
		padding: 0.75rem;

		&:disabled {
			cursor: not-allowed;
			opacity: 0.6;
		}

		i {
			font-size: 1rem;
		}
	}
</style>

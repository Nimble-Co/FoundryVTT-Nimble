<script>
	import { onMount } from 'svelte';

	let { dialog } = $props();
	const { actorImport } = CONFIG.NIMBLE;

	// Tab state
	let activeTab = $state('browse'); // 'browse' or 'upload'

	// Search state
	let searchQuery = $state('');
	let searchTimeout = $state(null);

	// Filter options
	const monsterTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'standard', label: 'Standard' },
		{ value: 'legendary', label: 'Legendary' },
		{ value: 'minion', label: 'Minion' },
	];

	const roleOptions = [
		{ value: 'all', label: 'All Roles' },
		{ value: 'ambusher', label: 'Ambusher' },
		{ value: 'aoe', label: 'AoE' },
		{ value: 'controller', label: 'Controller' },
		{ value: 'defender', label: 'Defender' },
		{ value: 'melee', label: 'Melee' },
		{ value: 'ranged', label: 'Ranged' },
		{ value: 'skirmisher', label: 'Skirmisher' },
		{ value: 'striker', label: 'Striker' },
		{ value: 'summoner', label: 'Summoner' },
		{ value: 'support', label: 'Support' },
	];

	const levelOptions = [
		{ value: '', label: 'All Levels' },
		{ value: '-4', label: '1/4' },
		{ value: '-3', label: '1/3' },
		{ value: '-2', label: '1/2' },
		...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
	];

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

	// File input reference
	let fileInput = $state(null);

	// Monster list element for infinite scroll
	let monsterListEl = $state(null);

	// Infinite scroll handler
	function handleScroll(event) {
		const el = event.target;
		if (!el || dialog.isLoading || !dialog.hasMore || activeTab !== 'browse') return;

		// Load more when scrolled within 100px of the bottom
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

	// Handle file selection
	function handleFileChange(event) {
		const file = event.target.files?.[0];
		if (file) {
			dialog.handleFileUpload(file);
		}
	}

	// Trigger file picker
	function openFilePicker() {
		fileInput?.click();
	}

	// Get monster type badge text
	function getMonsterTypeBadge(monster) {
		if (monster.attributes.legendary) return 'Solo';
		if (monster.attributes.minion) return 'Minion';
		return 'NPC';
	}

	// Get monster type badge class
	function getMonsterTypeBadgeClass(monster) {
		if (monster.attributes.legendary) return 'monster-badge--legendary';
		if (monster.attributes.minion) return 'monster-badge--minion';
		return 'monster-badge--npc';
	}

	// Import selected monsters
	async function importSelected() {
		const options = {};

		if (createFolder && folderName) {
			options.createFolder = true;
			options.folderName = folderName;
		} else if (selectedFolderId) {
			options.folderId = selectedFolderId;
		}

		const result =
			activeTab === 'browse'
				? await dialog.importSelectedFromSearch(options)
				: await dialog.importSelectedFromUpload(options);

		// If a folder was created, update UI to select it
		if (result.createdFolderId) {
			createFolder = false;
			selectedFolderId = result.createdFolderId;
		}
	}

	// Get current monsters list based on tab
	// Browse tab uses server-side filtering, upload tab uses client-side filtering
	let currentMonsters = $derived(
		activeTab === 'browse' ? dialog.searchResults : dialog.filteredUploadedMonsters,
	);

	// Get selection count (reactive)
	let selectedCount = $derived(
		currentMonsters.filter((m) => dialog.selectedMonsters.has(m.id)).length,
	);

	// Get actor folders (depends on foldersVersion to refresh after import)
	let actorFolders = $derived.by(() => {
		dialog.foldersVersion; // Reactive dependency
		return dialog.getActorFolders();
	});
</script>

<article class="actor-import-dialog">
	<!-- Tab Navigation -->
	<nav class="actor-import-tabs">
		<button
			class="actor-import-tab"
			class:actor-import-tab--active={activeTab === 'browse'}
			type="button"
			onclick={() => (activeTab = 'browse')}
		>
			<i class="fa-solid fa-search"></i>
			{game.i18n.localize(actorImport.browseTab)}
		</button>
		<button
			class="actor-import-tab"
			class:actor-import-tab--active={activeTab === 'upload'}
			type="button"
			onclick={() => (activeTab = 'upload')}
		>
			<i class="fa-solid fa-file-upload"></i>
			{game.i18n.localize(actorImport.uploadTab)}
		</button>
	</nav>

	<!-- Browse/Search Tab -->
	{#if activeTab === 'browse'}
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
	{/if}

	<!-- Filters Section -->
	<div class="actor-import-filters">
		<div class="actor-import-filters-row">
			<div class="actor-import-filter-group">
				<label class="actor-import-filter-label" for="level-filter">Level</label>
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
				<label class="actor-import-filter-label" for="type-filter">Type</label>
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
				<label class="actor-import-filter-label" for="role-filter">Role</label>
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
					title="Clear all filters"
				>
					<i class="fa-solid fa-times"></i>
				</button>
			{/if}
		</div>
	</div>

	<!-- Upload Tab -->
	{#if activeTab === 'upload'}
		<div class="actor-import-upload-section">
			<input
				type="file"
				accept=".json"
				style="display: none"
				bind:this={fileInput}
				onchange={handleFileChange}
			/>

			{#if dialog.uploadedMonsters.length === 0}
				<button class="actor-import-upload-button" type="button" onclick={openFilePicker}>
					<i class="fa-solid fa-file-upload"></i>
					<span>{game.i18n.localize(actorImport.selectFile)}</span>
				</button>
			{:else}
				<div class="actor-import-upload-info">
					<span>{dialog.uploadedMonsters.length} monsters loaded</span>
					<button
						class="actor-import-clear-button"
						type="button"
						onclick={() => dialog.clearUploadedMonsters()}
					>
						<i class="fa-solid fa-times"></i>
						{game.i18n.localize(actorImport.clearFile)}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Error Display -->
	{#if dialog.error}
		<div class="actor-import-error">
			<i class="fa-solid fa-exclamation-triangle"></i>
			{dialog.error}
		</div>
	{/if}

	<!-- Monster List -->
	<div class="actor-import-monster-list" bind:this={monsterListEl} onscroll={handleScroll}>
		{#if dialog.isLoading && currentMonsters.length === 0}
			<div class="actor-import-loading">
				<i class="fa-solid fa-spinner fa-spin"></i>
				{game.i18n.localize(actorImport.loading)}
			</div>
		{:else if currentMonsters.length === 0}
			<div class="actor-import-empty">
				<i class="fa-solid fa-ghost"></i>
				{game.i18n.localize(actorImport.noResults)}
			</div>
		{:else}
			<!-- Selection Controls -->
			<div class="actor-import-selection-controls">
				<button
					class="actor-import-select-button"
					type="button"
					onclick={() => (activeTab === 'browse' ? dialog.selectAll() : dialog.selectAllUploaded())}
				>
					{game.i18n.localize(actorImport.selectAll)}
				</button>
				<button
					class="actor-import-select-button"
					type="button"
					onclick={() => dialog.deselectAll()}
				>
					{game.i18n.localize(actorImport.deselectAll)}
				</button>
				<span class="actor-import-selection-count">
					{selectedCount} / {currentMonsters.length} selected
				</span>
			</div>

			<!-- Monster Items -->
			{#each currentMonsters as monster (monster.id)}
				<label class="actor-import-monster-item">
					<input
						type="checkbox"
						checked={dialog.selectedMonsters.has(monster.id)}
						onchange={() => dialog.toggleSelection(monster.id)}
					/>
					<div class="actor-import-monster-info">
						<span class="actor-import-monster-name">{monster.attributes.name}</span>
						<span class="monster-badge {getMonsterTypeBadgeClass(monster)}">
							{getMonsterTypeBadge(monster)}
						</span>
						<span class="actor-import-monster-level">Lvl {monster.attributes.level}</span>
						<span class="actor-import-monster-hp">{monster.attributes.hp} HP</span>
						{#if monster.attributes.kind}
							<span class="actor-import-monster-kind">{monster.attributes.kind}</span>
						{/if}
					</div>
				</label>
			{/each}

			<!-- Loading indicator for infinite scroll -->
			{#if dialog.isLoading && currentMonsters.length > 0}
				<div class="actor-import-loading-more">
					<i class="fa-solid fa-spinner fa-spin"></i>
				</div>
			{/if}
		{/if}
	</div>

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

	.actor-import-tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-border-light-tertiary);
		padding-bottom: 0.5rem;
	}

	.actor-import-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px 4px 0 0;
		cursor: pointer;
		color: var(--color-text-dark-secondary);
		font-size: var(--font-size-14);

		&:hover {
			background: var(--color-bg-option);
		}

		&--active {
			background: var(--color-bg-option);
			border-color: var(--color-border-light-tertiary);
			border-bottom-color: transparent;
			color: var(--color-text-dark-primary);
			font-weight: 500;
		}

		i {
			font-size: 0.875rem;
		}
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

	.actor-import-upload-section {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		gap: 1rem;
	}

	.actor-import-upload-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		border: 2px dashed var(--color-border-light-tertiary);
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		color: var(--color-text-dark-secondary);

		&:hover {
			border-color: var(--color-border-highlight);
			color: var(--color-text-dark-primary);
		}

		i {
			font-size: 2rem;
		}
	}

	.actor-import-upload-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.actor-import-clear-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		font-size: var(--font-size-12);

		&:hover {
			background: var(--color-bg-option);
		}
	}

	.actor-import-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: hsla(0, 60%, 50%, 0.1);
		border: 1px solid hsla(0, 60%, 50%, 0.3);
		border-radius: 4px;
		color: hsl(0, 60%, 40%);
		font-size: var(--font-size-12);
	}

	.actor-import-monster-list {
		flex: 1;
		overflow-y: auto;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: var(--color-bg-option);
	}

	.actor-import-loading,
	.actor-import-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		height: 100%;
		min-height: 150px;
		color: var(--color-text-dark-secondary);

		i {
			font-size: 2rem;
			opacity: 0.5;
		}
	}

	.actor-import-selection-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--color-border-light-tertiary);
		background: var(--color-bg-btn);
	}

	.actor-import-select-button {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		font-size: var(--font-size-12);

		&:hover {
			background: var(--color-bg-option);
		}
	}

	.actor-import-selection-count {
		margin-left: auto;
		color: var(--color-text-dark-secondary);
		font-size: var(--font-size-12);
	}

	.actor-import-monster-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--color-border-light-tertiary);
		cursor: pointer;

		&:hover {
			background: var(--color-bg-btn);
		}

		&:last-child {
			border-bottom: none;
		}

		input[type='checkbox'] {
			margin: 0;
			cursor: pointer;
		}
	}

	.actor-import-monster-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.actor-import-monster-name {
		font-weight: 500;
	}

	.monster-badge {
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		font-size: var(--font-size-10);
		font-weight: 600;
		text-transform: uppercase;

		&--legendary {
			background: hsl(45, 80%, 40%);
			color: white;
		}

		&--minion {
			background: hsl(200, 60%, 40%);
			color: white;
		}

		&--npc {
			background: hsl(120, 30%, 40%);
			color: white;
		}
	}

	.actor-import-monster-level,
	.actor-import-monster-hp,
	.actor-import-monster-kind {
		color: var(--color-text-dark-secondary);
		font-size: var(--font-size-12);
	}

	.actor-import-monster-kind {
		font-style: italic;
	}

	.actor-import-loading-more {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		color: var(--color-text-dark-secondary);

		i {
			font-size: 1.25rem;
		}
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

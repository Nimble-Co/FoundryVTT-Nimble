<script>
	import { getMonsterImageUrl } from '../../../../import/nimbleNexus/constants.js';

	const { actorImport } = CONFIG.NIMBLE;

	let { dialog, monsterListEl = $bindable(), onScroll } = $props();

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

	// Capitalize first letter of size
	function formatSize(size) {
		if (!size) return '';
		return size.charAt(0).toUpperCase() + size.slice(1);
	}

	let selectedCount = $derived(
		dialog.searchResults.filter((m) => dialog.selectedMonsters.has(m.id)).length,
	);
</script>

<div class="actor-import-monster-list" bind:this={monsterListEl} onscroll={onScroll}>
	{#if dialog.isLoading && dialog.searchResults.length === 0}
		<div class="actor-import-loading">
			<i class="fa-solid fa-spinner fa-spin"></i>
			{game.i18n.localize(actorImport.loading)}
		</div>
	{:else if dialog.searchResults.length === 0}
		<div class="actor-import-empty">
			<i class="fa-solid fa-ghost"></i>
			{game.i18n.localize(actorImport.noResults)}
		</div>
	{:else}
		<!-- Loading overlay for filter updates -->
		{#if dialog.isLoading}
			<div class="actor-import-loading-overlay">
				<i class="fa-solid fa-spinner fa-spin"></i>
			</div>
		{/if}

		<!-- Selection Controls -->
		<div class="actor-import-selection-controls">
			<button class="actor-import-select-button" type="button" onclick={() => dialog.selectAll()}>
				{game.i18n.localize(actorImport.selectAll)}
			</button>
			<button class="actor-import-select-button" type="button" onclick={() => dialog.deselectAll()}>
				{game.i18n.localize(actorImport.deselectAll)}
			</button>
			<span class="actor-import-selection-count">
				{selectedCount} / {dialog.searchResults.length} selected
			</span>
		</div>

		<!-- Monster Items -->
		{#each dialog.searchResults as monster (monster.id)}
			<label class="actor-import-monster-item">
				<input
					type="checkbox"
					checked={dialog.selectedMonsters.has(monster.id)}
					onchange={() => dialog.toggleSelection(monster.id)}
				/>
				<img
					class="actor-import-monster-avatar"
					src={getMonsterImageUrl(monster.attributes.paperforgeImageUrl)}
					alt={monster.attributes.name}
				/>
				<div class="actor-import-monster-info">
					<span class="actor-import-monster-name">{monster.attributes.name}</span>
					<span class="monster-badge {getMonsterTypeBadgeClass(monster)}">
						{getMonsterTypeBadge(monster)}
					</span>
					<span class="actor-import-monster-level">Lvl {monster.attributes.level}</span>
					<span class="actor-import-monster-size">{formatSize(monster.attributes.size)}</span>
					<span class="actor-import-monster-hp">{monster.attributes.hp} HP</span>
					{#if monster.attributes.kind}
						<span class="actor-import-monster-kind">{monster.attributes.kind}</span>
					{/if}
				</div>
			</label>
		{/each}

		<!-- Loading indicator for infinite scroll -->
		{#if dialog.isLoading && dialog.searchResults.length > 0}
			<div class="actor-import-loading-more">
				<i class="fa-solid fa-spinner fa-spin"></i>
			</div>
		{/if}
	{/if}
</div>

<style>
	.actor-import-monster-list {
		position: relative;
		flex: 1;
		overflow-y: auto;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: var(--color-bg-option);
	}

	.actor-import-monster-list:has(.actor-import-loading),
	.actor-import-monster-list:has(.actor-import-empty) {
		overflow: hidden;
	}

	.actor-import-loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsla(0, 0%, 100%, 0.7);
		z-index: 10;
		pointer-events: none;
	}

	.actor-import-loading-overlay i {
		font-size: 2rem;
		color: var(--color-text-dark-secondary);
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
	}

	.actor-import-loading i,
	.actor-import-empty i {
		font-size: 2rem;
		opacity: 0.5;
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
	}

	.actor-import-select-button:hover {
		background: var(--color-bg-option);
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
	}

	.actor-import-monster-item:hover {
		background: var(--color-bg-btn);
	}

	.actor-import-monster-item:last-child {
		border-bottom: none;
	}

	.actor-import-monster-item input[type='checkbox'] {
		margin: 0;
		cursor: pointer;
	}

	.actor-import-monster-avatar {
		width: 32px;
		height: 32px;
		border-radius: 4px;
		object-fit: cover;
		background: var(--color-bg-option);
		flex-shrink: 0;
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
	}

	:global(.monster-badge--legendary) {
		background: hsl(45, 80%, 40%);
		color: white;
	}

	:global(.monster-badge--minion) {
		background: hsl(200, 60%, 40%);
		color: white;
	}

	:global(.monster-badge--npc) {
		background: hsl(120, 30%, 40%);
		color: white;
	}

	.actor-import-monster-level,
	.actor-import-monster-size,
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
	}

	.actor-import-loading-more i {
		font-size: 1.25rem;
	}
</style>

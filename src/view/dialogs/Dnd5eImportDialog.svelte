<script>
	let { dialog } = $props();
	const { dnd5eImport, actorImport } = CONFIG.NIMBLE;

	// Folder options
	let createFolder = $state(false);
	let folderName = $state('5e Conversion');
	let selectedFolderId = $state('');

	// Get actor folders (depends on foldersVersion to refresh after import)
	let actorFolders = $derived.by(() => {
		const _version = dialog.foldersVersion;
		return dialog.getActorFolders();
	});

	function buildImportOptions() {
		const options = {};
		if (createFolder && folderName) {
			options.createFolder = true;
			options.folderName = folderName;
		} else if (selectedFolderId) {
			options.folderId = selectedFolderId;
		}
		return options;
	}

	async function handleImportSingle(report) {
		const success = await dialog.importSingle(report, buildImportOptions());
		if (success) dialog.close();
	}

	async function handleImportAll() {
		const success = await dialog.importAll(buildImportOptions());
		if (success) dialog.close();
	}

	// Report stats helpers
	function countByFlag(report, flag) {
		return report.items.filter((i) => i.flag === flag).length;
	}

	function formatMovement(movement) {
		return Object.entries(movement)
			.map(([mode, val]) => `${mode}: ${val} spaces`)
			.join(', ');
	}
</script>

<article class="dnd5e-import-dialog">
	{#if dialog.step === 'input'}
		<!-- ─── Input Step ──────────────────────────────────────────────── -->
		<div class="dnd5e-import-tabs">
			<button
				class="dnd5e-import-tab"
				class:active={dialog.activeTab === 'json'}
				type="button"
				onclick={() => (dialog.activeTab = 'json')}
			>
				{dnd5eImport.pasteJsonTab}
			</button>
			<button
				class="dnd5e-import-tab"
				class:active={dialog.activeTab === 'text'}
				type="button"
				onclick={() => (dialog.activeTab = 'text')}
			>
				{dnd5eImport.pasteTextTab}
			</button>
		</div>

		<div class="dnd5e-import-input-area">
			<p class="dnd5e-import-prompt">
				{dialog.activeTab === 'json' ? dnd5eImport.pasteJsonPrompt : dnd5eImport.pasteTextPrompt}
			</p>

			<textarea
				class="dnd5e-import-textarea"
				placeholder={dialog.activeTab === 'json'
					? '{ "name": "Wolf", "type": "npc", ... }'
					: 'Wolf\nMedium Beast, Unaligned\n\nArmor Class 13 (natural armor)\n...'}
				value={dialog.inputText}
				oninput={(e) => (dialog.inputText = e.target.value)}
			></textarea>
		</div>

		{#if dialog.error}
			<div class="dnd5e-import-error">
				<i class="fa-solid fa-circle-exclamation"></i>
				{dialog.error}
			</div>
		{/if}

		<footer class="dnd5e-import-footer">
			<button
				class="nimble-button"
				data-button-variant="full-width"
				type="button"
				onclick={() => dialog.parseAndConvert()}
				disabled={dialog.isLoading || !dialog.inputText.trim()}
			>
				{#if dialog.isLoading}
					<i class="fa-solid fa-spinner fa-spin"></i>
				{:else}
					<i class="fa-solid fa-wand-magic-sparkles"></i>
				{/if}
				{dnd5eImport.parseButton}
			</button>
		</footer>
	{:else}
		<!-- ─── Review Step ─────────────────────────────────────────────── -->
		<div class="dnd5e-import-review">
			<div class="dnd5e-import-review-header">
				<button class="dnd5e-import-back-button" type="button" onclick={() => dialog.goBack()}>
					<i class="fa-solid fa-arrow-left"></i>
					{dnd5eImport.backButton}
				</button>

				{#if dialog.reports.length > 1}
					<span class="dnd5e-import-batch-count">
						{dnd5eImport.batchCount.replace('{count}', String(dialog.reports.length))}
					</span>
				{/if}
			</div>

			<div class="dnd5e-import-reports" class:batch={dialog.reports.length > 1}>
				{#each dialog.reports as entry}
					{@const report = entry.report}
					{@const autoCount = countByFlag(report, 'auto')}
					{@const reviewCount = countByFlag(report, 'review')}
					{@const skippedCount = report.skippedItems.length}

					<details class="dnd5e-import-report" open={dialog.reports.length === 1}>
						<summary class="dnd5e-import-report-header">
							<h3 class="dnd5e-import-monster-name">{report.name.value}</h3>
							<div class="dnd5e-import-badges">
								{#if autoCount > 0}
									<span class="dnd5e-badge dnd5e-badge--auto" title={dnd5eImport.badges.auto}>
										{autoCount} auto
									</span>
								{/if}
								{#if reviewCount > 0}
									<span class="dnd5e-badge dnd5e-badge--review" title={dnd5eImport.badges.review}>
										{reviewCount} review
									</span>
								{/if}
								{#if skippedCount > 0}
									<span class="dnd5e-badge dnd5e-badge--skipped" title={dnd5eImport.badges.skipped}>
										{skippedCount} skipped
									</span>
								{/if}
							</div>
						</summary>

						<div class="dnd5e-import-report-body">
							<!-- Basic Info -->
							<section class="dnd5e-report-section">
								<h4>{dnd5eImport.sections.basicInfo}</h4>
								<div class="dnd5e-report-fields">
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.actorType}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.actorType.flag}"></span>
											{report.actorType.value}
											{#if report.actorType.note}<small class="dnd5e-report-note"
													>({report.actorType.note})</small
												>{/if}
										</span>
									</div>
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.size}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.sizeCategory.flag}"></span>
											{report.sizeCategory.value}
										</span>
									</div>
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.creatureType}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.creatureType.flag}"></span>
											{report.creatureType.value}
										</span>
									</div>
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.hp}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.hp.flag}"></span>
											{report.hp.value}
											{#if report.hp.note}<small class="dnd5e-report-note">({report.hp.note})</small
												>{/if}
										</span>
									</div>
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.armor}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.armor.flag}"></span>
											{report.armor.value}
											{#if report.armor.note}<small class="dnd5e-report-note"
													>({report.armor.note})</small
												>{/if}
										</span>
									</div>
									<div class="dnd5e-report-field">
										<span class="dnd5e-report-field-label">{dnd5eImport.fields.level}</span>
										<span class="dnd5e-report-field-value">
											<span class="dnd5e-flag dnd5e-flag--{report.level.flag}"></span>
											{report.level.value}
											{#if report.level.note}<small class="dnd5e-report-note"
													>({report.level.note})</small
												>{/if}
										</span>
									</div>
								</div>
							</section>

							<!-- Movement -->
							<section class="dnd5e-report-section">
								<h4>{dnd5eImport.sections.movement}</h4>
								<div class="dnd5e-report-field">
									<span class="dnd5e-flag dnd5e-flag--{report.movement.flag}"></span>
									<span>{formatMovement(report.movement.value)}</span>
									{#if report.movement.note}<small class="dnd5e-report-note"
											>({report.movement.note})</small
										>{/if}
								</div>
							</section>

							<!-- Defenses -->
							{#if report.damageResistances.value.length > 0 || report.damageImmunities.value.length > 0 || report.damageVulnerabilities.value.length > 0}
								<section class="dnd5e-report-section">
									<h4>{dnd5eImport.sections.defenses}</h4>
									{#if report.damageResistances.value.length > 0}
										<div class="dnd5e-report-field">
											<span class="dnd5e-report-field-label">{dnd5eImport.fields.resistances}</span>
											<span class="dnd5e-report-field-value">
												<span class="dnd5e-flag dnd5e-flag--{report.damageResistances.flag}"></span>
												{report.damageResistances.value.join(', ')}
											</span>
										</div>
									{/if}
									{#if report.damageImmunities.value.length > 0}
										<div class="dnd5e-report-field">
											<span class="dnd5e-report-field-label">{dnd5eImport.fields.immunities}</span>
											<span class="dnd5e-report-field-value">
												<span class="dnd5e-flag dnd5e-flag--{report.damageImmunities.flag}"></span>
												{report.damageImmunities.value.join(', ')}
											</span>
										</div>
									{/if}
									{#if report.damageVulnerabilities.value.length > 0}
										<div class="dnd5e-report-field">
											<span class="dnd5e-report-field-label"
												>{dnd5eImport.fields.vulnerabilities}</span
											>
											<span class="dnd5e-report-field-value">
												<span class="dnd5e-flag dnd5e-flag--{report.damageVulnerabilities.flag}"
												></span>
												{report.damageVulnerabilities.value.join(', ')}
											</span>
										</div>
									{/if}
								</section>
							{/if}

							<!-- Saving Throws -->
							{#if report.savingThrows.flag === 'review'}
								<section class="dnd5e-report-section">
									<h4>{dnd5eImport.sections.savingThrows}</h4>
									<div class="dnd5e-report-field">
										<span class="dnd5e-flag dnd5e-flag--review"></span>
										{#if report.savingThrows.note}
											<span>{report.savingThrows.note}</span>
										{/if}
									</div>
								</section>
							{/if}

							<!-- Actions / Items -->
							{#if report.items.length > 0}
								<section class="dnd5e-report-section">
									<h4>{dnd5eImport.sections.actions}</h4>
									<ul class="dnd5e-report-items">
										{#each report.items as item}
											<li class="dnd5e-report-item">
												<span class="dnd5e-flag dnd5e-flag--{item.flag}"></span>
												<span class="dnd5e-report-item-name">{item.name}</span>
												{#if item.note}
													<small class="dnd5e-report-note">{item.note}</small>
												{/if}
											</li>
										{/each}
									</ul>
								</section>
							{/if}

							<!-- Spell Matches -->
							{#if report.spellMatches.length > 0}
								<section class="dnd5e-report-section">
									<h4>{dnd5eImport.sections.spells}</h4>
									<ul class="dnd5e-report-items">
										{#each report.spellMatches as spell}
											<li class="dnd5e-report-item">
												<span class="dnd5e-flag dnd5e-flag--{spell.flag}"></span>
												<span class="dnd5e-report-item-name">{spell.spellName}</span>
												{#if spell.matchedNimbleName}
													<small class="dnd5e-report-note">
														→ {spell.matchedNimbleName}
														{#if spell.distance > 0}(distance: {spell.distance}){/if}
													</small>
												{/if}
											</li>
										{/each}
									</ul>
								</section>
							{/if}

							<!-- Skipped Items -->
							{#if report.skippedItems.length > 0}
								<section class="dnd5e-report-section">
									<h4>{dnd5eImport.sections.skipped}</h4>
									<ul class="dnd5e-report-items">
										{#each report.skippedItems as item}
											<li class="dnd5e-report-item dnd5e-report-item--skipped">
												<span class="dnd5e-flag dnd5e-flag--skipped"></span>
												<span class="dnd5e-report-item-name">{item.name}</span>
												<small class="dnd5e-report-note">{item.reason}</small>
											</li>
										{/each}
									</ul>
								</section>
							{/if}

							<!-- Warnings -->
							{#if report.warnings.length > 0}
								<section class="dnd5e-report-section dnd5e-report-section--warnings">
									<h4>{dnd5eImport.sections.warnings}</h4>
									<ul class="dnd5e-report-warnings">
										{#each report.warnings as warning}
											<li><i class="fa-solid fa-triangle-exclamation"></i> {warning}</li>
										{/each}
									</ul>
								</section>
							{/if}

							<!-- Single import button (batch mode) -->
							{#if dialog.reports.length > 1}
								<button
									class="nimble-button dnd5e-import-single-button"
									type="button"
									onclick={() => handleImportSingle(report)}
									disabled={dialog.isLoading}
								>
									<i class="fa-solid fa-file-import"></i>
									{dnd5eImport.importButton}
								</button>
							{/if}
						</div>
					</details>
				{/each}
			</div>

			{#if dialog.error}
				<div class="dnd5e-import-error">
					<i class="fa-solid fa-circle-exclamation"></i>
					{dialog.error}
				</div>
			{/if}

			<!-- Folder Options -->
			<div class="dnd5e-import-options">
				<label class="dnd5e-import-option">
					<input type="checkbox" bind:checked={createFolder} />
					{actorImport.createFolder}
				</label>

				{#if createFolder}
					<input
						type="text"
						class="dnd5e-import-folder-name"
						placeholder={dnd5eImport.folderNamePlaceholder}
						bind:value={folderName}
					/>
				{:else if actorFolders.length > 0}
					<select class="dnd5e-import-folder-select" bind:value={selectedFolderId}>
						<option value="">{actorImport.noFolder}</option>
						{#each actorFolders as folder}
							<option value={folder.id}>{folder.name}</option>
						{/each}
					</select>
				{/if}
			</div>

			<!-- Import Button -->
			<footer class="dnd5e-import-footer">
				{#if dialog.reports.length === 1}
					<button
						class="nimble-button"
						data-button-variant="full-width"
						type="button"
						onclick={() => handleImportSingle(dialog.reports[0].report)}
						disabled={dialog.isLoading}
					>
						{#if dialog.isLoading}
							<i class="fa-solid fa-spinner fa-spin"></i>
						{:else}
							<i class="fa-solid fa-file-import"></i>
						{/if}
						{dnd5eImport.importButton}
					</button>
				{:else}
					<button
						class="nimble-button"
						data-button-variant="full-width"
						type="button"
						onclick={handleImportAll}
						disabled={dialog.isLoading}
					>
						{#if dialog.isLoading}
							<i class="fa-solid fa-spinner fa-spin"></i>
						{:else}
							<i class="fa-solid fa-file-import"></i>
						{/if}
						{dnd5eImport.importAllButton} ({dialog.reports.length})
					</button>
				{/if}

				<button
					class="nimble-button dnd5e-import-another-button"
					type="button"
					onclick={() => dialog.reset()}
				>
					<i class="fa-solid fa-rotate"></i>
					{dnd5eImport.importAnother}
				</button>
			</footer>
		</div>
	{/if}
</article>

<style lang="scss">
	.dnd5e-import-dialog {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.5rem;
		gap: 0.5rem;
	}

	/* ─── Tabs ───────────────────────────────────────────────────────── */

	.dnd5e-import-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--color-border-light-tertiary);
	}

	.dnd5e-import-tab {
		flex: 1;
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		font-size: var(--font-size-14);
		cursor: pointer;
		color: var(--color-text-dark-secondary);
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all 0.15s ease;

		&:hover {
			color: var(--color-text-dark-primary);
		}

		&.active {
			color: var(--color-text-dark-primary);
			font-weight: 600;
			border-bottom-color: var(--color-border-highlight);
		}
	}

	/* ─── Input Area ─────────────────────────────────────────────────── */

	.dnd5e-import-input-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
	}

	.dnd5e-import-prompt {
		font-size: var(--font-size-13);
		color: var(--color-text-dark-secondary);
		margin: 0;
	}

	.dnd5e-import-textarea {
		flex: 1;
		resize: none;
		padding: 0.75rem;
		font-family: monospace;
		font-size: var(--font-size-12);
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		min-height: 200px;

		&:focus {
			outline: none;
			border-color: var(--color-border-highlight);
		}
	}

	/* ─── Error ──────────────────────────────────────────────────────── */

	.dnd5e-import-error {
		padding: 0.5rem 0.75rem;
		background: hsla(0, 60%, 50%, 0.1);
		border: 1px solid hsla(0, 60%, 50%, 0.3);
		border-radius: 4px;
		color: hsl(0, 60%, 40%);
		font-size: var(--font-size-13);

		i {
			margin-right: 0.25rem;
		}
	}

	/* ─── Footer ─────────────────────────────────────────────────────── */

	.dnd5e-import-footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border-light-tertiary);
	}

	.dnd5e-import-another-button {
		font-size: var(--font-size-12);
		opacity: 0.8;
	}

	/* ─── Review Step ────────────────────────────────────────────────── */

	.dnd5e-import-review {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 0.5rem;
	}

	.dnd5e-import-review-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.dnd5e-import-back-button {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		font-size: var(--font-size-13);

		&:hover {
			background: var(--color-bg-option);
		}

		i {
			margin-right: 0.25rem;
		}
	}

	.dnd5e-import-batch-count {
		font-size: var(--font-size-13);
		color: var(--color-text-dark-secondary);
	}

	.dnd5e-import-reports {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* ─── Report Card ────────────────────────────────────────────────── */

	.dnd5e-import-report {
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;

		&[open] {
			summary {
				border-bottom: 1px solid var(--color-border-light-tertiary);
			}
		}
	}

	.dnd5e-import-report-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		user-select: none;

		&:hover {
			background: var(--color-bg-option);
		}
	}

	.dnd5e-import-monster-name {
		margin: 0;
		font-size: var(--font-size-14);
		font-weight: 600;
	}

	.dnd5e-import-report-body {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ─── Badges ──────────────────────────────────────────────────────── */

	.dnd5e-import-badges {
		display: flex;
		gap: 0.375rem;
	}

	.dnd5e-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: var(--font-size-11);
		font-weight: 500;

		&--auto {
			background: hsla(120, 40%, 50%, 0.15);
			color: hsl(120, 40%, 35%);
		}

		&--review {
			background: hsla(40, 80%, 50%, 0.15);
			color: hsl(40, 60%, 35%);
		}

		&--skipped {
			background: hsla(0, 60%, 50%, 0.1);
			color: hsl(0, 50%, 40%);
		}
	}

	/* ─── Report Sections ────────────────────────────────────────────── */

	.dnd5e-report-section {
		h4 {
			margin: 0 0 0.375rem;
			font-size: var(--font-size-12);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.025em;
			color: var(--color-text-dark-secondary);
		}

		&--warnings {
			h4 {
				color: hsl(40, 60%, 35%);
			}
		}
	}

	.dnd5e-report-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.dnd5e-report-field {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: var(--font-size-13);
	}

	.dnd5e-report-field-label {
		font-weight: 500;
		color: var(--color-text-dark-secondary);
		min-width: 60px;
	}

	.dnd5e-report-field-value {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.dnd5e-report-note {
		font-size: var(--font-size-11);
		color: var(--color-text-dark-secondary);
	}

	/* ─── Flag Indicators ────────────────────────────────────────────── */

	.dnd5e-flag {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;

		&--auto {
			background: hsl(120, 45%, 50%);
		}

		&--review {
			background: hsl(40, 80%, 50%);
		}

		&--skipped {
			background: hsl(0, 60%, 50%);
		}
	}

	/* ─── Item Lists ─────────────────────────────────────────────────── */

	.dnd5e-report-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dnd5e-report-item {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: var(--font-size-13);
		padding: 0.125rem 0;
	}

	.dnd5e-report-item-name {
		font-weight: 500;
	}

	.dnd5e-report-warnings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		li {
			font-size: var(--font-size-13);
			color: hsl(40, 60%, 35%);

			i {
				color: hsl(40, 80%, 50%);
				margin-right: 0.25rem;
			}
		}
	}

	/* ─── Options ─────────────────────────────────────────────────────── */

	.dnd5e-import-options {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.dnd5e-import-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: var(--font-size-13);

		input[type='checkbox'] {
			margin: 0;
			cursor: pointer;
		}
	}

	.dnd5e-import-folder-name,
	.dnd5e-import-folder-select {
		flex: 1;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border-light-tertiary);
		border-radius: 4px;
		font-size: var(--font-size-13);
	}

	.dnd5e-import-single-button {
		align-self: flex-end;
		font-size: var(--font-size-12);
	}
</style>

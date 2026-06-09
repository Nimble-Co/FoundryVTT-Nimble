<script lang="ts">
	let { dialog } = $props();

	let fileInput: HTMLInputElement;
	let isDragging = $state(false);

	const localize = (key: string) => game.i18n.localize(key);

	function openPicker() {
		fileInput?.click();
	}

	async function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		await dialog.loadFile(input.files?.[0]);
		// Reset so selecting the same file again still fires a change event.
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) dialog.loadFile(file);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function onDragLeave() {
		isDragging = false;
	}
</script>

<article class="nimble-import-json">
	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		class="nimble-import-json__file-input"
		onchange={onFileChange}
	/>

	{#if !dialog.hasFile}
		<button
			type="button"
			class="nimble-import-json__dropzone"
			class:is-dragging={isDragging}
			onclick={openPicker}
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
		>
			<i class="fa-solid fa-file-arrow-up"></i>
			<span class="nimble-import-json__dropzone-title">
				{localize('NIMBLE.actorImport.json.selectPrompt')}
			</span>
			<span class="nimble-import-json__dropzone-hint">
				{localize('NIMBLE.actorImport.json.selectHint')}
			</span>
		</button>

		{#if dialog.error}
			<p class="nimble-import-json__error">
				<i class="fa-solid fa-triangle-exclamation"></i>
				{dialog.error}
			</p>
		{/if}
	{:else}
		{@const preview = dialog.preview}
		<div class="nimble-import-json__preview">
			<header class="nimble-import-json__heading">
				{#if preview.img}
					<img class="nimble-import-json__img" src={preview.img} alt={preview.name} />
				{:else}
					<div class="nimble-import-json__img nimble-import-json__img--placeholder">
						<i class="fa-solid fa-user"></i>
					</div>
				{/if}

				<div class="nimble-import-json__title-block">
					<h2 class="nimble-heading">{preview.name}</h2>
					<span class="nimble-import-json__subtitle">
						{preview.typeLabel}
						{#if preview.ancestry}&middot; {preview.ancestry}{/if}
						{#if preview.className}&middot; {preview.className}{/if}
					</span>
				</div>
			</header>

			<div class="nimble-import-json__stats">
				{#if preview.level !== null}
					<div class="nimble-import-json__stat">
						<span class="nimble-import-json__stat-value">{preview.level}</span>
						<span class="nimble-import-json__stat-label">
							{localize('NIMBLE.actorImport.json.statLevel')}
						</span>
					</div>
				{/if}
				{#if preview.hpMax !== null}
					<div class="nimble-import-json__stat">
						<span class="nimble-import-json__stat-value">{preview.hpMax}</span>
						<span class="nimble-import-json__stat-label">
							{localize('NIMBLE.actorImport.json.statHp')}
						</span>
					</div>
				{/if}
				<div class="nimble-import-json__stat">
					<span class="nimble-import-json__stat-value">{preview.totalItems}</span>
					<span class="nimble-import-json__stat-label">
						{localize('NIMBLE.actorImport.json.statItems')}
					</span>
				</div>
			</div>

			<section class="nimble-import-json__contents">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.actorImport.json.contentsHeader')}
				</h3>

				{#if preview.totalItems === 0}
					<p class="nimble-import-json__empty">
						{localize('NIMBLE.actorImport.json.noItems')}
					</p>
				{:else}
					{#each preview.itemGroups as group (group.type)}
						<div class="nimble-import-json__group">
							<span class="nimble-import-json__group-label">
								{group.label} ({group.names.length})
							</span>
							<ul class="nimble-import-json__group-items">
								{#each group.names as name, index (index)}
									<li>{name}</li>
								{/each}
							</ul>
						</div>
					{/each}
				{/if}
			</section>
		</div>

		{#if dialog.error}
			<p class="nimble-import-json__error">
				<i class="fa-solid fa-triangle-exclamation"></i>
				{dialog.error}
			</p>
		{/if}

		<footer class="nimble-import-json__footer">
			<button
				type="button"
				class="nimble-button"
				onclick={() => dialog.clearFile()}
				disabled={dialog.isImporting}
			>
				{localize('NIMBLE.actorImport.json.chooseDifferent')}
			</button>
			<button
				type="button"
				class="nimble-button"
				data-button-variant="primary"
				onclick={() => dialog.confirmImport()}
				disabled={dialog.isImporting}
			>
				{#if dialog.isImporting}
					<i class="fa-solid fa-spinner fa-spin"></i>
					{localize('NIMBLE.actorImport.json.importing')}
				{:else}
					<i class="fa-solid fa-file-import"></i>
					{localize('NIMBLE.actorImport.json.confirm')}
				{/if}
			</button>
		</footer>
	{/if}
</article>

<style lang="scss">
	.nimble-import-json {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;

		&__file-input {
			display: none;
		}

		&__dropzone {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 2rem 1rem;
			border: 2px dashed var(--color-border-light-tertiary);
			border-radius: 6px;
			background: transparent;
			cursor: pointer;
			transition: border-color 0.15s ease, background-color 0.15s ease;

			&:hover,
			&.is-dragging {
				border-color: var(--nimble-primary-color, var(--color-text-hyperlink));
				background-color: rgba(0, 0, 0, 0.05);
			}

			i {
				font-size: 2rem;
				opacity: 0.7;
			}

			&-title {
				font-weight: bold;
			}

			&-hint {
				font-size: var(--nimble-xs-text, 0.8rem);
				opacity: 0.7;
			}
		}

		&__preview {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		&__heading {
			display: flex;
			align-items: center;
			gap: 0.75rem;
		}

		&__img {
			width: 64px;
			height: 64px;
			object-fit: cover;
			border-radius: 4px;
			border: 1px solid var(--color-border-light-tertiary);
			flex: 0 0 auto;

			&--placeholder {
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0.5;

				i {
					font-size: 1.5rem;
				}
			}
		}

		&__title-block {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}

		&__subtitle {
			font-size: var(--nimble-sm-text, 0.9rem);
			opacity: 0.8;
		}

		&__stats {
			display: flex;
			gap: 0.5rem;
		}

		&__stat {
			display: flex;
			flex-direction: column;
			align-items: center;
			flex: 1;
			padding: 0.5rem;
			border-radius: 4px;
			background-color: rgba(0, 0, 0, 0.05);
		}

		&__stat-value {
			font-size: var(--nimble-lg-text, 1.25rem);
			font-weight: bold;
			line-height: 1.1;
		}

		&__stat-label {
			font-size: var(--nimble-xs-text, 0.75rem);
			text-transform: uppercase;
			opacity: 0.7;
		}

		&__contents {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			max-height: 280px;
			overflow-y: auto;
		}

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__group-label {
			font-weight: bold;
			font-size: var(--nimble-sm-text, 0.9rem);
		}

		&__group-items {
			margin: 0;
			padding-left: 1.25rem;
			font-size: var(--nimble-sm-text, 0.9rem);
			opacity: 0.9;
		}

		&__empty {
			margin: 0;
			opacity: 0.7;
			font-style: italic;
		}

		&__error {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			color: var(--color-level-error, #b91c1c);
		}

		&__footer {
			display: flex;
			gap: 0.5rem;

			button {
				flex: 1 1 0;
			}
		}
	}
</style>

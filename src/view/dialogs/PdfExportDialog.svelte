<script lang="ts">
	import type { PdfExportDialogProps } from '#types/components/PdfExportDialog.js';
	import localize from '#utils/localize.ts';
	import { CHARS_PER_COLUMN } from '../sheets/character/pdfExport/generatePdfContent.ts';
	import PdfPreviewDialog from './PdfPreviewDialog.svelte';
	import { createPdfExportDialogState } from './PdfExportDialogState.svelte.ts';

	let { actor, dialog }: PdfExportDialogProps = $props();

	const state = createPdfExportDialogState(
		() => actor,
		() => dialog,
		PdfPreviewDialog,
	);
	const {
		toggleCategory,
		areCategoryItemsAllSelected,
		toggleSelectAllInCategory,
		toggleItem,
		insertSelected,
		handleEditorInput,
		handleEditorKeydown,
		handleEditorCutPaste,
		applyFormat,
		getCategoryLabel,
		resetToDefault,
		generatePdf,
		openPreviewDialog,
	} = state;

	const searchActive = $derived(state.searchActive);
	const itemsByCategory = $derived(state.itemsByCategory);
	const selectedItems = $derived(state.selectedItems);
	const expandedCategories = $derived(state.expandedCategories);
	const column1OverLimit = $derived(state.column1OverLimit);
	const column2OverLimit = $derived(state.column2OverLimit);
	const column3OverLimit = $derived(state.column3OverLimit);
	const columnTooltips = $derived(state.columnTooltips);
	const column1Count = $derived(state.column1Count);
	const column2Count = $derived(state.column2Count);
	const column3Count = $derived(state.column3Count);
	const activeColumnCount = $derived(state.activeColumnCount);
	const activeColumnOverLimit = $derived(state.activeColumnOverLimit);
</script>

<article class="nimble-sheet__body pdf-export-dialog">
	<div class="pdf-export-dialog__layout">
		<!-- Content Picker Section -->
		<section class="pdf-export-dialog__picker">
			<h3 class="pdf-export-dialog__section-title">
				{localize('NIMBLE.pdfExport.contentPicker')}
			</h3>

			<div class="pdf-export-dialog__search-wrapper">
				<i class="fa-solid fa-magnifying-glass pdf-export-dialog__search-icon"></i>
				<input
					type="search"
					class="pdf-export-dialog__search"
					placeholder={localize('NIMBLE.pdfExport.search')}
					bind:value={state.searchQuery}
				/>
			</div>

			<div class="pdf-export-dialog__categories">
				{#each Object.entries(itemsByCategory) as [category, items]}
					<div class="pdf-export-dialog__category">
						{#if items.length === 1}
							<label class="pdf-export-dialog__item pdf-export-dialog__item--single">
								<input
									type="checkbox"
									checked={selectedItems.has(items[0].id)}
									onchange={() => toggleItem(items[0].id)}
								/>
								<span class="pdf-export-dialog__item-label">
									<span class="pdf-export-dialog__item-category">{getCategoryLabel(category)}:</span
									>
									{items[0].label}
								</span>
							</label>
						{:else}
							<div class="pdf-export-dialog__category-header">
								<button
									type="button"
									class="pdf-export-dialog__category-toggle"
									onclick={() => toggleCategory(category)}
								>
									<i
										class="fa-solid"
										class:fa-chevron-down={expandedCategories.has(category)}
										class:fa-chevron-right={!expandedCategories.has(category)}
									></i>
									<span>{getCategoryLabel(category)}</span>
									<span class="pdf-export-dialog__category-count">({items.length})</span>
								</button>
							</div>

							{#if expandedCategories.has(category) || searchActive}
								<div class="pdf-export-dialog__category-items">
									<label class="pdf-export-dialog__item pdf-export-dialog__item--select-all">
										<input
											type="checkbox"
											checked={areCategoryItemsAllSelected(category)}
											onchange={() => toggleSelectAllInCategory(category)}
										/>
										<span
											class="pdf-export-dialog__item-label pdf-export-dialog__item-label--select-all"
										>
											{areCategoryItemsAllSelected(category)
												? localize('NIMBLE.pdfExport.deselectAll')
												: localize('NIMBLE.pdfExport.selectAll')}
										</span>
									</label>
									{#each items as item}
										<label class="pdf-export-dialog__item">
											<input
												type="checkbox"
												checked={selectedItems.has(item.id)}
												onchange={() => toggleItem(item.id)}
											/>
											<span class="pdf-export-dialog__item-label">{item.label}</span>
										</label>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<button
				type="button"
				class="nimble-button pdf-export-dialog__insert-btn"
				data-button-variant="full-width"
				data-tooltip={localize('NIMBLE.pdfExport.insertAtCursor')}
				data-tooltip-direction="UP"
				disabled={selectedItems.size === 0}
				onclick={insertSelected}
			>
				<i class="fa-solid fa-plus"></i>
				{localize('NIMBLE.pdfExport.insertToColumn', { column: state.activeColumnTab })}
			</button>
			<!-- Invisible spacer mirrors the char-count row height so the button bottom aligns with the text box bottom -->
			<div
				class="pdf-export-dialog__char-count"
				aria-hidden="true"
				style="visibility: hidden; pointer-events: none;"
			>
				&nbsp;
			</div>
		</section>

		<!-- Column Editor Section -->
		<section class="pdf-export-dialog__editor">
			<div class="pdf-export-dialog__editor-header">
				<h3 class="pdf-export-dialog__section-title">
					{localize('NIMBLE.pdfExport.columnEditor')}
				</h3>
				<button
					type="button"
					class="pdf-export-dialog__reset-btn"
					title={localize('NIMBLE.pdfExport.resetToDefault')}
					onclick={resetToDefault}
				>
					<i class="fa-solid fa-rotate-left"></i>
					{localize('NIMBLE.pdfExport.resetToDefault')}
				</button>
			</div>

			<!-- Template Selection -->
			<div class="pdf-export-dialog__template-selection">
				<span class="pdf-export-dialog__template-label"
					>{localize('NIMBLE.pdfExport.template')}:</span
				>
				<button
					type="button"
					class="nimble-button pdf-export-dialog__template-btn"
					class:pdf-export-dialog__template-btn--active={state.selectedTemplate === 'lined'}
					onclick={() => (state.selectedTemplate = 'lined')}
					>{localize('NIMBLE.pdfExport.templateLined')}</button
				>
				<button
					type="button"
					class="nimble-button pdf-export-dialog__template-btn"
					class:pdf-export-dialog__template-btn--active={state.selectedTemplate === 'noLines'}
					onclick={() => (state.selectedTemplate = 'noLines')}
					>{localize('NIMBLE.pdfExport.templateNoLines')}</button
				>
			</div>

			<!-- Column Tabs -->
			<nav class="pdf-export-dialog__tabs">
				{#each [1, 2, 3] as num}
					{@const isOverLimit =
						(num === 1 && column1OverLimit) ||
						(num === 2 && column2OverLimit) ||
						(num === 3 && column3OverLimit)}
					<button
						type="button"
						class="pdf-export-dialog__tab"
						class:pdf-export-dialog__tab--active={state.activeColumnTab === num}
						class:pdf-export-dialog__tab--over-limit={isOverLimit}
						data-tooltip={columnTooltips[num - 1]}
						data-tooltip-direction="UP"
						onclick={() => (state.activeColumnTab = num)}
					>
						{localize('NIMBLE.pdfExport.column', { number: num })}
						{#if num === 1}
							<span class="pdf-export-dialog__tab-count">({column1Count})</span>
						{:else if num === 2}
							<span class="pdf-export-dialog__tab-count">({column2Count})</span>
						{:else}
							<span class="pdf-export-dialog__tab-count">({column3Count})</span>
						{/if}
					</button>
				{/each}
			</nav>

			<!-- Formatting Toolbar -->
			<div class="pdf-export-dialog__toolbar">
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn"
					title={localize('NIMBLE.pdfExport.bold')}
					onclick={() => applyFormat('bold')}
				>
					<i class="fa-solid fa-bold"></i>
				</button>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn"
					title={localize('NIMBLE.pdfExport.italic')}
					onclick={() => applyFormat('italic')}
				>
					<i class="fa-solid fa-italic"></i>
				</button>
				<div class="pdf-export-dialog__toolbar-divider"></div>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn pdf-export-dialog__toolbar-btn--heading"
					title={localize('NIMBLE.pdfExport.heading1')}
					onclick={() => applyFormat('formatBlock', 'h1')}>H1</button
				>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn pdf-export-dialog__toolbar-btn--heading"
					title={localize('NIMBLE.pdfExport.heading2')}
					onclick={() => applyFormat('formatBlock', 'h2')}>H2</button
				>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn pdf-export-dialog__toolbar-btn--heading"
					title={localize('NIMBLE.pdfExport.heading3')}
					onclick={() => applyFormat('formatBlock', 'h3')}>H3</button
				>
				<div class="pdf-export-dialog__toolbar-divider"></div>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn"
					title={localize('NIMBLE.pdfExport.bulletList')}
					onclick={() => applyFormat('insertUnorderedList')}
				>
					<i class="fa-solid fa-list-ul"></i>
				</button>
				<button
					type="button"
					class="pdf-export-dialog__toolbar-btn"
					title={localize('NIMBLE.pdfExport.numberedList')}
					onclick={() => applyFormat('insertOrderedList')}
				>
					<i class="fa-solid fa-list-ol"></i>
				</button>
			</div>

			<!-- Rich Text Editor -->
			<div
				bind:this={state.editorElement}
				class="pdf-export-dialog__rich-editor"
				class:pdf-export-dialog__rich-editor--over-limit={activeColumnOverLimit}
				contenteditable="true"
				role="textbox"
				tabindex="0"
				aria-multiline="true"
				aria-label={localize('NIMBLE.pdfExport.columnEditor')}
				oninput={handleEditorInput}
				onkeydown={handleEditorKeydown}
				oncut={handleEditorCutPaste}
				onpaste={handleEditorCutPaste}
			></div>

			<!-- Character Count -->
			<div
				class="pdf-export-dialog__char-count"
				class:pdf-export-dialog__char-count--over-limit={activeColumnOverLimit}
			>
				{activeColumnCount}/{CHARS_PER_COLUMN}
			</div>
		</section>
	</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		type="button"
		class="nimble-button"
		data-button-variant="basic"
		onclick={openPreviewDialog}
	>
		<i class="fa-solid fa-eye"></i>
		{localize('NIMBLE.pdfExport.previewPdf')}
	</button>
	<button class="nimble-button" data-button-variant="basic" onclick={generatePdf}>
		<i class="fa-solid fa-file-pdf"></i>
		{localize('NIMBLE.pdfExport.generatePdf')}
	</button>
</footer>

<style lang="scss">
	.pdf-export-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		height: 100%;
		min-height: 0;
		overflow: hidden;

		&__layout {
			display: flex;
			gap: 1rem;
			flex: 1;
			min-height: 0;
			overflow: hidden;
		}

		&__section-title {
			margin: 0.3125rem 0 0.125rem 0;
			padding: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
			border: none;
		}

		&__picker {
			width: 200px;
			flex-shrink: 0;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			min-height: 0;
			overflow: hidden;

			.pdf-export-dialog__section-title {
				padding-left: 1.6875rem;
			}
		}

		&__search-wrapper {
			position: relative;
			flex-shrink: 0;
		}

		&__search-icon {
			position: absolute;
			left: 0.5rem;
			top: 50%;
			transform: translateY(-50%);
			font-size: 0.625rem;
			color: var(--nimble-medium-text-color);
			pointer-events: none;
		}

		&__search {
			width: 100%;
			padding: 0.3rem 0.5rem 0.3rem 1.625rem;
			font-size: var(--nimble-sm-text);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);
			box-sizing: border-box;

			&::placeholder {
				color: var(--nimble-medium-text-color);
			}

			&:focus {
				outline: none;
				border-color: var(--nimble-accent-color, hsl(210, 70%, 50%));
			}

			// Hide the browser's native clear (×) button — we clear on empty query naturally
			&::-webkit-search-cancel-button {
				-webkit-appearance: none;
			}
		}

		&__categories {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			flex: 1;
			overflow-y: auto;
		}

		&__category {
			display: flex;
			flex-direction: column;
		}

		&__category-header {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__category-toggle {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0.5rem;
			background: transparent;
			border: none;
			cursor: pointer;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			text-align: left;

			&:hover {
				background: var(--nimble-box-background-hover-color, var(--nimble-box-background-color));
			}

			i {
				width: 12px;
				font-size: 0.625rem;
				color: var(--nimble-medium-text-color);
			}
		}

		&__category-count {
			margin-left: auto;
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__item--single {
			padding: 0.25rem 0.5rem;
			border-radius: 4px;

			.pdf-export-dialog__item-category {
				font-weight: 600;
				color: var(--nimble-medium-text-color);
				margin-right: 0.25rem;
			}
		}

		&__item--select-all {
			border-bottom: 1px solid var(--nimble-card-border-color);
			margin-bottom: 0.125rem;
			padding-bottom: 0.25rem;
		}

		&__item-label--select-all {
			font-weight: 600;
			font-style: italic;
		}

		&__category-items {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			padding: 0.25rem 0 0.25rem 0.5rem;
		}

		&__item {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			cursor: pointer;
			font-size: var(--nimble-sm-text);

			input[type='checkbox'] {
				flex-shrink: 0;
			}
		}

		&__item-label {
			word-break: break-word;
			color: var(--nimble-dark-text-color);
		}

		&__insert-btn {
			flex-shrink: 0;
		}

		&__editor {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
			gap: 0.5rem;
		}

		&__editor-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		&__reset-btn {
			display: flex;
			align-items: center;
			gap: 0.3rem;
			padding: 0.2rem 0.5rem;
			font-size: var(--nimble-xs-text, 0.625rem);
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			color: var(--nimble-medium-text-color);
			cursor: pointer;

			&:hover {
				background: var(--nimble-box-background-hover-color, rgba(0, 0, 0, 0.05));
				color: var(--nimble-dark-text-color);
			}

			i {
				font-size: 0.6rem;
			}
		}

		&__template-selection {
			display: flex;
			align-items: center;
			gap: 1rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__template-label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__template-btn {
			padding: 0.25rem 0.75rem;
			font-size: var(--nimble-sm-text);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-box-background-color);
			color: var(--nimble-medium-text-color);
			cursor: pointer;

			&--active {
				background: var(--nimble-accent-color, hsl(210, 70%, 50%));
				border-color: var(--nimble-accent-color, hsl(210, 70%, 50%));
				color: white;
			}
		}

		&__tabs {
			display: flex;
			gap: 0.25rem;
		}

		&__tab {
			flex: 1;
			padding: 0.5rem 1rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px 4px 0 0;
			border-bottom: none;
			cursor: pointer;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			transition:
				background 0.15s ease,
				color 0.15s ease;

			&:hover {
				background: var(--nimble-box-background-hover-color, var(--nimble-box-background-color));
			}

			&--active {
				background: var(--nimble-accent-color, hsl(210, 70%, 50%));
				color: white;
				border-color: var(--nimble-accent-color, hsl(210, 70%, 50%));
			}

			&--over-limit {
				border-color: hsl(0, 65%, 50%);

				&.pdf-export-dialog__tab--active {
					background: hsl(0, 65%, 50%);
				}
			}
		}

		&__tab-count {
			font-weight: 400;
			opacity: 0.8;
		}

		&__toolbar {
			display: flex;
			gap: 0.25rem;
			padding: 0.25rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__toolbar-divider {
			width: 1px;
			background: var(--nimble-card-border-color);
			margin: 0.125rem 0.125rem;
			align-self: stretch;
		}

		&__toolbar-btn {
			padding: 0.375rem 0.5rem;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-dark-text-color);
			line-height: 1;

			&:hover {
				background: var(--nimble-box-background-hover-color, rgba(0, 0, 0, 0.05));
			}

			&:active {
				background: var(--nimble-accent-color, hsl(210, 70%, 50%));
				color: white;
			}

			&--heading {
				font-size: var(--nimble-xs-text, 0.625rem);
				font-weight: 700;
				padding: 0.375rem 0.375rem;
				min-width: 1.75rem;
			}
		}

		&__rich-editor {
			flex: 1;
			min-height: 0;
			padding: 0.5rem;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			font-size: var(--nimble-sm-text);
			line-height: 1.5;
			background: var(--nimble-box-background-color);
			color: var(--nimble-dark-text-color);
			overflow-y: auto;

			&:focus {
				outline: none;
				border-color: var(--nimble-accent-color, hsl(210, 70%, 50%));
			}

			&--over-limit {
				border-color: hsl(0, 65%, 50%);
				background: hsla(0, 65%, 50%, 0.05);
			}

			// Bold and italic
			:global(b),
			:global(strong) {
				font-weight: 700;
			}

			:global(i),
			:global(em) {
				font-style: italic;
			}

			// Headings
			:global(h1),
			:global(h2),
			:global(h3) {
				font-weight: 700;
				line-height: 1.2;
				margin: 0.4em 0 0.15em;
			}

			:global(h1) {
				font-size: 1.2em;
			}
			:global(h2) {
				font-size: 1.1em;
			}
			:global(h3) {
				font-size: 1em;
			}

			:global(h4),
			:global(h5),
			:global(h6) {
				font-weight: 700;
				font-size: 0.95em;
				margin: 0.3em 0 0.1em;
			}

			// Lists
			:global(ul),
			:global(ol) {
				padding-left: 1.25rem;
				margin: 0.25em 0;
			}

			:global(li) {
				margin: 0.1em 0;
			}
		}

		&__char-count {
			text-align: right;
			font-size: var(--nimble-xs-text, 0.625rem);
			color: var(--nimble-medium-text-color);

			&--over-limit {
				color: hsl(0, 65%, 50%);
				font-weight: 600;
			}
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		display: flex;
		gap: 0.5rem;

		.nimble-button {
			flex: 1;
		}
	}

	// Dark mode overrides
	:global(.theme-dark) {
		.pdf-export-dialog {
			&__rich-editor--over-limit {
				background: hsla(0, 65%, 50%, 0.1);
			}

			&__char-count--over-limit {
				color: hsl(0, 60%, 65%);
			}
		}
	}
</style>

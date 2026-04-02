<script lang="ts">
	import type { PdfExportDialogProps } from '#types/components/PdfExportDialog.js';

	import localize from '#utils/localize.ts';

	import type { TemplateType } from '../sheets/character/pdfExport/exportCharacterPdf.ts';
	import {
		CHARS_PER_COLUMN,
		generateInitialColumnContentHtml,
		getSelectableItems,
		type SelectableItem,
	} from '../sheets/character/pdfExport/generatePdfContent.ts';
	import { getPlainTextFromHtml } from '../sheets/character/pdfExport/parseHtmlToStyledSegments.ts';

	let { actor, dialog }: PdfExportDialogProps = $props();

	// Initialize columns with generated HTML content
	const initialContent = generateInitialColumnContentHtml(actor);
	let column1Html = $state(initialContent[0]);
	let column2Html = $state(initialContent[1]);
	let column3Html = $state(initialContent[2]);

	// Template selection (lined or no lines)
	let selectedTemplate = $state<TemplateType>('lined');

	// Active column tab (1, 2, or 3)
	let activeColumnTab = $state(1);

	// Selected items for insertion
	let selectedItems = $state(new Set<string>());

	// Get selectable items grouped by category
	let selectableItems = $derived(getSelectableItems(actor));

	// Group items by category
	let itemsByCategory = $derived.by(() => {
		const groups: Record<string, SelectableItem[]> = {};
		for (const item of selectableItems) {
			if (!groups[item.category]) {
				groups[item.category] = [];
			}
			groups[item.category].push(item);
		}
		return groups;
	});

	// Category collapse state
	let collapsedCategories = $state(new Set<string>());

	// Character counts (derived from plain text)
	let column1Count = $derived(getPlainTextFromHtml(column1Html).length);
	let column2Count = $derived(getPlainTextFromHtml(column2Html).length);
	let column3Count = $derived(getPlainTextFromHtml(column3Html).length);

	// Over limit checks
	let column1OverLimit = $derived(column1Count > CHARS_PER_COLUMN);
	let column2OverLimit = $derived(column2Count > CHARS_PER_COLUMN);
	let column3OverLimit = $derived(column3Count > CHARS_PER_COLUMN);

	// Get current column data based on active tab
	let activeColumnHtml = $derived.by(() => {
		if (activeColumnTab === 1) return column1Html;
		if (activeColumnTab === 2) return column2Html;
		return column3Html;
	});

	let activeColumnCount = $derived.by(() => {
		if (activeColumnTab === 1) return column1Count;
		if (activeColumnTab === 2) return column2Count;
		return column3Count;
	});

	let activeColumnOverLimit = $derived.by(() => {
		if (activeColumnTab === 1) return column1OverLimit;
		if (activeColumnTab === 2) return column2OverLimit;
		return column3OverLimit;
	});

	// Reference to the contenteditable element
	let editorElement: HTMLDivElement | null = $state(null);

	// Track if we need to update the editor content
	let lastActiveTab = $state(activeColumnTab);

	// Update editor when tab changes
	$effect(() => {
		if (activeColumnTab !== lastActiveTab) {
			lastActiveTab = activeColumnTab;
			if (editorElement) {
				editorElement.innerHTML = activeColumnHtml;
			}
		}
	});

	function toggleCategory(category: string) {
		if (collapsedCategories.has(category)) {
			collapsedCategories.delete(category);
		} else {
			collapsedCategories.add(category);
		}
		collapsedCategories = new Set(collapsedCategories);
	}

	function toggleItem(itemId: string) {
		if (selectedItems.has(itemId)) {
			selectedItems.delete(itemId);
		} else {
			selectedItems.add(itemId);
		}
		selectedItems = new Set(selectedItems);
	}

	function insertSelected() {
		if (selectedItems.size === 0) return;

		const contentToInsert: string[] = [];
		for (const item of selectableItems) {
			if (selectedItems.has(item.id)) {
				contentToInsert.push(item.contentHtml);
			}
		}

		const insertHtml = contentToInsert.join('<br>');

		// Insert at cursor position or append
		if (editorElement) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0 && editorElement.contains(selection.anchorNode)) {
				// Insert at cursor
				document.execCommand('insertHTML', false, insertHtml);
			} else {
				// Append to end
				const currentHtml = editorElement.innerHTML;
				editorElement.innerHTML = currentHtml ? `${currentHtml}<br>${insertHtml}` : insertHtml;
			}
			handleEditorInput();
		}

		selectedItems = new Set();
	}

	function handleEditorInput() {
		if (!editorElement) return;
		const html = editorElement.innerHTML;

		if (activeColumnTab === 1) {
			column1Html = html;
		} else if (activeColumnTab === 2) {
			column2Html = html;
		} else {
			column3Html = html;
		}
	}

	function applyFormat(command: string) {
		document.execCommand(command, false);
		editorElement?.focus();
		handleEditorInput();
	}

	function getCategoryLabel(category: string): string {
		const labels: Record<string, string> = {
			ancestry: localize('NIMBLE.pdfExport.categories.ancestry'),
			background: localize('NIMBLE.pdfExport.categories.background'),
			features: localize('NIMBLE.pdfExport.categories.features'),
			spells: localize('NIMBLE.pdfExport.categories.spells'),
			inventory: localize('NIMBLE.pdfExport.categories.inventory'),
		};
		return labels[category] ?? category;
	}

	async function generatePdf() {
		dialog.submit({
			columnContent: [column1Html, column2Html, column3Html] as [string, string, string],
			template: selectedTemplate,
		});
	}

	async function previewPdf() {
		// Import the preview dialog dynamically to avoid circular dependencies
		const { showPdfPreview } = await import('../sheets/character/pdfExport/showPdfPreview.ts');
		await showPdfPreview(actor, [column1Html, column2Html, column3Html], selectedTemplate);
	}
</script>

<article class="nimble-sheet__body pdf-export-dialog">
	<div class="pdf-export-dialog__layout">
		<!-- Content Picker Section -->
		<section class="pdf-export-dialog__picker">
			<h3 class="pdf-export-dialog__section-title">
				{localize('NIMBLE.pdfExport.contentPicker')}
			</h3>

			<div class="pdf-export-dialog__categories">
				{#each Object.entries(itemsByCategory) as [category, items]}
					<div class="pdf-export-dialog__category">
						<button
							type="button"
							class="pdf-export-dialog__category-header"
							onclick={() => toggleCategory(category)}
						>
							<i
								class="fa-solid"
								class:fa-chevron-down={!collapsedCategories.has(category)}
								class:fa-chevron-right={collapsedCategories.has(category)}
							></i>
							<span>{getCategoryLabel(category)}</span>
							<span class="pdf-export-dialog__category-count">({items.length})</span>
						</button>

						{#if !collapsedCategories.has(category)}
							<div class="pdf-export-dialog__category-items">
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
					</div>
				{/each}
			</div>

			<button
				type="button"
				class="nimble-button pdf-export-dialog__insert-btn"
				data-button-variant="basic"
				disabled={selectedItems.size === 0}
				onclick={insertSelected}
			>
				<i class="fa-solid fa-plus"></i>
				{localize('NIMBLE.pdfExport.insertToColumn', { column: activeColumnTab })}
			</button>
		</section>

		<!-- Column Editor Section -->
		<section class="pdf-export-dialog__editor">
			<h3 class="pdf-export-dialog__section-title">
				{localize('NIMBLE.pdfExport.columnEditor')}
			</h3>

			<!-- Template Selection -->
			<div class="pdf-export-dialog__template-selection">
				<span class="pdf-export-dialog__template-label"
					>{localize('NIMBLE.pdfExport.template')}:</span
				>
				<label class="pdf-export-dialog__template-option">
					<input
						type="radio"
						name="template"
						value="lined"
						checked={selectedTemplate === 'lined'}
						onchange={() => (selectedTemplate = 'lined')}
					/>
					<span>{localize('NIMBLE.pdfExport.templateLined')}</span>
				</label>
				<label class="pdf-export-dialog__template-option">
					<input
						type="radio"
						name="template"
						value="noLines"
						checked={selectedTemplate === 'noLines'}
						onchange={() => (selectedTemplate = 'noLines')}
					/>
					<span>{localize('NIMBLE.pdfExport.templateNoLines')}</span>
				</label>
			</div>

			<!-- Column Tabs -->
			<nav class="pdf-export-dialog__tabs">
				{#each [1, 2, 3] as num}
					<button
						type="button"
						class="pdf-export-dialog__tab"
						class:pdf-export-dialog__tab--active={activeColumnTab === num}
						class:pdf-export-dialog__tab--over-limit={(num === 1 && column1OverLimit) ||
							(num === 2 && column2OverLimit) ||
							(num === 3 && column3OverLimit)}
						onclick={() => (activeColumnTab = num)}
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
			</div>

			<!-- Rich Text Editor -->
			<div
				bind:this={editorElement}
				class="pdf-export-dialog__rich-editor"
				class:pdf-export-dialog__rich-editor--over-limit={activeColumnOverLimit}
				contenteditable="true"
				oninput={handleEditorInput}
			>
				{@html activeColumnHtml}
			</div>

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
	<button type="button" class="nimble-button" data-button-variant="basic" onclick={previewPdf}>
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
		min-height: 500px;
		height: 100%;

		&__layout {
			display: flex;
			gap: 1rem;
			flex: 1;
		}

		&__section-title {
			margin: 0 0 0.75rem 0;
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
			gap: 0.5rem;
			padding: 0.375rem 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
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

		&__category-items {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			padding: 0.25rem 0 0.25rem 1.25rem;
		}

		&__item {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			cursor: pointer;
			font-size: var(--nimble-sm-text);

			input[type='checkbox'] {
				margin-top: 0.125rem;
				flex-shrink: 0;
			}
		}

		&__item-label {
			word-break: break-word;
			color: var(--nimble-dark-text-color);
		}

		&__insert-btn {
			margin-top: auto;
		}

		&__editor {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-width: 0;
			gap: 0.5rem;
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

		&__template-option {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			cursor: pointer;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);

			input[type='radio'] {
				margin: 0;
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

		&__toolbar-btn {
			padding: 0.375rem 0.5rem;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-dark-text-color);

			&:hover {
				background: var(--nimble-box-background-hover-color, rgba(0, 0, 0, 0.05));
			}

			&:active {
				background: var(--nimble-accent-color, hsl(210, 70%, 50%));
				color: white;
			}
		}

		&__rich-editor {
			flex: 1;
			min-height: 300px;
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

			// Style bold and italic text
			:global(b),
			:global(strong) {
				font-weight: 700;
			}

			:global(i),
			:global(em) {
				font-style: italic;
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

import type { NimbleCharacter } from '#documents/actor/character.js';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.ts';
import type { PreviewState } from '#types/components/PdfPreviewDialog.js';
import localize from '#utils/localize.ts';
import type { TemplateType } from '../sheets/character/pdfExport/exportCharacterPdf.ts';
import {
	CHARS_PER_COLUMN,
	generateInitialColumnContentHtml,
	getSelectableItems,
	type SelectableItem,
} from '../sheets/character/pdfExport/generatePdfContent.ts';
import { getPlainTextFromHtml } from '../sheets/character/pdfExport/parseHtmlToStyledSegments.ts';

export function createPdfExportDialogState(
	getActor: () => NimbleCharacter,
	getDialog: () => GenericDialog,
	previewDialogComponent: unknown,
) {
	const initialContent = generateInitialColumnContentHtml(getActor());

	let column1Html = $state(initialContent[0]);
	let column2Html = $state(initialContent[1]);
	let column3Html = $state(initialContent[2]);
	let selectedTemplate = $state<TemplateType>('lined');
	const previewState = $state<PreviewState>({
		columnContent: [initialContent[0], initialContent[1], initialContent[2]],
		template: 'lined',
	});
	let columnSyncTimer: number | null = null;
	let activeColumnTab = $state(1);
	let selectedItems = $state(new Set<string>());
	let searchQuery = $state('');
	let expandedCategories = $state(new Set<string>());
	let editorElement = $state<HTMLDivElement | null>(null);
	let lastActiveTab = $state(1);
	let activePreviewDialog: GenericDialog | null = null;

	$effect(() => {
		previewState.template = selectedTemplate;
	});

	$effect(() => {
		const c1 = column1Html;
		const c2 = column2Html;
		const c3 = column3Html;
		if (columnSyncTimer !== null) window.clearTimeout(columnSyncTimer);
		columnSyncTimer = window.setTimeout(() => {
			previewState.columnContent = [c1, c2, c3];
			columnSyncTimer = null;
		}, 800);
		return () => {
			if (columnSyncTimer !== null) {
				window.clearTimeout(columnSyncTimer);
				columnSyncTimer = null;
			}
		};
	});

	$effect(() => {
		if (!editorElement) return;
		if (activeColumnTab !== lastActiveTab || editorElement.innerHTML === '') {
			lastActiveTab = activeColumnTab;
			let content = column1Html;
			if (activeColumnTab === 2) content = column2Html;
			if (activeColumnTab === 3) content = column3Html;
			editorElement.innerHTML = content;
		}
	});

	const selectableItems = $derived(getSelectableItems(getActor()));
	const searchActive = $derived(!!searchQuery.trim());

	const itemsByCategory = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const groups: Record<string, SelectableItem[]> = {};
		for (const item of selectableItems) {
			if (query) {
				const categoryLabel = getCategoryLabel(item.category).toLowerCase();
				if (!categoryLabel.includes(query) && !item.label.toLowerCase().includes(query)) continue;
			}
			if (!groups[item.category]) groups[item.category] = [];
			groups[item.category].push(item);
		}
		return groups;
	});

	const column1Count = $derived(getPlainTextFromHtml(column1Html).length);
	const column2Count = $derived(getPlainTextFromHtml(column2Html).length);
	const column3Count = $derived(getPlainTextFromHtml(column3Html).length);
	const column1OverLimit = $derived(column1Count > CHARS_PER_COLUMN);
	const column2OverLimit = $derived(column2Count > CHARS_PER_COLUMN);
	const column3OverLimit = $derived(column3Count > CHARS_PER_COLUMN);

	const columnTooltips = $derived.by(() => {
		const tooltip = localize('NIMBLE.pdfExport.columnOverflow');
		return [
			column1OverLimit ? tooltip : undefined,
			column2OverLimit ? tooltip : undefined,
			column3OverLimit ? tooltip : undefined,
		];
	});

	const activeColumnCount = $derived.by(() => {
		if (activeColumnTab === 1) return column1Count;
		if (activeColumnTab === 2) return column2Count;
		return column3Count;
	});

	const activeColumnOverLimit = $derived.by(() => {
		if (activeColumnTab === 1) return column1OverLimit;
		if (activeColumnTab === 2) return column2OverLimit;
		return column3OverLimit;
	});

	function getCategoryLabel(category: string): string {
		const labels: Record<string, string> = {
			ancestry: localize('NIMBLE.pdfExport.categories.ancestry'),
			background: localize('NIMBLE.pdfExport.categories.background'),
			features: localize('NIMBLE.pdfExport.categories.features'),
			subclassFeatures: localize('NIMBLE.pdfExport.categories.subclassFeatures'),
			spells: localize('NIMBLE.pdfExport.categories.spells'),
			inventory: localize('NIMBLE.pdfExport.categories.inventory'),
			character: localize('NIMBLE.pdfExport.categories.character'),
		};
		return labels[category] ?? category;
	}

	function toggleCategory(category: string) {
		if (expandedCategories.has(category)) {
			expandedCategories.delete(category);
		} else {
			expandedCategories.add(category);
		}
		expandedCategories = new Set(expandedCategories);
	}

	function areCategoryItemsAllSelected(category: string): boolean {
		const items = itemsByCategory[category];
		if (!items || items.length === 0) return false;
		return items.every((item) => selectedItems.has(item.id));
	}

	function toggleSelectAllInCategory(category: string) {
		const items = itemsByCategory[category];
		if (!items) return;
		const allSelected = areCategoryItemsAllSelected(category);
		if (allSelected) {
			for (const item of items) selectedItems.delete(item.id);
		} else {
			for (const item of items) selectedItems.add(item.id);
		}
		selectedItems = new Set(selectedItems);
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

		if (editorElement) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0 && editorElement.contains(selection.anchorNode)) {
				document.execCommand('insertHTML', false, insertHtml);
			} else {
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

	function handleEditorKeydown(event: KeyboardEvent) {
		event.stopPropagation();
	}

	function handleEditorCutPaste() {
		setTimeout(() => {
			handleEditorInput();
		}, 0);
	}

	function applyFormat(command: string, value?: string) {
		document.execCommand(command, false, value);
		editorElement?.focus();
		handleEditorInput();
	}

	function resetToDefault() {
		const freshContent = generateInitialColumnContentHtml(getActor());
		column1Html = freshContent[0];
		column2Html = freshContent[1];
		column3Html = freshContent[2];
		// The $effect only refreshes the editor on tab changes, so update the active column directly
		if (editorElement) {
			let activeContent = freshContent[0];
			if (activeColumnTab === 2) activeContent = freshContent[1];
			if (activeColumnTab === 3) activeContent = freshContent[2];
			editorElement.innerHTML = activeContent;
		}
	}

	async function generatePdf() {
		getDialog().submit({
			columnContent: [column1Html, column2Html, column3Html] as [string, string, string],
			template: selectedTemplate,
		});
	}

	function openPreviewDialog() {
		if (columnSyncTimer !== null) {
			window.clearTimeout(columnSyncTimer);
			columnSyncTimer = null;
		}
		previewState.template = selectedTemplate;
		previewState.columnContent = [column1Html, column2Html, column3Html];

		if (activePreviewDialog?.rendered) {
			activePreviewDialog.bringToFront();
			return;
		}

		activePreviewDialog = new GenericDialog(
			localize('NIMBLE.pdfExport.previewTitle'),
			previewDialogComponent as ConstructorParameters<typeof GenericDialog>[1],
			{ actor: getActor(), previewState },
			{ icon: 'fa-solid fa-eye', width: 700, height: 900 },
		);
		activePreviewDialog.render(true);
	}

	return {
		get column1Html() {
			return column1Html;
		},
		get column2Html() {
			return column2Html;
		},
		get column3Html() {
			return column3Html;
		},
		get selectedTemplate() {
			return selectedTemplate;
		},
		set selectedTemplate(v: TemplateType) {
			selectedTemplate = v;
		},
		get activeColumnTab() {
			return activeColumnTab;
		},
		set activeColumnTab(v: number) {
			activeColumnTab = v;
		},
		get selectedItems() {
			return selectedItems;
		},
		get searchQuery() {
			return searchQuery;
		},
		set searchQuery(v: string) {
			searchQuery = v;
		},
		get searchActive() {
			return searchActive;
		},
		get itemsByCategory() {
			return itemsByCategory;
		},
		get expandedCategories() {
			return expandedCategories;
		},
		get column1Count() {
			return column1Count;
		},
		get column2Count() {
			return column2Count;
		},
		get column3Count() {
			return column3Count;
		},
		get column1OverLimit() {
			return column1OverLimit;
		},
		get column2OverLimit() {
			return column2OverLimit;
		},
		get column3OverLimit() {
			return column3OverLimit;
		},
		get columnTooltips() {
			return columnTooltips;
		},
		get activeColumnCount() {
			return activeColumnCount;
		},
		get activeColumnOverLimit() {
			return activeColumnOverLimit;
		},
		get editorElement() {
			return editorElement;
		},
		set editorElement(v: HTMLDivElement | null) {
			editorElement = v;
		},
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
	};
}

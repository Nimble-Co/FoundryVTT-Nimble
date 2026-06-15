import type { NimbleCharacter } from '#documents/actor/character.js';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.ts';
import type { PreviewState } from '#types/components/PdfPreviewDialog.js';
import localize from '#utils/localize.ts';
import {
	generateInitialColumnContentHtml,
	getSelectableItems,
	type SelectableItem,
} from '../sheets/character/pdfExport/generatePdfContent.ts';
import { getPlainTextFromHtml } from '../sheets/character/pdfExport/parseHtmlToStyledSegments.ts';
import type { TemplateType } from '../sheets/character/pdfExport/pdfExport.types.ts';

export function createPdfExportDialogState(
	getActor: () => NimbleCharacter,
	previewDialogComponent: unknown,
) {
	const initialContent = generateInitialColumnContentHtml(getActor());

	const DEFAULT_LINE_HEIGHT = 22;

	let column1Html = $state(initialContent[0]);
	let column2Html = $state(initialContent[1]);
	let column3Html = $state(initialContent[2]);
	let column1LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let column2LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let column3LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let selectedTemplate = $state<TemplateType>('lined');
	const previewState = $state<PreviewState>({
		columnContent: [initialContent[0], initialContent[1], initialContent[2]],
		template: 'lined',
		lineHeights: [DEFAULT_LINE_HEIGHT, DEFAULT_LINE_HEIGHT, DEFAULT_LINE_HEIGHT],
		overLimit: [false, false, false],
		activeSheet: 'main' as 'main' | 'additional',
		additionalColumnContent: ['', '', ''],
		additionalLineHeights: [DEFAULT_LINE_HEIGHT, DEFAULT_LINE_HEIGHT, DEFAULT_LINE_HEIGHT],
		additionalOverLimit: [false, false, false],
	});
	let activeColumnTab = $state(1);
	let activeSheetTab = $state<'main' | 'additional'>('main');
	let activeAdditionalColumnTab = $state(1);
	let lastActiveAdditionalTab = $state(1);
	let lastActiveSheetTab = $state<'main' | 'additional'>('main');
	let additionalCol1Html = $state('');
	let additionalCol2Html = $state('');
	let additionalCol3Html = $state('');
	let additionalCol1LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let additionalCol2LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let additionalCol3LineHeight = $state(DEFAULT_LINE_HEIGHT);
	let selectedItems = $state(new Set<string>());
	let searchQuery = $state('');
	let expandedCategories = $state(new Set<string>());
	let editorElement = $state<HTMLDivElement | null>(null);
	let lastActiveTab = $state(1);
	let isExporting = $state(false);
	let activePreviewDialog: GenericDialog | null = null;

	$effect(() => {
		previewState.template = selectedTemplate;
	});

	$effect(() => {
		previewState.columnContent = [column1Html, column2Html, column3Html];
		previewState.lineHeights = [column1LineHeight, column2LineHeight, column3LineHeight];
		previewState.overLimit = [column1OverLimit, column2OverLimit, column3OverLimit];
		previewState.activeSheet = activeSheetTab;
		previewState.additionalColumnContent = [
			additionalCol1Html,
			additionalCol2Html,
			additionalCol3Html,
		];
		previewState.additionalLineHeights = [
			additionalCol1LineHeight,
			additionalCol2LineHeight,
			additionalCol3LineHeight,
		];
		previewState.additionalOverLimit = [
			additionalCol1OverLimit,
			additionalCol2OverLimit,
			additionalCol3OverLimit,
		];
	});

	$effect(() => {
		if (!editorElement) return;
		const curMainTab = activeColumnTab;
		const curAdditTab = activeAdditionalColumnTab;
		const curSheet = activeSheetTab;
		const needsUpdate =
			curSheet !== lastActiveSheetTab ||
			curMainTab !== lastActiveTab ||
			curAdditTab !== lastActiveAdditionalTab ||
			editorElement.innerHTML === '';
		if (needsUpdate) {
			lastActiveSheetTab = curSheet;
			lastActiveTab = curMainTab;
			lastActiveAdditionalTab = curAdditTab;
			if (curSheet === 'main') {
				editorElement.innerHTML =
					curMainTab === 1 ? column1Html : curMainTab === 2 ? column2Html : column3Html;
			} else {
				editorElement.innerHTML =
					curAdditTab === 1
						? additionalCol1Html
						: curAdditTab === 2
							? additionalCol2Html
							: additionalCol3Html;
			}
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

	function columnCapacityAt(lh: number): number {
		// Calibrated from observed rendering: lh=10→3237 chars, lh=13→2446 chars
		// Derived via linear fit: A=34277, B=-191 where capacity = round(A/lh + B)
		return Math.round(34277 / lh - 191);
	}

	function additionalColumnCapacityAt(lh: number): number {
		// Additional sheet columns are ~705 pts tall vs 534 pts for main sheet
		return Math.round((34277 / lh - 191) * (705 / 534));
	}

	function activeSheetCapacityAt(lh: number): number {
		return activeSheetTab === 'additional'
			? additionalColumnCapacityAt(lh)
			: Math.round(34277 / lh - 191);
	}

	const column1Count = $derived(getPlainTextFromHtml(column1Html).length);
	const column2Count = $derived(getPlainTextFromHtml(column2Html).length);
	const column3Count = $derived(getPlainTextFromHtml(column3Html).length);
	const column1Capacity = $derived(columnCapacityAt(column1LineHeight));
	const column2Capacity = $derived(columnCapacityAt(column2LineHeight));
	const column3Capacity = $derived(columnCapacityAt(column3LineHeight));
	const column1OverLimit = $derived(column1Count > column1Capacity);
	const column2OverLimit = $derived(column2Count > column2Capacity);
	const column3OverLimit = $derived(column3Count > column3Capacity);

	const additionalCol1Count = $derived(getPlainTextFromHtml(additionalCol1Html).length);
	const additionalCol2Count = $derived(getPlainTextFromHtml(additionalCol2Html).length);
	const additionalCol3Count = $derived(getPlainTextFromHtml(additionalCol3Html).length);
	const additionalCol1Capacity = $derived(additionalColumnCapacityAt(additionalCol1LineHeight));
	const additionalCol2Capacity = $derived(additionalColumnCapacityAt(additionalCol2LineHeight));
	const additionalCol3Capacity = $derived(additionalColumnCapacityAt(additionalCol3LineHeight));
	const additionalCol1OverLimit = $derived(additionalCol1Count > additionalCol1Capacity);
	const additionalCol2OverLimit = $derived(additionalCol2Count > additionalCol2Capacity);
	const additionalCol3OverLimit = $derived(additionalCol3Count > additionalCol3Capacity);

	const columnTooltips = $derived.by(() => {
		const tooltip = localize('NIMBLE.pdfExport.columnOverflow');
		return [
			column1OverLimit ? tooltip : undefined,
			column2OverLimit ? tooltip : undefined,
			column3OverLimit ? tooltip : undefined,
		];
	});

	const additionalColumnTooltips = $derived.by(() => {
		const tooltip = localize('NIMBLE.pdfExport.columnOverflow');
		return [
			additionalCol1OverLimit ? tooltip : undefined,
			additionalCol2OverLimit ? tooltip : undefined,
			additionalCol3OverLimit ? tooltip : undefined,
		];
	});

	const activeColumnCount = $derived.by(() => {
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) return additionalCol1Count;
			if (activeAdditionalColumnTab === 2) return additionalCol2Count;
			return additionalCol3Count;
		}
		if (activeColumnTab === 1) return column1Count;
		if (activeColumnTab === 2) return column2Count;
		return column3Count;
	});

	const activeColumnCapacity = $derived.by(() => {
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) return additionalCol1Capacity;
			if (activeAdditionalColumnTab === 2) return additionalCol2Capacity;
			return additionalCol3Capacity;
		}
		if (activeColumnTab === 1) return column1Capacity;
		if (activeColumnTab === 2) return column2Capacity;
		return column3Capacity;
	});

	const activeColumnLineHeight = $derived.by(() => {
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) return additionalCol1LineHeight;
			if (activeAdditionalColumnTab === 2) return additionalCol2LineHeight;
			return additionalCol3LineHeight;
		}
		if (activeColumnTab === 1) return column1LineHeight;
		if (activeColumnTab === 2) return column2LineHeight;
		return column3LineHeight;
	});

	const activeColumnOverLimit = $derived.by(() => {
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) return additionalCol1OverLimit;
			if (activeAdditionalColumnTab === 2) return additionalCol2OverLimit;
			return additionalCol3OverLimit;
		}
		if (activeColumnTab === 1) return column1OverLimit;
		if (activeColumnTab === 2) return column2OverLimit;
		return column3OverLimit;
	});

	function setActiveColumnLineHeight(value: number) {
		const clamped = Math.max(10, Math.min(32, value));
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) additionalCol1LineHeight = clamped;
			else if (activeAdditionalColumnTab === 2) additionalCol2LineHeight = clamped;
			else additionalCol3LineHeight = clamped;
		} else {
			if (activeColumnTab === 1) column1LineHeight = clamped;
			else if (activeColumnTab === 2) column2LineHeight = clamped;
			else column3LineHeight = clamped;
		}
	}

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
		if (activeSheetTab === 'additional') {
			if (activeAdditionalColumnTab === 1) additionalCol1Html = html;
			else if (activeAdditionalColumnTab === 2) additionalCol2Html = html;
			else additionalCol3Html = html;
		} else {
			if (activeColumnTab === 1) column1Html = html;
			else if (activeColumnTab === 2) column2Html = html;
			else column3Html = html;
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
		column1LineHeight = DEFAULT_LINE_HEIGHT;
		column2LineHeight = DEFAULT_LINE_HEIGHT;
		column3LineHeight = DEFAULT_LINE_HEIGHT;
		additionalCol1Html = '';
		additionalCol2Html = '';
		additionalCol3Html = '';
		additionalCol1LineHeight = DEFAULT_LINE_HEIGHT;
		additionalCol2LineHeight = DEFAULT_LINE_HEIGHT;
		additionalCol3LineHeight = DEFAULT_LINE_HEIGHT;
		// The $effect only refreshes the editor on tab changes, so update the active column directly
		if (editorElement) {
			if (activeSheetTab === 'main') {
				let activeContent = freshContent[0];
				if (activeColumnTab === 2) activeContent = freshContent[1];
				if (activeColumnTab === 3) activeContent = freshContent[2];
				editorElement.innerHTML = activeContent;
			} else {
				editorElement.innerHTML = '';
			}
		}
	}

	async function generatePdf() {
		if (isExporting) return;
		isExporting = true;
		try {
			const { exportCharacterPdf } = await import(
				'../sheets/character/pdfExport/exportCharacterPdf.ts'
			);
			await exportCharacterPdf(getActor(), {
				columnContent: [column1Html, column2Html, column3Html] as [string, string, string],
				template: selectedTemplate,
				lineHeights: [column1LineHeight, column2LineHeight, column3LineHeight],
				additionalColumnContent: [additionalCol1Html, additionalCol2Html, additionalCol3Html],
				additionalLineHeights: [
					additionalCol1LineHeight,
					additionalCol2LineHeight,
					additionalCol3LineHeight,
				],
			});
			ui.notifications?.info(localize('NIMBLE.pdfExport.success'));
		} catch (error) {
			console.error('PDF export failed:', error);
			ui.notifications?.error(localize('NIMBLE.pdfExport.error'));
		} finally {
			isExporting = false;
		}
	}

	function openPreviewDialog() {
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
		get isExporting() {
			return isExporting;
		},
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
		get activeSheetTab() {
			return activeSheetTab;
		},
		set activeSheetTab(v: 'main' | 'additional') {
			activeSheetTab = v;
		},
		get activeAdditionalColumnTab() {
			return activeAdditionalColumnTab;
		},
		set activeAdditionalColumnTab(v: number) {
			activeAdditionalColumnTab = v;
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
		get additionalCol1Count() {
			return additionalCol1Count;
		},
		get additionalCol2Count() {
			return additionalCol2Count;
		},
		get additionalCol3Count() {
			return additionalCol3Count;
		},
		get additionalCol1OverLimit() {
			return additionalCol1OverLimit;
		},
		get additionalCol2OverLimit() {
			return additionalCol2OverLimit;
		},
		get additionalCol3OverLimit() {
			return additionalCol3OverLimit;
		},
		get additionalColumnTooltips() {
			return additionalColumnTooltips;
		},
		get activeColumnCount() {
			return activeColumnCount;
		},
		get activeColumnOverLimit() {
			return activeColumnOverLimit;
		},
		get activeColumnCapacity() {
			return activeColumnCapacity;
		},
		get activeColumnLineHeight() {
			return activeColumnLineHeight;
		},
		setActiveColumnLineHeight,
		activeSheetCapacityAt,
		additionalColumnCapacityAt,
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

import {
	CT_CARD_SCALE_STEP,
	CT_EDGE_GUTTER_PX,
	CT_ESTIMATED_ENTRY_WIDTH_REM,
	CT_FALLBACK_SIDE_RESERVED_PX,
	CT_MAX_CARD_SIZE_LEVEL,
	CT_MAX_WIDTH_LEVEL,
	CT_MIN_CARD_SCALE,
	CT_MIN_CARD_SIZE_LEVEL,
	CT_MIN_SAFE_TRACK_WIDTH_PX,
	CT_MIN_WIDTH_LEVEL,
	CT_MIN_WIDTH_RATIO,
	CT_VIRTUALIZATION_OVERSCAN,
	CT_WIDTH_RATIO_STEP,
	DRAG_SWITCH_LOWER_RATIO,
	DRAG_SWITCH_UPPER_RATIO,
	DRAG_TARGET_EXPANSION_REM,
} from './constants.js';
import type {
	BuildVirtualizedAliveEntriesParams,
	CombatantDropPreview,
	VirtualizedAliveEntries,
} from './types.js';

function getViewportWidthPx(): number {
	return Math.max(0, globalThis.innerWidth || document.documentElement.clientWidth || 0);
}

function getCtWidthRatio(widthLevel: number): number {
	const normalizedWidthLevel = normalizeCtWidthLevel(widthLevel);
	return CT_MIN_WIDTH_RATIO + (normalizedWidthLevel - CT_MIN_WIDTH_LEVEL) * CT_WIDTH_RATIO_STEP;
}

function getVisibleUiRect(selector: string): DOMRect | null {
	const element = document.querySelector<HTMLElement>(selector);
	if (!element) return null;
	const style = globalThis.getComputedStyle(element);
	if (style.display === 'none' || style.visibility === 'hidden') return null;
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return rect;
}

function getSafeCtTrackWidthPx(): number {
	const viewportWidth = getViewportWidthPx();
	if (viewportWidth <= 0) return CT_MIN_SAFE_TRACK_WIDTH_PX;

	const leftUiRect = getVisibleUiRect('#ui-left');
	const rightUiRect = getVisibleUiRect('#ui-right');
	const leftInset = leftUiRect
		? Math.max(0, leftUiRect.right + CT_EDGE_GUTTER_PX)
		: CT_FALLBACK_SIDE_RESERVED_PX;
	const rightInset = rightUiRect
		? Math.max(0, viewportWidth - rightUiRect.left + CT_EDGE_GUTTER_PX)
		: CT_FALLBACK_SIDE_RESERVED_PX;
	const safeWidth = viewportWidth - leftInset - rightInset;
	return Math.max(240, safeWidth);
}

export function normalizeCtWidthLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 10;
	const roundedValue = Math.round(numericValue);
	return Math.min(CT_MAX_WIDTH_LEVEL, Math.max(CT_MIN_WIDTH_LEVEL, roundedValue));
}

export function normalizeCtCardSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 5;
	const roundedValue = Math.round(numericValue);
	return Math.min(CT_MAX_CARD_SIZE_LEVEL, Math.max(CT_MIN_CARD_SIZE_LEVEL, roundedValue));
}

export function getCtCardScale(cardSizeLevel: number): number {
	const normalizedCardSizeLevel = normalizeCtCardSizeLevel(cardSizeLevel);
	return (
		CT_MIN_CARD_SCALE + (normalizedCardSizeLevel - CT_MIN_CARD_SIZE_LEVEL) * CT_CARD_SCALE_STEP
	);
}

export function resolveCtTrackMaxWidth(widthLevel: number): string {
	const widthRatio = getCtWidthRatio(widthLevel);
	const safeWidthPx = getSafeCtTrackWidthPx();
	const minimumWidthPx = Math.min(CT_MIN_SAFE_TRACK_WIDTH_PX, safeWidthPx);
	const resolvedWidthPx = Math.max(minimumWidthPx, Math.round(safeWidthPx * widthRatio));
	return `${resolvedWidthPx}px`;
}

export function trackDependency(_value: unknown): void {
	// Used to explicitly register rune dependencies in derived/effect blocks.
}

export function getRootFontSizePx(): number {
	const rootFontSize =
		Number.parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16;
	return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
}

export function getEstimatedCtEntryWidthPx(ctCardSizeLevel: number): number {
	return getRootFontSizePx() * CT_ESTIMATED_ENTRY_WIDTH_REM * getCtCardScale(ctCardSizeLevel);
}

export function buildVirtualizedAliveEntries(
	params: BuildVirtualizedAliveEntriesParams,
	ctCardSizeLevel: number,
): VirtualizedAliveEntries {
	const totalEntries = params.entries.length;
	if (!params.enabled || totalEntries < 1) {
		return {
			enabled: false,
			startIndex: 0,
			endIndex: totalEntries,
			leadingWidthPx: 0,
			trailingWidthPx: 0,
			entries: params.entries,
		};
	}

	const estimatedEntryWidthPx = Math.max(1, getEstimatedCtEntryWidthPx(ctCardSizeLevel));
	const visibleCount = Math.max(
		1,
		Math.ceil(Math.max(estimatedEntryWidthPx, params.viewportWidth) / estimatedEntryWidthPx),
	);
	const firstVisibleIndex = Math.max(0, Math.floor(params.scrollLeft / estimatedEntryWidthPx));
	const startIndex = Math.max(0, firstVisibleIndex - CT_VIRTUALIZATION_OVERSCAN);
	const endIndex = Math.min(
		totalEntries,
		firstVisibleIndex + visibleCount + CT_VIRTUALIZATION_OVERSCAN,
	);
	return {
		enabled: true,
		startIndex,
		endIndex,
		leadingWidthPx: Math.round(startIndex * estimatedEntryWidthPx),
		trailingWidthPx: Math.round((totalEntries - endIndex) * estimatedEntryWidthPx),
		entries: params.entries.slice(startIndex, endIndex),
	};
}

export function getDragTargetExpansionPx(): number {
	return getRootFontSizePx() * DRAG_TARGET_EXPANSION_REM;
}

export function resolvePreviewBeforeState(
	relative: number,
	targetId: string,
	dragPreview: CombatantDropPreview | null,
): boolean {
	if (relative <= DRAG_SWITCH_UPPER_RATIO) return true;
	if (relative >= DRAG_SWITCH_LOWER_RATIO) return false;
	if (dragPreview?.targetId === targetId) return dragPreview.before;
	return relative < 0.5;
}

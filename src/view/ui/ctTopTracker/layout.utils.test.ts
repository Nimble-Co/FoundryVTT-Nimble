import { afterEach, describe, expect, it } from 'vitest';

import { CT_EDGE_GUTTER_PX, CT_MIN_WIDTH_RATIO, CT_SHELL_EXTRA_WIDTH_REM } from './constants.js';
import { getRootFontSizePx, resolveCtTrackMaxWidth } from './layout.utils.js';

const originalInnerWidth = globalThis.innerWidth;
const originalVisualViewport = globalThis.visualViewport;

function setInnerWidth(width: number): void {
	Object.defineProperty(globalThis, 'innerWidth', {
		configurable: true,
		value: width,
	});
}

function setVisualViewport(width: number | undefined): void {
	Object.defineProperty(globalThis, 'visualViewport', {
		configurable: true,
		value: width == null ? undefined : { width },
	});
}

afterEach(() => {
	document.body.innerHTML = '';
	setInnerWidth(originalInnerWidth);
	Object.defineProperty(globalThis, 'visualViewport', {
		configurable: true,
		value: originalVisualViewport,
	});
});

describe('resolveCtTrackMaxWidth', () => {
	const shellExtraWidthPx = CT_SHELL_EXTRA_WIDTH_REM * getRootFontSizePx();

	it('uses the visible viewport width at the max level', () => {
		setInnerWidth(1000);

		expect(resolveCtTrackMaxWidth(10)).toBe(
			`${1000 - CT_EDGE_GUTTER_PX * 2 - shellExtraWidthPx}px`,
		);
	});

	it('uses visualViewport width when available', () => {
		setInnerWidth(1200);
		setVisualViewport(900);

		const expectedMaxWidth = `${900 - CT_EDGE_GUTTER_PX * 2 - shellExtraWidthPx}px`;
		expect(resolveCtTrackMaxWidth(10)).toBe(expectedMaxWidth);
		const viewportTrackWidthPx = 900 - CT_EDGE_GUTTER_PX * 2 - shellExtraWidthPx;
		const minimumTrackWidthPx = Math.min(420, viewportTrackWidthPx);
		expect(resolveCtTrackMaxWidth(1)).toBe(
			`${Math.max(minimumTrackWidthPx, Math.round(viewportTrackWidthPx * CT_MIN_WIDTH_RATIO))}px`,
		);
	});
});

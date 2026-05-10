import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VALID_WIDGETS, WIDGET_HINTS, withWidget } from './_widgetOption.js';

describe('withWidget validation', () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('returns the input options unchanged at runtime', () => {
		const opts = { required: true, widget: 'formula' as const };
		const out = withWidget(opts);
		expect(out).toBe(opts);
	});

	it('does not warn for a known widget hint', () => {
		withWidget({ widget: 'formula' });
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('warns for an unknown widget hint', () => {
		// `fromula` is the canonical typo from the review
		withWidget({ widget: 'fromula' as never }, 'value');
		expect(warnSpy).toHaveBeenCalledOnce();
		const message = warnSpy.mock.calls[0]?.[0] as string;
		expect(message).toContain('value');
		expect(message).toContain('fromula');
	});

	it('warns when showWhen is not a function', () => {
		withWidget({ showWhen: 'truthy' as never }, 'count');
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('showWhen');
	});

	it('warns when documentTypes is not an array', () => {
		withWidget({ documentTypes: 'Item.spell' as never }, 'uuid');
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('documentTypes');
	});

	it('warns for malformed documentTypes entries', () => {
		withWidget({ documentTypes: ['item.spell'] }, 'uuid');
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('item.spell');
	});

	it('accepts well-formed documentTypes entries', () => {
		withWidget({ documentTypes: ['Item', 'Item.spell', 'Actor'] }, 'uuid');
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('VALID_WIDGETS contains every WIDGET_HINTS entry and nothing else', () => {
		expect(VALID_WIDGETS.size).toBe(WIDGET_HINTS.length);
		for (const hint of WIDGET_HINTS) {
			expect(VALID_WIDGETS.has(hint)).toBe(true);
		}
	});
});

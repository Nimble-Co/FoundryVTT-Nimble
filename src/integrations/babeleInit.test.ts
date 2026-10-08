import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooksOnce = vi.fn();
vi.stubGlobal('Hooks', {
	on: vi.fn(),
	once: hooksOnce,
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn(),
});

import registerBabeleHooks from './babeleInit.js';

type BabeleConverter = (value: unknown, translation: unknown) => unknown;

function captureBabeleApi() {
	const converters = new Map<string, BabeleConverter>();
	const setSystemTranslationsDir = vi.fn();
	const registerConverter = vi.fn((name: string, fn: BabeleConverter) => {
		converters.set(name, fn);
	});
	return { converters, setSystemTranslationsDir, registerConverter };
}

function runBabeleInit() {
	hooksOnce.mockReset();
	const api = captureBabeleApi();
	registerBabeleHooks();
	expect(hooksOnce).toHaveBeenCalledWith('babele.init', expect.any(Function));
	const callback = hooksOnce.mock.calls[0][1] as (babele: typeof api) => void;
	callback(api);
	return api;
}

describe('babeleInit', () => {
	beforeEach(() => {
		hooksOnce.mockReset();
	});

	it('registers the system translations directory and both converters on babele.init', () => {
		const api = runBabeleInit();
		expect(api.setSystemTranslationsDir).toHaveBeenCalledWith('lang/babele');
		expect(api.converters.has('nimbleRules')).toBe(true);
		expect(api.converters.has('nimbleTableResults')).toBe(true);
	});

	describe('nimbleRules converter', () => {
		function getConverter() {
			return runBabeleInit().converters.get('nimbleRules')!;
		}

		it('overlays translations by rule.id', () => {
			const rules = [
				{ id: 'abc', label: 'Stout', other: 1 },
				{ id: 'def', label: 'Lithe' },
			];
			const translation = { abc: { label: 'Robusto' } };
			expect(getConverter()(rules, translation)).toEqual([
				{ id: 'abc', label: 'Robusto', other: 1 },
				{ id: 'def', label: 'Lithe' },
			]);
		});

		it('falls back to index:N keys when rule.id is absent', () => {
			const rules = [{ label: 'Optimistic' }, { label: 'Lithe' }];
			const translation = { 'index:0': { label: 'Optimista' } };
			expect(getConverter()(rules, translation)).toEqual([
				{ label: 'Optimista' },
				{ label: 'Lithe' },
			]);
		});

		it('prefers id-keyed translation over index fallback when both exist', () => {
			const rules = [{ id: 'abc', label: 'Stout' }];
			const translation = {
				abc: { label: 'FromId' },
				'index:0': { label: 'FromIndex' },
			};
			expect(getConverter()(rules, translation)).toEqual([{ id: 'abc', label: 'FromId' }]);
		});

		it('passes rules through unchanged when no override matches', () => {
			const rules = [{ id: 'abc', label: 'Stout' }];
			expect(getConverter()(rules, {})).toEqual(rules);
		});

		it('returns the original value when rules is not an array', () => {
			const converter = getConverter();
			expect(converter(undefined, { abc: { label: 'X' } })).toBe(undefined);
			expect(converter('not-an-array', { abc: { label: 'X' } })).toBe('not-an-array');
		});

		it('returns rules untouched when translation is missing or not an object', () => {
			const rules = [{ id: 'abc', label: 'Stout' }];
			expect(getConverter()(rules, null)).toBe(rules);
			expect(getConverter()(rules, undefined)).toBe(rules);
			expect(getConverter()(rules, 'string')).toBe(rules);
		});
	});

	describe('nimbleTableResults converter', () => {
		function getConverter() {
			return runBabeleInit().converters.get('nimbleTableResults')!;
		}

		it('overlays translations keyed by result._id', () => {
			const results = [
				{ _id: 'r1', name: 'I INSIST', description: '<p>orig</p>' },
				{ _id: 'r2', name: 'NO' },
			];
			const translation = {
				r1: { name: 'INSISTO', description: '<p>trad</p>' },
			};
			expect(getConverter()(results, translation)).toEqual([
				{ _id: 'r1', name: 'INSISTO', description: '<p>trad</p>' },
				{ _id: 'r2', name: 'NO' },
			]);
		});

		it('passes results through unchanged when _id has no override', () => {
			const results = [{ _id: 'r1', name: 'orig' }];
			expect(getConverter()(results, { r2: { name: 'other' } })).toEqual(results);
		});

		it('returns the original value when results is not an array', () => {
			const converter = getConverter();
			expect(converter(undefined, {})).toBe(undefined);
			expect(converter({ not: 'array' }, {})).toEqual({ not: 'array' });
		});

		it('returns results untouched when translation is missing or not an object', () => {
			const results = [{ _id: 'r1', name: 'orig' }];
			expect(getConverter()(results, null)).toBe(results);
			expect(getConverter()(results, undefined)).toBe(results);
		});

		it('leaves results without an _id alone', () => {
			const results = [{ name: 'no-id' }];
			expect(getConverter()(results, { undefined: { name: 'X' } })).toEqual(results);
		});
	});
});

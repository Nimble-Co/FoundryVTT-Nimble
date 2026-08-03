import { describe, expect, it } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import { compareFeatures, diffDescription, toPlainText } from './featureDiff.ts';

function feature(system: Record<string, unknown> = {}): NimbleFeatureItem {
	return {
		name: 'Wild Shape',
		system: {
			description: '<p>Transform into a beast for 1 hour.</p>',
			activation: {
				cost: { details: '', quantity: 1, type: 'action' },
				duration: { details: '', quantity: 1, type: 'hour' },
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 0, radius: 0, shape: '', width: 0 },
				effects: [],
			},
			rules: [],
			levelUpOptions: [],
			selectionCountByLevel: {},
			macro: '',
			...system,
		},
	} as unknown as NimbleFeatureItem;
}

describe('compareFeatures', () => {
	it('reports two untouched copies as identical', () => {
		const result = compareFeatures(feature(), feature());

		expect(result.isIdentical).toBe(true);
		expect(result.changedFields).toEqual([]);
	});

	it('ignores whitespace-only differences in the description', () => {
		const spaced = feature({ description: '<p>Transform   into a beast\n for 1 hour.</p>' });

		expect(compareFeatures(feature(), spaced).isIdentical).toBe(true);
	});

	it('ignores property order, which carries no meaning', () => {
		const reordered = feature({
			activation: {
				duration: { type: 'hour', quantity: 1, details: '' },
				cost: { type: 'action', quantity: 1, details: '' },
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 0, radius: 0, shape: '', width: 0 },
				effects: [],
			},
		});

		expect(compareFeatures(feature(), reordered).isIdentical).toBe(true);
	});

	it('names the duration when only the duration changes', () => {
		const shorter = feature({
			activation: {
				cost: { details: '', quantity: 1, type: 'action' },
				duration: { details: '', quantity: 10, type: 'minute' },
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 0, radius: 0, shape: '', width: 0 },
				effects: [],
			},
		});

		const result = compareFeatures(feature(), shorter);

		expect(result.isIdentical).toBe(false);
		expect(result.changedFields).toEqual(['duration']);
	});

	it('reports changed fields in a stable display order', () => {
		const altered = feature({
			description: '<p>Transform into a beast for 10 minutes.</p>',
			macro: 'doThing()',
			activation: {
				cost: { details: '', quantity: 2, type: 'action' },
				duration: { details: '', quantity: 1, type: 'hour' },
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 0, radius: 0, shape: '', width: 0 },
				effects: [],
			},
		});

		// description before actionCost before macro, per COMPARED_FIELDS
		expect(compareFeatures(feature(), altered).changedFields).toEqual([
			'description',
			'actionCost',
			'macro',
		]);
	});

	it('names the rule types behind an effects change', () => {
		const healed = feature({
			activation: {
				cost: { details: '', quantity: 1, type: 'action' },
				duration: { details: '', quantity: 1, type: 'hour' },
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 0, radius: 0, shape: '', width: 0 },
				effects: [{ type: 'healing', formula: '1d6' }],
			},
		});

		const result = compareFeatures(feature(), healed);

		expect(result.changedFields).toEqual(['effects']);
		expect(result.changedRuleTypes).toEqual(['healing']);
	});

	it('names only the rule type that actually changed', () => {
		const base = feature({
			rules: [
				{ type: 'healing', formula: '1d6' },
				{ type: 'damageBonus', formula: '2' },
			],
		});
		const tweaked = feature({
			rules: [
				{ type: 'healing', formula: '2d6' },
				{ type: 'damageBonus', formula: '2' },
			],
		});

		expect(compareFeatures(base, tweaked).changedRuleTypes).toEqual(['healing']);
	});

	it('treats a reordered rules array as a change, since order is meaningful', () => {
		const base = feature({
			rules: [
				{ type: 'a', v: 1 },
				{ type: 'b', v: 2 },
			],
		});
		const swapped = feature({
			rules: [
				{ type: 'b', v: 2 },
				{ type: 'a', v: 1 },
			],
		});

		const result = compareFeatures(base, swapped);

		expect(result.changedFields).toEqual(['rules']);
		// Both rule types are unchanged in content, so neither is named.
		expect(result.changedRuleTypes).toEqual([]);
	});
});

describe('diffDescription', () => {
	it('marks nothing when the descriptions match', () => {
		const segments = diffDescription('Transform for 1 hour.', 'Transform for 1 hour.');

		expect(segments.every((s) => !s.changed)).toBe(true);
		expect(segments.map((s) => s.text).join('')).toBe('Transform for 1 hour.');
	});

	it('marks only the words that changed', () => {
		const segments = diffDescription(
			'Transform into a beast for 1 hour. You regain no hit points.',
			'Transform into a beast for 10 minutes. You regain 1d6 hit points.',
		);

		const changed = segments
			.filter((s) => s.changed)
			.map((s) => s.text.trim())
			.join(' | ');

		expect(changed).toBe('10 minutes. | 1d6');
	});

	it('reconstructs the candidate text exactly', () => {
		const candidate = 'Transform into a beast for 10 minutes.';
		const segments = diffDescription('Transform into a beast for 1 hour.', candidate);

		expect(segments.map((s) => s.text).join('')).toBe(candidate);
	});

	it('marks everything as changed against an empty baseline', () => {
		const segments = diffDescription('', 'Wholly new text.');

		expect(segments).toEqual([{ text: 'Wholly new text.', changed: true }]);
	});

	it('returns nothing for an empty candidate', () => {
		expect(diffDescription('Anything at all.', '')).toEqual([]);
	});

	it('never emits markup, so a changed run cannot split a tag', () => {
		const segments = diffDescription(
			'<p>Transform for <strong>1 hour</strong>.</p>',
			'<p>Transform for <strong>10 minutes</strong>.</p>',
		);

		const all = segments.map((s) => s.text).join('');
		expect(all).not.toMatch(/[<>]/);
		expect(all).toBe('Transform for 10 minutes.');
		expect(
			segments
				.filter((s) => s.changed)
				.map((s) => s.text.trim())
				.join(' '),
		).toBe('10 minutes.');
	});

	it('strips scripts rather than passing them through as words', () => {
		const segments = diffDescription('', '<p>Safe</p><script>alert(1)</script>');

		expect(segments.map((s) => s.text).join('')).toBe('Safe');
	});

	it('decodes entities so escaped text compares as the reader sees it', () => {
		expect(toPlainText('<p>Cost&nbsp;&amp; effect</p>')).toBe('Cost & effect');
	});

	it('gives up on pathologically long text rather than stalling the dialog', () => {
		const long = 'word '.repeat(600);
		const segments = diffDescription(long, `${long}extra`);

		expect(segments).toHaveLength(1);
		expect(segments[0].changed).toBe(false);
	});
});

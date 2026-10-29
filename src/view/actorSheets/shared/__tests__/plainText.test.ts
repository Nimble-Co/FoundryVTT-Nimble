import { describe, expect, it } from 'vitest';
import { plainText } from '../plainText.ts';

describe('plainText', () => {
	it('drops the tags and keeps a space between blocks', () => {
		expect(plainText('<p>Deal <strong>2d6</strong> fire.</p><p>Range 8.</p>')).toBe(
			'Deal 2d6 fire. Range 8.',
		);
	});

	it('reads the common entities', () => {
		expect(plainText('Fish &amp; chips&nbsp;&lt;3 &quot;yes&quot; &#39;no&#39;')).toBe(
			'Fish & chips <3 "yes" \'no\'',
		);
	});

	it('shows the label of an enricher link', () => {
		expect(plainText('Apply @UUID[Compendium.nimble.conditions.Item.abc]{Prone} now')).toBe(
			'Apply Prone now',
		);
	});

	it('gives an empty string for no text', () => {
		expect(plainText('')).toBe('');
		expect(plainText(undefined)).toBe('');
	});
});

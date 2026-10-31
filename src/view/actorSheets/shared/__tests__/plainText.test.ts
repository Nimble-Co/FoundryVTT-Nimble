import { describe, expect, it } from 'vitest';
import { plainText } from '../plainText.ts';

describe('plainText', () => {
	it('drops the tags and keeps a space between blocks', () => {
		expect(plainText('<p>Deal <strong>2d6</strong> fire.</p><p>Range 8.</p>')).toBe(
			'Deal 2d6 fire. Range 8.',
		);
	});

	it('ends a block with a full stop when it has no end mark, so blocks do not run together', () => {
		expect(
			plainText(
				'<p><strong>Type:</strong> Cloth</p><p>Armor: 2+DEX<br>Cost: 10 gp</p><p>Hit:</p><p>Fire.</p>',
			),
		).toBe('Type: Cloth. Armor: 2+DEX. Cost: 10 gp. Hit: Fire.');
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

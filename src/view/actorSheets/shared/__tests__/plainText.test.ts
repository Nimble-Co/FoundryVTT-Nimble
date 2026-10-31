import { describe, expect, it } from 'vitest';
import { firstSentence, plainText } from '../plainText.ts';

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

describe('firstSentence', () => {
	it('gives the first sentence of a text', () => {
		expect(firstSentence('Wrath and Ruin. The Berserker is destruction.')).toBe('Wrath and Ruin.');
	});

	it('skips a first sentence that only repeats the name', () => {
		expect(firstSentence('Stout. +2 max Hit Dice [M]. +1 max Wounds [A].', 'Stout')).toBe(
			'+2 max Hit Dice [M].',
		);
	});

	it('does not end a sentence at an abbreviation', () => {
		expect(
			firstSentence('Strikes ignore Rushed Attacks (see pg. 13 of the Core Rules). More text.'),
		).toBe('Strikes ignore Rushed Attacks (see pg. 13 of the Core Rules).');
		expect(firstSentence('2 Handed (Req. 2 STR) Cost: 100 gp')).toBe(
			'2 Handed (Req. 2 STR) Cost: 100 gp',
		);
	});

	it('keeps a closing quote with its sentence', () => {
		expect(firstSentence('Dwarf, in the old language, means “stone.” You are resilient.')).toBe(
			'Dwarf, in the old language, means “stone.”',
		);
	});

	it('gives the whole text when it has no end mark, and nothing for no text', () => {
		expect(firstSentence('Gain 1 action')).toBe('Gain 1 action');
		expect(firstSentence('')).toBe('');
	});
});

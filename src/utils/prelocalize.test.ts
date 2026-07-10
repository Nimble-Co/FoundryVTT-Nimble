import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prelocalize } from './prelocalize.js';

// A minimal translation table: keys map to their English strings, some of
// which carry {placeholder} tokens. Mirrors game.i18n.localize semantics —
// return the translated string when the key is known, else the key itself.
const TRANSLATIONS: Record<string, string> = {
	'NIMBLE.plain.castSpell': 'Cast Spell',
	'NIMBLE.withPlaceholder.upcastHeading': 'Upcast {spellName}',
	'NIMBLE.withPlaceholder.cardHeading': 'Field Rest: {restType}',
};

beforeEach(() => {
	(globalThis as any).game = {
		i18n: {
			localize: (key: string) => TRANSLATIONS[key] ?? key,
		},
	};
});

describe('prelocalize', () => {
	it('localizes plain strings to their translated text', () => {
		const result = prelocalize({ castSpell: 'NIMBLE.plain.castSpell' });
		expect(result).toEqual({ castSpell: 'Cast Spell' });
	});

	it('leaves placeholder strings as keys so format() can interpolate them', () => {
		const result = prelocalize({
			upcastHeading: 'NIMBLE.withPlaceholder.upcastHeading',
			cardHeading: 'NIMBLE.withPlaceholder.cardHeading',
		});
		expect(result).toEqual({
			upcastHeading: 'NIMBLE.withPlaceholder.upcastHeading',
			cardHeading: 'NIMBLE.withPlaceholder.cardHeading',
		});
	});

	it('recurses through nested objects, mixing plain and placeholder strings', () => {
		const result = prelocalize({
			spellUpcastDialog: {
				castSpell: 'NIMBLE.plain.castSpell',
				upcastHeading: 'NIMBLE.withPlaceholder.upcastHeading',
			},
		});
		expect(result).toEqual({
			spellUpcastDialog: {
				castSpell: 'Cast Spell',
				upcastHeading: 'NIMBLE.withPlaceholder.upcastHeading',
			},
		});
	});

	it('leaves non-string values untouched', () => {
		const fn = () => 1;
		const result = prelocalize({ count: 3, enabled: true, handler: fn });
		expect(result).toEqual({ count: 3, enabled: true, handler: fn });
	});
});

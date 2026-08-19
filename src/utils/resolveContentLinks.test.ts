import { afterEach, describe, expect, it, vi } from 'vitest';
import resolveContentLinks from './resolveContentLinks.ts';

const globals = globalThis as unknown as { fromUuidSync?: unknown };
const originalFromUuidSync = globals.fromUuidSync;

afterEach(() => {
	globals.fromUuidSync = originalFromUuidSync;
});

describe('resolveContentLinks', () => {
	it('replaces a labelled link with its label', () => {
		expect(
			resolveContentLinks(
				'<p>@UUID[Compendium.nimble.nimble-spells.Item.9TNPdOXlCcGgxw6r]{Shadow Blast}</p>',
			),
		).toBe('<p>Shadow Blast</p>');
	});

	it('replaces every link in a description', () => {
		const description =
			'<p>Your Patron grants you knowledge of:</p>' +
			'<p>@UUID[Compendium.nimble.nimble-spells.Item.9TNPdOXlCcGgxw6r]{Shadow Blast}</p>' +
			'<p>@UUID[Compendium.nimble.nimble-spells.Item.ho2KADcmQWWTeYR0]{Summon Shadow}</p>';

		expect(resolveContentLinks(description)).toBe(
			'<p>Your Patron grants you knowledge of:</p><p>Shadow Blast</p><p>Summon Shadow</p>',
		);
	});

	it('falls back to the referenced document name when the link has no label', () => {
		globals.fromUuidSync = vi.fn(() => ({ name: 'Summon Shadow' }));

		expect(
			resolveContentLinks('@UUID[Compendium.nimble.nimble-spells.Item.ho2KADcmQWWTeYR0]'),
		).toBe('Summon Shadow');
	});

	it('leaves an unlabelled link alone when the document cannot be resolved', () => {
		globals.fromUuidSync = vi.fn(() => null);

		const description = '@UUID[Compendium.nimble.nimble-spells.Item.missing]';
		expect(resolveContentLinks(description)).toBe(description);
	});

	it('prefers the label over the referenced document name', () => {
		globals.fromUuidSync = vi.fn(() => ({ name: 'Shadow Blast' }));

		expect(
			resolveContentLinks('@UUID[Compendium.nimble.nimble-spells.Item.9TNPdOXlCcGgxw6r]{Blast}'),
		).toBe('Blast');
		expect(globals.fromUuidSync).not.toHaveBeenCalled();
	});

	it('returns content without links unchanged', () => {
		const description = '<p>Gain <strong>1 mana</strong> at the start of each round.</p>';
		expect(resolveContentLinks(description)).toBe(description);
	});

	it('handles empty content', () => {
		expect(resolveContentLinks('')).toBe('');
	});
});

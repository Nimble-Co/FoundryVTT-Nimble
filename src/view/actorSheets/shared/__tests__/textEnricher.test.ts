import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotesEnricher, type EnrichActor } from '../textEnricher.svelte.ts';

const enrichHTML = foundry.applications.ux.TextEditor.implementation
	.enrichHTML as unknown as ReturnType<typeof vi.fn>;

const actor: EnrichActor = {
	isOwner: true,
	getRollData: () => ({}),
	items: { get: () => undefined },
};

afterEach(() => {
	enrichHTML.mockImplementation((html: string) => Promise.resolve(html));
});

describe('createNotesEnricher', () => {
	it('keeps the text of the newest change when an older enrichment ends last', async () => {
		const pending = new Map<string, (html: string) => void>();
		enrichHTML.mockImplementation(
			(raw: string) => new Promise<string>((resolve) => pending.set(raw, resolve)),
		);
		const notes = createNotesEnricher(actor);

		notes.want('old');
		notes.want('new');
		pending.get('new')?.('<p>new</p>');
		pending.get('old')?.('<p>old</p>');
		await vi.waitFor(() => expect(notes.html).toBe('<p>new</p>'));
		await Promise.resolve();

		expect(notes.html).toBe('<p>new</p>');
	});
});

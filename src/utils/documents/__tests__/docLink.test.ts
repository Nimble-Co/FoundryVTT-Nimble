import { afterEach, describe, expect, it, vi } from 'vitest';
import { docLink, linkedDocument, linkedParts, linkedText, partsText } from '../docLink.js';

const RAGE = { name: 'Rage', uuid: 'Actor.hero.Item.rage' };

function stubDocument(doc: Record<string, unknown> | null, allowed = true) {
	const testUserPermission = vi.fn(() => allowed);
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn(() => (doc ? { testUserPermission, ...doc } : null)),
	);
	return testUserPermission;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('linkedParts', () => {
	it('splits a sentence at its placeholders, a document name a piece of its own', () => {
		expect(
			linkedParts('NIMBLE.chat.incomingReactions.redirectedToVia', { name: 'Bram', label: RAGE }),
		).toEqual(['Attack redirected to Bram via ', RAGE]);
	});

	it('puts text values and numbers into the text around them', () => {
		expect(linkedParts('NIMBLE.lastsUntil.chat.ended', { effect: 'Blinded', name: 3 })).toEqual([
			'Blinded ended on 3',
		]);
	});

	it('takes the pieces of a nested sentence in place', () => {
		const nested = linkedParts('NIMBLE.chat.incomingReactions.changeThisRoll.withFeature', {
			feature: RAGE,
		});
		expect(linkedParts('NIMBLE.chat.events.useHeading', { name: 'Hero', item: nested })).toEqual([
			'Hero uses with ',
			RAGE,
		]);
	});

	it('leaves out a placeholder with no value', () => {
		expect(linkedParts('NIMBLE.lastsUntil.chat.ended', { effect: RAGE })).toEqual([
			RAGE,
			' ended on ',
		]);
	});

	it('gives the plain text twin with the names as text', () => {
		const parts = linkedParts('NIMBLE.lastsUntil.chat.ended', { effect: RAGE, name: 'Hero' });
		expect(partsText(parts)).toBe('Rage ended on Hero');
		expect(linkedText('NIMBLE.lastsUntil.chat.ended', { effect: RAGE, name: 'Hero' })).toBe(
			'Rage ended on Hero',
		);
	});
});

describe('docLink', () => {
	it('keeps the uuid only when there is one', () => {
		expect(docLink('Rage', 'Item.rage')).toEqual({ name: 'Rage', uuid: 'Item.rage' });
		expect(docLink('Rage', '')).toEqual({ name: 'Rage' });
		expect(docLink(null, null)).toEqual({ name: '' });
	});
});

describe('linkedDocument', () => {
	it('links a document the user may see', () => {
		const test = stubDocument({ uuid: RAGE.uuid, id: 'rage', documentName: 'Item' });
		expect(linkedDocument(RAGE)).toEqual({
			uuid: RAGE.uuid,
			id: 'rage',
			documentName: 'Item',
			pack: undefined,
		});
		expect(test).toHaveBeenCalledWith(game.user, 'LIMITED');
	});

	it('stays plain text for a user who may not see the document', () => {
		stubDocument({ uuid: RAGE.uuid, documentName: 'Item' }, false);
		expect(linkedDocument(RAGE)).toBeNull();
	});

	it('stays plain text with no uuid, or when the document is gone', () => {
		stubDocument(null);
		expect(linkedDocument({ name: 'Rage' })).toBeNull();
		expect(linkedDocument(RAGE)).toBeNull();
	});

	it('stays plain text for a compendium index entry, which has no permission check', () => {
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => ({ uuid: RAGE.uuid, name: 'Rage' })),
		);
		expect(linkedDocument(RAGE)).toBeNull();
	});

	it('stays plain text when the uuid cannot be read', () => {
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => {
				throw new Error('bad uuid');
			}),
		);
		expect(linkedDocument(RAGE)).toBeNull();
	});

	it('never links an object that is not identified', () => {
		stubDocument({
			uuid: RAGE.uuid,
			documentName: 'Item',
			type: 'object',
			system: { identified: false },
		});
		expect(linkedDocument(RAGE)).toBeNull();
	});
});

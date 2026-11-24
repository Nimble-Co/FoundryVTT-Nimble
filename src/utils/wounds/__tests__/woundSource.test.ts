import { afterEach, describe, expect, it, vi } from 'vitest';
import { woundSourceOfMessage, woundSourceOfUuid } from '../woundSource.js';

describe('woundSourceOfMessage', () => {
	it('names the actor that speaks the card', () => {
		const card = { speakerActor: { uuid: 'Actor.ogre', name: 'Ogre' }, speaker: { alias: 'Big' } };
		expect(woundSourceOfMessage(card)).toEqual({ uuid: 'Actor.ogre', name: 'Ogre' });
	});

	it('falls back to the speaker name when no actor speaks it', () => {
		expect(woundSourceOfMessage({ speaker: { alias: 'Trap' } })).toEqual({
			uuid: null,
			name: 'Trap',
		});
	});

	it('has no source for no card', () => {
		expect(woundSourceOfMessage(null)).toBeNull();
		expect(woundSourceOfMessage({})).toBeNull();
	});
});

describe('woundSourceOfUuid', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('names the actor with that uuid', () => {
		vi.stubGlobal('fromUuidSync', () => ({ name: 'Ogre' }));
		expect(woundSourceOfUuid('Actor.ogre')).toEqual({ uuid: 'Actor.ogre', name: 'Ogre' });
	});

	it('keeps the uuid when the actor is not found', () => {
		vi.stubGlobal('fromUuidSync', () => null);
		expect(woundSourceOfUuid('Actor.gone')).toEqual({ uuid: 'Actor.gone', name: null });
		expect(woundSourceOfUuid(null)).toBeNull();
	});
});

import { describe, expect, it } from 'vitest';

import { SYSTEM_ID } from '#system';
import { cardMarkingItem, markOnToken, marksAddedOnCard } from '../cardMarks.ts';

const goblin = { actorUuid: 'Actor.goblin', tokenUuid: 'Scene.s.Token.goblin', name: 'Goblin' };
const ogre = { actorUuid: 'Actor.ogre', tokenUuid: null, name: 'Ogre' };

describe('cardMarkingItem', () => {
	const item = { uuid: 'Actor.cheat.Item.exploit' };
	const card = (isOwner: boolean) => ({
		flags: { [SYSTEM_ID]: { itemId: 'exploit' } },
		speakerActor: { isOwner, items: { get: (id: string) => (id === 'exploit' ? item : null) } },
	});

	it('gives the item that posted the card to the owner of its actor', () => {
		expect(cardMarkingItem(card(true))).toBe(item);
	});

	it('gives nothing to a user who does not own the actor', () => {
		expect(cardMarkingItem(card(false))).toBeNull();
	});
});

describe('markOnToken', () => {
	it('finds the mark by its token, or by the creature when the mark has no token', () => {
		const marks = [goblin, ogre];
		expect(markOnToken(marks, { uuid: 'Scene.s.Token.goblin' })).toBe(goblin);
		expect(markOnToken(marks, { uuid: 'Scene.s.Token.o', actor: { uuid: 'Actor.ogre' } })).toBe(
			ogre,
		);
		expect(markOnToken(marks, { uuid: 'Scene.s.Token.x', actor: { uuid: 'Actor.x' } })).toBeNull();
	});
});

describe('marksAddedOnCard', () => {
	const boar = {
		actorUuid: 'Actor.boar',
		tokenUuid: 'Scene.s.Token.boar',
		name: 'Boar',
		cardId: 'card-1',
	};
	const elsewhere = { ...ogre, cardId: 'card-2' };
	const targeted = { ...goblin, cardId: 'card-1' };

	it('gives the marks this card made on creatures that are not its targets', () => {
		const marks = [goblin, ogre, boar, elsewhere, targeted];
		expect(marksAddedOnCard(marks, 'card-1', ['Scene.s.Token.goblin'])).toEqual([boar]);
	});

	it('gives nothing for a card with no id', () => {
		expect(marksAddedOnCard([boar], null, [])).toEqual([]);
	});
});

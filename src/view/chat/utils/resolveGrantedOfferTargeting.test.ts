import { resolveGrantedOfferTargeting } from './resolveGrantedOfferTargeting.ts';

interface TokenStub {
	actor?: { id?: string; name?: string } | null;
	name?: string;
}

function createToken(stub: TokenStub): Token {
	return stub as unknown as Token;
}

describe('resolveGrantedOfferTargeting', () => {
	it('reports that the recipient is targeted when a targeted token belongs to them', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [createToken({ actor: { id: 'ally', name: 'Sir Brannon' } })],
		});

		expect(result.targetsRecipient).toBe(true);
		expect(result.targetNames).toEqual(['Sir Brannon']);
	});

	it('reports that the recipient is targeted when they are one of several targets', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'goblin', name: 'Goblin' } }),
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
			],
		});

		expect(result.targetsRecipient).toBe(true);
		expect(result.targetNames).toEqual(['Goblin', 'Sir Brannon']);
	});

	it('splits the recipient out from the other targets', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
				createToken({ actor: { id: 'goblin', name: 'Goblin Cutthroat' } }),
				createToken({ actor: { id: 'ogre', name: 'Ogre' } }),
			],
		});

		expect(result.recipientTargetNames).toEqual(['Sir Brannon']);
		expect(result.otherTargetNames).toEqual(['Goblin Cutthroat', 'Ogre']);
	});

	it('keeps every list in the order the targets were given', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'goblin', name: 'Goblin Cutthroat' } }),
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
				createToken({ actor: { id: 'ogre', name: 'Ogre' } }),
			],
		});

		// The recipient is not hoisted ahead of targets picked before them.
		expect(result.targetNames).toEqual(['Goblin Cutthroat', 'Sir Brannon', 'Ogre']);
		expect(result.otherTargetNames).toEqual(['Goblin Cutthroat', 'Ogre']);
	});

	it('counts every one of the recipient tokens when several are targeted', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
			],
		});

		expect(result.recipientTargetNames).toEqual(['Sir Brannon', 'Sir Brannon']);
		expect(result.otherTargetNames).toEqual([]);
	});

	it('reports no recipient target with no targets at all', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [],
		});

		expect(result.targetsRecipient).toBe(false);
		expect(result.targetNames).toEqual([]);
	});

	it('reports no recipient target and names a single other target', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [createToken({ actor: { id: 'goblin', name: 'Goblin Cutthroat' } })],
		});

		expect(result.targetsRecipient).toBe(false);
		expect(result.targetNames).toEqual(['Goblin Cutthroat']);
	});

	it('ignores empty token entries', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [null, undefined],
		});

		expect(result.targetsRecipient).toBe(false);
		expect(result.targetNames).toEqual([]);
	});

	it('reports no recipient target without a recipient id', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: '',
			targetedTokens: [createToken({ actor: { id: '', name: 'Nameless' } })],
		});

		expect(result.targetsRecipient).toBe(false);
		expect(result.targetNames).toEqual(['Nameless']);
	});

	it('names targets by actor name, then token name, then the unknown fallback', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'goblin', name: 'Goblin Cutthroat' }, name: 'Token Label' }),
				createToken({ actor: null, name: 'Token Label' }),
				createToken({ actor: null }),
			],
		});

		expect(result.targetNames).toEqual(['Goblin Cutthroat', 'Token Label', 'Unknown']);
	});
});

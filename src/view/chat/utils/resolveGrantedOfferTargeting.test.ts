import { resolveGrantedOfferTargeting } from './resolveGrantedOfferTargeting.ts';

interface TokenStub {
	actor?: { id?: string; name?: string } | null;
	name?: string;
}

function createToken(stub: TokenStub): Token {
	return stub as unknown as Token;
}

describe('resolveGrantedOfferTargeting', () => {
	it('blocks the offer when a targeted token belongs to the recipient', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [createToken({ actor: { id: 'ally', name: 'Sir Brannon' } })],
		});

		expect(result.status).toBe('blocked');
		expect(result.targetNames).toEqual(['Sir Brannon']);
	});

	it('blocks the offer when the recipient is one of several targets', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [
				createToken({ actor: { id: 'goblin', name: 'Goblin' } }),
				createToken({ actor: { id: 'ally', name: 'Sir Brannon' } }),
			],
		});

		expect(result.status).toBe('blocked');
	});

	it('stays ready with no targets, because untargeted activations are legal', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [],
		});

		expect(result.status).toBe('ready');
		expect(result.targetNames).toEqual([]);
	});

	it('is ready and reports the name of a single other target', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [createToken({ actor: { id: 'goblin', name: 'Goblin Cutthroat' } })],
		});

		expect(result.status).toBe('ready');
		expect(result.targetNames).toEqual(['Goblin Cutthroat']);
	});

	it('ignores empty token entries', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: 'ally',
			targetedTokens: [null, undefined],
		});

		expect(result.status).toBe('ready');
		expect(result.targetNames).toEqual([]);
	});

	it('cannot block without a recipient id', () => {
		const result = resolveGrantedOfferTargeting({
			recipientActorId: '',
			targetedTokens: [createToken({ actor: { id: '', name: 'Nameless' } })],
		});

		expect(result.status).toBe('ready');
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

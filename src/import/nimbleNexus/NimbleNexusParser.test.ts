import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCreatorCreditHtml } from './creatorCredit.js';
import { toActorData } from './NimbleNexusParser.js';
import type { NimbleNexusCreator, NimbleNexusMonster } from './types.js';

let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: {
			randomID: () => `mock-id-${++idCounter}`,
		},
	});
});

const creator: NimbleNexusCreator = { username: 'jao7371', displayName: '(jao)' };

function monster(description: string, withCreator: boolean): NimbleNexusMonster {
	return {
		type: 'monsters',
		id: 'm1',
		attributes: {
			name: 'Magma Drake',
			hp: 50,
			level: 3,
			size: 'large',
			armor: 'none',
			kind: 'Elemental',
			movement: [],
			abilities: [],
			actions: [],
			description,
		},
		...(withCreator ? { creator } : {}),
	} as unknown as NimbleNexusMonster;
}

function descriptionOf(actorData: ReturnType<typeof toActorData>): string {
	return (actorData as unknown as { system: { description: string } }).system.description;
}

describe('toActorData creator credit', () => {
	it('puts the credit above an existing description', () => {
		const result = descriptionOf(toActorData(monster('<p>A big lizard.</p>', true)));

		expect(result).toBe(`${buildCreatorCreditHtml(creator)}<hr /><p>A big lizard.</p>`);
	});

	it('uses the credit as the whole description when the monster has none', () => {
		const result = descriptionOf(toActorData(monster('', true)));

		expect(result).toBe(buildCreatorCreditHtml(creator));
	});

	it('leaves the description alone when no creator was side-loaded', () => {
		const result = descriptionOf(toActorData(monster('<p>A big lizard.</p>', false)));

		expect(result).toBe('<p>A big lizard.</p>');
	});

	it('leaves the description empty when there is no creator and no description', () => {
		const result = descriptionOf(toActorData(monster('', false)));

		expect(result).toBe('');
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { IMPORT_CREDIT_FLAG } from '../importCredit.js';
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

function actorFields(actorData: ReturnType<typeof toActorData>) {
	return actorData as unknown as {
		system: { description: string };
		flags?: Record<string, Record<string, unknown>>;
	};
}

describe('toActorData creator credit', () => {
	it('records the credit as a system flag', () => {
		const { flags } = actorFields(toActorData(monster('', true)));

		expect(flags?.[SYSTEM_ID]?.[IMPORT_CREDIT_FLAG]).toEqual({
			source: 'nimble-nexus',
			creator: { username: 'jao7371', displayName: '(jao)' },
		});
	});

	it('leaves the imported description exactly as the source wrote it', () => {
		const { system } = actorFields(toActorData(monster('<p>A big lizard.</p>', true)));

		expect(system.description).toBe('<p>A big lizard.</p>');
	});

	it('sets no flag when no creator was side-loaded', () => {
		const { flags } = actorFields(toActorData(monster('<p>A big lizard.</p>', false)));

		expect(flags?.[SYSTEM_ID]?.[IMPORT_CREDIT_FLAG]).toBeUndefined();
	});

	it('leaves an empty description empty', () => {
		const { system } = actorFields(toActorData(monster('', false)));

		expect(system.description).toBe('');
	});
});

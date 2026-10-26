import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from '../incomingReactionEntry.js';
import { alliesOnCard, rollerTokenOf, scanRerollAllies } from '../rerollAllies.js';

const FRIENDLY = 1;
const NEUTRAL = 0;
const HOSTILE = -1;

const allyRule = { type: 'reroll', usedBy: 'ally' };

function actor(uuid: string, extra: Record<string, unknown> = {}) {
	return { uuid, type: 'npc', hasPlayerOwner: false, rules: [allyRule], ...extra };
}

function token(id: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		uuid: `Scene.s.Token.${id}`,
		hidden: false,
		disposition: FRIENDLY,
		actor: actor(`Actor.${id}`),
		...extra,
	};
}

function scene(...tokens: ReturnType<typeof token>[]) {
	const sceneDoc = { tokens };
	for (const each of tokens) Object.assign(each, { parent: sceneDoc });
	return sceneDoc;
}

const spaces = (n: number) => () => n;

describe('scanRerollAllies', () => {
	it('lists a friendly creature with an ally reroll, with its spaces from the one who rolled', () => {
		const roller = token('roller', { actor: actor('Actor.roller', { rules: [] }) });
		const bard = token('bard');
		scene(roller, bard);
		expect(scanRerollAllies(roller, spaces(4))).toEqual([
			{ tokenUuid: bard.uuid, actor: bard.actor, isAlly: true, spaces: 4 },
		]);
	});

	it('skips hidden tokens, tokens without an actor, the one who rolled, and creatures without an ally reroll', () => {
		const roller = token('roller');
		scene(
			roller,
			token('hidden', { hidden: true }),
			token('empty', { actor: null }),
			token('twin', { actor: roller.actor }),
			token('plain', {
				actor: actor('Actor.plain', { rules: [{ type: 'reroll', usedBy: 'roller' }] }),
			}),
		);
		expect(scanRerollAllies(roller, spaces(1))).toEqual([]);
	});

	it('counts two player characters as allies whatever their disposition', () => {
		const pc = (id: string, disposition: number) =>
			token(id, {
				disposition,
				actor: actor(`Actor.${id}`, { type: 'character', hasPlayerOwner: true }),
			});
		const roller = pc('roller', HOSTILE);
		const gnome = pc('gnome', NEUTRAL);
		scene(roller, gnome);
		expect(scanRerollAllies(roller, spaces(2))).toEqual([
			expect.objectContaining({ isAlly: true }),
		]);
	});

	it('lists a creature that is not an ally by disposition as not an ally', () => {
		const roller = token('roller');
		scene(
			roller,
			token('neutral', { disposition: NEUTRAL }),
			token('foe', { disposition: HOSTILE }),
		);
		expect(scanRerollAllies(roller, spaces(1)).map((ally) => ally.isAlly)).toEqual([false, false]);
	});

	it('finds nothing without a token for the one who rolled', () => {
		expect(scanRerollAllies(null)).toEqual([]);
		expect(scanRerollAllies(token('alone', { parent: null }))).toEqual([]);
	});
});

describe('rollerTokenOf', () => {
	it("uses an unlinked actor's own token, else its first token on the scene", () => {
		const own = token('own');
		expect(rollerTokenOf({ token: own })).toBe(own);
		const placed = token('placed');
		const getActiveTokens = vi.fn(() => [placed]);
		expect(rollerTokenOf({ token: null, getActiveTokens })).toBe(placed);
		expect(getActiveTokens).toHaveBeenCalledWith(false, true);
		expect(rollerTokenOf(null)).toBeNull();
	});
});

describe('alliesOnCard', () => {
	const globals = globalThis as unknown as { fromUuidSync: unknown };
	afterEach(() => {
		globals.fromUuidSync = vi.fn();
	});

	function entry(overrides: Partial<IncomingReactionEntry>): IncomingReactionEntry {
		return {
			id: 'e',
			kind: 'reroll',
			source: 'rule',
			actorUuid: 'Actor.bard',
			tokenUuid: 'Scene.s.Token.bard',
			targetTokenUuid: null,
			side: 'ally',
			label: '',
			ruleId: 'r',
			itemUuid: 'Item.i',
			used: false,
			leftOut: null,
			...overrides,
		};
	}

	it('gives each ally with an entry that counts once, and none that is left out', () => {
		const bard = { uuid: 'Actor.bard' };
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'Actor.bard' ? bard : null));
		const allies = alliesOnCard([
			entry({ id: 'a', used: true }),
			entry({ id: 'b' }),
			entry({
				id: 'c',
				actorUuid: 'Actor.pip',
				tokenUuid: 'Scene.s.Token.pip',
				leftOut: { reason: 'disposition' },
			}),
			entry({ id: 'd', side: 'roller', actorUuid: 'Actor.roller' }),
		]);
		expect(allies).toEqual([
			{ tokenUuid: 'Scene.s.Token.bard', actor: bard, isAlly: true, spaces: 0 },
		]);
	});
});

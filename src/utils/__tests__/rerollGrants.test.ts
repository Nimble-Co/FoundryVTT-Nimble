import { describe, expect, it } from 'vitest';
import { type GrantModifier, rerollGrants } from '../rerollGrants.js';

interface FakeToken {
	uuid: string;
	hidden?: boolean;
	disposition?: number;
	x: number;
	actor: {
		uuid: string;
		name: string;
		type: string;
		hasPlayerOwner?: boolean;
		system: { attributes: { hp: { temp: number } } };
	} | null;
	parent?: { tokens: FakeToken[] };
}

function hero(name: string, x: number, temp = 0): FakeToken {
	return {
		uuid: `Scene.s.Token.${name}`,
		x,
		disposition: 1,
		actor: {
			uuid: `Actor.${name}`,
			name,
			type: 'character',
			hasPlayerOwner: true,
			system: { attributes: { hp: { temp } } },
		},
	};
}

function monster(name: string, x: number): FakeToken {
	return {
		uuid: `Scene.s.Token.${name}`,
		x,
		disposition: -1,
		actor: {
			uuid: `Actor.${name}`,
			name,
			type: 'npc',
			system: { attributes: { hp: { temp: 0 } } },
		},
	};
}

function scene(...tokens: FakeToken[]): FakeToken[] {
	const parent = { tokens };
	for (const token of tokens) token.parent = parent;
	return tokens;
}

const measure = (a: { x?: number }, b: { x?: number }) => Math.abs((a.x ?? 0) - (b.x ?? 0));

const presence: GrantModifier = {
	label: 'Inspiring Presence',
	actions: 0,
	tempHp: 3,
	tempHpWithin: 12,
};
const bones: GrantModifier = { label: 'Fire in my Bones', actions: 1, tempHp: 0, tempHpWithin: 0 };

function grants(
	tokens: FakeToken[],
	options: {
		roller: FakeToken | null;
		owner: FakeToken | null;
		modifiers?: GrantModifier[];
		actionState?: 'ok' | 'notInCombat' | 'notACharacter';
		featureEffects?: boolean;
	},
) {
	return rerollGrants({
		modifiers: options.modifiers ?? [presence],
		rollerActor: options.roller?.actor ?? tokens[0].actor,
		rollerToken: options.roller,
		ownerActor: options.owner?.actor ?? null,
		ownerToken: options.owner,
		actionState: () => options.actionState ?? 'ok',
		featureEffects: options.featureEffects ?? true,
		measure,
	} as never);
}

describe('rerollGrants', () => {
	it('gives temp HP to allies of the one who rolled within range of the owner, not the owner', () => {
		const [lyra, wren, pip, far, ogre] = scene(
			hero('Lyra', 0),
			hero('Wren', 2),
			hero('Pip', 12),
			hero('Far', 13),
			monster('Ogre', 1),
		);

		expect(grants([lyra, wren, pip, far, ogre], { roller: wren, owner: lyra })).toEqual([
			{
				actorUuid: 'Actor.Wren',
				name: 'Wren',
				tempHp: { amount: 3, had: 0, keeps: null, source: 'Inspiring Presence' },
				actions: null,
				applied: true,
			},
			{
				actorUuid: 'Actor.Pip',
				name: 'Pip',
				tempHp: { amount: 3, had: 0, keeps: null, source: 'Inspiring Presence' },
				actions: null,
				applied: true,
			},
		]);
	});

	it('lets a creature with more temp HP keep it', () => {
		const [lyra, wren, bram] = scene(hero('Lyra', 0), hero('Wren', 1), hero('Bram', 2, 5));

		const bramRow = grants([lyra, wren, bram], { roller: wren, owner: lyra }).find(
			(row) => row.name === 'Bram',
		);

		expect(bramRow?.tempHp).toEqual({ amount: 3, had: 5, keeps: 5, source: 'Inspiring Presence' });
	});

	it('gives a creature with less temp HP the new amount, and tells what it had', () => {
		const [lyra, wren, bram] = scene(hero('Lyra', 0), hero('Wren', 1), hero('Bram', 2, 1));

		const bramRow = grants([lyra, wren, bram], { roller: wren, owner: lyra }).find(
			(row) => row.name === 'Bram',
		);

		expect(bramRow?.tempHp).toEqual({
			amount: 3,
			had: 1,
			keeps: null,
			source: 'Inspiring Presence',
		});
	});

	it('gives temp HP at any distance when the range is 0', () => {
		const [lyra, wren, far] = scene(hero('Lyra', 0), hero('Wren', 1), hero('Far', 99));
		const anyDistance = { ...presence, tempHpWithin: 0 };

		const names = grants([lyra, wren, far], {
			roller: wren,
			owner: lyra,
			modifiers: [anyDistance],
		}).map((row) => row.name);

		expect(names).toEqual(['Wren', 'Far']);
	});

	it('leaves out hidden tokens', () => {
		const [lyra, wren, hidden] = scene(hero('Lyra', 0), hero('Wren', 1), {
			...hero('Hidden', 2),
			hidden: true,
		});

		expect(grants([lyra, wren, hidden], { roller: wren, owner: lyra }).map((r) => r.name)).toEqual([
			'Wren',
		]);
	});

	it('gives no temp HP when the owner or the one who rolled has no token', () => {
		const [lyra, wren] = scene(hero('Lyra', 0), hero('Wren', 1));

		expect(grants([lyra, wren], { roller: wren, owner: null })).toEqual([]);
		expect(grants([lyra, wren], { roller: null, owner: lyra })).toEqual([]);
	});

	it('gives actions to the one who rolled, with a reason when it cannot', () => {
		const [lyra, wren] = scene(hero('Lyra', 0), hero('Wren', 1));
		const row = (actionState: 'ok' | 'notInCombat' | 'notACharacter') =>
			grants([lyra, wren], { roller: wren, owner: lyra, modifiers: [bones], actionState });

		expect(row('ok')).toEqual([
			{
				actorUuid: 'Actor.Wren',
				name: 'Wren',
				tempHp: null,
				actions: { amount: 1, reason: null, source: 'Fire in my Bones' },
				applied: true,
			},
		]);
		expect(row('notInCombat')[0].actions).toEqual({
			amount: 0,
			reason: 'notInCombat',
			source: 'Fire in my Bones',
		});
		expect(row('notACharacter')[0].actions?.reason).toBe('notACharacter');
	});

	it('puts the actions and the temp HP of the one who rolled on one row, first', () => {
		const [lyra, pip, wren] = scene(hero('Lyra', 0), hero('Pip', 1), hero('Wren', 2));

		const rows = grants([lyra, pip, wren], {
			roller: wren,
			owner: lyra,
			modifiers: [presence, bones],
		});

		expect(rows.map((r) => r.name)).toEqual(['Wren', 'Pip']);
		expect(rows[0].actions?.amount).toBe(1);
		expect(rows[0].tempHp?.amount).toBe(3);
	});

	it('marks every row not applied when Feature Effects is off', () => {
		const [lyra, wren] = scene(hero('Lyra', 0), hero('Wren', 1));

		const rows = grants([lyra, wren], {
			roller: wren,
			owner: lyra,
			modifiers: [presence, bones],
			featureEffects: false,
		});

		expect(rows.map((r) => r.applied)).toEqual([false]);
		expect(rows[0].actions?.amount).toBe(1);
	});
});

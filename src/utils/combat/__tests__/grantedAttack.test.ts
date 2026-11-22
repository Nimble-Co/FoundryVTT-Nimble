import {
	createHeroicCharacter,
	createHeroicCombatant,
	resetHeroicGlobals,
	setHeroicCombat,
} from '../../../../tests/fixtures/heroicActions.js';

const rollUnarmedStrikeMock = vi.fn(async () => true);
const strikeUnarmedMock = vi.fn(async () => true);

// Setup loads these modules through game.ts, so a hoisted vi.mock would miss them.
let grantedAttack: typeof import('../grantedAttack.ts');

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../../heroicActions/unarmedStrike.js', () => ({
		rollUnarmedStrike: rollUnarmedStrikeMock,
		strikeUnarmed: strikeUnarmedMock,
	}));
	grantedAttack = await import('../grantedAttack.ts');
});

function weapon(id: string, options: { equipped?: boolean; attackType?: string } = {}) {
	return {
		id,
		uuid: `Actor.hero.Item.${id}`,
		name: id,
		type: 'object',
		system: {
			objectType: 'weapon',
			equipped: options.equipped ?? true,
			activation: {
				targets: { attackType: options.attackType ?? 'reach', distance: 1 },
				effects: [{ type: 'damage', formula: '1d8', damageType: 'slashing' }],
			},
		},
	};
}

function spell(id: string, tier: number) {
	return { id, uuid: `Actor.hero.Item.${id}`, name: id, type: 'spell', system: { tier } };
}

function hero(items: unknown[]) {
	const activateItem = vi.fn(async () => ({ id: 'card' }));
	const actor = createHeroicCharacter({ items, activateItem, system: {} });
	return { actor, activateItem };
}

const line = (options: Record<string, unknown> = {}) => ({
	sourceItemUuid: 'Item.granting',
	weaponKind: 'any' as const,
	allowsCantrips: false,
	free: false,
	spendsReaction: false,
	ignoresRushed: false,
	...options,
});

const names = (groups: ReturnType<typeof grantedAttack.grantedAttackGroups>) =>
	groups.map((group) => [group.label, group.choices.map((choice) => choice.name)]);

let restore: () => void;
beforeEach(() => {
	restore = resetHeroicGlobals();
	rollUnarmedStrikeMock.mockClear();
	strikeUnarmedMock.mockClear();
});
afterEach(() => restore());

describe('the choices of a granted attack line', () => {
	it('lists the equipped weapons, then Unarmed Strike, in one group with no heading', () => {
		const { actor } = hero([weapon('Longsword')]);

		expect(names(grantedAttack.grantedAttackGroups(actor, line()))).toEqual([
			[null, ['Longsword', 'Unarmed Strike']],
		]);
	});

	it('shows the headings when some weapons are equipped and some are not', () => {
		const { actor } = hero([weapon('Longsword'), weapon('Shortbow', { equipped: false })]);

		expect(names(grantedAttack.grantedAttackGroups(actor, line()))).toEqual([
			['Equipped', ['Longsword', 'Unarmed Strike']],
			['Not equipped', ['Shortbow']],
		]);
	});

	it('adds the cantrips of the recipient as a group when the line allows them', () => {
		const { actor } = hero([weapon('Longsword'), spell('Fire Bolt', 0), spell('Fireball', 3)]);

		expect(names(grantedAttack.grantedAttackGroups(actor, line({ allowsCantrips: true })))).toEqual(
			[
				[null, ['Longsword', 'Unarmed Strike']],
				['Cantrips', ['Fire Bolt']],
			],
		);
		expect(names(grantedAttack.grantedAttackGroups(actor, line()))).toEqual([
			[null, ['Longsword', 'Unarmed Strike']],
		]);
	});

	it('lists only the weapons of the kind of the line', () => {
		const { actor } = hero([weapon('Longsword'), weapon('Shortbow', { attackType: 'range' })]);

		expect(names(grantedAttack.grantedAttackGroups(actor, line({ weaponKind: 'ranged' })))).toEqual(
			[[null, ['Shortbow']]],
		);
		expect(
			names(grantedAttack.grantedAttackGroups(actor, line({ weaponKind: 'unarmed' }))),
		).toEqual([[null, ['Unarmed Strike']]]);
	});

	it('has no choices when nothing fits', () => {
		const { actor } = hero([weapon('Longsword')]);
		Object.assign(actor, { type: 'npc' });

		expect(grantedAttack.grantedAttackGroups(actor, line({ weaponKind: 'ranged' }))).toEqual([]);
	});
});

describe('an attack from a granted attack line', () => {
	it('attacks with the chosen weapon through the granting feature, spending the action', async () => {
		const sword = weapon('Longsword');
		const { actor, activateItem } = hero([sword]);

		expect(await grantedAttack.makeGrantedAttack(actor, line(), sword.uuid)).toBe(true);

		expect(activateItem).toHaveBeenCalledWith('Longsword', { originUuid: 'Item.granting' });
	});

	it('spends no action when the line is free, and can ignore Rushed Attacks', async () => {
		const sword = weapon('Longsword');
		const { actor, activateItem } = hero([sword]);

		await grantedAttack.makeGrantedAttack(
			actor,
			line({ free: true, ignoresRushed: true }),
			sword.uuid,
		);

		expect(activateItem).toHaveBeenCalledWith('Longsword', {
			originUuid: 'Item.granting',
			skipActionDeduction: true,
			ignoresRushed: true,
		});
	});

	it('casts a cantrip for free through the granting feature', async () => {
		const bolt = spell('Fire Bolt', 0);
		const { actor, activateItem } = hero([bolt]);

		await grantedAttack.makeGrantedAttack(
			actor,
			line({ free: true, allowsCantrips: true }),
			bolt.uuid,
		);

		expect(activateItem).toHaveBeenCalledWith('Fire Bolt', {
			originUuid: 'Item.granting',
			skipActionDeduction: true,
		});
	});

	it('makes a free Unarmed Strike through the granting feature', async () => {
		const { actor } = hero([]);

		expect(
			await grantedAttack.makeGrantedAttack(actor, line({ free: true }), 'unarmedStrike'),
		).toBe(true);

		expect(rollUnarmedStrikeMock).toHaveBeenCalledWith(actor, {
			originUuid: 'Item.granting',
			free: true,
		});
		expect(strikeUnarmedMock).not.toHaveBeenCalled();
	});

	it('spends the action of an Unarmed Strike that is not free', async () => {
		const { actor } = hero([]);

		await grantedAttack.makeGrantedAttack(actor, line({ ignoresRushed: true }), 'unarmedStrike');

		expect(strikeUnarmedMock).toHaveBeenCalledWith(actor, {
			originUuid: 'Item.granting',
			ignoresRushed: true,
		});
	});

	it('spends the reaction in place of an action, after the attack', async () => {
		const sword = weapon('Longsword');
		const { actor, activateItem } = hero([sword]);
		const combatant = createHeroicCombatant(actor);
		const useHeroicReactions = vi.fn(async () => true);
		setHeroicCombat(combatant, { useHeroicReactions });

		expect(
			await grantedAttack.makeGrantedAttack(actor, line({ spendsReaction: true }), sword.uuid),
		).toBe(true);

		expect(activateItem).toHaveBeenCalledWith('Longsword', {
			originUuid: 'Item.granting',
			skipActionDeduction: true,
		});
		expect(useHeroicReactions).toHaveBeenCalledWith(combatant.id, ['opportunityAttack'], undefined);
	});

	it('does nothing for a choice the recipient no longer has', async () => {
		const { actor, activateItem } = hero([]);

		expect(await grantedAttack.makeGrantedAttack(actor, line(), 'Actor.hero.Item.gone')).toBe(
			false,
		);
		expect(activateItem).not.toHaveBeenCalled();
	});
});

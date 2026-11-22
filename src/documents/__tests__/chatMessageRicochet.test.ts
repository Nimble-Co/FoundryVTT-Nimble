import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NimbleChatMessage } from '../chatMessage.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const DAGGER = 'Actor.cheat.Item.dagger';
const KOBOLD = 'Scene.scene.Token.kobold';

function creature(armor = 'none') {
	const actor = {
		name: 'Kobold',
		applyDamage: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor,
				hp: { value: 30, temp: 0, max: 30 },
				damageResistances: [],
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			damageReductions: [],
		},
		effects: [],
	};
	return actor;
}

function dagger(properties = ['light', 'thrown']) {
	return {
		uuid: DAGGER,
		name: 'Dagger',
		type: 'object',
		system: { objectType: 'weapon', weaponType: '', properties: { selected: properties } },
	};
}

function cheat(withTrickshot = true) {
	const rule = {
		type: 'ricochet',
		ricochetFor: (weapon: { system?: { properties?: { selected?: string[] } } } | null) =>
			weapon?.system?.properties?.selected?.includes('thrown')
				? { source: 'Trickshot', reach: 2 }
				: null,
	};
	return { uuid: 'Actor.cheat', rules: withTrickshot ? [rule] : [] };
}

/** A dagger hit for 4 on its die and 3 from DEX: 7 in all. */
function daggerCard(options: { isMiss?: boolean; isCritical?: boolean; flags?: object } = {}) {
	const card = new NimbleChatMessage({
		type: 'object',
		speaker: { actor: 'cheat' },
		flags: { [SYSTEM_ID]: { itemUuid: DAGGER, ...(options.flags ?? {}) } },
		system: {
			targets: ['Scene.scene.Token.goblin'],
			isCritical: options.isCritical ?? false,
			isMiss: options.isMiss ?? false,
			activation: {
				effects: [
					{
						id: 'daggerDmg',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d4 + 3',
						parentNode: null,
						parentContext: null,
						roll: {
							class: 'DamageRoll',
							formula: '1d4 + 3',
							total: 7,
							isCritical: options.isCritical ?? false,
							evaluated: true,
							options: {},
							terms: [
								{ class: 'Die', faces: 4, number: 1, results: [{ result: 4, active: true }] },
								{ class: 'OperatorTerm', operator: '+' },
								{ class: 'NumericTerm', number: 3, options: {} },
							],
						},
						on: {
							hit: [
								{
									id: 'daggerFull',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentNode: 'daggerDmg',
									parentContext: 'hit',
								},
							],
						},
					},
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
	card.setFlag = vi.fn().mockResolvedValue(card);
	return card;
}

function world(options: { armor?: string; weapon?: object; withTrickshot?: boolean } = {}) {
	const kobold = creature(options.armor);
	const weapon = options.weapon ?? dagger();
	globals.game.actors = {
		get: (id: string) => (id === 'cheat' ? cheat(options.withTrickshot) : null),
	};
	globals.fromUuidSync = vi.fn((uuid: string) => {
		if (uuid === DAGGER) return weapon;
		if (uuid === KOBOLD) return { actor: kobold, name: 'Kobold' };
		return null;
	});
	return { kobold };
}

beforeEach(() => {
	vi.clearAllMocks();
	globals.game.user.isGM = true;
	globals.Hooks = { call: vi.fn(), callAll: vi.fn() };
});

describe('the ricochet of a card', () => {
	it('is there after a hit with a thrown dagger of an attacker who has it', () => {
		world();

		expect(daggerCard().ricochet()).toEqual({ source: 'Trickshot', reach: 2 });
	});

	it('is not there after a miss', () => {
		world();

		expect(daggerCard({ isMiss: true }).ricochet()).toBeNull();
	});

	it('is not there for a weapon that does not fit, or an attacker without it', () => {
		world({ weapon: dagger(['light']) });
		expect(daggerCard().ricochet()).toBeNull();

		world({ withTrickshot: false });
		expect(daggerCard().ricochet()).toBeNull();
	});

	it('reads the weapon a feature attacked with', () => {
		world();

		const card = daggerCard({
			flags: { itemUuid: 'Actor.cheat.Item.feature', weaponUuid: DAGGER },
		});

		expect(card.ricochet()).not.toBeNull();
	});
});

describe('the ricochet damage', () => {
	it('is half the damage, rounded down', () => {
		world();

		expect(daggerCard().ricochetDamage(KOBOLD)).toBe(3);
	});

	it("goes through the creature's own armor", () => {
		world({ armor: 'medium' });

		// Medium armor takes only the dice: half of the 4 on the die.
		expect(daggerCard().ricochetDamage(KOBOLD)).toBe(2);
	});

	it('is half of a crit, which armor does not stop', () => {
		world({ armor: 'medium' });

		expect(daggerCard({ isCritical: true }).ricochetDamage(KOBOLD)).toBe(3);
	});

	it('is applied to the creature once, by the GM, and the card remembers it', async () => {
		const { kobold } = world();
		const card = daggerCard();

		await card.applyRicochetDamage(KOBOLD);

		expect(kobold.applyDamage).toHaveBeenCalledWith(3);
		expect(card.setFlag).toHaveBeenCalledWith(SYSTEM_ID, 'ricochet', {
			targetUuid: KOBOLD,
			applied: true,
		});
	});

	it('is not applied by a player, or a second time', async () => {
		const { kobold } = world();
		globals.game.user.isGM = false;
		await daggerCard().applyRicochetDamage(KOBOLD);

		globals.game.user.isGM = true;
		await daggerCard({
			flags: { ricochet: { targetUuid: KOBOLD, applied: true } },
		}).applyRicochetDamage(KOBOLD);

		expect(kobold.applyDamage).not.toHaveBeenCalled();
	});

	it('remembers the creature the player picks, for the GM to apply', async () => {
		world();
		globals.game.user.isGM = false;
		const card = daggerCard();

		await card.setRicochetTarget(KOBOLD);

		expect(card.setFlag).toHaveBeenCalledWith(SYSTEM_ID, 'ricochet', { targetUuid: KOBOLD });
	});
});

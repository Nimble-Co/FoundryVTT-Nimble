import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDamageBack, type DamageBackRecord } from '../chatMessage/cardDamageBack.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: unknown; user?: unknown; users?: unknown };
	fromUuidSync: unknown;
};

function setFeatureEffects(on: boolean) {
	testGlobals.game.settings = {
		get: (_scope: string, key: string) => on || !key.includes('RuleEffects'),
	};
}

const attacker = () => ({
	uuid: 'Actor.ogre',
	name: 'Ogre',
	applyDamage: vi.fn(async () => undefined),
});

const rule = (overrides: Record<string, unknown> = {}) => ({
	type: 'damageBack',
	label: 'Bring the Pain',
	woundDoubles: true,
	answersAttack: vi.fn((attack: { isCritical: boolean }) => attack.isCritical),
	...overrides,
});

function card(from = attacker(), records: DamageBackRecord[] = []) {
	const state = { records };
	const update = vi.fn(async (changes: Record<string, unknown>) => {
		state.records = changes['system.damageBack'] as DamageBackRecord[];
	});
	const back = new CardDamageBack({
		id: () => 'message-1',
		attacker: () => from,
		records: () => state.records,
		update,
	});
	return { back, state, update, from };
}

const hero = (...rules: unknown[]) => ({ uuid: 'Actor.hero', rules });

describe('CardDamageBack', () => {
	beforeEach(() => setFeatureEffects(true));
	afterEach(() => {
		delete testGlobals.game.settings;
		vi.restoreAllMocks();
	});

	it('deals what the creature took to the one who attacked, and tells it on the card', async () => {
		const { back, state, from } = card();

		await back.afterDamage([{ actor: hero(rule()), taken: 6 }], { isCritical: true });

		expect(from.applyDamage).toHaveBeenCalledWith(6);
		expect(state.records).toEqual([
			expect.objectContaining({
				label: 'Bring the Pain',
				attackerName: 'Ogre',
				amount: 6,
				dealt: true,
				doubled: false,
			}),
		]);
	});

	it('does nothing when the rule does not answer the attack', async () => {
		const { back, update, from } = card();

		await back.afterDamage([{ actor: hero(rule()), taken: 6 }], { isCritical: false });

		expect(from.applyDamage).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('does nothing for no damage, another rule, or damage the attacker did to itself', async () => {
		const { back, update, from } = card();

		await back.afterDamage(
			[
				{ actor: hero(rule()), taken: 0 },
				{ actor: hero({ type: 'damageReduction' }), taken: 6 },
				{ actor: { uuid: from.uuid, rules: [rule()] }, taken: 6 },
			],
			{ isCritical: true },
		);

		expect(from.applyDamage).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('waits for a click with Feature Effects off', async () => {
		setFeatureEffects(false);
		const { back, state, from } = card();

		await back.afterDamage([{ actor: hero(rule()), taken: 6 }], { isCritical: true });

		expect(from.applyDamage).not.toHaveBeenCalled();
		expect(state.records[0]).toMatchObject({ dealt: false, amount: 6 });
	});

	describe('a click on the card', () => {
		const record = (overrides: Partial<DamageBackRecord> = {}): DamageBackRecord => ({
			id: 'back-1',
			label: 'Bring the Pain',
			actorUuid: 'Actor.hero',
			attackerUuid: 'Actor.ogre',
			attackerName: 'Ogre',
			amount: 6,
			dealt: true,
			woundDoubles: true,
			doubled: false,
			...overrides,
		});

		function world(wounds = 0, max = 6) {
			const from = attacker();
			const owner = {
				uuid: 'Actor.hero',
				type: 'character',
				system: { attributes: { wounds: { value: wounds, max } } },
				testUserPermission: vi.fn(() => true),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					for (const [path, value] of Object.entries(changes)) {
						foundry.utils.setProperty(owner, path, value);
					}
				}),
			};
			testGlobals.fromUuidSync = vi.fn(
				(uuid: string) =>
					(({ 'Actor.hero': owner, 'Actor.ogre': from }) as Record<string, unknown>)[uuid] ?? null,
			);
			testGlobals.game.user = { id: 'gm', isGM: true };
			testGlobals.game.users = {
				get: (id: string) =>
					(({ gm: { id, isGM: true }, player: { id, isGM: false } }) as Record<string, unknown>)[
						id
					] ?? null,
			};
			return { from, owner };
		}

		it('pays 1 Wound and deals the amount again, once', async () => {
			const { from, owner } = world();
			const { back, state } = card(from, [record()]);

			await back.resolve('back-1', 'double', 'gm');
			await back.resolve('back-1', 'double', 'gm');

			expect(from.applyDamage).toHaveBeenCalledTimes(1);
			expect(from.applyDamage).toHaveBeenCalledWith(6);
			expect(owner.system.attributes.wounds.value).toBe(1);
			expect(state.records[0]?.doubled).toBe(true);
		});

		it('refuses the Wound on a rule without one, and deals nothing', async () => {
			const { from, owner } = world();
			const { back } = card(from, [record({ woundDoubles: false })]);

			await back.resolve('back-1', 'double', 'gm');

			expect(from.applyDamage).not.toHaveBeenCalled();
			expect(owner.system.attributes.wounds.value).toBe(0);
		});

		it('deals a waiting record once', async () => {
			const { from } = world();
			const { back, state } = card(from, [record({ dealt: false })]);

			await back.resolve('back-1', 'deal', 'gm');
			await back.resolve('back-1', 'deal', 'gm');

			expect(from.applyDamage).toHaveBeenCalledTimes(1);
			expect(state.records[0]?.dealt).toBe(true);
		});

		it('takes a click from the owner through the socket', async () => {
			const { from, owner } = world();
			const { back } = card(from, [record()]);

			await back.resolve('back-1', 'double', 'player', true);

			expect(owner.testUserPermission).toHaveBeenCalled();
			expect(from.applyDamage).toHaveBeenCalledWith(6);
		});

		it('refuses a player who does not own the creature', async () => {
			const { from, owner } = world();
			owner.testUserPermission.mockReturnValue(false);
			const { back } = card(from, [record()]);

			await back.resolve('back-1', 'double', 'player', true);

			expect(from.applyDamage).not.toHaveBeenCalled();
		});
	});
});

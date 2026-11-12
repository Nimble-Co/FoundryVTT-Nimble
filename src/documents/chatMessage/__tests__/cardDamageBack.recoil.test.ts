import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDamageBack, type DamageBackRecord } from '../cardDamageBack.js';

describe('damage recoil on the one who deals the damage', () => {
	const attack = { isCritical: false };
	const recoilRule = (multiplier: number, disabled = false) => ({
		type: 'damageRecoil',
		label: 'Bloodcursed',
		disabled,
		recoilFor: (dealt: number) => Math.floor(dealt * multiplier),
	});
	const setup = (rules: unknown[]) => {
		const attacker = { uuid: 'Actor.ogre', name: 'Ogre', rules, applyDamage: vi.fn() };
		const update = vi.fn(async (_changes: Record<string, unknown>) => undefined);
		const host = { id: () => 'c', attacker: () => attacker, records: () => [], update };
		return { attacker, update, back: new CardDamageBack(host) };
	};
	const written = (update: ReturnType<typeof setup>['update']) =>
		update.mock.calls[0]?.[0]?.['system.damageBack'] as DamageBackRecord[];

	let automatic = true;
	beforeEach(() => {
		automatic = true;
		(globalThis as any).game.settings = { get: () => automatic };
	});

	it('reads the active recoil rules of the attacker before the damage', () => {
		const { back } = setup([recoilRule(2), recoilRule(2, true), { type: 'damageBack' }]);
		expect(back.recoilRules()).toHaveLength(1);
	});

	it('puts twice the damage dealt to every target on the attacker', async () => {
		const { attacker, back, update } = setup([]);
		await back.afterDamage(
			[
				{ actor: { uuid: 'Actor.tessa' }, taken: 5 },
				{ actor: { uuid: 'Actor.bruno' }, taken: 3 },
			],
			attack,
			[recoilRule(2)],
		);
		expect(attacker.applyDamage).toHaveBeenCalledWith(16);
		expect(written(update)).toEqual([
			expect.objectContaining({
				label: 'Bloodcursed',
				actorUuid: 'Actor.ogre',
				attackerUuid: 'Actor.ogre',
				amount: 16,
				dealt: true,
			}),
		]);
	});

	it('counts no damage the attacker dealt to itself', async () => {
		const { attacker, back } = setup([]);
		await back.afterDamage([{ actor: { uuid: 'Actor.ogre' }, taken: 5 }], attack, [recoilRule(2)]);
		expect(attacker.applyDamage).not.toHaveBeenCalled();
	});

	it('waits for a click with Feature Effects off', async () => {
		automatic = false;
		const { attacker, back, update } = setup([]);
		await back.afterDamage([{ actor: { uuid: 'Actor.tessa' }, taken: 4 }], attack, [recoilRule(2)]);
		expect(attacker.applyDamage).not.toHaveBeenCalled();
		expect(written(update)[0]).toMatchObject({ amount: 8, dealt: false });
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const endOrWaitEffects = vi.fn(async (..._args: unknown[]) => undefined);
vi.resetModules();
vi.doMock('#utils/lastsUntil/endEffectsAt.js', () => ({ endOrWaitEffects }));
const { CardDamageBack } = await import('../cardDamageBack.js');

const globals = globalThis as unknown as { game: { settings?: unknown } };

const holder = { uuid: 'Actor.vex', name: 'Vex', documentName: 'Actor' };

function effectOn(id: string) {
	return {
		id,
		uuid: `Actor.vex.ActiveEffect.${id}`,
		name: id,
		documentName: 'ActiveEffect',
		parent: holder,
	};
}

function meleeRule(id: string, endsEffect: boolean) {
	return {
		id,
		type: 'damageBack',
		label: id,
		parentDocument: effectOn(id),
		amount: 'formula',
		formula: '3',
		rollData: () => ({}),
		damageType: 'cold',
		ignoreArmor: true,
		endsEffect,
		answersAttack: () => true,
	};
}

async function meleeHit(rules: object[]) {
	const attacker = { uuid: 'Actor.ogre', name: 'Ogre', applyDamage: vi.fn() };
	const update = vi.fn(async (_changes: Record<string, unknown>) => undefined);
	const back = new CardDamageBack({
		id: () => 'club',
		attacker: () => attacker,
		records: () => [],
		update,
	});
	await back.afterDamage([{ actor: { uuid: holder.uuid, rules }, taken: 9 }], {
		isCritical: false,
	});
	return { attacker, update };
}

beforeEach(() => {
	endOrWaitEffects.mockClear();
	vi.stubGlobal(
		'Roll',
		class {
			total = 3;
			async evaluate() {
				return this;
			}
			toJSON() {
				return { total: 3 };
			}
		},
	);
	globals.game.settings = { get: () => true };
});

afterEach(() => {
	vi.unstubAllGlobals();
	globals.game.settings = undefined;
});

describe('a damage back rule that ends after it answers', () => {
	it('ends the effect that holds it, on the card, once it makes its record', async () => {
		const { attacker, update } = await meleeHit([meleeRule('aura', true)]);

		expect(attacker.applyDamage).toHaveBeenCalledWith(3);
		expect(update).toHaveBeenCalledTimes(1);
		expect(endOrWaitEffects).toHaveBeenCalledTimes(1);
		const [effects, moment] = endOrWaitEffects.mock.calls[0] as [
			Array<{ id: string }>,
			{ hostId?: string; reason?: { key: string } },
		];
		expect(effects.map((effect) => effect.id)).toEqual(['aura']);
		expect(moment).toMatchObject({
			hostId: 'club',
			reason: { key: 'NIMBLE.chat.damageBack.ended' },
		});
	});

	it('ends only its own effect when other rules answer the same hit', async () => {
		await meleeHit([meleeRule('barrier', false), meleeRule('aura', true)]);

		expect(endOrWaitEffects).toHaveBeenCalledTimes(1);
		const [effects] = endOrWaitEffects.mock.calls[0] as [Array<{ id: string }>];
		expect(effects.map((effect) => effect.id)).toEqual(['aura']);
	});

	it('ends nothing when it is off, or when the rule is not on an effect', async () => {
		const onItem = {
			...meleeRule('blade', true),
			parentDocument: { id: 'blade', uuid: 'Actor.vex.Item.blade', documentName: 'Item' },
		};

		await meleeHit([meleeRule('barrier', false), onItem]);

		expect(endOrWaitEffects).not.toHaveBeenCalled();
	});

	it('ends nothing when the rule makes no record', async () => {
		await meleeHit([{ ...meleeRule('aura', true), answersAttack: () => false }]);

		expect(endOrWaitEffects).not.toHaveBeenCalled();
	});
});

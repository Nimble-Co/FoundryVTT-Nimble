import { afterEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { AttackOutcomeRule } from '../attackOutcome.js';

const ITEM_UUID = 'Actor.hero.Item.touch';

function makeRule(
	config: Record<string, unknown> = {},
	options: { isEmbedded?: boolean; tags?: string[] } = {},
) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(options.tags ?? []),
		getFlag: () => undefined,
		getRollData: () => ({}),
	};
	const item = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: "Deathbringer's Touch",
		uuid: ITEM_UUID,
		getDomain: () => new Set<string>(),
	};
	const rule = new AttackOutcomeRule({ type: 'attackOutcome' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		label: '',
		side: 'yourAttacks',
		cannotMiss: false,
		critRange: 0,
		forceCrit: 'none',
		anyDieCrits: false,
		attackDelivery: 'any',
		attackSource: 'any',
		thisItemOnly: false,
		exceptItemIdentifier: '',
		otherCreature: new Predicate({}),
		chargePoolIdentifier: '',
		predicate: new Predicate({}),
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

const bloodied = { uuid: 'Actor.ogre', getTargetDomain: () => new Set(['target:bloodied']) };
const unhurt = { uuid: 'Actor.ogre', getTargetDomain: () => new Set<string>() };

const attack = (overrides: Record<string, unknown> = {}) => ({
	side: 'yourAttacks' as const,
	delivery: 'melee' as const,
	other: unhurt,
	itemUuid: 'Actor.hero.Item.sword',
	...overrides,
});

describe('AttackOutcomeRule', () => {
	afterEach(() => vi.unstubAllGlobals());

	describe('the item of the attack', () => {
		const stubItem = (item: Record<string, unknown>) => vi.stubGlobal('fromUuidSync', () => item);

		it('applies only to the source it names', () => {
			stubItem({ type: 'spell' });
			expect(makeRule({ attackSource: 'weapon' }).changeFor(attack())).toBeNull();
			expect(makeRule({ attackSource: 'spell' }).changeFor(attack())).not.toBeNull();

			stubItem({ type: 'object' });
			expect(makeRule({ attackSource: 'weapon' }).changeFor(attack())).not.toBeNull();
			expect(makeRule({ attackSource: 'spell' }).changeFor(attack())).toBeNull();
		});

		it('counts an attack with no item as a weapon attack', () => {
			const noItem = attack({ itemUuid: null });
			expect(makeRule({ attackSource: 'weapon' }).changeFor(noItem)).not.toBeNull();
			expect(makeRule({ attackSource: 'spell' }).changeFor(noItem)).toBeNull();
		});

		it('ignores attacks with the item it excepts', () => {
			stubItem({ type: 'feature', identifier: 'companion' });
			expect(makeRule({ exceptItemIdentifier: 'companion' }).changeFor(attack())).toBeNull();
			expect(makeRule({ exceptItemIdentifier: 'other' }).changeFor(attack())).not.toBeNull();
		});
	});

	it('defines its fields with defaults that change nothing', () => {
		const schema = AttackOutcomeRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.side?.initial).toBe('yourAttacks');
		expect(schema.cannotMiss?.initial).toBe(false);
		expect(schema.critRange?.initial).toBe(0);
		expect(schema.forceCrit?.initial).toBe('none');
		expect(schema.anyDieCrits?.initial).toBe(false);
		expect(schema.thisItemOnly?.initial).toBe(false);
	});

	it('gives its change, named for its item, on an attack it applies to', () => {
		const rule = makeRule({ forceCrit: 'always', critRange: 1, cannotMiss: true });

		expect(rule.changeFor(attack())).toEqual({
			label: "Deathbringer's Touch",
			cannotMiss: true,
			critRange: 1,
			forcedCrit: 'always',
			anyDieCrits: false,
			chargePoolIdentifier: '',
		});
	});

	it('applies only to attacks on its side', () => {
		const rule = makeRule({ cannotMiss: true });

		expect(rule.changeFor(attack({ side: 'attacksAgainstYou' }))).toBeNull();
		expect(
			makeRule({ side: 'attacksAgainstYou' }).changeFor(attack({ side: 'attacksAgainstYou' })),
		).not.toBeNull();
	});

	it('applies only to the delivery it names', () => {
		const rule = makeRule({ attackDelivery: 'melee' });

		expect(rule.changeFor(attack())).not.toBeNull();
		expect(rule.changeFor(attack({ delivery: 'ranged' }))).toBeNull();
	});

	it('applies only to attacks with its own item when it says so', () => {
		const rule = makeRule({ thisItemOnly: true });

		expect(rule.changeFor(attack())).toBeNull();
		expect(rule.changeFor(attack({ itemUuid: ITEM_UUID }))).not.toBeNull();
	});

	it('applies only when the other creature is what it asks for', () => {
		const rule = makeRule({ otherCreature: new Predicate({ $and: ['target:bloodied'] }) });

		expect(rule.changeFor(attack())).toBeNull();
		expect(rule.changeFor(attack({ other: bloodied }))).not.toBeNull();
		expect(rule.changeFor(attack({ other: null }))).toBeNull();
	});

	it("tests its predicate with the attack's damage types", () => {
		const rule = makeRule({ predicate: new Predicate({ $and: ['attack:damageType:slashing'] }) });

		expect(rule.changeFor(attack({ damageTypes: ['slashing'] }))).not.toBeNull();
		expect(rule.changeFor(attack({ damageTypes: ['piercing'] }))).toBeNull();
		expect(rule.changeFor(attack())).toBeNull();
	});

	it('does not apply while its own predicate fails, or off a sheet', () => {
		expect(
			makeRule({ predicate: new Predicate({ $and: ['self:raging'] }) }).changeFor(attack()),
		).toBeNull();
		expect(makeRule({}, { isEmbedded: false }).changeFor(attack())).toBeNull();
	});

	it('does not apply with a charge pool the owner does not have', () => {
		expect(makeRule({ chargePoolIdentifier: 'touch' }).changeFor(attack())).toBeNull();
	});

	describe('as a Make It a Crit button, with Feature Effects off', () => {
		const roll = (itemUuid?: string) =>
			({ kind: 'attack', delivery: 'melee', ...(itemUuid ? { itemUuid } : {}) }) as const;

		it('is used by the one who attacks, or by the target for attacks against it', () => {
			const yours = makeRule({ forceCrit: 'always' });
			const against = makeRule({ forceCrit: 'always', side: 'attacksAgainstYou' });

			expect(yours.offersUseOn({ side: 'roller', roll: roll(), other: unhurt })).toBe(true);
			expect(yours.offersUseOn({ side: 'target', roll: roll(), other: unhurt })).toBe(false);
			expect(against.offersUseOn({ side: 'target', roll: roll(), other: unhurt })).toBe(true);
			expect(yours.offersUseOn({ side: 'ally', roll: roll(), other: unhurt })).toBe(false);
		});

		it("tests its predicate with the card's damage types", () => {
			const rule = makeRule({
				forceCrit: 'onHit',
				predicate: new Predicate({ attack: 'damageType:slashing' } as never),
			});
			const slashing = { ...roll(), damageTypes: ['slashing'] };
			expect(rule.offersUseOn({ side: 'roller', roll: slashing, other: unhurt })).toBe(true);
			expect(rule.offersUseOn({ side: 'roller', roll: roll(), other: unhurt })).toBe(false);
		});

		it('is not a button when it gives no crit', () => {
			const rule = makeRule({ cannotMiss: true, critRange: 1 });
			expect(rule.offersUseOn({ side: 'roller', roll: roll(), other: unhurt })).toBe(false);
		});

		it('is not a button on a check', () => {
			const rule = makeRule({ forceCrit: 'always' });
			expect(
				rule.offersUseOn({ side: 'roller', roll: { kind: 'save', key: 'will' }, other: null }),
			).toBe(false);
		});

		it('reads the item of the attack for an item-only rule', () => {
			const rule = makeRule({ anyDieCrits: true, thisItemOnly: true });
			expect(rule.offersUseOn({ side: 'roller', roll: roll(), other: unhurt })).toBe(false);
			expect(rule.offersUseOn({ side: 'roller', roll: roll(ITEM_UUID), other: unhurt })).toBe(true);
		});

		it('is used on any result for an "always" crit, else on a hit', () => {
			expect(makeRule({ forceCrit: 'always' }).outcome).toBe('always');
			expect(makeRule({ forceCrit: 'onHit' }).outcome).toBe('hit');
			expect(makeRule({ anyDieCrits: true }).outcome).toBe('hit');
		});

		it('needs a die at its max only when the crit comes from a die at its max', () => {
			expect(makeRule({ anyDieCrits: true }).critNeedsDieAtMax).toBe(true);
			expect(makeRule({ anyDieCrits: true, forceCrit: 'onHit' }).critNeedsDieAtMax).toBe(false);
		});

		it('costs one charge of its pool on your attacks, and nothing else', () => {
			expect(makeRule({ chargePoolIdentifier: ' touch ' }).rollUseCost).toEqual({
				chargePoolIdentifier: 'touch',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
			});
			expect(
				makeRule({ chargePoolIdentifier: 'touch', side: 'attacksAgainstYou' }).rollUseCost
					.chargePoolIdentifier,
			).toBe('');
		});
	});
});

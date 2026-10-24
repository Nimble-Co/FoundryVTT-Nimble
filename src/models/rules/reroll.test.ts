import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RerollRule } from './reroll.js';

type Toggles = Record<string, boolean>;

const gameGlobal = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

function setToggles(toggles: Toggles): void {
	gameGlobal.game.settings = { get: (_scope, key) => toggles[key] ?? true };
}

function makePoolItem(current: number) {
	return {
		id: 'pool-item',
		name: 'Pocket Sand',
		flags: { nimble: { chargePools: { sand: { current, max: 2 } } } },
		rules: new Map([
			[
				'pool-rule',
				{
					type: 'chargePool',
					disabled: false,
					id: 'sand',
					identifier: 'sand',
					scope: 'item',
					max: '2',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		update: vi.fn(async () => undefined),
	};
}

function makeRule(
	config: Record<string, unknown> = {},
	options: {
		isEmbedded?: boolean;
		predicate?: (domain: Set<string>) => boolean;
		pool?: number;
		mana?: number;
	} = {},
) {
	const poolItem = options.pool === undefined ? null : makePoolItem(options.pool);
	const actor = {
		uuid: 'Actor.hero',
		type: 'character',
		flags: {},
		system: { resources: { mana: { current: options.mana ?? 0, max: 5 } } },
		getDomain: () => new Set<string>(['self:raging']),
		getRollData: () => ({ combatDie: 8, level: 3 }),
		items: {
			contents: poolItem ? [poolItem] : [],
			get: (id: string) => (poolItem && id === poolItem.id ? poolItem : undefined),
		},
	};
	const item = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: 'Pocket Sand',
		uuid: 'Actor.hero.Item.sand',
		getDomain: () => new Set<string>(),
	};

	const rule = new RerollRule({ type: 'reroll' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		rolls: ['attack'],
		usedBy: 'target',
		outcome: 'always',
		attackDelivery: 'any',
		automatic: false,
		discardedCritTriggers: false,
		rollModeChange: 0,
		primaryDieBonus: 0,
		extraDamage: '',
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		oncePerRoll: false,
		disabled: false,
		id: 'rule-1',
		label: '',
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	const predicate = options.predicate;
	Object.defineProperty(rule, 'predicate', {
		get: () => (predicate ? { size: 1, test: predicate } : { size: 0 }),
		configurable: true,
	});
	return { rule, actor, item };
}

const TARGET_MELEE = { side: 'target', delivery: 'melee' } as const;

describe('RerollRule', () => {
	beforeEach(() => {
		setToggles({});
	});

	afterEach(() => {
		delete gameGlobal.game.settings;
	});

	describe('schema', () => {
		const schema = RerollRule.defineSchema() as unknown as Record<
			string,
			{
				initial?: unknown;
				choices?: Record<string, string>;
				min?: number;
				max?: number;
				integer?: boolean;
				element?: { choices?: Record<string, string> };
				options?: Record<string, unknown>;
				showWhen?: (data: Record<string, unknown>) => boolean;
			}
		>;

		it('defines every field with its default', () => {
			expect(schema.rolls?.initial).toEqual(['attack']);
			expect(schema.usedBy?.initial).toBe('roller');
			expect(schema.outcome?.initial).toBe('always');
			expect(schema.attackDelivery?.initial).toBe('any');
			expect(schema.automatic?.initial).toBe(false);
			expect(schema.discardedCritTriggers?.initial).toBe(false);
			expect(schema.rollModeChange?.initial).toBe(0);
			expect(schema.primaryDieBonus?.initial).toBe(0);
			expect(schema.extraDamage?.initial).toBe('');
			expect(schema.chargePoolIdentifier?.initial).toBe('');
			expect(schema.chargeCost?.initial).toBe(1);
			expect(schema.manaCost?.initial).toBe(0);
			expect(schema.woundCost?.initial).toBe(0);
			expect(schema.heroicReaction?.initial).toBe('');
			expect(schema.oncePerRoll?.initial).toBe(false);
			expect(schema.type?.initial).toBe('reroll');
		});

		it('keeps the base rule fields', () => {
			for (const field of ['disabled', 'id', 'identifier', 'label', 'predicate', 'priority']) {
				expect(schema).toHaveProperty(field);
			}
		});

		it('limits each choice field to its closed set', () => {
			expect(Object.keys(schema.usedBy?.choices ?? {})).toEqual(['roller', 'target']);
			expect(Object.keys(schema.outcome?.choices ?? {})).toEqual([
				'always',
				'hit',
				'criticalHit',
				'nonCriticalHit',
				'miss',
			]);
			expect(Object.keys(schema.attackDelivery?.choices ?? {})).toEqual(['any', 'melee', 'ranged']);
			expect(Object.keys(schema.heroicReaction?.choices ?? {})).toEqual([
				'',
				'defend',
				'interpose',
				'opportunityAttack',
				'help',
			]);
			expect(schema.outcome?.choices?.nonCriticalHit).toBe(
				'NIMBLE.rules.reroll.outcome.choices.nonCriticalHit',
			);
			expect(schema.heroicReaction?.choices?.['']).toBe(
				'NIMBLE.rules.reroll.heroicReaction.choices.none',
			);
		});

		it('bounds the numbers', () => {
			expect(schema.rollModeChange).toMatchObject({ min: -1, max: 1, integer: true });
			expect(schema.chargeCost).toMatchObject({ min: 1, integer: true });
			expect(schema.manaCost).toMatchObject({ min: 0, integer: true });
			expect(schema.woundCost).toMatchObject({ min: 0, integer: true });
		});

		it('shows charges per use only when a charge pool is named', () => {
			const showWhen = schema.chargeCost?.showWhen;
			expect(showWhen?.({ chargePoolIdentifier: 'sand' })).toBe(true);
			expect(showWhen?.({ chargePoolIdentifier: '  ' })).toBe(false);
			expect(showWhen?.({})).toBe(false);
		});

		it('asks about a discarded crit only when the first roll can be a crit', () => {
			const showWhen = schema.discardedCritTriggers?.showWhen;
			expect(showWhen?.({ outcome: 'criticalHit' })).toBe(true);
			expect(showWhen?.({ outcome: 'hit' })).toBe(true);
			expect(showWhen?.({ outcome: 'always' })).toBe(true);
			expect(showWhen?.({ outcome: 'nonCriticalHit' })).toBe(false);
			expect(showWhen?.({ outcome: 'miss' })).toBe(false);
		});

		it('labels every field for the rules builder', () => {
			for (const [name, field] of Object.entries(schema)) {
				if (
					[
						'disabled',
						'id',
						'identifier',
						'label',
						'predicate',
						'priority',
						'type',
						'suppressActivationCard',
					].includes(name)
				)
					continue;
				const options = (field.options ?? field) as { label?: string; hint?: string };
				expect(options.label, name).toBe(`NIMBLE.rules.reroll.${name}.label`);
				expect(options.hint, name).toBe(
					name === 'rolls' ? undefined : `NIMBLE.rules.reroll.${name}.hint`,
				);
			}
		});

		it('sits in the triggers group with a description', () => {
			expect(RerollRule.group).toBe('triggers');
			expect(RerollRule.description).toBe('NIMBLE.rules.reroll.description');
		});
	});

	describe('offersRerollOn', () => {
		it('offers to the side and delivery it names', () => {
			const { rule } = makeRule({ attackDelivery: 'melee' });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(true);
		});

		it('does not offer from an item that is not on an actor', () => {
			const { rule } = makeRule({}, { isEmbedded: false });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
		});

		it('does not offer while disabled', () => {
			const { rule } = makeRule({ disabled: true });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
		});

		it('offers only while the predicate passes', () => {
			const passing = makeRule({}, { predicate: (domain) => domain.has('self:raging') });
			const failing = makeRule({}, { predicate: (domain) => domain.has('self:dying') });
			expect(passing.rule.offersRerollOn(TARGET_MELEE)).toBe(true);
			expect(failing.rule.offersRerollOn(TARGET_MELEE)).toBe(false);
		});

		it('does not offer to the other side', () => {
			const { rule } = makeRule({ usedBy: 'roller' });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
			expect(rule.offersRerollOn({ side: 'roller', delivery: 'melee' })).toBe(true);
		});

		it('filters on how the attack is delivered', () => {
			const { rule } = makeRule({ attackDelivery: 'ranged' });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
			expect(rule.offersRerollOn({ side: 'target', delivery: 'ranged' })).toBe(true);
			expect(rule.offersRerollOn({ side: 'target', delivery: null })).toBe(false);
		});

		it('does not offer when attacks are not among its rolls', () => {
			const { rule } = makeRule({ rolls: [] });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
		});

		it('is hidden while its charge pool is empty, and shown with charges left', () => {
			expect(
				makeRule({ chargePoolIdentifier: 'sand' }, { pool: 0 }).rule.offersRerollOn(TARGET_MELEE),
			).toBe(false);
			expect(
				makeRule({ chargePoolIdentifier: 'sand' }, { pool: 1 }).rule.offersRerollOn(TARGET_MELEE),
			).toBe(true);
			expect(
				makeRule({ chargePoolIdentifier: 'sand', chargeCost: 2 }, { pool: 1 }).rule.offersRerollOn(
					TARGET_MELEE,
				),
			).toBe(false);
		});

		it('is hidden without the mana it costs', () => {
			expect(makeRule({ manaCost: 2 }, { mana: 1 }).rule.offersRerollOn(TARGET_MELEE)).toBe(false);
			expect(makeRule({ manaCost: 2 }, { mana: 2 }).rule.offersRerollOn(TARGET_MELEE)).toBe(true);
		});

		it('shows at zero charges while resource spending automation is off', () => {
			setToggles({ 'automation.resourceSpending': false });
			const { rule } = makeRule({ chargePoolIdentifier: 'sand', manaCost: 3 }, { pool: 0 });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(true);
		});

		it('lets two rules on one actor offer side by side', () => {
			const { rule: first, actor } = makeRule({ id: 'a' });
			const { rule: second } = makeRule({ id: 'b' });
			Object.defineProperty(second, 'item', {
				get: () => ({ ...first.item, actor }),
				configurable: true,
			});
			expect([first, second].filter((r) => r.offersRerollOn(TARGET_MELEE))).toHaveLength(2);
		});
	});

	describe('rerollCost', () => {
		it('collects the cost fields with safe numbers', () => {
			const { rule } = makeRule({
				chargePoolIdentifier: 'sand',
				chargeCost: 0,
				manaCost: -1,
				woundCost: 1,
				heroicReaction: 'defend',
			});
			expect(rule.rerollCost).toEqual({
				chargePoolIdentifier: 'sand',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 1,
				heroicReaction: 'defend',
			});
		});
	});

	describe('rerollChanges', () => {
		it('resolves the extra damage against the owner of the rule', () => {
			const replaceFormulaData = vi.fn((formula: string, data: Record<string, number>) =>
				formula.replace('@combatDie', String(data.combatDie)),
			);
			const rollGlobal = globalThis as unknown as { Roll: { replaceFormulaData?: unknown } };
			const previous = rollGlobal.Roll.replaceFormulaData;
			rollGlobal.Roll.replaceFormulaData = replaceFormulaData;
			try {
				const { rule } = makeRule({
					rollModeChange: -1,
					primaryDieBonus: 1,
					extraDamage: '1d@combatDie',
				});
				expect(rule.rerollChanges()).toEqual({
					rollModeChange: -1,
					primaryDieBonus: 1,
					extraDamage: '1d8',
				});
				expect(replaceFormulaData).toHaveBeenCalledWith(
					'1d@combatDie',
					{ combatDie: 8, level: 3 },
					{ missing: '0' },
				);
			} finally {
				rollGlobal.Roll.replaceFormulaData = previous;
			}
		});

		it('leaves the extra damage empty when none is set', () => {
			const { rule } = makeRule();
			expect(rule.rerollChanges()).toEqual({
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
			});
		});
	});
});

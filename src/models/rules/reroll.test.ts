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
		oncePerAttack: false,
		disabled: false,
		id: 'rule-1',
		label: '',
		saves: [],
		skills: [],
		abilities: [],
		range: 0,
		die: 'wholeRoll',
		keep: 'new',
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

const TARGET_MELEE = { side: 'target', roll: { kind: 'attack', delivery: 'melee' } } as const;

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
				element?: { choices?: Record<string, string> | (() => Record<string, string>) };
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
			expect(schema.oncePerAttack?.initial).toBe(false);
			expect(schema.saves?.initial).toEqual([]);
			expect(schema.skills?.initial).toEqual([]);
			expect(schema.abilities?.initial).toEqual([]);
			expect(schema.range?.initial).toBe(0);
			expect(schema.die?.initial).toBe('wholeRoll');
			expect(schema.keep?.initial).toBe('new');
			expect(schema.type?.initial).toBe('reroll');
		});

		it('keeps the base rule fields', () => {
			for (const field of ['disabled', 'id', 'identifier', 'label', 'predicate', 'priority']) {
				expect(schema).toHaveProperty(field);
			}
		});

		it('limits each choice field to its closed set', () => {
			expect(Object.keys(schema.usedBy?.choices ?? {})).toEqual(['roller', 'target', 'ally']);
			expect(Object.keys(schema.die?.choices ?? {})).toEqual([
				'wholeRoll',
				'primaryDie',
				'pickedDie',
			]);
			expect(Object.keys(schema.keep?.choices ?? {})).toEqual([
				'new',
				'rollerChooses',
				'ownerChooses',
			]);
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

		it('offers attacks, saves, skill checks and ability checks as rolls', () => {
			expect(schema.rolls?.element?.choices).toEqual({
				attack: 'NIMBLE.rules.reroll.rolls.choices.attack',
				save: 'NIMBLE.rules.reroll.rolls.choices.save',
				skillCheck: 'NIMBLE.rules.reroll.rolls.choices.skillCheck',
				abilityCheck: 'NIMBLE.rules.reroll.rolls.choices.abilityCheck',
			});
		});

		it.each([
			['saves', () => CONFIG.NIMBLE.savingThrows],
			['skills', () => CONFIG.NIMBLE.skills],
			['abilities', () => CONFIG.NIMBLE.abilityScores],
		] as const)('picks %s from the system keys', (name, keys) => {
			const choices = schema[name]?.element?.choices;
			const resolved = typeof choices === 'function' ? choices() : choices;
			expect(Object.keys(resolved ?? {})).toEqual(Object.keys(keys()));
		});

		it.each([
			['saves', 'save'],
			['skills', 'skillCheck'],
			['abilities', 'abilityCheck'],
		])('shows %s only when %s is among the rolls', (name, kind) => {
			const showWhen = schema[name]?.options?.showWhen as (
				data: Record<string, unknown>,
			) => boolean;
			expect(showWhen({ rolls: ['attack', kind] })).toBe(true);
			expect(showWhen({ rolls: ['attack'] })).toBe(false);
			expect(showWhen({})).toBe(false);
		});

		it.each(['outcome', 'attackDelivery', 'primaryDieBonus', 'extraDamage', 'oncePerAttack'])(
			'shows %s only when attack is among the rolls',
			(name) => {
				const showWhen = schema[name]?.options?.showWhen as (
					data: Record<string, unknown>,
				) => boolean;
				expect(showWhen({ rolls: ['save', 'attack'] })).toBe(true);
				expect(showWhen({ rolls: ['save'] })).toBe(false);
			},
		);

		it('bounds the numbers', () => {
			expect(schema.rollModeChange).toMatchObject({ min: -1, max: 1, integer: true });
			expect(schema.chargeCost).toMatchObject({ min: 1, integer: true });
			expect(schema.manaCost).toMatchObject({ min: 0, integer: true });
			expect(schema.woundCost).toMatchObject({ min: 0, integer: true });
			expect(schema.range).toMatchObject({ min: 0, integer: true });
		});

		it('asks for a range only for an ally', () => {
			const showWhen = schema.range?.showWhen;
			expect(showWhen?.({ usedBy: 'ally' })).toBe(true);
			expect(showWhen?.({ usedBy: 'roller' })).toBe(false);
			expect(showWhen?.({ usedBy: 'target' })).toBe(false);
		});

		it('offers Rerolls by itself only when nobody has a choice to make', () => {
			const showWhen = schema.automatic?.showWhen;
			const plain = { usedBy: 'target', die: 'wholeRoll', keep: 'new' };
			expect(showWhen?.(plain)).toBe(true);
			expect(showWhen?.({ ...plain, die: 'primaryDie' })).toBe(true);
			expect(showWhen?.({ ...plain, usedBy: 'ally' })).toBe(false);
			expect(showWhen?.({ ...plain, die: 'pickedDie' })).toBe(false);
			expect(showWhen?.({ ...plain, keep: 'rollerChooses' })).toBe(false);
			expect(showWhen?.({ ...plain, keep: 'ownerChooses' })).toBe(false);
		});

		it('shows charges per use only when a charge pool is named', () => {
			const showWhen = schema.chargeCost?.showWhen;
			expect(showWhen?.({ chargePoolIdentifier: 'sand' })).toBe(true);
			expect(showWhen?.({ chargePoolIdentifier: '  ' })).toBe(false);
			expect(showWhen?.({})).toBe(false);
		});

		it('asks about a discarded crit only when the first roll can be a crit', () => {
			const showWhen = schema.discardedCritTriggers?.showWhen;
			const attack = ['attack'];
			expect(showWhen?.({ rolls: attack, outcome: 'criticalHit' })).toBe(true);
			expect(showWhen?.({ rolls: attack, outcome: 'hit' })).toBe(true);
			expect(showWhen?.({ rolls: attack, outcome: 'always' })).toBe(true);
			expect(showWhen?.({ rolls: attack, outcome: 'nonCriticalHit' })).toBe(false);
			expect(showWhen?.({ rolls: attack, outcome: 'miss' })).toBe(false);
			expect(showWhen?.({ rolls: ['save'], outcome: 'always' })).toBe(false);
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
				const hint = ['saves', 'skills', 'abilities'].includes(name)
					? 'NIMBLE.rules.reroll.noneMeansAny'
					: `NIMBLE.rules.reroll.${name}.hint`;
				expect(options.hint, name).toBe(name === 'rolls' ? undefined : hint);
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
			expect(
				rule.offersRerollOn({ side: 'roller', roll: { kind: 'attack', delivery: 'melee' } }),
			).toBe(true);
		});

		it('filters on how the attack is delivered', () => {
			const { rule } = makeRule({ attackDelivery: 'ranged' });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
			expect(
				rule.offersRerollOn({ side: 'target', roll: { kind: 'attack', delivery: 'ranged' } }),
			).toBe(true);
			expect(
				rule.offersRerollOn({ side: 'target', roll: { kind: 'attack', delivery: null } }),
			).toBe(false);
		});

		it('does not offer when attacks are not among its rolls', () => {
			const { rule } = makeRule({ rolls: [] });
			expect(rule.offersRerollOn(TARGET_MELEE)).toBe(false);
		});

		it('does not offer on a check while only attacks are among its rolls', () => {
			const { rule } = makeRule({ usedBy: 'roller' });
			expect(rule.offersRerollOn({ side: 'roller', roll: { kind: 'save', key: 'will' } })).toBe(
				false,
			);
		});

		describe('on a check', () => {
			const save = (key: string) => ({
				side: 'roller' as const,
				roll: { kind: 'save', key } as const,
			});

			it('offers any save when no save is picked', () => {
				const { rule } = makeRule({ usedBy: 'roller', rolls: ['save'] });
				expect(rule.offersRerollOn(save('will'))).toBe(true);
				expect(rule.offersRerollOn(save('strength'))).toBe(true);
			});

			it.each([
				['save', 'saves', 'intelligence', 'will'],
				['skillCheck', 'skills', 'arcana', 'stealth'],
				['abilityCheck', 'abilities', 'dexterity', 'strength'],
			] as const)('offers a %s only on the %s picked', (kind, list, picked, other) => {
				const { rule } = makeRule({ usedBy: 'roller', rolls: [kind], [list]: [picked, 'lore'] });
				expect(rule.offersRerollOn({ side: 'roller', roll: { kind, key: picked } })).toBe(true);
				expect(rule.offersRerollOn({ side: 'roller', roll: { kind, key: other } })).toBe(false);
			});

			it('filters each check kind with its own list only', () => {
				const { rule } = makeRule({
					usedBy: 'roller',
					rolls: ['save', 'skillCheck'],
					skills: ['arcana'],
				});
				expect(rule.offersRerollOn(save('will'))).toBe(true);
			});

			it('does not offer a check kind that is not among its rolls', () => {
				const { rule } = makeRule({ usedBy: 'roller', rolls: ['attack', 'save'] });
				const skill = { side: 'roller', roll: { kind: 'skillCheck', key: 'arcana' } } as const;
				expect(rule.offersRerollOn(skill)).toBe(false);
			});

			it('offers a check to an ally', () => {
				const { rule } = makeRule({ usedBy: 'ally', rolls: ['save'] });
				expect(rule.offersRerollOn({ side: 'ally', roll: { kind: 'save', key: 'will' } })).toBe(
					true,
				);
			});

			it('never offers a check to the target side', () => {
				const { rule } = makeRule({ usedBy: 'target', rolls: ['save'] });
				expect(rule.offersRerollOn({ side: 'target', roll: { kind: 'save', key: 'will' } })).toBe(
					false,
				);
			});

			it('ignores the attack type on a check', () => {
				const { rule } = makeRule({ usedBy: 'roller', rolls: ['save'], attackDelivery: 'ranged' });
				expect(rule.offersRerollOn(save('dexterity'))).toBe(true);
			});

			it('does not offer on an attack when attack is not among its rolls', () => {
				const { rule } = makeRule({ usedBy: 'roller', rolls: ['save'] });
				const attack = { side: 'roller', roll: { kind: 'attack', delivery: 'melee' } } as const;
				expect(rule.offersRerollOn(attack)).toBe(false);
			});

			it('still needs the cost to be payable', () => {
				const { rule } = makeRule(
					{ usedBy: 'roller', rolls: ['save'], chargePoolIdentifier: 'sand' },
					{ pool: 0 },
				);
				expect(rule.offersRerollOn(save('will'))).toBe(false);
			});
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

	describe('rerollsByItself', () => {
		it('follows the automatic field when nobody has a choice to make', () => {
			expect(makeRule({ automatic: true }).rule.rerollsByItself).toBe(true);
			expect(makeRule({ automatic: false }).rule.rerollsByItself).toBe(false);
			expect(makeRule({ automatic: true, die: 'primaryDie' }).rule.rerollsByItself).toBe(true);
		});

		it('never rerolls by itself for an ally, a picked die or a choice of result', () => {
			expect(makeRule({ automatic: true, usedBy: 'ally' }).rule.rerollsByItself).toBe(false);
			expect(makeRule({ automatic: true, die: 'pickedDie' }).rule.rerollsByItself).toBe(false);
			expect(makeRule({ automatic: true, keep: 'rollerChooses' }).rule.rerollsByItself).toBe(false);
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
				expect(rule.rerollChanges('attack')).toEqual({
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

		it('drops the attack changes from a rule that rerolls no attack', () => {
			const { rule } = makeRule({
				rolls: ['save'],
				rollModeChange: 1,
				primaryDieBonus: 2,
				extraDamage: '1d6',
			});
			expect(rule.rerollChanges('attack')).toEqual({
				rollModeChange: 1,
				primaryDieBonus: 0,
				extraDamage: '',
			});
		});

		it('drops the attack changes when the roll is a check, also for a rule with Attack', () => {
			const { rule } = makeRule({
				rolls: ['attack', 'save'],
				rollModeChange: 1,
				primaryDieBonus: 2,
				extraDamage: '1d6',
			});
			expect(rule.rerollChanges('save')).toEqual({
				rollModeChange: 1,
				primaryDieBonus: 0,
				extraDamage: '',
			});
		});

		it('leaves the extra damage empty when none is set', () => {
			const { rule } = makeRule();
			expect(rule.rerollChanges('attack')).toEqual({
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
			});
		});
	});
});

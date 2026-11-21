import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let createState: typeof import('../spellUpcastDialogState.svelte.ts').createSpellUpcastDialogState;

const math = Math as unknown as { clamp?: (value: number, min: number, max: number) => number };
const ownClamp = math.clamp;

beforeAll(async () => {
	math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
	({ createSpellUpcastDialogState: createState } = await import(
		'../spellUpcastDialogState.svelte.ts'
	));
});

const gameGlobal = globalThis as unknown as {
	game: { settings?: unknown; user: { targets?: unknown } };
};
const realSettings = gameGlobal.game.settings;
const realTargets = gameGlobal.game.user.targets;

afterAll(() => {
	math.clamp = ownClamp;
});

afterEach(() => {
	gameGlobal.game.settings = realSettings;
	gameGlobal.game.user.targets = realTargets;
});

/** Automation toggles; any key not named reads as on. */
function settings(off: string[]) {
	gameGlobal.game.settings = {
		get: (_scope: string, key: string) => !off.includes(key),
	};
}

function caster({ mana = 3, unlocked = 3, rules = [] as object[], effects = [] as object[] } = {}) {
	return {
		type: 'character',
		uuid: 'Actor.mage',
		rules,
		items: [],
		effects,
		flags: {},
		getFlag: () => undefined,
		getRollData: () => ({}),
		system: { resources: { mana: { current: mana }, highestUnlockedSpellTier: unlocked } },
	};
}

function fireBolt(overrides: object = {}) {
	return {
		tier: 1,
		school: 'fire',
		scaling: { mode: 'upcast', deltas: [{ operation: 'addFlatDamage', value: 2 }] },
		activation: {
			effects: [{ id: 'd', type: 'damage', formula: '1d6', damageType: 'fire' }],
			targets: {},
		},
		properties: { selected: [] },
		parent: { name: 'Fire Bolt', rules: [] },
		...overrides,
	};
}

function open(
	actor: object = caster(),
	spell: object = fireBolt(),
	more: Partial<Parameters<typeof createState>[0]> = {},
) {
	gameGlobal.game.user.targets = new Set();
	return createState({
		actor: () => actor as never,
		spell: () => spell as never,
		hideRollsDefault: false,
		spellCost: { type: 'mana', amount: (spell as { tier: number }).tier },
		...more,
	});
}

describe('the upcast dialog tier buttons', () => {
	it('run from the spell tier up to the mana the caster has, and start on the spell tier', () => {
		const state = open(caster({ mana: 3, unlocked: 5 }));

		expect(state.canUpcast).toBe(true);
		expect(state.tiers.map((tier) => tier.tier)).toEqual([1, 2, 3]);
		expect(state.manaToSpend).toBe(1);
		expect(state.upcastSteps).toBe(0);
	});

	it('stop at the highest unlocked tier', () => {
		const state = open(caster({ mana: 9, unlocked: 2 }));

		expect(state.tiers.map((tier) => tier.tier)).toEqual([1, 2]);
	});

	it('with Resource Spending off, run to the highest unlocked tier and mark the tiers short of mana', () => {
		settings(['automation.resourceSpending']);

		const state = open(caster({ mana: 1, unlocked: 3 }));

		expect(state.tiers).toEqual([
			{ tier: 1, short: false },
			{ tier: 2, short: true },
			{ tier: 3, short: true },
		]);
	});

	it('are absent on a spell that does not scale', () => {
		const state = open(caster(), fireBolt({ scaling: { mode: 'none', deltas: [] } }));

		expect(state.canUpcast).toBe(false);
	});

	it('count the steps above the spell tier', () => {
		const state = open();

		state.manaToSpend = 3;

		expect(state.upcastSteps).toBe(2);
	});
});

describe('the upcast dialog spend line', () => {
	it('names the actions and the mana of the chosen tier', () => {
		const state = open(caster(), fireBolt(), { spendsActions: 1 });

		expect(state.spendLine).toBe('When you roll, it spends 1 action and 1 Mana.');

		state.manaToSpend = 3;

		expect(state.spendLine).toBe('When you roll, it spends 1 action and 3 Mana.');
	});

	it('keeps a class pool cost at every tier', () => {
		const state = open(caster(), fireBolt(), {
			spellCost: {
				type: 'pool',
				poolIdentifier: 'blood',
				poolLabel: 'Blood',
				amount: 2,
				overdraftConsequence: '',
				overdraftResolvedAtTable: false,
			} as never,
		});

		expect(state.spendLine).toBe('When you roll, it spends 2 Blood.');
		expect(state.canUpcast).toBe(false);
	});

	it('is empty when the cast spends nothing', () => {
		const state = open(caster(), fireBolt(), { spellCost: { type: 'none' } });

		expect(state.spendLine).toBe('');
	});
});

describe('the upcast dialog less mana tick', () => {
	const chaos = { type: 'tableRoll', table: 'chaos', when: 'lessManaOrCrit', invokesChaos: true };

	it('shows for a caster who can invoke Chaos, starts off, and goes in the cast', () => {
		const state = open(caster({ rules: [chaos] }));

		expect(state.offersLessMana).toBe(true);
		expect(state.lessMana).toBe(false);

		state.lessMana = true;

		expect(state.castData.lessMana).toBe(true);
	});

	it('does not show for a caster who cannot invoke Chaos', () => {
		expect(open().offersLessMana).toBe(false);
	});
});

describe('the upcast dialog Max Damage tick', () => {
	const maxDamage = {
		type: 'maxDamage',
		id: 'max',
		use: 'damage',
		parentDocument: { name: 'Overload', uuid: 'Actor.mage.Item.o' },
		tempHpChoice: false,
		chargePoolIdentifier: '',
		chargeCost: 0,
		canPay: true,
		covers: () => true,
	};

	it('offers the rule for a spell with damage dice, and starts with no tick', () => {
		const state = open(caster({ rules: [maxDamage] }));

		expect(state.maxDamageOffers.map((offer) => offer.key)).toEqual(['Actor.mage.Item.o:max']);
		expect(state.maxDamageChoice).toBeNull();
	});

	it('sends the chosen tick with the cast', () => {
		const state = open(caster({ rules: [maxDamage] }));
		const choice = { key: 'Actor.mage.Item.o:max', tempHp: false };

		state.maxDamageChoice = choice as never;

		expect(state.castData.maxDamage).toEqual(choice);
	});
});

const opening = {
	id: 'opening',
	name: 'Create an Opening',
	origin: null,
	system: {
		rules: [
			{
				id: 'opening-rule',
				type: 'heldRoll',
				heldKind: 'advantage',
				value: 1,
				whichRoll: 'holderAttacks',
				usedUp: true,
			},
		],
	},
	flags: {},
};
const kept = {
	...opening,
	id: 'kept',
	name: 'Rampage',
	system: {
		rules: [{ ...opening.system.rules[0], id: 'kept-rule', heldKind: 'wholeAmount', value: 13 }],
	},
};
const attackBolt = () =>
	fireBolt({
		activation: {
			effects: [
				{
					id: 'd',
					type: 'damage',
					formula: '1d6',
					damageType: 'fire',
					canCrit: true,
					canMiss: true,
				},
			],
			targets: {},
		},
	});

describe('the upcast dialog kept amount', () => {
	it('is ticked at the start and goes in the cast', () => {
		const state = open(caster({ effects: [kept] }), attackBolt());

		expect(state.keptAmount?.value).toBe(13);
		expect(state.usesKeptAmount).toBe(true);
		expect(state.keptInUse).toBe(true);
		expect(state.castData.keptAmount).toBe(true);
	});

	it('when unticked, the roll is back and the cast says so', () => {
		const state = open(caster({ effects: [kept] }), attackBolt());

		state.usesKeptAmount = false;

		expect(state.keptInUse).toBe(false);
		expect(state.castData.keptAmount).toBe(false);
	});

	it('is absent, and not in the cast, with no kept amount', () => {
		const state = open(caster(), attackBolt());

		expect(state.keptAmount).toBeNull();
		expect(state.keptInUse).toBe(false);
		expect(state.castData).not.toHaveProperty('keptAmount');
	});
});

describe('the upcast dialog Held Changes', () => {
	it('are read-only lines with Feature Effects on', () => {
		const state = open(caster({ effects: [opening] }), attackBolt());

		expect(state.heldLines.map((line) => line.key)).toEqual(['Actor.mage.opening.opening-rule']);
		expect(state.choosesHeldChanges).toBe(false);
		expect(state.castData).not.toHaveProperty('heldChosen');
	});

	it('with Feature Effects off, a ticked advantage moves the slider but goes in the cast apart', () => {
		settings(['automation.applyRuleEffects']);
		const state = open(caster({ effects: [opening, kept] }), attackBolt());

		expect(state.choosesHeldChanges).toBe(true);
		expect(state.usesKeptAmount).toBe(false);

		state.chosenHeldChanges = ['Actor.mage.opening.opening-rule'];

		expect(state.selectedRollMode).toBe(1);
		expect(state.castData.rollMode).toBe(0);
		expect(state.castData.heldChosen).toEqual(['Actor.mage.opening.opening-rule']);

		state.chosenHeldChanges = [];

		expect(state.selectedRollMode).toBe(0);
		expect(state.castData.heldChosen).toEqual([]);
	});
});

describe('the upcast dialog cast', () => {
	it('sends the roll fields and the chosen tier', () => {
		const state = open(caster(), fireBolt(), { initialRollMode: 1 });
		state.manaToSpend = 2;
		state.situationalModifiers = '2';
		state.shouldRollBeHidden = true;

		expect(state.castWarning).toBe('');
		expect(state.castData).toEqual({
			rollMode: 1,
			conditionRollModes: [],
			situationalModifiers: '2',
			primaryDieValue: undefined,
			primaryDieModifier: undefined,
			rollHidden: true,
			maxDamage: null,
			lessMana: false,
			upcast: { manaToSpend: 2, choiceIndex: undefined },
		});
	});

	it('sends the chosen enhancement of a spell with choices', () => {
		const state = open(
			caster(),
			fireBolt({
				scaling: {
					mode: 'upcastChoice',
					deltas: [],
					choices: [
						{ label: 'Hotter', deltas: [{ operation: 'addFlatDamage', value: 2 }] },
						{ label: 'Wider', deltas: [{ operation: 'addAreaSize', value: 1 }] },
					],
				},
			}),
		);

		state.manaToSpend = 2;
		state.choiceIndex = 1;

		expect(state.castData.upcast).toEqual({ manaToSpend: 2, choiceIndex: 1 });
	});

	it('sends no upcast for a spell that does not scale', () => {
		const state = open(caster(), fireBolt({ scaling: { mode: 'none', deltas: [] } }));

		expect(state.castData.upcast).toBeUndefined();
	});

	it('is refused with too little mana for the chosen tier', () => {
		settings(['automation.resourceSpending']);
		const state = open(caster({ mana: 1, unlocked: 3 }));
		state.manaToSpend = 3;

		// With Resource Spending off, the cast goes ahead.
		expect(state.castWarning).toBe('');

		gameGlobal.game.settings = realSettings;
		const enforced = open(caster({ mana: 1, unlocked: 3 }));
		enforced.manaToSpend = 3;

		expect(enforced.castWarning).toBe('Not enough mana. You have 1, but need 3.');
	});

	it('is refused above the highest unlocked tier', () => {
		settings(['automation.resourceSpending']);
		const state = open(caster({ mana: 9, unlocked: 2 }));
		state.manaToSpend = 3;

		expect(state.castWarning).toBe(
			'Cannot spend more mana than your highest unlocked spell tier (2).',
		);
	});
});

describe('the upcast dialog preview', () => {
	it('shows the added damage of the chosen tier', () => {
		const state = open();

		expect(state.upcastPreview).toEqual([]);

		state.manaToSpend = 3;

		expect(state.upcastPreview).toEqual(['+4 fire Damage']);
	});
});

function manaCost(source: string, amount: number, variable?: { min: number; max: number }) {
	return {
		kind: 'mana' as const,
		amount: variable ? variable.min : amount,
		spend: variable
			? { mode: 'variable' as const, min: String(variable.min), max: String(variable.max) }
			: { mode: 'fixed' as const },
		beyond: 'notAllowed' as const,
		source,
		id: source,
	};
}

function option(name: string, amount: number, more: object = {}) {
	return {
		key: `Item.${name}:option`,
		name,
		cost: manaCost(name, amount),
		poolIdentifier: 'spellshaper',
		actionCostChange: null,
		...more,
	};
}

const stretchTime = option('Stretch Time', 2, { actionCostChange: { delta: -1, minimum: 1 } });
const compression = option('Dimensional Compression', 1, {
	cost: manaCost('Dimensional Compression', 1, { min: 1, max: 8 }),
});

function spellshaper(used = false, options = [stretchTime, compression]) {
	return { key: 'spellshaper', label: 'Spellshaper (1/turn)', used, options };
}

describe('the upcast dialog Spell or Attack Options', () => {
	it('show options that share a pool as one dropdown named after the pool, with None chosen', () => {
		const state = open(caster(), fireBolt(), { useOptionGroups: [spellshaper()] });

		expect(state.optionGroups).toEqual([
			{
				key: 'spellshaper',
				label: 'Spellshaper (1/turn)',
				disabled: false,
				note: '',
				chosen: '',
				amount: null,
				entries: [
					{ key: '', label: 'None' },
					{ key: stretchTime.key, label: 'Stretch Time (2 mana)' },
					{ key: compression.key, label: 'Dimensional Compression (1+ mana)' },
				],
			},
		]);
		expect(state.castData.useOptions).toBeUndefined();
	});

	it('show a group whose pool has no use left as disabled, with "Used this turn"', () => {
		const state = open(caster(), fireBolt(), { useOptionGroups: [spellshaper(true)] });

		expect(state.optionGroups[0]).toMatchObject({ disabled: true, note: 'Used this turn' });
	});

	it('with Resource Spending off, never disable a group', () => {
		settings(['automation.resourceSpending']);
		const state = open(caster(), fireBolt(), { useOptionGroups: [spellshaper(true)] });

		expect(state.optionGroups[0]).toMatchObject({ disabled: false, note: '' });
	});

	it('put the chosen option in the cast', () => {
		const state = open(caster(), fireBolt(), { useOptionGroups: [spellshaper()] });

		state.chooseOption('spellshaper', stretchTime.key);

		expect(state.optionGroups[0].chosen).toBe(stretchTime.key);
		expect(state.castData.useOptions).toEqual([{ key: stretchTime.key }]);

		state.chooseOption('spellshaper', '');

		expect(state.castData.useOptions).toBeUndefined();
	});

	it('add the option mana to the spell mana in the spend line, and its action change', () => {
		const state = open(caster({ mana: 5 }), fireBolt(), {
			useOptionGroups: [spellshaper()],
			spendsActions: 2,
		});

		state.chooseOption('spellshaper', stretchTime.key);

		expect(state.spendLine).toBe('When you roll, it spends 1 action and 3 Mana.');
	});

	it('mark the tiers that the option mana leaves short, and refuse such a tier', () => {
		const state = open(caster({ mana: 3, unlocked: 3 }), fireBolt(), {
			useOptionGroups: [spellshaper()],
		});

		state.chooseOption('spellshaper', stretchTime.key);

		expect(state.tiers).toEqual([
			{ tier: 1, short: false },
			{ tier: 2, short: true },
			{ tier: 3, short: true },
		]);
		state.manaToSpend = 2;
		expect(state.castWarning).toBe('Not enough mana. You have 3, but need 4.');
	});

	it('ask for the amount of a variable option cost, up to its maximum and the mana left', () => {
		const state = open(caster({ mana: 5, unlocked: 3 }), fireBolt(), {
			useOptionGroups: [spellshaper()],
		});

		state.chooseOption('spellshaper', compression.key);

		expect(state.optionGroups[0].amount).toEqual({ kind: 'mana', minimum: 1, limit: 4, amount: 1 });
		state.setOptionAmount('spellshaper', 9);
		expect(state.optionGroups[0].amount?.amount).toBe(4);
		expect(state.castData.useOptions).toEqual([{ key: compression.key, amount: 4 }]);
		expect(state.spendLine).toBe('When you roll, it spends 5 Mana.');
	});
});

describe('the upcast dialog variable Spend or Sacrifice cost', () => {
	it('asks for the amount and sends it with the cast', () => {
		const cost = { ...manaCost('Frost Pact', 1, { min: 1, max: 3 }), kind: 'hp' as const };
		const state = open(
			{ ...caster(), system: { ...caster().system, attributes: { hp: { value: 20 } } } },
			fireBolt(),
			{ resourceCosts: [cost] },
		);

		expect(state.variableResourceCosts).toEqual([
			{ id: 'Frost Pact', kind: 'hp', minimum: 1, limit: 3, amount: 1 },
		]);
		state.setResourceAmount('Frost Pact', 2);

		expect(state.castData.resourceAmounts).toEqual({ 'Frost Pact': 2 });
		expect(state.spendLine).toBe('When you roll, it spends 1 Mana and you sacrifice 2 HP.');
	});
});

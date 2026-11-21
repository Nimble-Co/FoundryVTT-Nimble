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
		chargePoolIdentifier: 'spellshaper',
		actionCostChange: null,
		rangePerMana: 0,
		cardNote: '',
		damageTypes: [] as string[],
		manaChange: null,
		freeCopy: false,
		replacesSpellCost: false,
		manaSet: null,
		effect: null,
		used: false,
		...more,
	};
}

const stretchTime = option('Stretch Time', 2, { actionCostChange: { delta: -1, minimum: 1 } });
const compression = option('Dimensional Compression', 1, {
	cost: manaCost('Dimensional Compression', 1, { min: 1, max: 8 }),
	rangePerMana: 4,
});

function spellshaper(used = false, options = [stretchTime, compression]) {
	return {
		key: 'spellshaper',
		label: 'Spellshaper (1/turn)',
		used,
		refillsEachTurn: true,
		spend: false,
		options,
	};
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
				amountLabel: '',
				picks: [],
				pick: '',
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

	it('say "No uses left" for a used pool that does not refill each turn', () => {
		const group = {
			...spellshaper(true),
			label: 'Master of Storm (1/Safe Rest)',
			refillsEachTurn: false,
		};
		const state = open(caster(), fireBolt(), { useOptionGroups: [group] });

		expect(state.optionGroups[0]).toMatchObject({ disabled: true, note: 'No uses left' });
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

	it('show the damage types of a pick as buttons, and ask for one before the cast', () => {
		const transmutation = option('Elemental Transmutation', 1, {
			damageTypes: ['fire', 'radiant'],
		});
		const state = open(caster({ mana: 5 }), fireBolt(), {
			useOptionGroups: [spellshaper(false, [transmutation])],
		});

		state.chooseOption('spellshaper', transmutation.key);

		expect(state.optionGroups[0]).toMatchObject({
			amount: null,
			picks: [
				{ key: 'fire', label: 'Fire' },
				{ key: 'radiant', label: 'Radiant' },
			],
			pick: '',
		});
		expect(state.castWarning).toBe('Choose a damage type for Elemental Transmutation.');

		state.chooseOptionPick('spellshaper', 'radiant');

		expect(state.optionGroups[0].pick).toBe('radiant');
		expect(state.castWarning).toBe('');
		expect(state.castData.useOptions).toEqual([{ key: transmutation.key, damageType: 'radiant' }]);
		expect(state.spendLine).toBe('When you roll, it spends 2 Mana.');
	});

	it('take a mana cut off the spell mana in the spend line, down to its minimum', () => {
		const methodical = option('Methodical Spellweaver', 0, {
			actionCostChange: { delta: 1, minimum: 0 },
			manaChange: { delta: -2, minimum: 1 },
		});
		const state = open(caster({ mana: 5, unlocked: 3 }), fireBolt(), {
			useOptionGroups: [spellshaper(false, [methodical])],
			spendsActions: 1,
		});

		state.chooseOption('spellshaper', methodical.key);

		expect(state.spendLine).toBe('When you roll, it spends 2 actions and 1 Mana.');
		state.manaToSpend = 3;
		expect(state.spendLine).toBe('When you roll, it spends 2 actions and 1 Mana.');
	});

	it('work out a cost that reads the mana of the cast at the chosen tier', () => {
		const echo = option('Echo Casting', 0, {
			cost: { ...manaCost('Echo Casting', 0), amount: '2 * @castManaSpent' },
			freeCopy: true,
		});
		const state = open(caster({ mana: 8, unlocked: 3 }), fireBolt({ tier: 2 }), {
			useOptionGroups: [spellshaper(false, [echo])],
		});

		expect(state.optionGroups[0].entries[1].label).toBe('Echo Casting (4 mana)');

		state.chooseOption('spellshaper', echo.key);

		expect(state.spendLine).toBe('When you roll, it spends 6 Mana.');
		expect(state.tiers.map((tier) => tier.short)).toEqual([false, true]);

		state.manaToSpend = 3;

		expect(state.optionGroups[0].entries[1].label).toBe('Echo Casting (6 mana)');
		expect(state.spendLine).toBe('When you roll, it spends 9 Mana.');
		expect(state.castWarning).toBe('Not enough mana. You have 8, but need 9.');
	});

	it('work out a cost that reads the mana of the cast after the less mana tick', () => {
		const echo = option('Echo Casting', 0, {
			cost: { ...manaCost('Echo Casting', 0), amount: '2 * @castManaSpent' },
			freeCopy: true,
		});
		const state = open(caster({ mana: 8, unlocked: 3 }), fireBolt({ tier: 2 }), {
			useOptionGroups: [spellshaper(false, [echo])],
		});

		state.lessMana = true;
		state.chooseOption('spellshaper', echo.key);

		expect(state.optionGroups[0].entries[1].label).toBe('Echo Casting (2 mana)');
		expect(state.spendLine).toBe('When you roll, it spends 3 Mana.');
	});

	it('leave a short mana option that may go beyond to the confirm at the spend', () => {
		const surge = option('Surge', 4, {
			cost: { ...manaCost('Surge', 4), beyond: 'allowed' as const },
		});
		const state = open(caster({ mana: 3, unlocked: 3 }), fireBolt(), {
			useOptionGroups: [spellshaper(false, [surge])],
		});

		state.chooseOption('spellshaper', surge.key);

		expect(state.castWarning).toBe('');
	});

	it('name what the amount does in its label', () => {
		const state = open(caster({ mana: 5, unlocked: 3 }), fireBolt(), {
			useOptionGroups: [spellshaper()],
		});

		state.chooseOption('spellshaper', compression.key);

		expect(state.optionGroups[0].amountLabel).toBe('Mana (+4 range)');
		state.setOptionAmount('spellshaper', 2);
		expect(state.optionGroups[0].amountLabel).toBe('Mana (+8 range)');
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

function spendGroup(...options: ReturnType<typeof option>[]) {
	return { key: 'spend', label: 'Spend', used: false, spend: true, options };
}

const pilferedPower = {
	type: 'pool' as const,
	poolIdentifier: 'pilfered-power',
	poolLabel: 'Pilfered Power',
	amount: 1,
	overdraftConsequence: '' as const,
	overdraftResolvedAtTable: false,
};

const shadowfrost = option('Shadowfrost', 10, {
	cost: { ...manaCost('Shadowfrost', 10), kind: 'tempHp' as const },
	chargePoolIdentifier: '',
	replacesSpellCost: true,
});

const reprisal = option("Cryomancer's Reprisal", 14, {
	cost: { ...manaCost("Cryomancer's Reprisal", 14), kind: 'hp' as const },
	chargePoolIdentifier: '',
	replacesSpellCost: true,
});

describe('the upcast dialog Spend buttons', () => {
	it("show the spell's own cost first, then each different spend, with the spell's cost chosen", () => {
		const state = open(caster(), fireBolt(), {
			spellCost: pilferedPower,
			useOptionGroups: [spendGroup(shadowfrost)],
		});

		expect(state.spendChoice).toEqual({
			key: 'spend',
			label: 'Spend',
			chosen: '',
			amount: null,
			amountLabel: '',
			picks: [],
			pick: '',
			buttons: [
				{ key: '', label: '1 Pilfered Power', disabled: false },
				{ key: shadowfrost.key, label: '10 temp HP (Shadowfrost)', disabled: false },
			],
		});
		expect(state.optionGroups).toEqual([]);
		expect(state.spendLine).toBe('When you roll, it spends 1 Pilfered Power.');
	});

	it('give a chosen spend its amount and its damage type picks', () => {
		const surge = option('Surge', 1, {
			cost: { ...manaCost('Surge', 1, { min: 1, max: 3 }), kind: 'hp' as const },
			chargePoolIdentifier: '',
			replacesSpellCost: true,
			damageTypes: ['cold', 'fire'],
		});
		const state = open(
			{ ...caster(), system: { ...caster().system, attributes: { hp: { value: 20 } } } },
			fireBolt(),
			{ useOptionGroups: [spendGroup(surge)] },
		);

		state.chooseOption('spend', surge.key);

		expect(state.spendChoice?.amount).toMatchObject({ minimum: 1, limit: 3, amount: 1 });
		expect(state.spendChoice?.picks.map((pick) => pick.key)).toEqual(['cold', 'fire']);
	});

	it('keep the enhancement choice of a pinned cast with a different spend', () => {
		const state = open(
			caster(),
			fireBolt({
				scaling: {
					mode: 'upcastChoice',
					deltas: [],
					choices: [
						{ label: 'Hotter', deltas: [] },
						{ label: 'Wider', deltas: [] },
					],
				},
			}),
			{ spellCost: pilferedPower, pinnedCastTier: 3, useOptionGroups: [spendGroup(shadowfrost)] },
		);

		state.chooseOption('spend', shadowfrost.key);
		state.choiceIndex = 1;

		expect(state.canUpcast).toBe(true);
		expect(state.castData.upcast).toEqual({ manaToSpend: 3, choiceIndex: 1 });
	});

	it('change the spend line to the chosen spend and put it in the cast', () => {
		const state = open(caster(), fireBolt(), {
			spellCost: pilferedPower,
			useOptionGroups: [spendGroup(shadowfrost)],
		});

		state.chooseOption('spend', shadowfrost.key);

		expect(state.spendChoice?.chosen).toBe(shadowfrost.key);
		expect(state.spendLine).toBe('When you roll, it spends 10 temp HP.');
		expect(state.castData.useOptions).toEqual([{ key: shadowfrost.key }]);

		state.chooseOption('spend', '');

		expect(state.spendLine).toBe('When you roll, it spends 1 Pilfered Power.');
		expect(state.castData.useOptions).toBeUndefined();
	});

	it('name the mana of the chosen tier, and with an HP sacrifice cast at the spell tier', () => {
		const state = open(caster({ mana: 5, unlocked: 3 }), fireBolt({ tier: 2 }), {
			spendsActions: 1,
			useOptionGroups: [spendGroup(reprisal)],
		});

		state.manaToSpend = 3;

		expect(state.spendChoice?.buttons.map((button) => button.label)).toEqual([
			'3 mana',
			"14 HP (Cryomancer's Reprisal)",
		]);

		state.chooseOption('spend', reprisal.key);

		expect(state.spendLine).toBe('When you roll, it spends 1 action and you sacrifice 14 HP.');
		expect(state.canUpcast).toBe(false);
		expect(state.castData.upcast).toBeUndefined();
		expect(state.castWarning).toBe('');
	});

	it('mark a spend whose use is spent as off', () => {
		const state = open(caster(), fireBolt(), {
			spellCost: pilferedPower,
			useOptionGroups: [spendGroup({ ...shadowfrost, used: true })],
		});

		expect(state.spendChoice?.buttons[1].disabled).toBe(true);

		state.chooseOption('spend', shadowfrost.key);

		expect(state.castData.useOptions).toBeUndefined();
	});
});

describe('the upcast dialog option that sets the mana of the spell', () => {
	const storm = option('Master of Storm', 0, { chargePoolIdentifier: 'storm', manaSet: 0 });

	it('casts at the spell tier for that mana, with no tier buttons', () => {
		const state = open(caster({ mana: 9, unlocked: 5 }), fireBolt({ tier: 3 }), {
			spendsActions: 1,
			useOptionGroups: [
				{
					key: 'storm',
					label: 'Master of Storm (1/Safe Rest)',
					used: false,
					spend: false,
					options: [storm],
				},
			],
		});
		state.manaToSpend = 4;

		state.chooseOption('storm', storm.key);

		expect(state.canUpcast).toBe(false);
		expect(state.castData.upcast).toBeUndefined();
		expect(state.spendLine).toBe('When you roll, it spends 1 action.');
		expect(state.castWarning).toBe('');
	});
	it('keeps a set mana as it is when another option cuts the mana', () => {
		const set = option('Set Mana', 0, { chargePoolIdentifier: 'set', manaSet: 2 });
		const cut = option('Cut Mana', 0, {
			chargePoolIdentifier: 'cut',
			manaChange: { delta: -1, minimum: 0 },
		});
		const state = open(caster({ mana: 9, unlocked: 5 }), fireBolt({ tier: 3 }), {
			useOptionGroups: [
				{ key: 'set', label: 'Set', used: false, spend: false, options: [set] },
				{ key: 'cut', label: 'Cut', used: false, spend: false, options: [cut] },
			],
		});

		state.chooseOption('set', set.key);
		state.chooseOption('cut', cut.key);

		expect(state.spendLine).toBe('When you roll, it spends 2 Mana.');
	});
});

describe('the upcast dialog with a change to the mana cost', () => {
	it('lowers the mana of each tier, down to 0, and offers the tiers the lowered cost reaches', () => {
		const state = open(caster({ mana: 3, unlocked: 9 }), fireBolt({ tier: 3 }), {
			spendsActions: 1,
			manaCostChange: -5,
		});

		expect(state.tiers.map((tier) => tier.tier)).toEqual([3, 4, 5, 6, 7, 8]);
		expect(state.spendLine).toBe('When you roll, it spends 1 action.');

		state.manaToSpend = 7;

		expect(state.spendLine).toBe('When you roll, it spends 1 action and 2 Mana.');
		expect(state.castWarning).toBe('');
		expect(state.castData.upcast).toEqual({ manaToSpend: 7, choiceIndex: undefined });
	});

	it('for a use free of mana, spends only the mana above the spell tier', () => {
		const state = open(caster({ mana: 1, unlocked: 5 }), fireBolt({ tier: 2 }), {
			manaCostChange: -2,
		});

		expect(state.tiers).toEqual([
			{ tier: 2, short: false },
			{ tier: 3, short: false },
		]);

		state.manaToSpend = 3;

		expect(state.spendLine).toBe('When you roll, it spends 1 Mana.');
	});

	it('is refused when the lowered cost is still more than the caster has', () => {
		const state = open(caster({ mana: 1, unlocked: 5 }), fireBolt({ tier: 2 }), {
			manaCostChange: -2,
		});

		state.manaToSpend = 4;

		expect(state.castWarning).toBe('Not enough mana. You have 1, but need 2.');
	});
});

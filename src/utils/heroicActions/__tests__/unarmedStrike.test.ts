import {
	createHeroicCharacter,
	createHeroicCombatant,
	heroicGlobals,
	resetHeroicGlobals,
	setHeroicCombat,
	targetToken,
} from '../../../../tests/fixtures/heroicActions.js';

const damageRollMock = vi.fn();
const dialogMock = vi.fn();
const spendRuleChargeMock = vi.fn(async () => true);
const fireAttackEventsMock = vi.fn();

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let rollUnarmedStrike: typeof import('../unarmedStrike.ts').rollUnarmedStrike;
let strikeUnarmed: typeof import('../unarmedStrike.ts').strikeUnarmed;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../../../dice/DamageRoll.js', () => ({ DamageRoll: damageRollMock }));
	vi.doMock('../../../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
		default: dialogMock,
	}));
	vi.doMock('#utils/chargePool/ruleChargeGate.js', () => ({
		spendRuleCharge: spendRuleChargeMock,
	}));
	vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', () => ({ fireAttackEvents: fireAttackEventsMock }));
	vi.doMock('../../damage/attackUtils.js', () => ({
		getDamageBonusFormulas: () => ['1d4'],
		getDamageBonusTotal: () => 2,
		getUnarmedDamageFormula: () => '1',
		hasUnarmedProficiency: (actor: { proficient?: boolean }) => actor.proficient === true,
	}));
	({ rollUnarmedStrike, strikeUnarmed } = await import('../unarmedStrike.ts'));
});

function dialogResult(result: unknown) {
	dialogMock.mockImplementation(function dialog() {
		return { render: vi.fn(), promise: Promise.resolve(result) };
	});
}

const globals = globalThis as unknown as Record<string, unknown>;
let restore: () => void;
let savedFromUuidSync: unknown;

beforeEach(() => {
	restore = resetHeroicGlobals();
	savedFromUuidSync = globals.fromUuidSync;
	dialogMock.mockReset();
	fireAttackEventsMock.mockClear();
	damageRollMock.mockReset();
	damageRollMock.mockImplementation(function roll() {
		return { evaluate: vi.fn(), toJSON: () => ({}), isCritical: false, isMiss: false };
	});
});

afterEach(() => {
	globals.fromUuidSync = savedFromUuidSync;
	restore();
});

describe('rollUnarmedStrike', () => {
	it('posts the unarmed strike card with the damage bonuses', async () => {
		dialogResult({ rollMode: 0 });
		heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.goblin')]);
		const actor = createHeroicCharacter();

		expect(await rollUnarmedStrike(actor)).toBe(true);

		expect(dialogMock).toHaveBeenCalledWith(actor, expect.anything(), expect.any(String), {
			rollMode: 0,
			rushedAttack: undefined,
			spendsActions: 0,
		});
		expect(damageRollMock).toHaveBeenCalledWith(
			'1 + 2 + 1d4',
			{},
			expect.objectContaining({ rollMode: 0, damageType: 'bludgeoning', canMiss: true }),
		);
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'feature',
				system: expect.objectContaining({
					attackType: 'reach',
					rollMode: 0,
					targets: ['Scene.s.Token.goblin'],
				}),
			}),
		);
	});

	it('cannot crit or miss with two targets (Core:1403)', async () => {
		dialogResult({ rollMode: 0 });
		heroicGlobals().game.user.targets = new Set([
			targetToken('Scene.s.Token.goblin'),
			targetToken('Scene.s.Token.kobold'),
		]);

		await rollUnarmedStrike(createHeroicCharacter());

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ canCrit: false, canMiss: false, multiTarget: true }),
		);
	});

	it("reads the striker's Attack Outcome rules, and spends their charge after the card", async () => {
		dialogResult({ rollMode: 0 });
		heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.goblin')]);
		const actor = createHeroicCharacter();
		Object.assign(actor, {
			rules: [
				{
					type: 'attackOutcome',
					changeFor: () => ({
						label: 'Heads I Win',
						cannotMiss: true,
						critRange: 0,
						forcedCrit: null,
						anyDieCrits: false,
						chargePoolIdentifier: 'heads',
					}),
				},
			],
		});
		spendRuleChargeMock.mockClear();
		damageRollMock.mockImplementation(function roll() {
			return {
				evaluate: vi.fn(),
				toJSON: () => ({}),
				isCritical: false,
				isMiss: false,
				primaryDieValue: 1,
				options: {},
			};
		});

		await rollUnarmedStrike(actor);

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ canMiss: false, outcomeSources: { cannotMiss: ['Heads I Win'] } }),
		);
		expect(spendRuleChargeMock).toHaveBeenCalledWith(actor, 'heads');

		spendRuleChargeMock.mockClear();
		damageRollMock.mockImplementation(function roll() {
			return {
				evaluate: vi.fn(),
				toJSON: () => ({}),
				isCritical: false,
				isMiss: false,
				primaryDieValue: 3,
				options: {},
			};
		});

		await rollUnarmedStrike(actor);

		expect(spendRuleChargeMock).not.toHaveBeenCalled();
	});

	it('tells the Attack Outcome rules the strike deals bludgeoning damage', async () => {
		dialogResult({ rollMode: 0 });
		heroicGlobals().game.user.targets = new Set([targetToken('Scene.s.Token.goblin')]);
		const actor = createHeroicCharacter();
		const changeFor = vi.fn(() => null);
		Object.assign(actor, { rules: [{ type: 'attackOutcome', changeFor }] });

		await rollUnarmedStrike(actor);

		expect(changeFor).toHaveBeenCalledWith(
			expect.objectContaining({ damageTypes: ['bludgeoning'] }),
		);
	});

	it('takes out disadvantage with a Held Change that ignores it', async () => {
		dialogResult({ rollMode: -1 });
		const actor = createHeroicCharacter({ proficient: true });
		const deleteEmbeddedDocuments = vi.fn(async () => []);
		Object.assign(actor, {
			uuid: 'Actor.hero',
			deleteEmbeddedDocuments,
			effects: [
				{
					id: 'held',
					name: 'Nullify',
					origin: null,
					system: {
						rules: [
							{
								id: 'held-rule',
								type: 'heldRoll',
								heldKind: 'ignoreDisadvantage',
								whichRoll: 'holderAttacks',
								usedUp: true,
								value: 0,
							},
						],
					},
					flags: {},
				},
			],
		});
		globals.fromUuidSync = vi.fn(() => actor);

		await rollUnarmedStrike(actor);

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ rollMode: 0 }),
		);
		expect(deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['held']);
	});

	it('writes the recovery flags on its card, so a reroll can follow them', async () => {
		dialogResult({ rollMode: 0 });
		const update = vi.fn(async () => undefined);
		vi.mocked(ChatMessage.create).mockResolvedValueOnce({ update } as never);

		await rollUnarmedStrike(createHeroicCharacter());

		expect(update).toHaveBeenCalledWith({
			'flags.nimble.chargeRecoveryGiven': [],
			'flags.nimble.chargeRecoveryDomain': expect.arrayContaining(['attack:melee']),
		});
	});

	it('is a crit on a hit against a target in the Incapacitated group', async () => {
		dialogResult({ rollMode: 0 });
		const token = targetToken('Scene.s.Token.goblin') as unknown as { actor: object };
		Object.assign(token.actor, {
			statuses: new Set(['stunned']),
			getTargetDomain: () => new Set(['target:incapacitated']),
		});
		heroicGlobals().game.user.targets = new Set([token]);

		await rollUnarmedStrike(createHeroicCharacter({ proficient: true }));

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({
				forcedCrit: 'onHit',
				outcomeSources: { forcedCrit: ['target Stunned'] },
			}),
		);
	});

	it('starts the dialog at the given roll mode', async () => {
		dialogResult({});

		expect(await rollUnarmedStrike(createHeroicCharacter(), { rollMode: -1 })).toBe(true);

		expect(dialogMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.any(String),
			{ rollMode: -1, rushedAttack: undefined, spendsActions: 0 },
		);
		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ rollMode: -1 }),
		);
	});

	it('fires the attack event for the striker once', async () => {
		dialogResult({ rollMode: 0 });
		const actor = createHeroicCharacter();

		await rollUnarmedStrike(actor);

		expect(fireAttackEventsMock).toHaveBeenCalledTimes(1);
		expect(fireAttackEventsMock).toHaveBeenCalledWith(actor);
	});

	it('posts nothing when the dialog is cancelled', async () => {
		dialogResult(null);

		expect(await rollUnarmedStrike(createHeroicCharacter())).toBe(false);

		expect(damageRollMock).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
		expect(fireAttackEventsMock).not.toHaveBeenCalled();
	});
});

describe('strikeUnarmed', () => {
	it('rolls, then spends 1 action in a started combat, as activateItem does', async () => {
		dialogResult({});
		const actor = createHeroicCharacter();
		const combatant = createHeroicCombatant(actor, { currentActions: 2 });
		setHeroicCombat(combatant);

		await strikeUnarmed(actor);

		expect(ChatMessage.create).toHaveBeenCalled();
		expect(combatant.update).toHaveBeenCalledWith({ 'system.actions.base.current': 1 });
	});

	it('spends no action when the combat has not started', async () => {
		dialogResult({});
		const actor = createHeroicCharacter();
		const combatant = createHeroicCombatant(actor);
		setHeroicCombat(combatant, { started: false });

		await strikeUnarmed(actor);

		expect(ChatMessage.create).toHaveBeenCalled();
		expect(combatant.update).not.toHaveBeenCalled();
	});

	it('spends no action when the roll is cancelled', async () => {
		dialogResult(null);
		const actor = createHeroicCharacter();
		const combatant = createHeroicCombatant(actor);
		setHeroicCombat(combatant);

		await strikeUnarmed(actor);

		expect(combatant.update).not.toHaveBeenCalled();
	});
});

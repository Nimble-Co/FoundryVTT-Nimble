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

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let rollUnarmedStrike: typeof import('../unarmedStrike.ts').rollUnarmedStrike;
let strikeUnarmed: typeof import('../unarmedStrike.ts').strikeUnarmed;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../../../dice/DamageRoll.js', () => ({ DamageRoll: damageRollMock }));
	vi.doMock('../../../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
		default: dialogMock,
	}));
	vi.doMock('../../damage/attackUtils.js', () => ({
		getDamageBonusFormulas: () => ['1d4'],
		getDamageBonusTotal: () => 2,
		getUnarmedDamageFormula: () => '1',
		hasUnarmedProficiency: () => false,
	}));
	({ rollUnarmedStrike, strikeUnarmed } = await import('../unarmedStrike.ts'));
});

function dialogResult(result: unknown) {
	dialogMock.mockImplementation(function dialog() {
		return { render: vi.fn(), promise: Promise.resolve(result) };
	});
}

let restore: () => void;

beforeEach(() => {
	restore = resetHeroicGlobals();
	dialogMock.mockReset();
	damageRollMock.mockReset();
	damageRollMock.mockImplementation(function roll() {
		return { evaluate: vi.fn(), toJSON: () => ({}), isCritical: false, isMiss: false };
	});
});

afterEach(() => restore());

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

	it('posts nothing when the dialog is cancelled', async () => {
		dialogResult(null);

		expect(await rollUnarmedStrike(createHeroicCharacter())).toBe(false);

		expect(damageRollMock).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
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

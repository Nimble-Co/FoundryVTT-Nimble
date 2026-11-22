import { SYSTEM_ID } from '#system';
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
		hasRuleCharge: () => true,
		spendRuleCharge: spendRuleChargeMock,
	}));
	vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', () => ({
		fireAttackEvents: fireAttackEventsMock,
	}));
	vi.doMock('../../damage/attackUtils.js', () => ({
		getDamageBonusFormulas: () => ['1d4'],
		getDamageBonusParts: () => [{ label: 'Rage', itemUuid: 'Item.rage', amount: 2 }],
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

	it('marks the card of an opportunity attack', async () => {
		dialogResult({ rollMode: -1 });
		await rollUnarmedStrike(createHeroicCharacter(), { rollMode: -1, opportunityAttack: true });

		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({ flags: { [SYSTEM_ID]: { opportunityAttack: true } } }),
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

	it('shares one attack among targets it may have, with crit and miss as normal', async () => {
		dialogResult({ rollMode: 0 });
		heroicGlobals().game.user.targets = new Set([
			targetToken('Scene.s.Token.goblin'),
			targetToken('Scene.s.Token.kobold'),
		]);
		const actor = createHeroicCharacter();
		Object.assign(actor, { proficient: true });

		await rollUnarmedStrike(actor, { sharedTargets: 2 });

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ canCrit: true, canMiss: true, multiTarget: false }),
		);
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.objectContaining({
					activation: expect.objectContaining({
						targets: expect.objectContaining({ singleTargetAttack: true }),
					}),
					targets: ['Scene.s.Token.goblin', 'Scene.s.Token.kobold'],
				}),
			}),
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
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'Actor.hero' ? actor : null));

		await rollUnarmedStrike(actor);

		expect(damageRollMock).toHaveBeenCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ rollMode: 0 }),
		);
		expect(deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['held']);
	});

	it('uses only the held changes ticked in its window with Feature Effects off', async () => {
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
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'Actor.hero' ? actor : null));
		heroicGlobals().game.settings = {
			get: vi.fn((_scope: string, key: string) => key !== 'automation.applyRuleEffects'),
		};

		dialogResult({ rollMode: -1, heldChosen: [] });
		await rollUnarmedStrike(actor);
		expect(damageRollMock).toHaveBeenLastCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ rollMode: -1 }),
		);
		expect(deleteEmbeddedDocuments).not.toHaveBeenCalled();

		dialogResult({ rollMode: -1, heldChosen: ['Actor.hero.held.held-rule'] });
		await rollUnarmedStrike(actor);
		expect(damageRollMock).toHaveBeenLastCalledWith(
			expect.any(String),
			{},
			expect.objectContaining({ rollMode: 0 }),
		);
		expect(deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['held']);
	});

	it('puts the ended line of a held change it uses up on its card', async () => {
		dialogResult({ rollMode: -1 });
		const actor = createHeroicCharacter({ proficient: true });
		const held = {
			id: 'held',
			uuid: 'Actor.hero.ActiveEffect.held',
			name: 'Nullify',
			img: 'nullify.svg',
			origin: null,
			parent: actor,
			toObject: () => ({ _id: 'held', name: 'Nullify' }),
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
		};
		Object.assign(actor, {
			uuid: 'Actor.hero',
			name: 'Hero',
			deleteEmbeddedDocuments: vi.fn(async () => []),
			effects: [held],
		});
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid.includes('ActiveEffect') ? held : actor));
		const user = heroicGlobals().game.user as { isActiveGM?: boolean };
		const wasActiveGM = user.isActiveGM;
		user.isActiveGM = true;
		const update = vi.fn(async (_changes: Record<string, unknown>) => undefined);
		vi.mocked(ChatMessage.create).mockResolvedValueOnce({
			id: 'strike',
			flags: {},
			update,
		} as never);

		try {
			await rollUnarmedStrike(actor);
		} finally {
			user.isActiveGM = wasActiveGM;
		}

		const events = update.mock.calls
			.map(([changes]) => changes[`flags.${SYSTEM_ID}.events`])
			.find(Boolean) as Array<{ kind: string }> | undefined;
		expect(events).toEqual([expect.objectContaining({ kind: 'effectEnded' })]);
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

	describe('an opportunity attack', () => {
		function berserker() {
			const actor = createHeroicCharacter();
			Object.assign(actor, {
				rules: [
					{
						type: 'attackRollMode',
						changeFor: (_origin: string, attack: { opportunityAttack?: boolean } = {}) =>
							attack.opportunityAttack
								? { advantage: 1, ignoreDisadvantage: false, label: 'Frenzy' }
								: null,
					},
				],
			});
			return actor;
		}

		it('opens the window with the change of the rules for opportunity attacks', async () => {
			dialogResult({});

			await rollUnarmedStrike(berserker(), { rollMode: -1, opportunityAttack: true });

			expect(dialogMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.any(String),
				expect.objectContaining({ rollMode: 0 }),
			);
		});

		it('keeps the disadvantage of an attack that is not an opportunity attack', async () => {
			dialogResult({});

			await rollUnarmedStrike(berserker(), { rollMode: -1 });

			expect(dialogMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.any(String),
				expect.objectContaining({ rollMode: -1 }),
			);
		});

		it("puts the lines of the striker's allies for an ally's opportunity attack on its card", async () => {
			dialogResult({ rollMode: -1 });
			globals.fromUuidSync = vi.fn(() => null);
			const striker = createHeroicCharacter({ uuid: 'Actor.striker' });
			const hunter = createHeroicCharacter({
				id: 'hunter',
				uuid: 'Actor.hunter',
				items: [
					{
						uuid: 'Actor.hunter.Item.no-escape',
						name: 'No Escape',
						rules: new Map([
							[
								'r',
								{
									type: 'grantActivation',
									id: 'r',
									trigger: 'onAllyOpportunityAttack',
									spendsReaction: true,
									weaponKind: 'ranged',
									appliesTo: () => true,
								},
							],
						]),
					},
				],
			});
			const combat = setHeroicCombat(createHeroicCombatant(striker));
			combat.combatants = [
				{ id: 'a', token: { id: 't-striker', disposition: 1, actor: striker } },
				{ id: 'b', token: { id: 't-hunter', disposition: 1, actor: hunter } },
			] as never;

			await rollUnarmedStrike(striker, { rollMode: -1, opportunityAttack: true });

			const card = vi.mocked(ChatMessage.create).mock.calls[0]?.[0] as {
				system: { grantedActionOffers?: unknown[] };
			};
			expect(card.system.grantedActionOffers).toEqual([
				expect.objectContaining({ targetActorUuid: 'Actor.hunter', weaponKind: 'ranged' }),
			]);
		});

		it('says on its card that it is an opportunity attack', async () => {
			dialogResult({ rollMode: -1 });

			await rollUnarmedStrike(createHeroicCharacter(), { rollMode: -1, opportunityAttack: true });

			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({
					flags: { [SYSTEM_ID]: expect.objectContaining({ opportunityAttack: true }) },
				}),
			);
		});
	});

	describe('a strike that a feature gives', () => {
		function onOwnTurnAfterOneAttack(actor: ReturnType<typeof createHeroicCharacter>) {
			const combatant = createHeroicCombatant(actor);
			setHeroicCombat(combatant, {
				turn: 0,
				combatant: {
					actorId: actor.id,
					getFlag: () => ({ round: 1, turn: 0, count: 1 }),
					setFlag: vi.fn(async () => undefined),
				},
			});
		}

		it('takes Rushed Attack disadvantage as the second attack of the turn', async () => {
			dialogResult({});
			globals.fromUuidSync = vi.fn(() => null);
			const actor = createHeroicCharacter();
			onOwnTurnAfterOneAttack(actor);

			await rollUnarmedStrike(actor, { originUuid: 'Item.quickstrike' });

			expect(dialogMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.any(String),
				expect.objectContaining({ rollMode: -1, rushedAttack: 2 }),
			);
		});

		it('takes no Rushed Attack disadvantage when it ignores it', async () => {
			dialogResult({});
			const actor = createHeroicCharacter();
			onOwnTurnAfterOneAttack(actor);

			await rollUnarmedStrike(actor, { ignoresRushed: true });

			expect(dialogMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.any(String),
				expect.objectContaining({ rollMode: 0, rushedAttack: undefined }),
			);
		});

		it('says in its window that a free strike spends no action', async () => {
			dialogResult({});
			const actor = createHeroicCharacter();
			onOwnTurnAfterOneAttack(actor);

			await rollUnarmedStrike(actor, { free: true });

			expect(dialogMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.any(String),
				expect.objectContaining({ spendsActions: 0 }),
			);
		});

		it('records the feature as the origin, on the roll and on the card', async () => {
			dialogResult({ rollMode: 0 });
			globals.fromUuidSync = vi.fn((uuid: string) =>
				uuid === 'Item.quickstrike' ? { system: { identifier: 'quickstrike' } } : null,
			);

			await rollUnarmedStrike(createHeroicCharacter(), { originUuid: 'Item.quickstrike' });

			const origin = { uuid: 'Item.quickstrike', identifier: 'quickstrike' };
			expect(damageRollMock).toHaveBeenCalledWith(
				expect.any(String),
				{},
				expect.objectContaining({ origin }),
			);
			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({ flags: { [SYSTEM_ID]: { origin } } }),
			);
		});
		describe('the riders of attacks made through the feature', () => {
			function commander() {
				const actor = createHeroicCharacter();
				Object.assign(actor, {
					rules: [
						{
							type: 'offerAttackBonus',
							bonusFor: (origin: string) =>
								origin === 'rally' ? { label: 'Heavy Hand', damage: 3, primaryDie: 1 } : null,
						},
						{
							type: 'primaryDieBonus',
							label: 'Steady',
							parentDocument: { uuid: 'Item.steady' },
							bonusFor: ({ origin }: { origin?: string }) => (origin === 'rally' ? 1 : 0),
						},
						{
							type: 'attackRollMode',
							changeFor: (origin: string) =>
								origin === 'rally'
									? { advantage: 1, ignoreDisadvantage: true, label: 'Together' }
									: null,
						},
					],
				});
				globals.fromUuidSync = vi.fn((uuid: string) =>
					uuid === 'Item.rally' ? { system: { identifier: 'rally' } } : null,
				);
				return actor;
			}

			it('adds the damage and the Primary Die bonuses', async () => {
				dialogResult({ rollMode: 0 });

				await rollUnarmedStrike(commander(), { originUuid: 'Item.rally' });

				expect(damageRollMock).toHaveBeenCalledWith(
					'1 + 2 + 1d4 + 3',
					{},
					expect.objectContaining({ primaryDieModifier: 2 }),
				);
			});

			it('opens the window with the roll mode change, and the roll takes no disadvantage', async () => {
				dialogResult({ rollMode: -1 });
				const actor = commander();
				onOwnTurnAfterOneAttack(actor);

				await rollUnarmedStrike(actor, { originUuid: 'Item.rally' });

				expect(dialogMock).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.any(String),
					expect.objectContaining({
						rollMode: 1,
						rushedAttack: undefined,
						ignoreDisadvantage: true,
					}),
				);
				expect(damageRollMock).toHaveBeenCalledWith(
					expect.any(String),
					{},
					expect.objectContaining({ rollMode: 0 }),
				);
			});

			it('puts damage of its own type on the card as its own damage', async () => {
				dialogResult({ rollMode: 0 });
				const actor = commander();
				(actor.rules as unknown[]).push({
					type: 'offerAttackBonus',
					bonusFor: (origin: string) =>
						origin === 'rally'
							? { label: 'Dark Edge', damage: 6, primaryDie: 0, damageType: 'necrotic' }
							: null,
				});

				await rollUnarmedStrike(actor, { originUuid: 'Item.rally' });

				const card = vi.mocked(ChatMessage.create).mock.calls.at(-1)?.[0] as unknown as {
					system: {
						activation: { effects: Array<{ type: string; damageType: string; formula: string }> };
					};
				};
				const damage = card.system.activation.effects.filter((node) => node.type === 'damage');
				expect(damage.map((node) => [node.damageType, node.formula])).toEqual([
					['bludgeoning', '1 + 2 + 1d4 + 3'],
					['necrotic', '6'],
				]);
			});

			it('adds nothing to a strike made another way', async () => {
				dialogResult({ rollMode: 0 });

				await rollUnarmedStrike(commander());

				expect(damageRollMock).toHaveBeenCalledWith(
					'1 + 2 + 1d4',
					{},
					expect.objectContaining({ primaryDieModifier: 0 }),
				);
			});

			it("an ally's strike through the feature gets the owner's rules set to You and allies only", async () => {
				dialogResult({ rollMode: 0 });
				const rider = (originAttacker: string, damage: number, advantage: number) => [
					{
						type: 'offerAttackBonus',
						originAttacker,
						originScope: 'rally',
						bonusFor: (origin: string) =>
							origin === 'rally' ? { label: originAttacker, damage, primaryDie: 0 } : null,
					},
					{
						type: 'attackRollMode',
						originAttacker,
						originScope: 'rally',
						changeFor: (origin: string) =>
							origin === 'rally'
								? { advantage, ignoreDisadvantage: false, label: originAttacker }
								: null,
					},
				];
				const owner = {
					uuid: 'Actor.owner',
					rules: [...rider('anyone', 3, 1), ...rider('self', 7, 2)],
				};
				globals.fromUuidSync = vi.fn((uuid: string) =>
					uuid === 'Item.rally' ? { system: { identifier: 'rally' }, actor: owner } : null,
				);

				await rollUnarmedStrike(createHeroicCharacter(), { originUuid: 'Item.rally' });

				expect(dialogMock).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.any(String),
					expect.objectContaining({ rollMode: 1 }),
				);
				expect(damageRollMock).toHaveBeenCalledWith('1 + 2 + 1d4 + 3', {}, expect.anything());
			});
		});
	});

	it('fires the attack event for the striker once', async () => {
		dialogResult({ rollMode: 0 });
		const actor = createHeroicCharacter();

		await rollUnarmedStrike(actor);

		expect(fireAttackEventsMock).toHaveBeenCalledTimes(1);
		// The card of the strike hosts the lines of what the attack ends.
		expect(fireAttackEventsMock).toHaveBeenCalledWith(actor, { id: 'chat-message-id' });
	});

	it('does not end a Despair line itself: the attack event ends it', async () => {
		const despair = { key: 'self:despair', condition: 'despair', side: 'self', step: -1, on: true };
		dialogResult({ rollMode: -1, conditionRollModes: [{ ...despair, name: 'Kael' }] });
		const actor = Object.assign(createHeroicCharacter(), { toggleStatusEffect: vi.fn() });

		await rollUnarmedStrike(actor);

		expect(fireAttackEventsMock).toHaveBeenCalledWith(actor, { id: 'chat-message-id' });
		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
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

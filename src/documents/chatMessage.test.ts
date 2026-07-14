import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NimbleChatMessage } from './chatMessage.js';

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: {
		user: {
			isGM: boolean;
		};
	};
	ui: {
		notifications: {
			info: ReturnType<typeof vi.fn>;
			warn: ReturnType<typeof vi.fn>;
		};
	};
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createActivationMessage(targets: string[] = ['Scene.scene.Token.token']) {
	return new NimbleChatMessage({
		type: 'spell',
		system: {
			targets,
			isCritical: false,
			isMiss: false,
			activation: {
				effects: [],
			},
		},
	} as unknown as ChatMessage.CreateData);
}

function createSerializedDamageRoll(params: {
	diceResults: number[];
	flatBonus?: number;
	isCritical?: boolean;
	excludedPrimaryDieValue?: number;
}) {
	const flatBonus = params.flatBonus ?? 0;
	const diceTotal = params.diceResults.reduce((sum, result) => sum + result, 0);
	const total = diceTotal + flatBonus;

	const terms: Record<string, unknown>[] = [
		{
			number: params.diceResults.length || 1,
			faces: 6,
			results: params.diceResults.map((result) => ({
				result,
				active: true,
				discarded: false,
			})),
		},
	];

	if (flatBonus !== 0) {
		terms.push({ operator: flatBonus < 0 ? '-' : '+' });
		terms.push({ number: Math.abs(flatBonus) });
	}

	const flatBonusFormulaSegment =
		flatBonus === 0 ? '' : ` ${flatBonus < 0 ? '-' : '+'} ${Math.abs(flatBonus)}`;

	return {
		class: 'DamageRoll',
		formula: `${params.diceResults.length || 1}d6${flatBonusFormulaSegment}`,
		total,
		isCritical: params.isCritical ?? false,
		excludedPrimaryDieValue: params.excludedPrimaryDieValue ?? 0,
		terms,
	};
}

describe('NimbleChatMessage.applyHealing', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
	});

	it('applies healing to target actor', async () => {
		const actor = {
			applyHealing: vi.fn().mockResolvedValue(undefined),
			system: { attributes: { hp: { value: 5, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

		const message = createActivationMessage();
		await message.applyHealing(5, 'healing');

		expect(actor.applyHealing).toHaveBeenCalledWith(5, 'healing');
	});

	it('applies temporary healing correctly', async () => {
		const actor = {
			applyHealing: vi.fn().mockResolvedValue(undefined),
			system: { attributes: { hp: { value: 10, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

		const message = createActivationMessage();
		await message.applyHealing(10, 'temporaryHealing');

		expect(actor.applyHealing).toHaveBeenCalledWith(10, 'temporaryHealing');
	});

	it('warns when there are no targets', async () => {
		const message = createActivationMessage([]);
		await message.applyHealing(5, 'healing');

		expect(globals().fromUuidSync).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith('No targets selected');
	});

	it('skips targets when the uuid does not resolve to an actor', async () => {
		globals().fromUuidSync.mockReturnValue(null);

		const message = createActivationMessage();
		await message.applyHealing(5, 'healing');

		expect(globals().fromUuidSync).toHaveBeenCalled();
	});

	it('does not apply healing when value is zero or negative', async () => {
		const actor = {
			applyHealing: vi.fn().mockResolvedValue(undefined),
			system: { attributes: { hp: { value: 5, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

		const message = createActivationMessage();
		await message.applyHealing(0, 'healing');

		expect(actor.applyHealing).not.toHaveBeenCalled();
	});

	it('tracks healing applied state when effectId is provided', async () => {
		const actor = {
			applyHealing: vi.fn().mockResolvedValue(undefined),
			system: { attributes: { hp: { value: 5, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

		const message = createActivationMessage();
		message.update = vi.fn().mockResolvedValue(undefined);

		await message.applyHealing(5, 'healing', 'effect-123');

		expect(message.update).toHaveBeenCalled();
	});

	it('prevents double application when effectId is already applied', async () => {
		const actor = {
			applyHealing: vi.fn().mockResolvedValue(undefined),
			system: { attributes: { hp: { value: 5, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

		const message = new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: ['Scene.scene.Token.token'],
				isCritical: false,
				isMiss: false,
				activation: { effects: [] },
				appliedHealing: {
					'effect-123': {
						effectId: 'effect-123',
						healingType: 'healing',
						amount: 5,
						targets: [],
						appliedAt: Date.now(),
					},
				},
			},
		} as unknown as ChatMessage.CreateData);

		await message.applyHealing(5, 'healing', 'effect-123');

		expect(actor.applyHealing).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			'Healing has already been applied',
		);
	});
});

describe('NimbleChatMessage.isHealingApplied', () => {
	it('returns true when healing has been applied for effectId', () => {
		const message = new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: [],
				isCritical: false,
				isMiss: false,
				activation: { effects: [] },
				appliedHealing: {
					'effect-123': {
						effectId: 'effect-123',
						healingType: 'healing',
						amount: 5,
						targets: [],
						appliedAt: Date.now(),
					},
				},
			},
		} as unknown as ChatMessage.CreateData);

		expect(message.isHealingApplied('effect-123')).toBe(true);
	});

	it('returns false when healing has not been applied for effectId', () => {
		const message = createActivationMessage();
		expect(message.isHealingApplied('effect-123')).toBe(false);
	});
});

describe('NimbleChatMessage.undoHealing', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
	});

	it('reverts HP and removes healing record', async () => {
		const actor = {
			setCurrentHP: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: ['Scene.scene.Token.token'],
				isCritical: false,
				isMiss: false,
				activation: { effects: [] },
				appliedHealing: {
					'effect-123': {
						effectId: 'effect-123',
						healingType: 'healing',
						amount: 5,
						targets: [
							{
								uuid: 'Scene.scene.Token.token',
								tokenName: 'Test Token',
								previousHp: 5,
								previousTempHp: 0,
								newHp: 10,
								newTempHp: 0,
							},
						],
						appliedAt: Date.now(),
					},
				},
			},
		} as unknown as ChatMessage.CreateData);

		message.update = vi.fn().mockResolvedValue(undefined);

		await message.undoHealing('effect-123');

		expect(actor.setCurrentHP).toHaveBeenCalledWith(5);
		expect(message.update).toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('Healing has been undone');
	});

	it('uses actor hp setter methods when undoing healing', async () => {
		const actor = {
			setCurrentHP: vi.fn().mockResolvedValue(undefined),
			setTempHP: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: ['Scene.scene.Token.token'],
				isCritical: false,
				isMiss: false,
				activation: { effects: [] },
				appliedHealing: {
					'effect-123': {
						effectId: 'effect-123',
						healingType: 'healing',
						amount: 5,
						targets: [
							{
								uuid: 'Scene.scene.Token.token',
								tokenName: 'Test Token',
								previousHp: 5,
								previousTempHp: 0,
								newHp: 10,
								newTempHp: 0,
							},
						],
						appliedAt: Date.now(),
					},
				},
			},
		} as unknown as ChatMessage.CreateData);

		message.update = vi.fn().mockResolvedValue(undefined);

		await message.undoHealing('effect-123');

		expect(actor.setCurrentHP).toHaveBeenCalledWith(5);
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('warns when no healing record found', async () => {
		const message = createActivationMessage();

		await message.undoHealing('nonexistent-effect');

		expect(globals().ui.notifications.warn).toHaveBeenCalledWith('No healing record found to undo');
	});
});

describe('NimbleChatMessage.applyDamage', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
	});

	it('applies damage to target actor and consumes temporary hit points first', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					hp: {
						value: 10,
						temp: 3,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(5, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('delegates damage application to actor.applyDamage when available', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					hp: {
						value: 10,
						temp: 2,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(4, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(4);
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not apply damage when outcome is noDamage', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					hp: {
						value: 10,
						temp: 2,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(4, { outcome: 'noDamage' });

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('No damage to apply.');
	});

	it('shows no-damage feedback when total damage is 0 or negative', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					hp: {
						value: 10,
						temp: 2,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(0, { outcome: 'fullDamage' });
		await message.applyDamage(-4, { outcome: 'fullDamage' });

		expect(globals().fromUuidSync).not.toHaveBeenCalled();
		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('No damage to apply.');
	});

	it('warns when there are no targets', async () => {
		const message = createActivationMessage([]);
		await message.applyDamage(4, { outcome: 'fullDamage' });

		expect(globals().fromUuidSync).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith('No targets selected');
	});

	it('does not apply damage when the current user is not a GM', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					hp: {
						value: 10,
						temp: 2,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().game.user.isGM = false;
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(4, { outcome: 'fullDamage' });

		expect(actor.applyDamage).not.toHaveBeenCalled();
	});

	it('applies medium armor by using dice-only damage on non-critical hits', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [6],
			flatBonus: 2,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(6);
	});

	it('applies medium armor with halfDamage outcome using halved dice-only damage', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(5, { outcome: 'halfDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('applies negative modifiers after medium armor dice-only calculation', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [4],
			flatBonus: -1,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(3, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('applies all negative modifiers and ignores positive modifiers for medium armor', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = {
			class: 'DamageRoll',
			formula: '1d6 + 2 - 1 - 2',
			total: 5,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{
					number: 1,
					faces: 6,
					results: [{ result: 6, active: true, discarded: false }],
				},
				{ operator: '+' },
				{ number: 2 },
				{ operator: '-' },
				{ number: 1 },
				{ operator: '-' },
				{ number: 2 },
			],
		};

		const message = createActivationMessage();
		await message.applyDamage(5, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('counts banked dice-pool bonuses (Fury Dice) as dice, not modifiers, for medium armor', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 50,
						temp: 0,
						max: 50,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		// Battleaxe hit: 1d10 (rolled 5) + 5 + 10[Fury Dice] + 4[Fury Dice] + 18 = 42.
		// Medium armor keeps the dice (d10 5 + Fury 10 + Fury 4 = 19) and drops the
		// flat +5 / +18 modifiers.
		const roll = {
			class: 'DamageRoll',
			formula: '1d10 + 5 + 10 + 4 + 18',
			total: 42,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{ number: 1, faces: 10, results: [{ result: 5, active: true, discarded: false }] },
				{ operator: '+' },
				{ number: 5 },
				{ operator: '+' },
				{ number: 10, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 4, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 18 },
			],
		};

		const message = createActivationMessage();
		await message.applyDamage(42, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(19);
	});

	it('halves banked dice-pool bonuses (Fury Dice) with the dice for heavy armor', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 50,
						temp: 0,
						max: 50,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		// Same Battleaxe hit against a heavy-armor target: dice total 19 is halved
		// (Math.ceil(19 * 0.5) = 10); the flat +5 / +18 modifiers are ignored.
		const roll = {
			class: 'DamageRoll',
			formula: '1d10 + 5 + 10 + 4 + 18',
			total: 42,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{ number: 1, faces: 10, results: [{ result: 5, active: true, discarded: false }] },
				{ operator: '+' },
				{ number: 5 },
				{ operator: '+' },
				{ number: 10, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 4, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 18 },
			],
		};

		const message = createActivationMessage();
		await message.applyDamage(42, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('counts other banked dice pools (e.g. Oathsworn Judgment Dice) as dice for armor', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 50,
						temp: 0,
						max: 50,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		// Manually-spent Judgment Dice arrive on the roll the same way Fury Dice do
		// (flavored numeric terms). 1d8 (6) + 3[Judgment Dice] + 5[Judgment Dice] + 4
		// against medium armor keeps the dice (6 + 3 + 5 = 14), drops the flat +4.
		const roll = {
			class: 'DamageRoll',
			formula: '1d8 + 3 + 5 + 4',
			total: 18,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{ number: 1, faces: 8, results: [{ result: 6, active: true, discarded: false }] },
				{ operator: '+' },
				{ number: 3, options: { flavor: 'Judgment Dice' } },
				{ operator: '+' },
				{ number: 5, options: { flavor: 'Judgment Dice' } },
				{ operator: '+' },
				{ number: 4 },
			],
		};

		const message = createActivationMessage();
		await message.applyDamage(18, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(14);
	});

	it('applies heavy armor by halving dice-only damage and rounding up on non-critical hits', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('includes situational dice modifiers (e.g. +2d8) in heavy armor dice-only reduction', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = {
			class: 'DamageRoll',
			formula: '1d6 + 2d8 + 3',
			total: 17,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{
					number: 1,
					faces: 6,
					results: [{ result: 4, active: true, discarded: false }],
				},
				{ operator: '+' },
				{
					number: 2,
					faces: 8,
					results: [
						{ result: 5, active: true, discarded: false },
						{ result: 5, active: true, discarded: false },
					],
				},
				{ operator: '+' },
				{ number: 3 },
			],
		};

		const message = createActivationMessage();
		await message.applyDamage(17, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(7);
	});

	it('applies negative modifiers after heavy armor reduction', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [4],
			flatBonus: -1,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(3, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(1);
	});

	it('applies heavy armor fallback reduction when no roll metadata is provided', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(9, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('shows no-damage feedback when all targets are reduced to 0 damage by armor', async () => {
		const ironGuard = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};
		const stoneSentinel = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === 'Scene.scene.Token.alpha') return { actor: ironGuard, name: 'Iron Guard' };
			if (uuid === 'Scene.scene.Token.beta')
				return { actor: stoneSentinel, name: 'Stone Sentinel' };
			return null;
		});

		const roll = createSerializedDamageRoll({
			diceResults: [2],
			flatBonus: -1,
			isCritical: false,
		});

		const message = createActivationMessage(['Scene.scene.Token.alpha', 'Scene.scene.Token.beta']);
		await message.applyDamage(1, { outcome: 'fullDamage', roll });

		expect(ironGuard.applyDamage).not.toHaveBeenCalled();
		expect(stoneSentinel.applyDamage).not.toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('No damage to apply.');
	});

	it('notifies the GM when a target is skipped because adjusted damage is 0', async () => {
		const ironGuard = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};
		const scout = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === 'Scene.scene.Token.alpha') return { actor: ironGuard, name: 'Iron Guard' };
			if (uuid === 'Scene.scene.Token.beta') return { actor: scout, name: 'Scout' };
			return null;
		});

		const roll = createSerializedDamageRoll({
			diceResults: [2],
			flatBonus: -1,
			isCritical: false,
		});

		const message = createActivationMessage(['Scene.scene.Token.alpha', 'Scene.scene.Token.beta']);
		await message.applyDamage(1, { outcome: 'fullDamage', roll });

		expect(ironGuard.applyDamage).not.toHaveBeenCalled();
		expect(scout.applyDamage).toHaveBeenCalledWith(1);
		expect(globals().ui.notifications.info).toHaveBeenCalledWith(
			'Ignored Iron Guard because the result is 0.',
		);
	});

	it('stacks heavy armor reduction with halfDamage outcome', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(5, { outcome: 'halfDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(2);
	});

	it('applies full damage to armored targets on critical hits', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: true,
		});

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('applies halfDamage to critical hits but still ignores armor reduction', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: true,
		});

		const message = createActivationMessage();
		await message.applyDamage(5, { outcome: 'halfDamage', roll });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('bypasses armor rules when ignoreArmor is enabled', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 10,
						temp: 0,
						max: 10,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({
			diceResults: [5],
			flatBonus: 5,
			isCritical: false,
		});

		const message = createActivationMessage();
		await message.applyDamage(10, {
			outcome: 'fullDamage',
			roll,
			ignoreArmor: true,
		});

		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('applies armor reduction per roll when only some grouped rolls are critical', async () => {
		const actor = {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'heavy',
					hp: {
						value: 20,
						temp: 0,
						max: 20,
					},
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		};

		globals().fromUuidSync.mockReturnValue({ actor });

		const nonCriticalRoll = createSerializedDamageRoll({
			diceResults: [4],
			flatBonus: 2,
			isCritical: false,
		});
		const criticalRoll = createSerializedDamageRoll({
			diceResults: [6],
			flatBonus: 3,
			isCritical: true,
		});

		const message = createActivationMessage();
		await message.applyDamage(15, {
			outcome: 'fullDamage',
			rolls: [nonCriticalRoll, criticalRoll],
		});

		expect(actor.applyDamage).toHaveBeenCalledWith(11);
	});
});

describe('NimbleChatMessage.getDamagePreviewForTarget', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
	});

	// Battleaxe hit: 1d10 (rolled 5) + 5 + 10[Fury Dice] + 4[Fury Dice] + 18 = 42.
	function battleaxeRoll() {
		return {
			class: 'DamageRoll',
			formula: '1d10 + 5 + 10 + 4 + 18',
			total: 42,
			isCritical: false,
			excludedPrimaryDieValue: 0,
			terms: [
				{ number: 1, faces: 10, results: [{ result: 5, active: true, discarded: false }] },
				{ operator: '+' },
				{ number: 5 },
				{ operator: '+' },
				{ number: 10, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 4, options: { flavor: 'Fury Dice' } },
				{ operator: '+' },
				{ number: 18 },
			],
		};
	}

	// Mirrors the effects tree shape produced by the attack flow: a base damage
	// node whose on-hit outcome node inherits its roll (see processNodes).
	function createDamageMessage(params: {
		roll: object;
		isMiss?: boolean;
		ignoreArmor?: boolean;
		targets?: string[];
	}) {
		return new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: params.targets ?? ['Scene.scene.Token.token'],
				isCritical: false,
				isMiss: params.isMiss ?? false,
				activation: {
					effects: [
						{
							id: 'dmg',
							type: 'damage',
							formula: '1d10',
							damageType: 'slashing',
							ignoreArmor: params.ignoreArmor ?? false,
							canCrit: true,
							canMiss: true,
							roll: params.roll,
							parentNode: null,
							parentContext: null,
							on: {
								hit: [
									{ id: 'dmg-hit', type: 'damageOutcome', parentNode: 'dmg', parentContext: 'hit' },
								],
							},
						},
					],
				},
			},
		} as unknown as ChatMessage.CreateData);
	}

	it('returns the full displayed total for an unarmored target', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'none' } } },
		});

		const message = createDamageMessage({ roll: battleaxeRoll() });

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(42);
	});

	it('returns the armor-reduced total for a heavy-armor target (Fury Dice count as dice)', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'heavy' } } },
		});

		const message = createDamageMessage({ roll: battleaxeRoll() });

		// Dice = d10 5 + Fury 10 + 4 = 19; heavy halves to ceil(9.5) = 10; +5/+18 dropped.
		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(10);
	});

	it('ignores armor for the preview when the damage ignores armor', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'heavy' } } },
		});

		const message = createDamageMessage({ roll: battleaxeRoll(), ignoreArmor: true });

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(42);
	});

	it('returns null for a miss so the target list shows no preview', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'none' } } },
		});

		const message = createDamageMessage({ roll: battleaxeRoll(), isMiss: true });

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBeNull();
	});

	it('counts a disposition-targeted damage node once when its outcome child is also surfaced', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'none' } } },
		});

		const message = new NimbleChatMessage({
			type: 'spell',
			system: {
				targets: ['Scene.scene.Token.token'],
				isCritical: false,
				isMiss: false,
				activation: {
					effects: [
						{
							id: 'dmg',
							type: 'damage',
							formula: '1d10',
							damageType: 'slashing',
							targetDisposition: 'hostile',
							canCrit: true,
							canMiss: true,
							roll: battleaxeRoll(),
							parentNode: null,
							parentContext: null,
							on: {
								hit: [
									{ id: 'dmg-hit', type: 'damageOutcome', parentNode: 'dmg', parentContext: 'hit' },
								],
							},
						},
					],
				},
			},
		} as unknown as ChatMessage.CreateData);

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(42);
	});

	it('returns null when the card has no applicable damage rolls', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: { system: { attributes: { armor: 'none' } } },
		});

		const message = createActivationMessage();

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBeNull();
	});

	it('returns null when the target token does not resolve to an actor', () => {
		globals().fromUuidSync.mockReturnValue(null);

		const message = createDamageMessage({ roll: battleaxeRoll() });

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBeNull();
	});

	it('subtracts the target damage reductions so the preview matches applied damage', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: {
				system: {
					attributes: { armor: 'heavy' },
					damageReductions: [{ value: 3, damageTypes: [] }],
				},
			},
		});

		const message = createDamageMessage({ roll: battleaxeRoll() });

		// Heavy armor total is 10 (see above); untyped reduction of 3 leaves 7.
		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(7);
	});

	it('applies type-scoped reductions to the preview using the damage node type', () => {
		globals().fromUuidSync.mockReturnValue({
			actor: {
				system: {
					attributes: { armor: 'none' },
					damageReductions: [
						{ value: 5, damageTypes: ['slashing'] },
						{ value: 2, damageTypes: ['fire'] },
					],
				},
			},
		});

		// createDamageMessage's damage node is slashing: only the slashing entry applies.
		const message = createDamageMessage({ roll: battleaxeRoll() });

		expect(message.getDamagePreviewForTarget('Scene.scene.Token.token')).toBe(37);
	});
});

describe('NimbleChatMessage.applyDamage — damage reduction', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
	});

	function createReductionActor(damageReductions: object[]) {
		return {
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'none',
					hp: { value: 10, temp: 0, max: 10 },
				},
				damageReductions,
			},
			update: vi.fn().mockResolvedValue(undefined),
		};
	}

	it('subtracts untyped reductions from the applied damage', async () => {
		const actor = createReductionActor([{ value: 3, damageTypes: [] }]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('sums multiple matching reductions', async () => {
		const actor = createReductionActor([
			{ value: 3, damageTypes: [] },
			{ value: 2, damageTypes: ['fire'] },
		]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage', damageType: 'fire' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('applies type-scoped reductions only when the damage type matches', async () => {
		const actor = createReductionActor([{ value: 4, damageTypes: ['lightning'] }]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage', damageType: 'fire' });

		expect(actor.applyDamage).toHaveBeenCalledWith(8);
	});

	it('does not apply type-scoped reductions when the damage type is unknown', async () => {
		const actor = createReductionActor([{ value: 4, damageTypes: ['lightning'] }]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(8);
	});

	it('applies untyped reductions even when the damage type is unknown', async () => {
		const actor = createReductionActor([{ value: 4, damageTypes: [] }]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(4);
	});

	it('still applies reductions when armor is ignored', async () => {
		const actor = createReductionActor([{ value: 3, damageTypes: [] }]);
		actor.system.attributes.armor = 'heavy';
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage', ignoreArmor: true });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('subtracts the reduction after armor halving', async () => {
		const actor = createReductionActor([{ value: 3, damageTypes: [] }]);
		actor.system.attributes.armor = 'heavy';
		globals().fromUuidSync.mockReturnValue({ actor });

		const roll = createSerializedDamageRoll({ diceResults: [6, 6] });

		const message = createActivationMessage();
		await message.applyDamage(12, { outcome: 'fullDamage', roll });

		// Heavy armor halves the dice total (12 -> 6), then the reduction applies.
		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('shows no-damage feedback when the reduction absorbs everything', async () => {
		const actor = createReductionActor([{ value: 10, damageTypes: [] }]);
		globals().fromUuidSync.mockReturnValue({
			actor,
			name: 'Raging Berserker',
		});

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('No damage to apply.');
	});

	it('notifies the GM when only one of two targets is fully absorbed by reduction', async () => {
		const protectedActor = createReductionActor([{ value: 10, damageTypes: [] }]);
		const exposedActor = createReductionActor([]);

		globals().fromUuidSync.mockImplementation((uuid: string) =>
			uuid.endsWith('protected')
				? { actor: protectedActor, name: 'Raging Berserker' }
				: { actor: exposedActor, name: 'Bystander' },
		);

		const message = createActivationMessage([
			'Scene.scene.Token.protected',
			'Scene.scene.Token.exposed',
		]);
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(protectedActor.applyDamage).not.toHaveBeenCalled();
		expect(exposedActor.applyDamage).toHaveBeenCalledWith(8);
		expect(globals().ui.notifications.info).toHaveBeenCalledWith(
			expect.stringContaining('Raging Berserker'),
		);
	});

	it('subtracts a banked one-shot reduction and clears it after application', async () => {
		const actor = createReductionActor([]);
		(actor as { flags?: object }).flags = { [SYSTEM_ID]: { bankedDamageReduction: 6 } };
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(4);
		expect(actor.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.bankedDamageReduction`]: 0,
		});
	});

	it('combines banked reduction with damageReduction rule entries', async () => {
		const actor = createReductionActor([{ value: 2, damageTypes: [] }]);
		(actor as { flags?: object }).flags = { [SYSTEM_ID]: { bankedDamageReduction: 3 } };
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});

	it('consumes the banked reduction even when it absorbs the damage entirely', async () => {
		const actor = createReductionActor([]);
		(actor as { flags?: object }).flags = { [SYSTEM_ID]: { bankedDamageReduction: 20 } };
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(actor.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.bankedDamageReduction`]: 0,
		});
	});

	it('does not consume the banked reduction when only previewing or checking applicability', () => {
		const actor = createReductionActor([]);
		(actor as { flags?: object }).flags = { [SYSTEM_ID]: { bankedDamageReduction: 6 } };
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		message.canApplyDamage(10, { outcome: 'fullDamage' });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('ignores malformed reduction entries', async () => {
		const actor = createReductionActor([
			{ value: Number.NaN, damageTypes: [] },
			{ value: -2, damageTypes: [] },
			{ value: 'nonsense', damageTypes: [] },
			{ value: 2, damageTypes: 'notAnArray' },
			{ value: 3, damageTypes: [] },
		]);
		globals().fromUuidSync.mockReturnValue({ actor });

		const message = createActivationMessage();
		await message.applyDamage(10, { outcome: 'fullDamage' });

		// Only the well-formed entries apply: 2 (invalid damageTypes treated as untyped) + 3.
		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});
});

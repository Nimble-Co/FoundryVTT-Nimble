import { beforeEach, describe, expect, it, vi } from 'vitest';
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

	it('skips actors without applyHealing method', async () => {
		const actor = {
			system: { attributes: { hp: { value: 5, temp: 0, max: 10 } } },
		};

		globals().fromUuidSync.mockReturnValue({ actor, name: 'Test Token' });

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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 5,
		});
		expect(message.update).toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('Healing has been undone');
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.temp': 0,
			'system.attributes.hp.value': 8,
		});
	});

	it('does not apply damage when outcome is noDamage', async () => {
		const actor = {
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

		expect(actor.update).not.toHaveBeenCalled();
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

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('applies medium armor by using dice-only damage on non-critical hits', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 4,
		});
	});

	it('applies medium armor with halfDamage outcome using halved dice-only damage', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 7,
		});
	});

	it('applies negative modifiers after medium armor dice-only calculation', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 7,
		});
	});

	it('applies all negative modifiers and ignores positive modifiers for medium armor', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 7,
		});
	});

	it('applies heavy armor by halving dice-only damage and rounding up on non-critical hits', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 7,
		});
	});

	it('includes situational dice modifiers (e.g. +2d8) in heavy armor dice-only reduction', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 3,
		});
	});

	it('applies negative modifiers after heavy armor reduction', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 9,
		});
	});

	it('applies heavy armor fallback reduction when no roll metadata is provided', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 5,
		});
	});

	it('shows no-damage feedback when all targets are reduced to 0 damage by armor', async () => {
		const ironGuard = {
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

		expect(ironGuard.update).not.toHaveBeenCalled();
		expect(stoneSentinel.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.info).toHaveBeenCalledWith('No damage to apply.');
	});

	it('notifies the GM when a target is skipped because adjusted damage is 0', async () => {
		const ironGuard = {
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

		expect(ironGuard.update).not.toHaveBeenCalled();
		expect(scout.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 9,
		});
		expect(globals().ui.notifications.info).toHaveBeenCalledWith(
			'Ignored Iron Guard because the result is 0.',
		);
	});

	it('stacks heavy armor reduction with halfDamage outcome', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 8,
		});
	});

	it('applies full damage to armored targets on critical hits', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 0,
		});
	});

	it('applies halfDamage to critical hits but still ignores armor reduction', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 5,
		});
	});

	it('bypasses armor rules when ignoreArmor is enabled', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 0,
		});
	});

	it('applies armor reduction per roll when only some grouped rolls are critical', async () => {
		const actor = {
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

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 9,
		});
	});
});

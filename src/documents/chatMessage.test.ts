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
});

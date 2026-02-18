import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from './chatMessage.js';

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
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

describe('NimbleChatMessage.applyDamage', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
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
});

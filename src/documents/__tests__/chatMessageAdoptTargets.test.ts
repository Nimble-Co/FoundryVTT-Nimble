import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from '../chatMessage.js';

/**
 * A card that stored no targets takes the user's current targets when damage
 * or healing is applied, then runs the existing path. A card that already
 * stored targets does not.
 */

const GOBLIN = 'Scene.scene.Token.goblin';
const OGRE = 'Scene.scene.Token.ogre';

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: { user: { isGM: boolean; id?: string; targets?: Set<unknown> } };
	ui: {
		notifications: {
			error: ReturnType<typeof vi.fn>;
			info: ReturnType<typeof vi.fn>;
			warn: ReturnType<typeof vi.fn>;
		};
	};
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function token(uuid: string) {
	return { document: { uuid } };
}

function actor(name: string, damageResistances: string[] = []) {
	const hp = 20;
	const target = {
		name,
		applyDamage: vi.fn().mockResolvedValue(undefined),
		applyHealing: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor: 'none',
				hp: { value: hp, temp: 0, max: hp },
				damageResistances,
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			damageReductions: [],
		},
		effects: [],
		update: vi.fn().mockResolvedValue(undefined),
	};
	return target;
}

function damageNode(total: number, damageType = 'radiant') {
	return {
		id: 'packet',
		type: 'damage',
		damageType,
		formula: String(total),
		canCrit: false,
		canMiss: false,
		parentNode: null,
		parentContext: null,
		roll: {
			class: 'Roll',
			formula: String(total),
			total,
			evaluated: true,
			options: {},
			terms: [{ class: 'NumericTerm', number: total, evaluated: true, options: {} }],
		},
		on: {
			hit: [
				{
					id: 'packet-hit',
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentNode: 'packet',
					parentContext: 'hit',
				},
			],
		},
	};
}

function createCard(targets: string[], effects: unknown[] = [damageNode(5)]) {
	const message = new NimbleChatMessage({
		type: 'spell',
		system: {
			targets,
			isCritical: false,
			isMiss: false,
			activation: { effects },
		},
	} as unknown as ChatMessage.CreateData);
	message.update = vi.fn(async (changes: Record<string, unknown>) => {
		for (const [path, value] of Object.entries(changes)) {
			if (path === 'system' && value && typeof value === 'object') {
				Object.assign(message.system as object, value);
			} else {
				foundry.utils.setProperty(message, path, value);
			}
		}
		return message;
	}) as unknown as NimbleChatMessage['update'];
	return message;
}

function storedTargets(message: NimbleChatMessage): string[] {
	return (message.system as { targets?: string[] }).targets ?? [];
}

function writtenTargets(message: NimbleChatMessage): string[][] {
	return (message.update as ReturnType<typeof vi.fn>).mock.calls.map((call) => {
		const changes = call[0] as { system?: { targets?: string[] } };
		return changes.system?.targets ?? [];
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	globals().fromUuidSync = vi.fn();
	globals().game.user.isGM = true;
	globals().game.user.targets = new Set();
});

afterEach(() => {
	globals().game.user.targets = new Set();
	globals().game.user.isGM = true;
});

describe('applying damage adopts current targets only when the card stored none', () => {
	it('writes the current target onto the card and applies through its resistance', async () => {
		const goblin = actor('Goblin', ['radiant']);
		globals().fromUuidSync.mockImplementation((uuid: string) =>
			uuid === GOBLIN ? { actor: goblin, name: 'Goblin' } : null,
		);
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([]);
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyAllDamage();

		expect(adopt).toHaveBeenCalledOnce();
		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(writtenTargets(message)[0]).toEqual([GOBLIN]);
		// 5 radiant, halved (rounding up) by the resistance. Raw damage would be 5.
		expect(goblin.applyDamage).toHaveBeenCalledWith(3);
	});

	it('applies one packet the same way', async () => {
		const goblin = actor('Goblin');
		globals().fromUuidSync.mockReturnValue({ actor: goblin, name: 'Goblin' });
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([]);

		await message.applyDamage(4, { outcome: 'fullDamage' });

		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(goblin.applyDamage).toHaveBeenCalledWith(4);
	});

	it('ignores current targets when the card already stored one', async () => {
		const goblin = actor('Goblin', ['radiant']);
		const ogre = actor('Ogre');
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === GOBLIN) return { actor: goblin, name: 'Goblin' };
			if (uuid === OGRE) return { actor: ogre, name: 'Ogre' };
			return null;
		});
		globals().game.user.targets = new Set([token(OGRE)]);
		const message = createCard([GOBLIN]);
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyAllDamage();

		expect(adopt).not.toHaveBeenCalled();
		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(goblin.applyDamage).toHaveBeenCalledWith(3);
		expect(ogre.applyDamage).not.toHaveBeenCalled();
	});

	it('warns and applies nothing when nothing is stored and nothing is targeted', async () => {
		const message = createCard([]);
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyAllDamage();

		expect(adopt).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(globals().fromUuidSync).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith('No targets selected');
		expect(globals().ui.notifications.error).not.toHaveBeenCalled();
	});

	it('does not adopt targets for a player, which stays on the GM gate', async () => {
		const goblin = actor('Goblin');
		globals().fromUuidSync.mockReturnValue({ actor: goblin, name: 'Goblin' });
		globals().game.user.isGM = false;
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([]);
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyAllDamage();
		await message.applyDamage(4, { outcome: 'fullDamage' });

		expect(adopt).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(goblin.applyDamage).not.toHaveBeenCalled();
		expect(storedTargets(message)).toEqual([]);
	});

	it('does not adopt a second set when damage is applied again', async () => {
		const goblin = actor('Goblin');
		const ogre = actor('Ogre');
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === GOBLIN) return { actor: goblin, name: 'Goblin' };
			if (uuid === OGRE) return { actor: ogre, name: 'Ogre' };
			return null;
		});
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([]);

		await message.applyAllDamage();
		globals().game.user.targets = new Set([token(OGRE)]);
		await message.applyAllDamage();

		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(writtenTargets(message).every((targets) => !targets.includes(OGRE))).toBe(true);
		expect(goblin.applyDamage).toHaveBeenCalledTimes(2);
		expect(ogre.applyDamage).not.toHaveBeenCalled();
	});
});

describe('applying healing adopts current targets only when the card stored none', () => {
	it('heals the current target and keeps it on the card', async () => {
		const goblin = actor('Goblin');
		globals().fromUuidSync.mockReturnValue({ actor: goblin, name: 'Goblin' });
		globals().game.user.isGM = false;
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([], []);

		await message.applyHealing(6, 'healing', 'heal-1');

		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(goblin.applyHealing).toHaveBeenCalledWith(6, 'healing', { quiet: true });
	});

	it('ignores current targets when the card already stored one', async () => {
		const goblin = actor('Goblin');
		const ogre = actor('Ogre');
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === GOBLIN) return { actor: goblin, name: 'Goblin' };
			if (uuid === OGRE) return { actor: ogre, name: 'Ogre' };
			return null;
		});
		globals().game.user.targets = new Set([token(OGRE)]);
		const message = createCard([GOBLIN], []);
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyHealing(6, 'healing', 'heal-1');

		expect(adopt).not.toHaveBeenCalled();
		expect(goblin.applyHealing).toHaveBeenCalledOnce();
		expect(ogre.applyHealing).not.toHaveBeenCalled();
	});

	it('warns and applies nothing when nothing is stored and nothing is targeted', async () => {
		const message = createCard([], []);

		await message.applyHealing(6, 'healing', 'heal-1');

		expect(message.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith('No targets selected');
		expect(globals().ui.notifications.error).not.toHaveBeenCalled();
	});

	it('does not adopt or re-apply when the effect is already applied', async () => {
		const goblin = actor('Goblin');
		globals().fromUuidSync.mockReturnValue({ actor: goblin, name: 'Goblin' });
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([], []);
		(message.system as { appliedHealing?: unknown }).appliedHealing = {
			'heal-1': {
				effectId: 'heal-1',
				healingType: 'healing',
				amount: 6,
				targets: [],
				appliedAt: 1,
			},
		};
		const adopt = vi.spyOn(message, 'addTargetedTokensAsTargets');

		await message.applyHealing(6, 'healing', 'heal-1');

		expect(adopt).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(goblin.applyHealing).not.toHaveBeenCalled();
		expect(storedTargets(message)).toEqual([]);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			'Healing has already been applied',
		);
	});

	it('does not adopt a second set or heal again when applied twice', async () => {
		const goblin = actor('Goblin');
		const ogre = actor('Ogre');
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === GOBLIN) return { actor: goblin, name: 'Goblin' };
			if (uuid === OGRE) return { actor: ogre, name: 'Ogre' };
			return null;
		});
		globals().game.user.targets = new Set([token(GOBLIN)]);
		const message = createCard([], []);

		await message.applyHealing(6, 'healing', 'heal-1');
		globals().game.user.targets = new Set([token(OGRE)]);
		await message.applyHealing(6, 'healing', 'heal-1');

		expect(storedTargets(message)).toEqual([GOBLIN]);
		expect(goblin.applyHealing).toHaveBeenCalledOnce();
		expect(ogre.applyHealing).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			'Healing has already been applied',
		);
	});
});

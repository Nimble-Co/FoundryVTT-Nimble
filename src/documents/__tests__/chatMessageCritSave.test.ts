import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const requestSaves = vi.fn(async () => {});
const asksSave = vi.fn(() => true);
vi.resetModules();
const saveRequests = await vi.importActual<typeof import('#utils/saveRequest/saveRequests.js')>(
	'#utils/saveRequest/saveRequests.js',
);
vi.doMock('#utils/saveRequest/saveRequests.js', () => ({
	...saveRequests,
	asksSave,
	requestSaves,
}));
const { NimbleChatMessage } = await import('../chatMessage.js');

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: { user: { isGM: boolean } };
	Hooks: { call: ReturnType<typeof vi.fn>; callAll: ReturnType<typeof vi.fn> };
	ui: { notifications: { info: ReturnType<typeof vi.fn> } };
};

const globals = () => globalThis as unknown as TestGlobals;

function createTarget(immune: string[] = []) {
	return {
		name: 'Tessa',
		applyDamage: vi.fn(async () => undefined),
		system: {
			attributes: {
				armor: 'none',
				hp: { value: 20, temp: 0, max: 20 },
				damageResistances: [],
				damageImmunities: immune,
				damageVulnerabilities: [],
			},
			damageReductions: [],
		},
		effects: [],
		deleteEmbeddedDocuments: vi.fn(async () => undefined),
		update: vi.fn(async () => undefined),
	};
}

function createCard(isCritical: boolean, isMiss = false) {
	return new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.token'],
			isCritical,
			isMiss,
			activation: {
				effects: [
					{
						id: 'packet',
						type: 'damage',
						damageType: 'fire',
						formula: '6',
						canCrit: true,
						canMiss: false,
						parentNode: null,
						parentContext: null,
						roll: {
							class: 'Roll',
							formula: '6',
							total: 6,
							evaluated: true,
							options: {},
							terms: [{ class: 'NumericTerm', number: 6, evaluated: true, options: {} }],
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
					},
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
}

describe('a crit that deals 0 damage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		asksSave.mockReturnValue(true);
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('still asks the target for its crit saves', async () => {
		const actor = createTarget(['fire']);
		globals().fromUuidSync.mockReturnValue({ actor });
		const card = createCard(true);

		await card.applyAllDamage();

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(requestSaves).toHaveBeenCalledWith(card, actor, 'critReceived');
		expect(asksSave).toHaveBeenCalledWith(actor, 'critReceived');
	});

	it('keeps Apply Damage live while a target it deals 0 damage has a crit save', () => {
		globals().fromUuidSync.mockReturnValue({ actor: createTarget(['fire']) });

		expect(createCard(true).canApplyAllDamage()).toBe(true);
		expect(createCard(false).canApplyAllDamage()).toBe(false);
		asksSave.mockReturnValue(false);
		expect(createCard(true).canApplyAllDamage()).toBe(false);
	});

	it('says there is nothing to apply only when it asks no save', async () => {
		const info = vi.spyOn(globals().ui.notifications, 'info');
		globals().fromUuidSync.mockReturnValue({ actor: createTarget(['fire']) });

		await createCard(true).applyAllDamage();
		expect(info).not.toHaveBeenCalled();

		asksSave.mockReturnValue(false);
		await createCard(true).applyAllDamage();
		expect(info).toHaveBeenCalledTimes(1);
		expect(requestSaves).toHaveBeenCalledTimes(1);
		info.mockRestore();
	});

	it('asks nothing when the attack is no crit', async () => {
		globals().fromUuidSync.mockReturnValue({ actor: createTarget(['fire']) });
		await createCard(false).applyAllDamage();
		expect(requestSaves).not.toHaveBeenCalled();
	});

	it('asks nothing when the attack missed', async () => {
		globals().fromUuidSync.mockReturnValue({ actor: createTarget(['fire']) });
		await createCard(true, true).applyAllDamage();
		expect(requestSaves).not.toHaveBeenCalled();
	});
});

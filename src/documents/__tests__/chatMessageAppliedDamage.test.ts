import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import localize from '#utils/localize.ts';
import { NimbleChatMessage } from '../chatMessage.js';

/**
 * The amount Apply Damage actually removed, kept on the card. The live preview
 * keeps changing with armor; this record does not.
 */

const TOKEN = 'Scene.scene.Token.goblin';
const OTHER = 'Scene.scene.Token.orc';

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: {
		user: { isGM?: boolean; id?: string };
		users?: { activeGM?: { id?: string } | null; get?: (id: string) => unknown };
		socket?: { emit: ReturnType<typeof vi.fn> };
		messages?: { get: (id: string) => unknown };
	};
	Hooks: { call: ReturnType<typeof vi.fn>; callAll: ReturnType<typeof vi.fn> };
	ui: { notifications: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } };
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createTarget(
	config: { hp?: number; immunities?: string[]; bank?: number; name?: string } = {},
) {
	const hp = config.hp ?? 30;
	const actor = {
		name: config.name ?? 'Goblin',
		isOwner: false,
		applyDamage: vi.fn(async (amount: number) => {
			actor.system.attributes.hp.value = Math.max(0, actor.system.attributes.hp.value - amount);
		}),
		setCurrentHP: vi.fn(async (value: number) => {
			actor.system.attributes.hp.value = value;
		}),
		testUserPermission: vi.fn((_user: { id?: string }) => false),
		deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor: 'none',
				hp: { value: hp, temp: 0, max: hp },
				damageResistances: [],
				damageImmunities: config.immunities ?? [],
				damageVulnerabilities: [],
			},
			damageReductions: [],
		},
		effects: config.bank
			? [
					{
						id: 'banked-effect',
						disabled: false,
						flags: { [SYSTEM_ID]: { bankedDamageReduction: config.bank } },
					},
				]
			: [],
	};
	return actor;
}

function damageNode(id: string, damageType: string, total: number) {
	return {
		id,
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
					id: `${id}-hit`,
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentNode: id,
					parentContext: 'hit',
				},
			],
		},
	};
}

function createCard(targets: string[] = [TOKEN], total = 8) {
	const card = new NimbleChatMessage({
		id: 'msg-applied',
		type: 'spell',
		system: {
			targets,
			isCritical: false,
			isMiss: false,
			activation: { effects: [damageNode('slash', 'slashing', total)] },
		},
	} as unknown as ChatMessage.CreateData);
	return card;
}

function rememberUpdates(card: NimbleChatMessage) {
	card.update = vi.fn(async (changes: Record<string, unknown>) => {
		const value = changes['system.appliedDamage'];
		if (value instanceof foundry.data.operators.ForcedDeletion) {
			delete (card.system as { appliedDamage?: unknown }).appliedDamage;
		} else if (value) {
			(card.system as { appliedDamage?: unknown }).appliedDamage = value;
		}
		return card;
	}) as never;
	return card;
}

describe('applied damage on an activation card', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().fromUuidSync = vi.fn();
		globals().game.user = { isGM: true, id: 'gm-user' };
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('records the amount removed, the token, and the HP before and after', async () => {
		const actor = createTarget({ hp: 30, name: 'Goblin' });
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const card = rememberUpdates(createCard());

		await card.applyAllDamage();

		const record = (card.system as { appliedDamage?: { appliedAt: number } }).appliedDamage;
		expect(record?.appliedAt).toEqual(expect.any(Number));
		expect(card.appliedDamageFor(TOKEN)).toEqual({
			uuid: TOKEN,
			tokenName: 'Goblin',
			amount: 8,
			previousHp: 30,
			newHp: 22,
		});
		expect(card.isDamageApplied()).toBe(true);
		expect(card.canApplyAllDamage()).toBe(false);
	});

	it('keeps the recorded amount when armor changes afterwards', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const card = rememberUpdates(createCard([TOKEN], 4));
		const preview = card.getDamageBreakdownForTarget(TOKEN)?.total;

		await card.applyAllDamage();
		actor.system.attributes.armor = 'heavy';

		expect(card.getDamageBreakdownForTarget(TOKEN)?.total).not.toBe(preview);
		expect(card.appliedDamageFor(TOKEN)?.amount).toBe(preview);
	});

	it('records 0 for a target the attack could not hurt, and nothing when it was never applied', async () => {
		const immune = createTarget({ immunities: ['slashing'], name: 'Wraith' });
		const hurt = createTarget({ name: 'Goblin' });
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === TOKEN) return { name: 'Wraith', actor: immune };
			if (uuid === OTHER) return { name: 'Goblin', actor: hurt };
			return null;
		});
		const fresh = createCard([TOKEN, OTHER]);
		expect(fresh.appliedDamageFor(TOKEN)).toBeNull();
		expect(fresh.isDamageApplied()).toBe(false);

		const card = rememberUpdates(createCard([TOKEN, OTHER]));
		await card.applyAllDamage();

		expect(immune.applyDamage).not.toHaveBeenCalled();
		expect(hurt.applyDamage).toHaveBeenCalledWith(8);
		expect(card.appliedDamageFor(TOKEN)).toMatchObject({ amount: 0, tokenName: 'Wraith' });
		expect(card.appliedDamageFor(OTHER)).toMatchObject({ amount: 8, tokenName: 'Goblin' });
	});

	it('does not record an attack that never removes HP', async () => {
		const actor = createTarget({ immunities: ['slashing'] });
		globals().fromUuidSync.mockReturnValue({ name: 'Wraith', actor });
		const card = rememberUpdates(createCard());

		await card.applyAllDamage();

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(card.isDamageApplied()).toBe(false);
		expect(card.update).not.toHaveBeenCalled();
	});

	it('refuses a second apply, and says why', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const card = rememberUpdates(createCard());

		await card.applyAllDamage();
		await card.applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledTimes(1);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.damageAlreadyApplied'),
		);
	});

	it('records a bank that absorbs the attack, and does not spend the bank again', async () => {
		const actor = createTarget({ bank: 20 });
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const card = rememberUpdates(createCard());

		await card.applyAllDamage();

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(card.appliedDamageFor(TOKEN)).toMatchObject({ amount: 0, previousHp: 30, newHp: 30 });

		await card.applyAllDamage();

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.damageAlreadyApplied'),
		);
	});

	it('records each token, and undo restores the HP from before either hit', async () => {
		const actor = createTarget({ hp: 30 });
		globals().fromUuidSync.mockImplementation((uuid: string) => {
			if (uuid === TOKEN) return { name: 'Left', actor };
			if (uuid === OTHER) return { name: 'Right', actor };
			return null;
		});
		const card = rememberUpdates(createCard([TOKEN, OTHER], 10));

		await card.applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledTimes(2);
		expect(card.appliedDamageFor(TOKEN)).toMatchObject({ previousHp: 30, newHp: 20, amount: 10 });
		expect(card.appliedDamageFor(OTHER)).toMatchObject({ previousHp: 20, newHp: 10, amount: 10 });

		await card.undoAppliedDamage();

		expect(actor.setCurrentHP).toHaveBeenCalledTimes(1);
		expect(actor.setCurrentHP).toHaveBeenCalledWith(30);
		expect(card.isDamageApplied()).toBe(false);
		expect(card.canApplyAllDamage()).toBe(true);
		expect(globals().ui.notifications.info).toHaveBeenCalledWith(
			localize('NIMBLE.chat.damageUndone'),
		);
	});

	it('undo does nothing for a player, and warns when there is no record', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });
		const card = rememberUpdates(createCard());
		(card.system as { appliedDamage?: unknown }).appliedDamage = {
			targets: [{ uuid: TOKEN, tokenName: 'Goblin', amount: 8, previousHp: 30, newHp: 22 }],
			appliedAt: 1,
		};
		globals().game.user = { isGM: false, id: 'player-1' };

		await card.undoAppliedDamage();

		expect(actor.setCurrentHP).not.toHaveBeenCalled();
		expect(card.isDamageApplied()).toBe(true);

		globals().game.user = { isGM: true, id: 'gm-user' };
		delete (card.system as { appliedDamage?: unknown }).appliedDamage;
		await card.undoAppliedDamage();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.noDamageRecord'),
		);
	});

	it('lets an owning player ask the GM, and hides the action from anyone else', async () => {
		const actor = createTarget();
		actor.isOwner = true;
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const emit = vi.fn();
		globals().game.user = { isGM: false, id: 'player-1' };
		globals().game.socket = { emit };
		globals().game.users = { activeGM: { id: 'gm-user' } };
		const card = createCard();

		expect(card.mayApplyCardDamage()).toBe(true);
		await card.applyAllDamage();

		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(emit).toHaveBeenCalledWith(`system.${SYSTEM_ID}`, {
			type: 'applyCardDamage',
			messageId: 'msg-applied',
			userId: 'player-1',
		});

		actor.isOwner = false;
		const stranger = createCard();
		await stranger.applyAllDamage();
		expect(emit).toHaveBeenCalledTimes(1);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.cannotApplyDamage'),
		);
	});

	it('warns an owning player when no GM is connected', async () => {
		const actor = createTarget();
		actor.isOwner = true;
		globals().fromUuidSync.mockReturnValue({ actor });
		const emit = vi.fn();
		globals().game.user = { isGM: false, id: 'player-1' };
		globals().game.socket = { emit };
		globals().game.users = { activeGM: null, contents: [] } as TestGlobals['game']['users'];

		await createCard().applyAllDamage();

		expect(emit).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.noGmToApplyDamage'),
		);
	});

	it('applies on the GM client for an owner, and refuses a spoofed GM and a stranger', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const player = { isGM: false, id: 'player-1' };
		const stranger = { isGM: false, id: 'stranger' };
		globals().game.users = {
			get: (id: string) => {
				if (id === 'gm-user') return globals().game.user;
				if (id === 'player-1') return player;
				if (id === 'stranger') return stranger;
				return null;
			},
		};
		actor.testUserPermission.mockImplementation((user: { id?: string }) => user.id === 'player-1');
		const card = rememberUpdates(createCard());

		expect(await card.applyAllDamageRequested({ userId: 'gm-user', viaSocket: true })).toBe(false);
		expect(actor.applyDamage).not.toHaveBeenCalled();

		globals().game.user = { isGM: false, id: 'player-1' };
		expect(await card.applyAllDamageRequested({ userId: 'player-1', viaSocket: false })).toBe(
			false,
		);
		expect(actor.applyDamage).not.toHaveBeenCalled();

		globals().game.user = { isGM: true, id: 'gm-user' };
		expect(await card.applyAllDamageRequested({ userId: 'stranger', viaSocket: true })).toBe(false);
		expect(actor.applyDamage).not.toHaveBeenCalled();

		expect(await card.applyAllDamageRequested({ userId: 'player-1', viaSocket: true })).toBe(true);
		expect(actor.applyDamage).toHaveBeenCalledWith(8);
		expect(card.appliedDamageFor(TOKEN)?.amount).toBe(8);
	});

	it('does not record a single packet, so a save-gated apply stays repeatable', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ name: 'Goblin', actor });
		const card = rememberUpdates(createCard());

		await card.applyDamage(8, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(8);
		expect(card.isDamageApplied()).toBe(false);
		expect(card.canApplyAllDamage()).toBe(true);
		expect(card.update).not.toHaveBeenCalled();
	});
});

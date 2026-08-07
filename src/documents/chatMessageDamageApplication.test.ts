import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID, systemHookName } from '#system';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * Coverage for applying a whole card at once: which of a target's defenses
 * resolve per damage packet and which resolve once for the attack, and that the
 * preview in the Targets row reports exactly what gets removed.
 */

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: { user: { isGM: boolean } };
	Hooks: { call: ReturnType<typeof vi.fn>; callAll: ReturnType<typeof vi.fn> };
	ui: { notifications: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } };
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createTarget(
	config: {
		hp?: number;
		damageReductions?: object[];
		damageResistances?: string[];
		bankedReduction?: number;
	} = {},
) {
	const hp = config.hp ?? 30;
	const actor = {
		name: 'Target',
		applyDamage: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor: 'none',
				hp: { value: hp, temp: 0, max: hp },
				damageResistances: config.damageResistances ?? [],
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			damageReductions: config.damageReductions ?? [],
		},
		effects: config.bankedReduction
			? [
					{
						id: 'banked-effect',
						disabled: false,
						flags: { [SYSTEM_ID]: { bankedDamageReduction: config.bankedReduction } },
					},
				]
			: [],
		deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
	};

	// applyDamage is the real HP write in production; here it just records the
	// new value so a kill can be detected the same way the card detects one.
	actor.applyDamage.mockImplementation(async (amount: number) => {
		actor.system.attributes.hp.value = Math.max(0, actor.system.attributes.hp.value - amount);
	});

	return actor;
}

function damagePacketNode(id: string, damageType: string, total: number) {
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

function createCard(packets: Array<{ damageType: string; total: number }>) {
	return new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.token'],
			isCritical: false,
			isMiss: false,
			activation: {
				effects: packets.map((packet, index) =>
					damagePacketNode(`packet-${index}`, packet.damageType, packet.total),
				),
			},
		},
	} as unknown as ChatMessage.CreateData);
}

/** A Shadow Trap card: damage that posts unrolled, waiting on the trap firing. */
function deferredDamageCard() {
	return new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.token'],
			isCritical: false,
			isMiss: false,
			activation: {
				effects: [
					{
						id: 'trap-damage',
						type: 'damage',
						damageType: 'necrotic',
						formula: '3d12',
						deferredRoll: true,
						canCrit: false,
						canMiss: false,
						parentNode: null,
						parentContext: null,
					},
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
}

function deferredNodeOf(card: NimbleChatMessage) {
	const effects = (card.system as unknown as { activation: { effects: Array<{ id: string }> } })
		.activation.effects;
	return effects.find((effect) => effect.id === 'trap-damage') as { roll?: object };
}

/** A weapon hit plus a differently-typed bonus packet, as a typed spend posts. */
function slashingPlusRadiant(slashing = 7, radiant = 5) {
	return createCard([
		{ damageType: 'slashing', total: slashing },
		{ damageType: 'radiant', total: radiant },
	]);
}

describe('NimbleChatMessage.applyAllDamage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('subtracts a flat reduction once for the attack, not once per packet', async () => {
		const actor = createTarget({ damageReductions: [{ value: 2, damageTypes: [] }] });
		globals().fromUuidSync.mockReturnValue({ actor });

		await slashingPlusRadiant().applyAllDamage();

		// 7 + 5 = 12, minus 2 once. Per packet it would have been (7-2) + (5-2) = 10.
		expect(actor.applyDamage).toHaveBeenCalledTimes(1);
		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('carries a reduction bigger than the first packet into the next one', async () => {
		const actor = createTarget({ damageReductions: [{ value: 6, damageTypes: [] }] });
		globals().fromUuidSync.mockReturnValue({ actor });

		await createCard([
			{ damageType: 'slashing', total: 4 },
			{ damageType: 'radiant', total: 5 },
		]).applyAllDamage();

		// 9 total minus 6. Clamping each packet at zero would have wasted 2 of it.
		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('halves only the packet whose type the target resists', async () => {
		const actor = createTarget({ damageResistances: ['radiant'] });
		globals().fromUuidSync.mockReturnValue({ actor });

		await slashingPlusRadiant().applyAllDamage();

		// 7 slashing in full, 5 radiant halved (rounding up) to 3.
		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('spends the banked one-shot reduction once for the attack', async () => {
		const actor = createTarget({ bankedReduction: 4 });
		globals().fromUuidSync.mockReturnValue({ actor });

		await slashingPlusRadiant().applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledWith(8);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
	});

	it('carries the banked reduction into the next packet rather than wasting it', async () => {
		const actor = createTarget({ bankedReduction: 9 });
		globals().fromUuidSync.mockReturnValue({ actor });

		await createCard([
			{ damageType: 'slashing', total: 4 },
			{ damageType: 'radiant', total: 8 },
		]).applyAllDamage();

		// 12 total minus 9. Spending the whole bank on the first packet would
		// have left the 8 untouched.
		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});

	it('spends a type-scoped reduction only against damage of that type', async () => {
		const actor = createTarget({
			damageReductions: [{ value: 5, damageTypes: ['radiant'], label: 'Sun Ward' }],
		});
		globals().fromUuidSync.mockReturnValue({ actor });

		await createCard([
			{ damageType: 'slashing', total: 10 },
			{ damageType: 'radiant', total: 2 },
		]).applyAllDamage();

		// The ward absorbs the 2 radiant and nothing else; the slashing is whole.
		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('fires damageApplied once per target, not once per packet', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });

		await slashingPlusRadiant().applyAllDamage();

		const damageAppliedCalls = globals().Hooks.callAll.mock.calls.filter(
			([hook]) => hook === systemHookName('damageApplied'),
		);
		expect(damageAppliedCalls).toHaveLength(1);
	});

	it('reports a kill once when neither packet would drop the target alone', async () => {
		const actor = createTarget({ hp: 10 });
		globals().fromUuidSync.mockReturnValue({ actor });

		const card = slashingPlusRadiant();
		// The kill hook carries the attacker, which is resolved off the speaker.
		Object.defineProperty(card, 'actor', { get: () => ({ name: 'Attacker' }) });

		await card.applyAllDamage();

		const killCalls = globals().Hooks.call.mock.calls.filter(
			([hook]) => hook === 'nimbleKillApplied',
		);
		expect(killCalls).toHaveLength(1);
		expect(actor.system.attributes.hp.value).toBe(0);
	});

	it('removes exactly what the Targets row previewed', async () => {
		const actor = createTarget({
			damageReductions: [{ value: 2, damageTypes: [] }],
			damageResistances: ['radiant'],
			bankedReduction: 3,
		});
		globals().fromUuidSync.mockReturnValue({ actor });

		const card = slashingPlusRadiant();
		const previewed = card.getDamageBreakdownForTarget('Scene.scene.Token.token');
		await card.applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledWith(previewed?.total);
	});

	it('leaves the target alone when the attack missed', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });

		const card = slashingPlusRadiant();
		(card.system as unknown as { isMiss: boolean }).isMiss = true;

		await card.applyAllDamage();

		expect(actor.applyDamage).not.toHaveBeenCalled();
	});

	it('has nothing to apply until deferred damage is rolled, then applies it', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });

		const card = deferredDamageCard();
		expect(card.canApplyAllDamage()).toBe(false);

		await card.applyAllDamage();
		expect(actor.applyDamage).not.toHaveBeenCalled();

		// What the card's Roll Damage button writes back onto the node.
		deferredNodeOf(card).roll = {
			class: 'Roll',
			formula: '3d12',
			total: 21,
			evaluated: true,
			options: {},
			terms: [{ class: 'Die', number: 3, faces: 12, evaluated: true, results: [] }],
		};

		expect(card.canApplyAllDamage()).toBe(true);
		await card.applyAllDamage();
		expect(actor.applyDamage).toHaveBeenCalledWith(21);
	});
});

describe('NimbleChatMessage.applyDamage — single packet through the shared path', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('still subtracts a flat reduction from the one packet it is given', async () => {
		const actor = createTarget({ damageReductions: [{ value: 2, damageTypes: [] }] });
		globals().fromUuidSync.mockReturnValue({ actor });

		await slashingPlusRadiant().applyDamage(7, { outcome: 'fullDamage' });

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
	});
});

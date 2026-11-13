import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID, systemHookName } from '#system';
import { NimbleChatMessage } from '../chatMessage.js';

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

function createCard(
	packets: Array<{ damageType: string; total: number; damageMultiplier?: number }>,
	isCritical = false,
) {
	return new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.token'],
			isCritical,
			isMiss: false,
			activation: {
				effects: packets.map((packet, index) => ({
					...damagePacketNode(`packet-${index}`, packet.damageType, packet.total),
					...(packet.damageMultiplier ? { damageMultiplier: packet.damageMultiplier } : {}),
				})),
			},
		},
	} as unknown as ChatMessage.CreateData);
}

/** A card whose damage posts unrolled, waiting on a later trigger. */
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

	describe('a reduction only against crits', () => {
		const packets = [
			{ damageType: 'slashing', total: 7 },
			{ damageType: 'radiant', total: 5 },
		];

		it('halves every packet of a crit, and nothing of an attack that is not a crit', async () => {
			const actor = createTarget({
				damageReductions: [{ value: 0, damageTypes: [], mode: 'half', onlyCrits: true }],
			});
			globals().fromUuidSync.mockReturnValue({ actor });

			await createCard(packets, true).applyAllDamage();
			// 7 and 5, each halved (rounding up): 4 + 3.
			expect(actor.applyDamage).toHaveBeenLastCalledWith(7);

			await createCard(packets).applyAllDamage();
			expect(actor.applyDamage).toHaveBeenLastCalledWith(12);
		});

		it('subtracts a flat reduction only from a crit', async () => {
			const actor = createTarget({
				damageReductions: [{ value: 2, damageTypes: [], onlyCrits: true }],
			});
			globals().fromUuidSync.mockReturnValue({ actor });

			await createCard(packets, true).applyAllDamage();
			expect(actor.applyDamage).toHaveBeenLastCalledWith(10);

			await createCard(packets).applyAllDamage();
			expect(actor.applyDamage).toHaveBeenLastCalledWith(12);
		});
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

	it('tells damageApplied that a discarded crit still triggers when-crit abilities', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });
		const card = createCard([{ damageType: 'slashing', total: 7 }]);
		(card.system as unknown as { discardedCritTriggers: boolean }).discardedCritTriggers = true;
		const update = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(card, 'update', { value: update });

		await card.applyAllDamage();

		const payload = globals().Hooks.callAll.mock.calls.find(
			([hook]) => hook === systemHookName('damageApplied'),
		)?.[1];
		expect(payload).toMatchObject({
			isCritical: false,
			discardedCritTriggers: true,
			discardedCritTriggersFired: false,
		});
		expect(update).toHaveBeenCalledWith({ 'system.discardedCritTriggersFired': true });
	});

	it('tells damageApplied when the discarded crit triggers already fired, and writes no flag again', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue({ actor });
		const card = createCard([{ damageType: 'slashing', total: 7 }]);
		Object.assign(card.system as object, {
			discardedCritTriggers: true,
			discardedCritTriggersFired: true,
		});
		const update = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(card, 'update', { value: update });

		await card.applyAllDamage();

		const payload = globals().Hooks.callAll.mock.calls.find(
			([hook]) => hook === systemHookName('damageApplied'),
		)?.[1];
		expect(payload).toMatchObject({ discardedCritTriggersFired: true });
		expect(update).not.toHaveBeenCalled();
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

describe('a target with No Damage', () => {
	const COVERED = 'Scene.scene.Token.covered';
	const OTHER = 'Scene.scene.Token.other';

	function noDamageCard() {
		const card = slashingPlusRadiant();
		Object.assign(card.system, {
			targets: [COVERED, OTHER],
			resultChanges: [
				{
					id: 'no-damage',
					lineId: 'no-damage',
					change: 'noDamage',
					targetTokenUuid: COVERED,
					itemUuid: 'Item.res',
					label: 'Epic Resistance',
					retired: false,
				},
			],
		});
		Object.assign(card, { update: vi.fn().mockResolvedValue(undefined) });
		return card;
	}

	function world() {
		const covered = createTarget({ bankedReduction: 4 });
		const other = createTarget();
		globals().fromUuidSync = vi.fn((uuid: string) => {
			if (uuid === COVERED) return { name: 'Covered', actor: covered };
			if (uuid === OTHER) return { name: 'Other', actor: other };
			if (uuid === 'Item.res') return { name: 'Epic Resistance' };
			return null;
		});
		return { covered, other };
	}

	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('takes no damage from any packet, the bank stays, and the other target is hurt', async () => {
		const { covered, other } = world();

		await noDamageCard().applyAllDamage();

		expect(covered.applyDamage).not.toHaveBeenCalled();
		expect(covered.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(other.applyDamage).toHaveBeenCalledWith(12);
	});

	it('records that the damage is applied, so Remove stops', async () => {
		world();
		const card = noDamageCard();

		await card.applyAllDamage();

		expect(card.update).toHaveBeenCalledWith({ 'system.damageApplied': true });
	});

	it('previews zero for that target only, and names the feature', () => {
		world();
		const card = noDamageCard();

		expect(card.getDamageBreakdownForTarget(COVERED)?.total).toBe(0);
		expect(card.getDamageBreakdownForTarget(OTHER)?.total).toBe(12);
		expect(card.noDamageSourceFor(COVERED)).toBe('Epic Resistance');
		expect(card.noDamageSourceFor(OTHER)).toBeNull();
	});

	it('hurts the target again when the change is gone', async () => {
		const { covered } = world();
		const card = noDamageCard();
		Object.assign(card.system, { resultChanges: [] });

		await card.applyAllDamage();

		expect(covered.applyDamage).toHaveBeenCalledWith(8);
	});
});

describe('NimbleChatMessage latched miss damage', () => {
	const CREATURE = 'Actor.creature';

	function missedCard(slashing = 7, radiant = 5) {
		const card = slashingPlusRadiant(slashing, radiant);
		(card.system as unknown as { isMiss: boolean }).isMiss = true;
		card.setFlag = vi.fn().mockResolvedValue(card);
		return card;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		globals().fromUuidSync = vi.fn();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('deals what the button says after the defenses of the creature', async () => {
		const actor = createTarget({ damageReductions: [{ value: 2, damageTypes: [] }] });
		globals().fromUuidSync.mockReturnValue(actor);
		const card = missedCard();

		expect(card.latchedMissDamage(CREATURE)).toBe(10);
		await card.applyLatchedMissDamage(CREATURE);

		expect(actor.applyDamage).toHaveBeenCalledTimes(1);
		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('adds the packets of a two-node attack and applies them once', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue(actor);

		await missedCard().applyLatchedMissDamage(CREATURE);

		expect(actor.applyDamage).toHaveBeenCalledTimes(1);
		expect(actor.applyDamage).toHaveBeenCalledWith(12);
	});

	it('uses resistance of the creature', () => {
		globals().fromUuidSync.mockReturnValue(createTarget({ damageResistances: ['radiant'] }));

		// 7 + ceil(5 / 2) = 10.
		expect(missedCard().latchedMissDamage(CREATURE)).toBe(10);
	});

	it('uses up banked reduction', async () => {
		const actor = createTarget({ bankedReduction: 4 });
		globals().fromUuidSync.mockReturnValue(actor);
		const card = missedCard();

		expect(card.latchedMissDamage(CREATURE)).toBe(8);
		await card.applyLatchedMissDamage(CREATURE);

		expect(actor.applyDamage).toHaveBeenCalledWith(8);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
	});

	it('marks the card so the button goes away', async () => {
		globals().fromUuidSync.mockReturnValue(createTarget());
		const card = missedCard();

		await card.applyLatchedMissDamage(CREATURE);

		expect(card.setFlag).toHaveBeenCalledWith(SYSTEM_ID, 'latchedDamageApplied', true);
	});

	it('does nothing for a player', async () => {
		const actor = createTarget();
		globals().fromUuidSync.mockReturnValue(actor);
		globals().game.user.isGM = false;

		await missedCard().applyLatchedMissDamage(CREATURE);

		expect(actor.applyDamage).not.toHaveBeenCalled();
	});

	it('does not fire the damage hook or the attack triggers', async () => {
		globals().fromUuidSync.mockReturnValue(createTarget());

		await missedCard().applyLatchedMissDamage(CREATURE);

		expect(globals().Hooks.callAll).not.toHaveBeenCalled();
		expect(globals().Hooks.call).not.toHaveBeenCalled();
	});
});

describe('a damage node with a multiplier', () => {
	it('deals and previews the multiplied amount', async () => {
		const actor = createTarget();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor });
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
		const card = createCard([{ damageType: 'piercing', total: 6, damageMultiplier: 2 }]);

		expect(card.getDamageBreakdownForTarget('Scene.scene.Token.token')?.total).toBe(12);
		await card.applyAllDamage();
		expect(actor.applyDamage).toHaveBeenCalledWith(12);
	});
});

describe('a vulnerability to the next fire damage', () => {
	function greased() {
		const actor = createTarget();
		const effect = {
			id: 'grease',
			name: 'Grease Trap',
			disabled: false,
			origin: null,
			system: {
				rules: [
					{
						id: 'grease-rule',
						type: 'heldRoll',
						heldKind: 'vulnerableOnce',
						value: 0,
						whichRoll: 'attacksOnHolder',
						usedUp: true,
						damageType: 'fire',
					},
				],
			},
			flags: {},
		};
		Object.assign(actor, { uuid: 'Actor.greased', isOwner: true, effects: [effect] });
		return actor;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('deals more, and is gone after the first fire damage', async () => {
		const actor = greased();
		globals().fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.greased' ? actor : { actor },
		);

		const card = createCard([{ damageType: 'fire', total: 5 }]);
		const previewed = card.getDamageBreakdownForTarget('Scene.scene.Token.token');
		expect(previewed?.total).toBeGreaterThan(5);
		await card.applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledWith(previewed?.total);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['grease']);
	});

	it('stays through other damage', async () => {
		const actor = greased();
		globals().fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.greased' ? actor : { actor },
		);

		await createCard([{ damageType: 'cold', total: 5 }]).applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledWith(5);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe('a damage node with a multiplier on an armored target', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	async function dealt(armor: string, packet: { total: number; damageMultiplier?: number }) {
		const actor = createTarget();
		actor.system.attributes.armor = armor;
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor });
		await createCard([{ damageType: 'piercing', ...packet }]).applyAllDamage();
		return actor.applyDamage.mock.calls[0]?.[0];
	}

	it('doubles what heavy armor lets through', async () => {
		expect(await dealt('heavy', { total: 6 })).toBe(3);
		expect(await dealt('heavy', { total: 6, damageMultiplier: 2 })).toBe(6);
	});

	it('doubles what medium armor lets through', async () => {
		expect(await dealt('medium', { total: 6, damageMultiplier: 2 })).toBe(12);
	});
});

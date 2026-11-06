import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.js';
import type { CardRerolls as CardRerollsClass, RerollCard } from '../cardRerolls.js';

const ROLLER = 'Actor.roller';
const TARGET_TOKEN = 'Scene.s.Token.target';
const COST = {
	chargePoolIdentifier: 'pool',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 0,
	heroicReaction: '',
};
const PAID = { charges: 1, mana: 2, wounds: 1, heroicReaction: null };

const payCost = vi.fn();
const giveBack = vi.fn();
const keepAmount = vi.fn();
const rollSaveWithOwner = vi.fn();
const rejectCardRequest = vi.fn();

let CardRerolls: typeof CardRerollsClass;

type Globals = {
	game: { user: { isGM: boolean; id: string } };
};

function globals(): Globals {
	return globalThis as unknown as Globals;
}

function makeRoller() {
	return {
		uuid: ROLLER,
		type: 'npc',
		name: 'Brom',
		rules: [] as unknown[],
		getRollData: () => ({}),
	};
}

type Roller = ReturnType<typeof makeRoller>;

function makeRule(roller: Roller, type: string, extra: Record<string, unknown> = {}) {
	return {
		type,
		id: type,
		disabled: false,
		label: '',
		item: { name: type, uuid: `Item.${type}` },
		actor: roller,
		rollUseCost: COST,
		offersUseOn: vi.fn(() => true),
		...extra,
	};
}

type Rule = ReturnType<typeof makeRule>;

function setupWorld(rule: Rule, roller: Roller, extra: Record<string, unknown> = {}) {
	const byUuid: Record<string, unknown> = {
		[ROLLER]: roller,
		[rule.item.uuid]: { rules: new Map([[rule.id, rule]]) },
		...extra,
	};
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => byUuid[uuid] ?? null),
	);
}

function entryFor(rule: Rule, extra: Partial<IncomingReactionEntry> = {}): IncomingReactionEntry {
	return {
		id: `entry-${rule.id}`,
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: rule.id,
		ruleId: rule.id,
		itemUuid: rule.item.uuid,
		used: false,
		outcomeTrigger: 'always',
		...extra,
	};
}

type CardSystem = {
	incomingReactions: IncomingReactionEntry[];
	resultChanges: ResultChange[];
	keptAmount?: { label: string; amount: number };
	[key: string]: unknown;
};

type FakeHost = RerollCard & {
	data: CardSystem;
	update: ReturnType<typeof vi.fn>;
};

/** A host whose `update` writes to its system data, as the document does. */
function makeHost(input: {
	type: string;
	system: CardSystem;
	rolls: string[];
	isActivationCard: boolean;
	attacker?: unknown;
}): FakeHost {
	const data = input.system;
	const host: FakeHost = {
		data,
		id: () => 'card-1',
		type: () => input.type,
		system: () => data,
		rollsSource: () => input.rolls,
		isActivationCard: () => input.isActivationCard,
		attacker: () => (input.attacker ?? null) as ReturnType<RerollCard['attacker']>,
		flags: () => ({}),
		incomingReactions: () => data.incomingReactions,
		validateIncomingReaction: (entryId) =>
			data.incomingReactions.find((entry) => entry.id === entryId && !entry.used) ?? null,
		attackDelivery: () => 'melee',
		movementOfferChanges: (changes) => changes,
		update: vi.fn(async (changes: { system?: Record<string, unknown> }) => {
			Object.assign(data, changes.system ?? {});
		}),
	};
	return host;
}

/** A save card: the check-card roll target reads its first roll. */
function makeSaveCard(entries: IncomingReactionEntry[], extra: Record<string, unknown> = {}) {
	const roll = {
		class: 'NimbleRoll',
		formula: '1d20 + 2',
		total: 7,
		options: {},
		data: {},
		terms: [{ class: 'Die', faces: 20, number: 1, results: [{ result: 5, active: true }] }],
	};
	return makeHost({
		type: 'savingThrow',
		isActivationCard: false,
		rolls: [JSON.stringify(roll)],
		system: {
			saveKey: 'will',
			rollMode: 0,
			actorUuid: ROLLER,
			dc: 14,
			incomingReactions: entries,
			resultChanges: [],
			rerolls: [],
			...extra,
		},
	});
}

/** A hit card with one target and a primary damage roll. */
function makeAttackCard(entries: IncomingReactionEntry[], attacker: Roller) {
	const roll = {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		originalFormula: '1d6 + 2',
		total: 8,
		isCritical: false,
		isMiss: false,
		options: { canCrit: true, canMiss: true, rollMode: 0 },
		data: {},
		terms: [],
	};
	return makeHost({
		type: 'feature',
		isActivationCard: true,
		attacker,
		rolls: [JSON.stringify(roll)],
		system: {
			targets: [TARGET_TOKEN],
			isCritical: false,
			isMiss: false,
			activation: {
				effects: [{ id: 'damage', type: 'damage', parentNode: null, parentContext: null, roll }],
			},
			incomingReactions: entries,
			resultChanges: [],
			rerolls: [],
		},
	});
}

function use(host: FakeHost, entry: IncomingReactionEntry, forceHeroicReaction = false) {
	return new CardRerolls(host).resolveRerollReaction(
		entry.id,
		'gm-user',
		false,
		forceHeroicReaction,
	);
}

function entryOn(host: FakeHost, id: string) {
	return host.data.incomingReactions.find((entry) => entry.id === id);
}

function rejectedWith() {
	return rejectCardRequest.mock.calls.map(([rejection]) => rejection.reasonKey);
}

beforeEach(async () => {
	vi.unstubAllGlobals();
	vi.resetModules();
	for (const mock of [payCost, giveBack, keepAmount, rollSaveWithOwner, rejectCardRequest]) {
		mock.mockReset();
	}
	payCost.mockResolvedValue(PAID);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	globals().game.user = { isGM: true, id: 'gm-user' };

	vi.doMock('#utils/cost/costLedger.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		payCost,
		giveBack,
	}));
	vi.doMock('#utils/heldChange/heldChange.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		keepAmount,
	}));
	vi.doMock('#utils/rolls/rollSaveWithOwner.js', () => ({ rollSaveWithOwner }));
	vi.doMock('#utils/chat/cardOperations.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		rejectCardRequest,
	}));
	({ CardRerolls } = await import('../cardRerolls.js'));
});

describe('Keep Amount row', () => {
	function world() {
		const roller = makeRoller();
		const rule = makeRule(roller, 'keepAmount', { rollEffect: 'keepAmount' });
		setupWorld(rule, roller);
		const entry = entryFor(rule);
		const host = makeSaveCard([entry], {
			activation: { effects: [{ id: 'd', type: 'damage', roll: { total: 9 } }] },
		});
		return { roller, entry, host };
	}

	it('pays the cost with forceHeroicReaction when the request forces it', async () => {
		const { roller, entry, host } = world();

		await use(host, entry, true);

		expect(payCost).toHaveBeenCalledWith(roller, COST, { forceHeroicReaction: true });
	});

	it('keeps the card damage total and marks the entry used', async () => {
		const { roller, entry, host } = world();

		await use(host, entry);

		expect(keepAmount).toHaveBeenCalledWith(roller, entry.label, 9);
		expect(entryOn(host, entry.id)?.used).toBe(true);
		expect(host.data.keptAmount).toEqual({ label: entry.label, amount: 9 });
	});

	it('gives the cost back and rejects with useFailed when keeping the amount throws', async () => {
		const { roller, entry, host } = world();
		keepAmount.mockRejectedValue(new Error('no holder'));

		await use(host, entry);

		expect(giveBack).toHaveBeenCalledWith(roller, { cost: COST, paid: PAID });
		expect(rejectedWith()).toEqual(['NIMBLE.chat.incomingReactions.useFailed']);
		expect(host.update).not.toHaveBeenCalled();
	});

	it('rejects with rerollCostUnpaid and keeps nothing when the cost is not paid', async () => {
		const { entry, host } = world();
		payCost.mockResolvedValue(null);

		await use(host, entry);

		expect(rejectedWith()).toEqual(['NIMBLE.chat.incomingReactions.rerollCostUnpaid']);
		expect(keepAmount).not.toHaveBeenCalled();
		expect(host.update).not.toHaveBeenCalled();
	});
});

describe('Crit Dice save row', () => {
	function world() {
		const roller = makeRoller();
		const target = { uuid: 'Actor.target', rollSavingThrowToChat: vi.fn() };
		const rule = makeRule(roller, 'critDiceSave', {
			rollEffect: 'critDiceSave',
			saveType: 'strength',
			saveDC: '',
		});
		setupWorld(rule, roller, { [TARGET_TOKEN]: { actor: target } });
		const entry = entryFor(rule);
		const host = makeAttackCard([entry], roller);
		return { roller, target, entry, host };
	}

	it('pays the cost with forceHeroicReaction passed through', async () => {
		const { roller, entry, host } = world();
		rollSaveWithOwner.mockResolvedValue(true);

		await use(host, entry, true);

		expect(payCost).toHaveBeenCalledWith(roller, COST, { forceHeroicReaction: true });
	});

	it('asks the sole target for the save and marks the entry used', async () => {
		const { target, entry, host } = world();
		rollSaveWithOwner.mockResolvedValue(true);

		await use(host, entry);

		expect(rollSaveWithOwner).toHaveBeenCalledWith(target, 'strength', expect.any(Object));
		expect(entryOn(host, entry.id)?.used).toBe(true);
	});

	it('gives the cost back and rejects nothing when the save window is closed', async () => {
		const { roller, entry, host } = world();
		rollSaveWithOwner.mockResolvedValue(false);

		await use(host, entry);

		expect(giveBack).toHaveBeenCalledWith(roller, { cost: COST, paid: PAID });
		expect(entryOn(host, entry.id)?.used).toBe(false);
		expect(host.update).not.toHaveBeenCalled();
		expect(rejectCardRequest).not.toHaveBeenCalled();
	});
});

describe('Change a Result row', () => {
	const resultUse = { change: 'add', value: 2, stat: '' };

	function world() {
		const roller = makeRoller();
		const rule = makeRule(roller, 'changeResult', { resultUseFor: vi.fn(() => resultUse) });
		setupWorld(rule, roller);
		const entry = entryFor(rule, { use: 'result' });
		const host = makeSaveCard([entry]);
		return { roller, entry, host };
	}

	it('pays the cost with forceHeroicReaction passed through', async () => {
		const { roller, entry, host } = world();

		await use(host, entry, true);

		expect(payCost).toHaveBeenCalledWith(roller, COST, { forceHeroicReaction: true });
	});

	it('writes one result change that carries the paid charges, mana and wounds', async () => {
		const { entry, host } = world();

		await use(host, entry);

		expect(host.data.resultChanges).toEqual([
			expect.objectContaining({
				entryId: entry.id,
				change: 'add',
				value: 2,
				chargePoolIdentifier: 'pool',
				paid: { charges: 1, mana: 2, wounds: 1 },
			}),
		]);
		expect(entryOn(host, entry.id)?.used).toBe(true);
	});
});

describe('a client that is not a GM', () => {
	it('pays nothing and does not change the card', async () => {
		const roller = makeRoller();
		const rule = makeRule(roller, 'keepAmount', { rollEffect: 'keepAmount' });
		setupWorld(rule, roller);
		const entry = entryFor(rule);
		const host = makeSaveCard([entry]);
		globals().game.user = { isGM: false, id: 'player' };

		await use(host, entry, true);

		expect(payCost).not.toHaveBeenCalled();
		expect(host.update).not.toHaveBeenCalled();
	});
});

describe('the automatic Rerolls after a placed roll', () => {
	function unreadableCard(entries: IncomingReactionEntry[]) {
		const host = makeAttackCard(entries, makeRoller());
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => {
				throw new Error('bad uuid');
			}),
		);
		return host;
	}

	const placed = (automatic: unknown[], entries: IncomingReactionEntry[]) => ({
		automatic,
		entries,
		discardedCritTriggers: false,
		outcome: { outcome: { isCritical: false, isMiss: false }, forcedMiss: false },
	});

	it('reads nothing when no automatic Reroll is next', async () => {
		const host = unreadableCard([]);

		await expect(
			new CardRerolls(host).runAutomaticReroll(placed([], []) as never),
		).resolves.toBeUndefined();
		expect(fromUuidSync).not.toHaveBeenCalled();
	});

	it('logs, and does not throw, when the roll cannot be read for the next automatic Reroll', async () => {
		const roller = makeRoller();
		const rule = makeRule(roller, 'reroll', { automatic: true });
		const entry = entryFor(rule);
		const host = unreadableCard([]);

		await expect(
			new CardRerolls(host).runAutomaticReroll(placed([{ entry, rule }], []) as never),
		).resolves.toBeUndefined();
		expect(fromUuidSync).toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith(
			'Nimble | An automatic reroll failed.',
			expect.any(Error),
		);
		expect(host.update).not.toHaveBeenCalled();
	});
});

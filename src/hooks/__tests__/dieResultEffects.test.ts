import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { DieResultEffectRule } from '../../models/rules/dieResultEffect.js';

class FakeDamageRoll {
	options: { primaryDieBaseResult?: number };
	primaryDieValue: number | undefined;

	constructor(face: number | undefined, base?: number) {
		this.primaryDieValue = face;
		this.options = base === undefined ? {} : { primaryDieBaseResult: base };
	}
}

class FakeRoll {
	total = 7;
}

const applyEffectToActorMock = vi.fn(async (..._args: unknown[]) => null);
const payloadFromEffectMock = vi.fn((effect: { toObject(): object }, source: object) => ({
	data: effect.toObject(),
	source,
}));
const ruleAutomationMock = vi.fn(() => true);
const isActiveGMMock = vi.fn(() => false);

let applyDieResultEffects: typeof import('../dieResultEffects.js').applyDieResultEffects;
let registerDieResultEffectHooks: typeof import('../dieResultEffects.js').registerDieResultEffectHooks;

const globals = globalThis as unknown as Record<string, any>;
const items = new Map<string, unknown>();
let savedFromUuidSync: unknown;

beforeEach(async () => {
	vi.clearAllMocks();
	ruleAutomationMock.mockReturnValue(true);
	isActiveGMMock.mockReturnValue(false);
	items.clear();
	savedFromUuidSync = globals.fromUuidSync;
	globals.fromUuidSync = (uuid: string) => items.get(uuid) ?? null;
	vi.resetModules();
	vi.doMock('../../settings/automationSettings.js', () => ({
		isRuleAutomationEnabled: ruleAutomationMock,
	}));
	vi.doMock('#utils/isActiveGM.js', () => ({ isActiveGM: isActiveGMMock }));
	vi.doMock('../../dice/DamageRoll.js', () => ({ DamageRoll: FakeDamageRoll }));
	vi.doMock('#utils/actor/applyEffectToActor.js', () => ({
		applyEffectToActor: applyEffectToActorMock,
		payloadFromEffect: payloadFromEffectMock,
	}));
	({ applyDieResultEffects, registerDieResultEffectHooks } = await import(
		'../dieResultEffects.js'
	));
});

afterEach(() => {
	globals.fromUuidSync = savedFromUuidSync;
});

const SPIRIT_UUID = 'Actor.a.Item.spirit';
const GUIDE_UUID = 'Actor.a.Item.guide';

function itemEffect(transfer: boolean, name: string) {
	return { transfer, toObject: () => ({ name }) };
}

interface Setup {
	itemIdentifier?: string;
	atLeast?: number;
	disabled?: boolean;
	predicatePasses?: boolean;
	ruleOnUsedItem?: boolean;
	notOnAllies?: boolean;
}

/** An actor with a used item and a rule item; the rule reads the used item by its identifier. */
function setup(config: Setup = {}) {
	const actor: Record<string, unknown> = {
		uuid: 'Actor.a',
		rules: [],
		prototypeToken: { disposition: FRIENDLY },
		getDomain: () => new Set<string>(),
	};
	const used = {
		uuid: SPIRIT_UUID,
		actor,
		system: { identifier: 'spirit' },
		isEmbedded: true,
		getDomain: () => new Set<string>(),
		effects: [] as unknown[],
	};
	const guide = config.ruleOnUsedItem
		? used
		: {
				uuid: GUIDE_UUID,
				actor,
				system: { identifier: '' },
				isEmbedded: true,
				getDomain: () => new Set<string>(),
				effects: [] as unknown[],
			};
	guide.effects = [itemEffect(true, 'Passive'), itemEffect(false, 'Glow')];
	const rule = new DieResultEffectRule(
		{
			id: 'rule-id',
			type: 'dieResultEffect',
			itemIdentifier: config.itemIdentifier ?? 'spirit',
			atLeast: config.atLeast ?? 6,
		} as never,
		{ parent: guide as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.disabled = config.disabled ?? false;
	rule.type = 'dieResultEffect';
	rule.itemIdentifier = config.itemIdentifier ?? 'spirit';
	rule.atLeast = config.atLeast ?? 6;
	rule.notOnAllies = config.notOnAllies ?? false;
	Object.defineProperty(rule, 'parent', { get: () => guide, configurable: true });
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	actor.rules = [rule];
	items.set(SPIRIT_UUID, used);
	items.set('Actor.a.Item.other', {
		uuid: 'Actor.a.Item.other',
		actor,
		system: { identifier: 'other' },
	});
	return { actor, used, guide, rule };
}

const FRIENDLY = 1;
const NEUTRAL = 0;
const HOSTILE = -1;

const TARGET_A = { uuid: 'Actor.target-a' };
const TARGET_B = { uuid: 'Actor.target-b' };

/** A target token on the scene, with its side. */
function placeToken(uuid: string, actor: object, disposition = HOSTILE) {
	items.set(uuid, { actor, disposition });
}

function card(
	fields: {
		rolls?: unknown[];
		isMiss?: boolean;
		targets?: string[];
		itemUuid?: string;
		type?: string;
		pendingKeep?: unknown;
		author?: { id?: string | null; active?: boolean } | null;
		read?: boolean;
		effects?: unknown[];
	} = {},
) {
	cardCount += 1;
	const flags: Record<string, Record<string, unknown>> = {
		[SYSTEM_ID]: {
			itemUuid: fields.itemUuid ?? SPIRIT_UUID,
			...(fields.read ? { dieResultRead: true } : {}),
		},
	};
	if (!items.has('Scene.s.Token.a')) placeToken('Scene.s.Token.a', TARGET_A);
	if (!items.has('Scene.s.Token.b')) placeToken('Scene.s.Token.b', TARGET_B);
	return {
		id: `card-${cardCount}`,
		author:
			fields.author === undefined ? { id: globals.game.user.id, active: true } : fields.author,
		type: fields.type ?? 'feature',
		flags,
		getFlag: (scope: string, key: string) => flags[scope]?.[key],
		setFlag: vi.fn(async (scope: string, key: string, value: unknown) => {
			flags[scope] = { ...flags[scope], [key]: value };
		}),
		system: {
			isMiss: fields.isMiss ?? false,
			targets: fields.targets ?? ['Scene.s.Token.a'],
			...(fields.pendingKeep ? { pendingKeep: fields.pendingKeep } : {}),
			...(fields.effects ? { activation: { effects: fields.effects as never[] } } : {}),
		},
		rolls: fields.rolls ?? [new FakeDamageRoll(6)],
	};
}

let cardCount = 0;

describe('applyDieResultEffects', () => {
	it.each([6, 7])('applies the effect to the target at a face of %i', async (face) => {
		setup();

		const attack = card({ rolls: [new FakeDamageRoll(face)] });
		await applyDieResultEffects(attack);

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
		// The card of the attack takes the lines of the effect, such as "At N stacks".
		expect(applyEffectToActorMock).toHaveBeenCalledWith(TARGET_A, {
			data: { name: 'Glow' },
			source: {
				itemUuid: GUIDE_UUID,
				user: expect.objectContaining({ uuid: 'Actor.a' }),
				cardId: attack.id,
			},
		});
	});

	it('does not apply the effect at a face of 5', async () => {
		setup();

		await applyDieResultEffects(card({ rolls: [new FakeDamageRoll(5)] }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('reads the face before the Primary Die bonus', async () => {
		setup();

		await applyDieResultEffects(card({ rolls: [new FakeDamageRoll(7, 5)] }));
		expect(applyEffectToActorMock).not.toHaveBeenCalled();

		await applyDieResultEffects(card({ rolls: [new FakeDamageRoll(4, 6)] }));
		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
	});

	it('reads the attack roll, not the first roll of the card', async () => {
		setup();

		await applyDieResultEffects(card({ rolls: [new FakeRoll(), new FakeDamageRoll(6)] }));

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
	});

	it('does not apply the effect on a miss', async () => {
		setup();

		await applyDieResultEffects(card({ isMiss: true }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect while a result waits to be kept', async () => {
		setup();

		await applyDieResultEffects(card({ pendingKeep: { rolls: [] } }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect for a use of another item', async () => {
		setup();

		await applyDieResultEffects(card({ itemUuid: 'Actor.a.Item.other' }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it("reads its own item's uses when the identifier is blank", async () => {
		setup({ itemIdentifier: '', ruleOnUsedItem: true });

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
		expect(payloadFromEffectMock.mock.calls[0][1]).toMatchObject({ itemUuid: SPIRIT_UUID });
	});

	it('does not read another item when the identifier is blank', async () => {
		setup({ itemIdentifier: '' });

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect when rule automation is off', async () => {
		ruleAutomationMock.mockReturnValue(false);
		setup();

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect when the rule is disabled', async () => {
		setup({ disabled: true });

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect when the predicate fails', async () => {
		setup({ predicatePasses: false });

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('applies the effect once to each target', async () => {
		setup();

		await applyDieResultEffects(
			card({ targets: ['Scene.s.Token.a', 'Scene.s.Token.b', 'Scene.s.Token.a'] }),
		);

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(2);
		expect(applyEffectToActorMock.mock.calls.map((call) => call[0])).toEqual([TARGET_A, TARGET_B]);
	});

	it('gives no effect to an ally when the rule is not on allies', async () => {
		setup({ notOnAllies: true });
		placeToken('Scene.s.Token.a', TARGET_A, FRIENDLY);
		placeToken('Scene.s.Token.b', TARGET_B, HOSTILE);

		await applyDieResultEffects(card({ targets: ['Scene.s.Token.a', 'Scene.s.Token.b'] }));

		expect(applyEffectToActorMock.mock.calls.map((call) => call[0])).toEqual([TARGET_B]);
	});

	it('gives the effect to a neutral target when the rule is not on allies', async () => {
		setup({ notOnAllies: true });
		placeToken('Scene.s.Token.a', TARGET_A, NEUTRAL);

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock.mock.calls.map((call) => call[0])).toEqual([TARGET_A]);
	});

	it('gives the effect to an ally when the rule allows allies', async () => {
		setup();
		placeToken('Scene.s.Token.a', TARGET_A, FRIENDLY);

		await applyDieResultEffects(card());

		expect(applyEffectToActorMock.mock.calls.map((call) => call[0])).toEqual([TARGET_A]);
	});

	it("reads the user's side from the card speaker's token", async () => {
		setup({ notOnAllies: true });
		placeToken('Scene.s.Token.a', TARGET_A, HOSTILE);
		const saved = globals.game.scenes;
		globals.game.scenes = {
			get: (id: string) =>
				id === 's'
					? {
							tokens: {
								get: (tokenId: string) => (tokenId === 'me' ? { disposition: HOSTILE } : null),
							},
						}
					: null,
		};
		try {
			await applyDieResultEffects({ ...card(), speaker: { scene: 's', token: 'me' } });
		} finally {
			globals.game.scenes = saved;
		}

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('applies nothing when the card has no target', async () => {
		setup();

		await applyDieResultEffects(card({ targets: [] }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does nothing for a card with only a healing roll', async () => {
		setup();

		await applyDieResultEffects(card({ rolls: [new FakeRoll()] }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('does nothing for a card that is not an activation card', async () => {
		setup();

		await applyDieResultEffects(card({ type: 'savingThrow' }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('applies the effect of each rule whose number the face meets', async () => {
		const { actor, guide } = setup();
		const higher = new DieResultEffectRule(
			{ id: 'rule-2', type: 'dieResultEffect', itemIdentifier: 'spirit', atLeast: 8 } as never,
			{ parent: guide as unknown as foundry.abstract.DataModel.Any, strict: false },
		);
		Object.defineProperty(higher, 'parent', { get: () => guide, configurable: true });
		Object.defineProperty(higher, 'predicate', {
			get: () => ({ size: 0, test: () => true }),
			configurable: true,
		});
		Object.assign(higher, {
			type: 'dieResultEffect',
			disabled: false,
			itemIdentifier: 'spirit',
			atLeast: 8,
		});
		actor.rules = [...(actor.rules as unknown[]), higher];

		await applyDieResultEffects(card({ rolls: [new FakeDamageRoll(6)] }));
		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);

		await applyDieResultEffects(card({ rolls: [new FakeDamageRoll(8)] }));
		expect(applyEffectToActorMock).toHaveBeenCalledTimes(3);
	});
});

describe('registerDieResultEffectHooks', () => {
	type Handler = (document: unknown, options: unknown, userId: string) => void;
	let handlers: Map<string, Handler>;
	let savedHooks: unknown;

	beforeEach(() => {
		savedHooks = globals.Hooks;
		handlers = new Map();
		globals.Hooks = {
			...globals.Hooks,
			on: vi.fn((name: string, handler: Handler) => handlers.set(name, handler)),
		};
		registerDieResultEffectHooks();
	});

	afterEach(() => {
		globals.Hooks = savedHooks;
	});

	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	it('applies the effect on the client of the user who made the card', async () => {
		setup();

		handlers.get('createChatMessage')?.(card(), {}, globals.game.user.id);
		await flush();

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
	});

	it("does not apply the effect on another user's client", async () => {
		setup();

		handlers.get('createChatMessage')?.(
			card({ author: { id: 'another-user', active: true } }),
			{},
			'another-user',
		);
		await flush();

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('applies the effect when a card that waited for Keep a Result is updated', async () => {
		setup();
		const waiting = card({ pendingKeep: { dice: [6, 2] } });

		handlers.get('createChatMessage')?.(waiting, {}, globals.game.user.id);
		await flush();
		expect(applyEffectToActorMock).not.toHaveBeenCalled();

		delete (waiting.system as { pendingKeep?: unknown }).pendingKeep;
		handlers.get('updateChatMessage')?.(waiting, {}, globals.game.user.id);
		await flush();

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
	});

	it('reads a card only once, and marks it read', async () => {
		setup();
		const used = card();

		handlers.get('createChatMessage')?.(used, {}, globals.game.user.id);
		await flush();
		handlers.get('updateChatMessage')?.(used, {}, globals.game.user.id);
		await flush();

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
		expect(used.setFlag).toHaveBeenCalledWith(SYSTEM_ID, 'dieResultRead', true);
	});

	it('does not read a card that another client marked read', async () => {
		setup();

		handlers.get('updateChatMessage')?.(card({ read: true }), {}, globals.game.user.id);
		await flush();

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('lets the active GM read the card when its author is away', async () => {
		setup();
		isActiveGMMock.mockReturnValue(true);

		handlers.get('createChatMessage')?.(
			card({ author: { id: 'another-user', active: false } }),
			{},
			'another-user',
		);
		await flush();

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
	});
});

describe('applyDieResultEffects on the damage of the item in another attack', () => {
	const MACE_UUID = 'Actor.a.Item.other';

	/** A bonus step of the spirit's damage, whose first die shows `face`. */
	function spiritStep(face: number, identifier = 'spirit') {
		return {
			id: 'bonus',
			type: 'damage',
			damageType: 'radiant',
			formula: '1d6+3',
			fromItemIdentifier: identifier,
			parentContext: null,
			parentNode: null,
			roll: {
				class: 'Roll',
				terms: [
					{ class: 'Die', faces: 6, number: 1, results: [{ result: face, active: true }] },
					{ class: 'OperatorTerm', operator: '+' },
					{ class: 'NumericTerm', number: 3 },
				],
				total: face + 3,
			},
		};
	}

	function maceCard(fields: {
		face: number;
		primary?: number;
		isMiss?: boolean;
		identifier?: string;
	}) {
		return card({
			type: 'object',
			itemUuid: MACE_UUID,
			isMiss: fields.isMiss,
			rolls: [new FakeDamageRoll(fields.primary ?? 2)],
			effects: [
				{
					id: 'mace',
					type: 'damage',
					damageType: 'bludgeoning',
					formula: '1d8',
					parentContext: null,
					parentNode: null,
				},
				spiritStep(fields.face, fields.identifier),
			],
		});
	}

	it('applies the effect when the first die of the spirit step is 6 or more', async () => {
		setup();

		await applyDieResultEffects(maceCard({ face: 6 }));

		expect(applyEffectToActorMock).toHaveBeenCalledTimes(1);
		expect(applyEffectToActorMock).toHaveBeenCalledWith(TARGET_A, expect.anything());
	});

	it("reads the spirit's die, not the Primary Die of the attack", async () => {
		setup();

		await applyDieResultEffects(maceCard({ face: 5, primary: 8 }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('applies nothing on a miss, or with a step of another item', async () => {
		setup();

		await applyDieResultEffects(maceCard({ face: 6, isMiss: true }));
		await applyDieResultEffects(maceCard({ face: 6, identifier: 'torch' }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('gives no effect to an ally when the rule is not on allies', async () => {
		setup({ notOnAllies: true });
		placeToken('Scene.s.Token.a', TARGET_A, FRIENDLY);

		await applyDieResultEffects(maceCard({ face: 6 }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});

	it('reads no bonus step when the rule reads its own item', async () => {
		setup({ itemIdentifier: '' });

		await applyDieResultEffects(maceCard({ face: 6, identifier: '' }));

		expect(applyEffectToActorMock).not.toHaveBeenCalled();
	});
});

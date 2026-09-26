import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FreeMoveRule as FreeMoveRuleType } from './freeMove.js';

// tests/setup.ts loads the rules config, so this rule and its imports are
// cached before the mocks below register. Load a fresh copy that sees them.
let FreeMoveRule: typeof FreeMoveRuleType;
beforeAll(async () => {
	vi.resetModules();
	({ FreeMoveRule } = await import('./freeMove.js'));
});

const postMovementOfferCard = vi.fn(async (_input: unknown) => ({ id: 'card' }) as unknown);
vi.mock('../../utils/movement/postMovementOfferCard.js', () => ({
	postMovementOfferCard: (input: unknown) => postMovementOfferCard(input),
}));

const distances = new Map<string, number>();
vi.mock('../../utils/movement/spacesBetween.js', () => ({
	spacesBetween: (a: { id: string }, b: { id: string }) =>
		distances.get(`${a.id}>${b.id}`) ?? Number.POSITIVE_INFINITY,
}));

const { FRIENDLY, HOSTILE, NEUTRAL } = { FRIENDLY: 1, HOSTILE: -1, NEUTRAL: 0 };

interface MockToken {
	id: string;
	uuid: string;
	name: string;
	disposition: number;
	hidden: boolean;
	actor: unknown;
	parent: { tokens: MockToken[] };
}

function makeScene() {
	const scene = { tokens: [] as MockToken[] };
	const addToken = (id: string, overrides: Partial<MockToken> = {}): MockToken => {
		const token: MockToken = {
			id,
			uuid: `Scene.s.Token.${id}`,
			name: id,
			disposition: FRIENDLY,
			hidden: false,
			actor: { id: `actor-${id}` },
			parent: scene,
			...overrides,
		};
		scene.tokens.push(token);
		return token;
	};
	return { scene, addToken };
}

interface Harness {
	rule: FreeMoveRuleType;
	actor: Record<string, unknown>;
	item: Record<string, unknown>;
	heroToken: MockToken | null;
	addToken: (id: string, overrides?: Partial<MockToken>) => MockToken;
}

function makeRule(
	config: Record<string, unknown> = {},
	options: {
		isEmbedded?: boolean;
		predicate?: (domain: Set<string>) => boolean;
		withToken?: boolean;
		pool?: number;
		actorType?: string;
	} = {},
): Harness {
	const { addToken } = makeScene();
	const poolItem =
		options.pool === undefined
			? null
			: {
					id: 'pool-item',
					name: 'Thrill',
					flags: { nimble: { chargePools: { thrill: { current: options.pool, max: 2 } } } },
					rules: new Map([
						[
							'pool-rule',
							{
								type: 'chargePool',
								disabled: false,
								id: 'thrill',
								identifier: 'thrill',
								scope: 'item',
								max: '2',
								initial: 'max',
								recoveries: [],
							},
						],
					]),
					update: vi.fn(async () => undefined),
				};
	const actor: Record<string, unknown> = {
		id: 'hero-actor',
		name: 'Hero',
		type: options.actorType ?? 'character',
		flags: {},
		getDomain: () => new Set<string>(['self:ready']),
		getRollData: () => ({}),
		items: {
			contents: poolItem ? [poolItem] : [],
			get: (id: string) => (poolItem && id === poolItem.id ? poolItem : undefined),
		},
		update: vi.fn(async () => undefined),
	};
	const heroToken = options.withToken === false ? null : addToken('hero', { actor, name: 'Hero' });
	actor.getActiveTokens = () => (heroToken ? [{ document: heroToken }] : []);

	const item: Record<string, unknown> = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: 'Swift Step',
		img: 'icons/step.webp',
		uuid: 'Actor.hero-actor.Item.step',
		getDomain: () => new Set<string>(),
	};

	const rule = new FreeMoveRule({ type: 'freeMove' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		trigger: 'onActivation',
		poolIdentifier: '',
		distance: '@speed',
		recipient: 'self',
		within: 12,
		direction: 'any',
		ignoresDifficultTerrain: false,
		chargePoolIdentifier: '',
		disabled: false,
		id: 'rule-1',
		label: '',
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	const predicate = options.predicate;
	Object.defineProperty(rule, 'predicate', {
		get: () => (predicate ? { size: 1, test: predicate } : { size: 0 }),
		configurable: true,
	});
	return { rule, actor, item, heroToken, addToken };
}

type OfferInput = {
	actor: unknown;
	token: MockToken | null;
	name: string;
	image: string;
	reason: string;
	node: Record<string, unknown>;
	recipients: 'self' | string[];
};

function lastOffer(): OfferInput {
	return postMovementOfferCard.mock.calls.at(-1)?.[0] as OfferInput;
}

function activate(harness: Harness, sourceItem: unknown = harness.item) {
	return harness.rule.onItemActivated({
		sourceItem,
		sourceActor: harness.actor,
		card: null,
	} as never);
}

describe('FreeMoveRule', () => {
	beforeEach(() => {
		postMovementOfferCard.mockClear();
		distances.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('schema', () => {
		let schema: Record<
			string,
			{ initial?: unknown; choices?: unknown; options?: Record<string, unknown> }
		> = {};
		beforeAll(() => {
			schema = FreeMoveRule.defineSchema() as unknown as typeof schema;
		});

		it('defines every field with its default', () => {
			expect(schema.trigger?.initial).toBe('onActivation');
			expect(schema.trigger?.choices).toEqual([
				'onActivation',
				'onPoolGain',
				'onInitiativeRolled',
				'onTurnStart',
				'onCritReceived',
			]);
			expect(schema.poolIdentifier?.initial).toBe('');
			expect(schema.distance?.initial).toBe('@speed');
			expect(schema.recipient?.initial).toBe('self');
			expect(schema.recipient?.choices).toEqual(['self', 'allies', 'selfAndAllies']);
			expect(schema.within?.initial).toBe(12);
			expect(schema.direction?.initial).toBe('any');
			expect(schema.direction?.choices).toEqual(['any', 'away', 'toward']);
			expect(schema.ignoresDifficultTerrain?.initial).toBe(false);
			expect(schema.chargePoolIdentifier?.initial).toBe('');
			expect(schema.type?.initial).toBe('freeMove');
		});

		it('uses the pool pickers and the formula widget', () => {
			expect(schema.poolIdentifier?.options?.widget).toBe('dicePoolPicker');
			expect(schema.chargePoolIdentifier?.options?.widget).toBe('chargePoolPicker');
			expect(schema.distance?.options?.widget).toBe('formula');
		});

		it('shows the pool only for onPoolGain and the range only for allies', () => {
			const poolShow = schema.poolIdentifier?.options?.showWhen as (d: object) => boolean;
			expect(poolShow({ trigger: 'onPoolGain' })).toBe(true);
			expect(poolShow({ trigger: 'onTurnStart' })).toBe(false);
			const withinShow = schema.within?.options?.showWhen as (d: object) => boolean;
			expect(withinShow({ recipient: 'self' })).toBe(false);
			expect(withinShow({ recipient: 'allies' })).toBe(true);
			expect(withinShow({ recipient: 'selfAndAllies' })).toBe(true);
		});
	});

	it('lists in the grants group with a description', () => {
		expect(FreeMoveRule.group).toBe('grants');
		expect(FreeMoveRule.description).toBe('NIMBLE.rules.freeMove.description');
	});

	describe('guards', () => {
		it('does not fire when the item is not embedded on an actor', async () => {
			await activate(makeRule({}, { isEmbedded: false }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('does not fire when disabled', async () => {
			await activate(makeRule({ disabled: true }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('fires only when the predicate passes', async () => {
			await activate(makeRule({}, { predicate: () => false }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
			await activate(makeRule({}, { predicate: (domain) => domain.has('self:ready') }));
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
		});

		it('posts nothing when the actor has no token', async () => {
			await activate(makeRule({}, { withToken: false }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('onActivation', () => {
		it('offers a Free Move with the rule settings when its own item is used', async () => {
			const harness = makeRule({
				distance: '@dexterity',
				direction: 'away',
				ignoresDifficultTerrain: true,
			});
			await activate(harness);

			const offer = lastOffer();
			expect(offer.actor).toBe(harness.actor);
			expect(offer.token).toBe(harness.heroToken);
			expect(offer.name).toBe('Swift Step');
			expect(offer.image).toBe('icons/step.webp');
			expect(offer.recipients).toBe('self');
			expect(offer.node).toEqual({
				kind: 'free',
				chooser: 'mover',
				distance: '@dexterity',
				direction: 'away',
				ignoreDifficultTerrain: true,
			});
			expect(offer.reason).toContain('Swift Step');
		});

		it('does not fire when another item is used', async () => {
			const harness = makeRule();
			await activate(harness, { uuid: 'Actor.hero-actor.Item.other' });
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('uses the speaker token of the activation card', async () => {
			const harness = makeRule();
			const other = harness.addToken('hero-2', { actor: harness.actor });
			vi.stubGlobal('game', {
				...(globalThis as unknown as { game: object }).game,
				scenes: { get: () => ({ tokens: { get: () => other } }) },
			});
			await harness.rule.onItemActivated({
				sourceItem: harness.item,
				sourceActor: harness.actor,
				card: { speaker: { scene: 's', token: 'hero-2' } },
			} as never);
			expect(lastOffer().token).toBe(other);
		});

		it('ignores the event when set to another trigger', async () => {
			await activate(makeRule({ trigger: 'onTurnStart' }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('onInitiativeRolled', () => {
		it("fires for this actor's roll, from the combatant's token", async () => {
			const harness = makeRule({ trigger: 'onInitiativeRolled' });
			const combatToken = harness.addToken('hero-combat', { actor: harness.actor });
			await harness.rule.onInitiativeRolled({
				actor: harness.actor,
				combatant: { token: combatToken },
			} as never);
			expect(lastOffer().token).toBe(combatToken);
			expect(lastOffer().reason).toContain('Initiative');
		});

		it("does not fire for another actor's roll", async () => {
			const harness = makeRule({ trigger: 'onInitiativeRolled' });
			await harness.rule.onInitiativeRolled({ actor: {}, combatant: {} } as never);
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('onTurnStart', () => {
		function turnStart(harness: Harness, actor: unknown = harness.actor) {
			return harness.rule.onActiveGmTurnStart({
				combat: {},
				combatant: { token: harness.heroToken },
				actor,
			} as never);
		}

		it("fires once, on the active GM, at the start of this actor's own turn", async () => {
			const harness = makeRule({ trigger: 'onTurnStart' });
			await turnStart(harness);
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
			expect(lastOffer().reason).toContain('turn');
		});

		it('does not fire from the client-side turn start', async () => {
			const harness = makeRule({ trigger: 'onTurnStart' });
			await harness.rule.onTurnStart({
				combat: {},
				combatant: { token: harness.heroToken },
				actor: harness.actor,
			} as never);
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it("does not fire at the start of another creature's turn", async () => {
			await turnStart(makeRule({ trigger: 'onTurnStart' }), {});
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('guards the turn start path the same as the others', async () => {
			const config = { trigger: 'onTurnStart' };
			await turnStart(makeRule(config, { isEmbedded: false }));
			await turnStart(makeRule({ ...config, disabled: true }));
			await turnStart(makeRule(config, { predicate: () => false }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('onCritReceived', () => {
		function receive(harness: Harness, isCritical: boolean, targetActor: unknown = harness.actor) {
			return harness.rule.onAttackReceived({
				sourceItem: {},
				sourceActor: {},
				targetActor,
				card: null,
				isCritical,
				isMiss: false,
			} as never);
		}

		it('fires when this actor takes a critical hit', async () => {
			const harness = makeRule({ trigger: 'onCritReceived' });
			await receive(harness, true);
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
		});

		it('does not fire on a hit that is not critical, or on another target', async () => {
			const harness = makeRule({ trigger: 'onCritReceived' });
			await receive(harness, false);
			await receive(harness, true, {});
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('onPoolGain', () => {
		function gain(harness: Harness, poolIdentifier: string, poolLabel?: string) {
			return harness.rule.onPoolGain({ actor: harness.actor, poolIdentifier, poolLabel } as never);
		}

		it('fires when the named pool gains dice', async () => {
			await gain(makeRule({ trigger: 'onPoolGain', poolIdentifier: 'fury' }), 'fury', 'Fury Dice');
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
			expect(lastOffer().reason).toContain('Fury Dice');
		});

		it('does not fire for another pool or another trigger', async () => {
			await gain(makeRule({ trigger: 'onPoolGain', poolIdentifier: 'fury' }), 'judgment');
			await gain(makeRule({ trigger: 'onTurnStart', poolIdentifier: 'fury' }), 'fury');
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('does not fire without a configured pool, even for an empty pool identifier', async () => {
			await gain(makeRule({ trigger: 'onPoolGain', poolIdentifier: '' }), '');
			await gain(makeRule({ trigger: 'onPoolGain', poolIdentifier: '  ' }), '');
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('guards the pool path the same as the others', async () => {
			const config = { trigger: 'onPoolGain', poolIdentifier: 'fury' };
			await gain(makeRule(config, { isEmbedded: false }), 'fury');
			await gain(makeRule({ ...config, disabled: true }), 'fury');
			await gain(makeRule(config, { predicate: () => false }), 'fury');
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('recipients', () => {
		function setUpAllies(harness: Harness) {
			const near = harness.addToken('near');
			harness.addToken('far');
			const hidden = harness.addToken('hidden', { hidden: true });
			const enemy = harness.addToken('enemy', { disposition: HOSTILE });
			const neutral = harness.addToken('neutral', { disposition: NEUTRAL });
			const empty = harness.addToken('empty', { actor: null });
			for (const token of [near, hidden, enemy, neutral, empty])
				distances.set(`hero>${token.id}`, 3);
			distances.set('hero>far', 13);
			return { near };
		}

		it('allies: the same-disposition visible creatures within range', async () => {
			const harness = makeRule({ recipient: 'allies', within: 12 });
			const { near } = setUpAllies(harness);
			await activate(harness);
			expect(lastOffer().recipients).toEqual([near.uuid]);
		});

		it('allies: a creature exactly at the range is included, one space beyond is not', async () => {
			const harness = makeRule({ recipient: 'allies', within: 12 });
			const edge = harness.addToken('edge');
			harness.addToken('beyond');
			distances.set('hero>edge', 12);
			distances.set('hero>beyond', 13);
			await activate(harness);
			expect(lastOffer().recipients).toEqual([edge.uuid]);
		});

		it('selfAndAllies: adds the source token', async () => {
			const harness = makeRule({ recipient: 'selfAndAllies', within: 12 });
			const { near } = setUpAllies(harness);
			await activate(harness);
			expect(lastOffer().recipients).toEqual([harness.heroToken?.uuid, near.uuid]);
		});

		it('allies: a neutral source has no allies, so nothing posts', async () => {
			const harness = makeRule({ recipient: 'allies' });
			if (harness.heroToken) harness.heroToken.disposition = NEUTRAL;
			harness.addToken('other', { disposition: NEUTRAL });
			distances.set('hero>other', 1);
			await activate(harness);
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	describe('charge pool', () => {
		function poolItemOf(harness: Harness) {
			return (harness.actor.items as { contents: { update: ReturnType<typeof vi.fn> }[] })
				.contents[0] as { update: ReturnType<typeof vi.fn> };
		}

		it('an empty identifier is unlimited', async () => {
			const harness = makeRule();
			await activate(harness);
			await activate(harness);
			expect(postMovementOfferCard).toHaveBeenCalledTimes(2);
		});

		it('fires while the pool has a charge and spends one', async () => {
			const harness = makeRule({ chargePoolIdentifier: 'thrill' }, { pool: 1 });
			await activate(harness);
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
			expect(poolItemOf(harness).update).toHaveBeenCalledWith(
				{ 'flags.nimble.chargePools': { thrill: expect.objectContaining({ current: 0 }) } },
				expect.anything(),
			);
		});

		it('spends no charge when the card is not posted', async () => {
			postMovementOfferCard.mockResolvedValueOnce(null);
			const harness = makeRule({ chargePoolIdentifier: 'thrill' }, { pool: 1 });
			await activate(harness);
			expect(postMovementOfferCard).toHaveBeenCalledTimes(1);
			expect(poolItemOf(harness).update).not.toHaveBeenCalled();
		});

		it('does not fire on an empty pool', async () => {
			await activate(makeRule({ chargePoolIdentifier: 'thrill' }, { pool: 0 }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});

		it('does not fire for an actor that is not a character', async () => {
			await activate(makeRule({ chargePoolIdentifier: 'thrill' }, { pool: 2, actorType: 'npc' }));
			expect(postMovementOfferCard).not.toHaveBeenCalled();
		});
	});

	it('several rules on one item each post their own offer', async () => {
		const harness = makeRule();
		const second = makeRule({ distance: '2' });
		Object.defineProperty(second.rule, 'item', { get: () => harness.item, configurable: true });
		await activate(harness);
		await second.rule.onItemActivated({
			sourceItem: harness.item,
			sourceActor: harness.actor,
			card: null,
		} as never);
		expect(postMovementOfferCard).toHaveBeenCalledTimes(2);
		expect(lastOffer().node.distance).toBe('2');
	});
});

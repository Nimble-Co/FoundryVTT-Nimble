import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAreAllies, mockAreWithinSpaces } = vi.hoisted(() => ({
	mockAreAllies: vi.fn(),
	mockAreWithinSpaces: vi.fn(),
}));

vi.mock('../tokenAdjacency.js', () => ({
	areAllies: mockAreAllies,
	areWithinSpaces: mockAreWithinSpaces,
}));

// tests/setup.ts boots the system init hook, which eagerly imports the real
// tokenAdjacency module before any per-file vi.mock can register. Resetting the
// module registry and importing dynamically forces a fresh graph that resolves
// through the mocks above.
let collectTargetIncomingModifiers: typeof import('../incomingAttackModifiers.js').collectTargetIncomingModifiers;
let collectRedirectCandidates: typeof import('../incomingAttackModifiers.js').collectRedirectCandidates;
let computeIncomingAttackPlan: typeof import('../incomingAttackModifiers.js').computeIncomingAttackPlan;
let applyPostRollIncomingBehavior: typeof import('../incomingAttackModifiers.js').applyPostRollIncomingBehavior;

beforeAll(async () => {
	vi.resetModules();
	({
		collectTargetIncomingModifiers,
		collectRedirectCandidates,
		computeIncomingAttackPlan,
		applyPostRollIncomingBehavior,
	} = await import('../incomingAttackModifiers.js'));
});

interface MockRule {
	type?: string;
	id?: string;
	label?: string;
	modifier?: 'disadvantage' | 'redirectToSelf' | 'autoMiss' | 'raiseMissThreshold';
	missThreshold?: number;
	range?: number;
	item?: { name?: string; uuid?: string } | null;
	appliesTo?: () => boolean;
}

interface MockActor {
	uuid: string;
	type: string;
	name: string;
	rules: MockRule[];
	system: { attributes: { hp: { value: number } } };
}

interface MockToken {
	actor: MockActor | null;
	document: { id: string; uuid: string; hidden: boolean };
	scene: { id: string };
	/** Distance to the attack's target in spaces; drives the areWithinSpaces mock */
	distanceToTarget: number;
	/** Drives the areAllies mock */
	isAllyOfTarget: boolean;
}

function createRule(overrides: Partial<MockRule> = {}): MockRule {
	return {
		type: 'modifyIncomingAttack',
		id: 'rule-1',
		label: 'Test Rule',
		modifier: 'disadvantage',
		range: 2,
		item: { name: 'Test Item', uuid: 'Item.test-item' },
		appliesTo: () => true,
		...overrides,
	};
}

/** A `reroll` rule that gives the target a button. */
function createTargetRerollRule(id: string) {
	return {
		type: 'reroll',
		id,
		label: '',
		item: { name: 'Pocket Sand', uuid: 'Item.sand' },
		outcome: 'always',
		offersRerollOn: (context: { side: string }) => context.side === 'target',
	};
}

function createActor(overrides: Partial<MockActor> = {}): MockActor {
	return {
		uuid: 'Actor.test-actor',
		type: 'character',
		name: 'Test Actor',
		rules: [],
		system: { attributes: { hp: { value: 10 } } },
		...overrides,
	};
}

let tokenCounter = 0;

function createToken(overrides: Partial<MockToken> = {}): MockToken {
	tokenCounter += 1;
	const id = overrides.document?.id ?? `token-${tokenCounter}`;
	return {
		actor: createActor({ uuid: `Actor.actor-${tokenCounter}` }),
		document: { id, uuid: `Scene.scene.Token.${id}`, hidden: false },
		scene: { id: 'scene-1' },
		distanceToTarget: 1,
		isAllyOfTarget: true,
		...overrides,
	};
}

function setCanvasTokens(tokens: MockToken[]): void {
	(globalThis as unknown as { canvas: unknown }).canvas = {
		tokens: { placeables: tokens },
	};
	(globalThis as unknown as { game: { combat: unknown } }).game.combat = null;
}

function setCombatTokens(tokens: MockToken[], sceneId = 'scene-1'): void {
	(globalThis as unknown as { canvas: unknown }).canvas = { tokens: { placeables: [] } };
	(globalThis as unknown as { game: { combat: unknown } }).game.combat = {
		active: true,
		combatants: {
			contents: tokens.map((token) => ({
				sceneId,
				token: { object: token },
				actor: token.actor,
				defeated: false,
			})),
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockAreAllies.mockImplementation(
		(candidate: MockToken, _target: MockToken) => candidate.isAllyOfTarget,
	);
	mockAreWithinSpaces.mockImplementation(
		(candidate: MockToken, _target: MockToken, spaces: number) =>
			candidate.distanceToTarget <= spaces,
	);
	(globalThis as unknown as { game: { combat: unknown } }).game.combat = null;
	(globalThis as unknown as { canvas: unknown }).canvas = { tokens: { placeables: [] } };
});

describe('collectTargetIncomingModifiers', () => {
	it('returns entries for matching rules', () => {
		const actor = createActor({
			rules: [createRule({ modifier: 'disadvantage' }), createRule({ modifier: 'autoMiss' })],
		});

		const entries = collectTargetIncomingModifiers(actor);

		expect(entries).toEqual([
			expect.objectContaining({ modifier: 'disadvantage' }),
			expect.objectContaining({ modifier: 'autoMiss' }),
		]);
	});

	it('ignores rules of other types', () => {
		const actor = createActor({
			rules: [createRule({ type: 'damageReduction' }), createRule({ type: 'speedBonus' })],
		});

		expect(collectTargetIncomingModifiers(actor)).toEqual([]);
	});

	it('excludes rules whose appliesTo() gate fails', () => {
		const actor = createActor({
			rules: [createRule({ appliesTo: () => false })],
		});

		expect(collectTargetIncomingModifiers(actor)).toEqual([]);
	});

	it('excludes rules without an appliesTo method', () => {
		const actor = createActor({
			rules: [createRule({ appliesTo: undefined })],
		});

		expect(collectTargetIncomingModifiers(actor)).toEqual([]);
	});

	it('excludes redirectToSelf rules (protector-side, not target-side)', () => {
		const actor = createActor({
			rules: [createRule({ modifier: 'redirectToSelf' }), createRule({ modifier: 'disadvantage' })],
		});

		const entries = collectTargetIncomingModifiers(actor);

		expect(entries).toEqual([expect.objectContaining({ modifier: 'disadvantage' })]);
	});

	it('falls back to the owning item name when the rule has no label', () => {
		const actor = createActor({
			rules: [createRule({ label: '', item: { name: 'Blur Cloak', uuid: 'Item.blur' } })],
		});

		const entries = collectTargetIncomingModifiers(actor);

		expect(entries[0]).toMatchObject({
			modifier: 'disadvantage',
			label: 'Blur Cloak',
			ruleId: 'rule-1',
			itemUuid: 'Item.blur',
		});
	});

	it('returns an empty array for a null actor', () => {
		expect(collectTargetIncomingModifiers(null)).toEqual([]);
		expect(collectTargetIncomingModifiers(undefined)).toEqual([]);
	});
});

describe('collectRedirectCandidates', () => {
	it('offers a baseline Interpose entry for an allied living character within 2 spaces', () => {
		const target = createToken();
		const ally = createToken({ distanceToTarget: 2 });
		setCanvasTokens([target, ally]);

		const entries = collectRedirectCandidates(target as never);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(
			expect.objectContaining({
				kind: 'redirectToSelf',
				source: 'baseline',
				actorUuid: ally.actor?.uuid,
				tokenUuid: ally.document.uuid,
				targetTokenUuid: target.document.uuid,
				used: false,
			}),
		);
	});

	it('does not offer a baseline entry for an allied NPC', () => {
		const target = createToken();
		const npcAlly = createToken({ actor: createActor({ type: 'npc' }) });
		setCanvasTokens([target, npcAlly]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('does not offer a baseline entry for an ally at 0 HP', () => {
		const target = createToken();
		const downedAlly = createToken({
			actor: createActor({ system: { attributes: { hp: { value: 0 } } } }),
		});
		setCanvasTokens([target, downedAlly]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('does not offer a rule-granted entry for a downed protector', () => {
		const target = createToken();
		const downedProtector = createToken({
			actor: createActor({
				system: { attributes: { hp: { value: 0 } } },
				rules: [createRule({ modifier: 'redirectToSelf' })],
			}),
		});
		setCanvasTokens([target, downedProtector]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('still offers a rule-granted entry for an actor without a numeric HP attribute', () => {
		const target = createToken();
		const abstractedCompanion = createToken({
			actor: createActor({
				type: 'npc',
				system: { attributes: { hp: {} } } as never,
				rules: [createRule({ modifier: 'redirectToSelf' })],
			}),
		});
		setCanvasTokens([target, abstractedCompanion]);

		expect(collectRedirectCandidates(target as never)).toEqual([
			expect.objectContaining({ kind: 'redirectToSelf', source: 'rule' }),
		]);
	});

	it('excludes hidden combatant tokens on the combat path', () => {
		const target = createToken();
		const hiddenAlly = createToken({
			document: { id: 'hidden-ally', uuid: 'Scene.scene.Token.hidden-ally', hidden: true },
		});
		setCombatTokens([target, hiddenAlly]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('does not offer a baseline entry for an ally beyond 2 spaces', () => {
		const target = createToken();
		const farAlly = createToken({ distanceToTarget: 3 });
		setCanvasTokens([target, farAlly]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('never offers the target itself as a candidate', () => {
		const target = createToken();
		setCanvasTokens([target]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('does not offer entries for enemies', () => {
		const target = createToken();
		const enemy = createToken({ isAllyOfTarget: false });
		setCanvasTokens([target, enemy]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('offers a rule-granted entry when a redirectToSelf rule matches within its range', () => {
		const target = createToken();
		const protector = createToken({
			distanceToTarget: 4,
			actor: createActor({
				rules: [
					createRule({
						modifier: 'redirectToSelf',
						range: 5,
						id: 'bodyguard-rule',
						label: 'Bodyguard',
						item: { name: 'Bodyguard Feature', uuid: 'Item.bodyguard' },
					}),
				],
			}),
		});
		setCanvasTokens([target, protector]);

		const entries = collectRedirectCandidates(target as never);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(
			expect.objectContaining({
				kind: 'redirectToSelf',
				source: 'rule',
				label: 'Bodyguard',
				ruleId: 'bodyguard-rule',
				itemUuid: 'Item.bodyguard',
			}),
		);
	});

	it('offers a rule-granted entry for non-character actors such as a monster companion', () => {
		const target = createToken();
		const companion = createToken({
			actor: createActor({
				type: 'npc',
				rules: [createRule({ modifier: 'redirectToSelf', id: 'companion-rule' })],
			}),
		});
		setCanvasTokens([target, companion]);

		const entries = collectRedirectCandidates(target as never);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(
			expect.objectContaining({ source: 'rule', ruleId: 'companion-rule' }),
		);
	});

	it('excludes a redirectToSelf rule whose own range is exceeded', () => {
		const target = createToken();
		const protector = createToken({
			distanceToTarget: 4,
			actor: createActor({
				type: 'npc',
				rules: [createRule({ modifier: 'redirectToSelf', range: 3 })],
			}),
		});
		setCanvasTokens([target, protector]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});

	it('prefers the rule-granted entry over the baseline for the same token', () => {
		const target = createToken();
		const protector = createToken({
			distanceToTarget: 1,
			actor: createActor({
				rules: [createRule({ modifier: 'redirectToSelf', id: 'granted-rule' })],
			}),
		});
		setCanvasTokens([target, protector]);

		const entries = collectRedirectCandidates(target as never);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(expect.objectContaining({ source: 'rule', ruleId: 'granted-rule' }));
	});

	it('uses combatant tokens when a combat is active', () => {
		const target = createToken();
		const combatAlly = createToken();
		const canvasOnlyAlly = createToken();
		setCombatTokens([target, combatAlly]);
		// canvasOnlyAlly is only on the canvas, not in the combat
		(globalThis as unknown as { canvas: unknown }).canvas = {
			tokens: { placeables: [target, combatAlly, canvasOnlyAlly] },
		};

		const entries = collectRedirectCandidates(target as never);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.tokenUuid).toBe(combatAlly.document.uuid);
	});

	it('excludes hidden tokens on the non-combat path', () => {
		const target = createToken();
		const hiddenAlly = createToken();
		hiddenAlly.document.hidden = true;
		setCanvasTokens([target, hiddenAlly]);

		expect(collectRedirectCandidates(target as never)).toEqual([]);
	});
});

describe('computeIncomingAttackPlan', () => {
	it('returns an empty plan for a null token', () => {
		expect(computeIncomingAttackPlan(null)).toEqual({
			disadvantageCount: 0,
			forceMiss: false,
			missThreshold: 1,
			appliedEntries: [],
			reactionEntries: [],
			autoRerollEntries: [],
		});
	});

	it('returns an empty plan for a token without an actor', () => {
		const token = createToken({ actor: null });

		expect(computeIncomingAttackPlan(token as never)).toEqual({
			disadvantageCount: 0,
			forceMiss: false,
			missThreshold: 1,
			appliedEntries: [],
			reactionEntries: [],
			autoRerollEntries: [],
		});
	});

	it('aggregates multiple disadvantage rules into the disadvantage count', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'disadvantage', id: 'rule-a' }),
					createRule({ modifier: 'disadvantage', id: 'rule-b' }),
				],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.disadvantageCount).toBe(2);
		expect(plan.forceMiss).toBe(false);
		expect(plan.appliedEntries).toHaveLength(2);
	});

	it('sets forceMiss and suppresses all reactions when an autoMiss rule applies', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'autoMiss', id: 'auto-miss' }),
					createTargetRerollRule('target-reroll') as never,
				],
			}),
		});
		const ally = createToken();
		setCanvasTokens([target, ally]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.forceMiss).toBe(true);
		expect(plan.appliedEntries).toEqual([expect.objectContaining({ modifier: 'autoMiss' })]);
		expect(plan.reactionEntries).toEqual([]);
	});

	it('defaults the miss threshold to 1 when no rule raises it', () => {
		const target = createToken({
			actor: createActor({ rules: [createRule({ modifier: 'disadvantage' })] }),
		});
		setCanvasTokens([target]);

		expect(computeIncomingAttackPlan(target as never).missThreshold).toBe(1);
	});

	it('raises the miss threshold and records the rule that raised it', () => {
		const target = createToken({
			actor: createActor({
				rules: [createRule({ modifier: 'raiseMissThreshold', missThreshold: 2, id: 'parry' })],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.missThreshold).toBe(2);
		expect(plan.appliedEntries).toEqual([
			expect.objectContaining({ modifier: 'raiseMissThreshold', missThreshold: 2 }),
		]);
	});

	it('takes the maximum of stacked miss thresholds rather than the sum', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'raiseMissThreshold', missThreshold: 3, id: 'parry-c' }),
					createRule({ modifier: 'raiseMissThreshold', missThreshold: 2, id: 'parry-a' }),
				],
			}),
		});
		setCanvasTokens([target]);

		expect(computeIncomingAttackPlan(target as never).missThreshold).toBe(3);
	});

	it('keeps two threshold-2 sources at 2', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'raiseMissThreshold', missThreshold: 2, id: 'parry-a' }),
					createRule({ modifier: 'raiseMissThreshold', missThreshold: 2, id: 'parry-b' }),
				],
			}),
		});
		setCanvasTokens([target]);

		expect(computeIncomingAttackPlan(target as never).missThreshold).toBe(2);
	});

	it('includes redirect candidates from allies alongside target-side reactions', () => {
		const target = createToken({
			actor: createActor({
				rules: [createTargetRerollRule('reroll-rule') as never],
			}),
		});
		const ally = createToken();
		setCanvasTokens([target, ally]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.reactionEntries).toHaveLength(2);
		expect(plan.reactionEntries.map((entry) => entry.kind)).toEqual(['reroll', 'redirectToSelf']);
	});

	it('assigns unique ids to reaction entries', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createTargetRerollRule('rule-a') as never,
					createTargetRerollRule('rule-b') as never,
				],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);
		const ids = plan.reactionEntries.map((entry) => entry.id);

		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
	});

	it('forwards the attack context to the attacker-side offer collector', () => {
		const providesCardOffer = vi.fn(() => false);
		const attacker = {
			uuid: 'Actor.attacker',
			rules: [{ type: 'diceConsumer', id: 'consumer', providesCardOffer }],
		};

		computeIncomingAttackPlan(null, attacker as never, { delivery: 'ranged' });

		expect(providesCardOffer).toHaveBeenCalledWith({ delivery: 'ranged' });
	});
});

describe('applyPostRollIncomingBehavior', () => {
	function makeRoll(isCritical: boolean, forceMiss = false, isMiss = false) {
		return {
			isCritical,
			isMiss,
			originalFormula: '1d8',
			options: { forceMiss, netRollMode: -1, rollMode: 0 } as Record<string, unknown>,
			toJSON: () => ({ class: 'DamageRoll', total: isCritical ? 16 : 5 }),
		};
	}

	function rerollEntry(outcomeTrigger: 'always' | 'hit' | 'criticalHit') {
		return {
			id: 'auto-1',
			kind: 'reroll' as const,
			source: 'rule' as const,
			actorUuid: 'Actor.target',
			tokenUuid: null,
			targetTokenUuid: 'Scene.s.Token.target',
			side: 'target' as const,
			label: "Mountain's Endurance",
			ruleId: 'rule-1',
			itemUuid: 'Item.endurance',
			used: false,
			outcomeTrigger,
		};
	}

	/** An automatic `reroll` rule with no cost, and its entry. */
	function automaticReroll(outcomeTrigger: 'always' | 'hit' | 'criticalHit') {
		const entry = rerollEntry(outcomeTrigger);
		const rule = {
			type: 'reroll',
			id: 'rule-1',
			automatic: true,
			rerollsByItself: true,
			outcome: outcomeTrigger,
		};
		return { autoRerollEntries: [entry], rerollRules: new Map([[entry.id, rule]]) };
	}

	const emptyPlan = () => ({
		disadvantageCount: 0,
		forceMiss: false,
		missThreshold: 1,
		appliedEntries: [],
		reactionEntries: [],
		autoRerollEntries: [],
	});

	it('rerolls a crit when the automatic entry is crit-gated and the roll crit', async () => {
		const roll = makeRoll(true);
		const rebuilt = makeRoll(false);
		const rebuildRoll = vi.fn(
			async (_formula: string, _options: Record<string, unknown>) => rebuilt,
		);

		const result = await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), ...automaticReroll('criticalHit') },
			rebuildRoll,
		);

		expect(rebuildRoll).toHaveBeenCalledTimes(1);
		// netRollMode is stripped before rebuild so the ctor recomputes it
		expect(rebuildRoll.mock.calls[0][1]).not.toHaveProperty('netRollMode');
		expect(result.roll).toBe(rebuilt);
		expect(result.discardedRoll).toEqual({ class: 'DamageRoll', total: 16 });
		expect(result.stampEntries).toEqual([expect.objectContaining({ id: 'auto-1', used: true })]);
	});

	it('does not reroll a non-crit when the automatic entry is crit-gated', async () => {
		const roll = makeRoll(false);
		const rebuildRoll = vi.fn(async () => makeRoll(false));

		const result = await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), ...automaticReroll('criticalHit') },
			rebuildRoll,
		);

		expect(rebuildRoll).not.toHaveBeenCalled();
		expect(result.roll).toBe(roll);
		expect(result.discardedRoll).toBeNull();
		expect(result.stampEntries).toEqual([]);
	});

	it('passes interactive offers through unchanged', async () => {
		const roll = makeRoll(false);
		const offer = { ...rerollEntry('always'), id: 'offer-1' };

		const result = await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), reactionEntries: [offer] },
			vi.fn(async () => makeRoll(false)),
		);

		expect(result.stampEntries).toEqual([offer]);
	});

	it('fires a hit-gated automatic reroll on a hit but not on a miss', async () => {
		const hitRoll = makeRoll(false, false, false); // not a miss
		const missRoll = makeRoll(false, false, true); // a miss

		const onHit = await applyPostRollIncomingBehavior(
			hitRoll,
			{ ...emptyPlan(), ...automaticReroll('hit') },
			vi.fn(async () => makeRoll(false)),
		);
		expect(onHit.discardedRoll).not.toBeNull();

		const rebuildMiss = vi.fn(async () => makeRoll(false));
		const onMiss = await applyPostRollIncomingBehavior(
			missRoll,
			{ ...emptyPlan(), ...automaticReroll('hit') },
			rebuildMiss,
		);
		expect(rebuildMiss).not.toHaveBeenCalled();
		expect(onMiss.roll).toBe(missRoll);
	});

	it('drops a set primary die value and keeps the primary die modifier', async () => {
		const roll = makeRoll(true);
		Object.assign(roll.options, { primaryDieValue: 20, primaryDieModifier: 2 });
		const rebuildRoll = vi.fn(async (_formula: string, _options: Record<string, unknown>) =>
			makeRoll(false),
		);

		await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), ...automaticReroll('criticalHit') },
			rebuildRoll,
		);

		const opts = rebuildRoll.mock.calls[0][1];
		expect(opts).not.toHaveProperty('primaryDieValue');
		expect(opts.primaryDieModifier).toBe(2);
	});

	describe('attacker-side spend offers', () => {
		function spendOffer(outcomeTrigger: 'always' | 'hit' | 'criticalHit') {
			return {
				id: 'spend-1',
				kind: 'spendPoolForDamage' as const,
				source: 'rule' as const,
				actorUuid: 'Actor.berserker',
				tokenUuid: null,
				targetTokenUuid: null,
				label: 'Death Blow',
				ruleId: 'death-blow-fury-consumer',
				itemUuid: 'Item.death-blow',
				used: false,
				outcomeTrigger,
			};
		}

		it('stamps a crit-gated spend offer when the attack crit', async () => {
			const result = await applyPostRollIncomingBehavior(
				makeRoll(true),
				{ ...emptyPlan(), reactionEntries: [spendOffer('criticalHit')] },
				vi.fn(async () => makeRoll(false)),
			);

			expect(result.stampEntries).toEqual([spendOffer('criticalHit')]);
		});

		it('drops a crit-gated spend offer on an ordinary hit', async () => {
			const result = await applyPostRollIncomingBehavior(
				makeRoll(false),
				{ ...emptyPlan(), reactionEntries: [spendOffer('criticalHit')] },
				vi.fn(async () => makeRoll(false)),
			);

			expect(result.stampEntries).toEqual([]);
		});

		it('drops a hit-gated spend offer on a miss', async () => {
			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, false, true),
				{ ...emptyPlan(), reactionEntries: [spendOffer('hit')] },
				vi.fn(async () => makeRoll(false)),
			);

			expect(result.stampEntries).toEqual([]);
		});

		it('keeps an outcome-independent offer whatever the roll did', async () => {
			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, false, true),
				{ ...emptyPlan(), reactionEntries: [spendOffer('always')] },
				vi.fn(async () => makeRoll(false)),
			);

			expect(result.stampEntries).toHaveLength(1);
		});

		it('gates against the reroll result, not the discarded first roll', async () => {
			// The auto-reroll turns a crit into a normal hit, so a crit-gated
			// spend offer must not survive on the strength of the roll that was
			// thrown away.
			const result = await applyPostRollIncomingBehavior(
				makeRoll(true),
				{
					...emptyPlan(),
					...automaticReroll('criticalHit'),
					reactionEntries: [spendOffer('criticalHit')],
				},
				vi.fn(async () => makeRoll(false)),
			);

			expect(result.stampEntries.map((e) => e.id)).toEqual(['auto-1']);
		});
	});
});

describe('Reroll rules on the attack', () => {
	const FREE = {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '' as const,
	};

	function rerollRule(overrides: Record<string, unknown> = {}) {
		return {
			type: 'reroll',
			id: 'reroll-1',
			label: '',
			item: { name: 'Pocket Sand', uuid: 'Item.sand' },
			outcome: 'always',
			automatic: false,
			discardedCritTriggers: false,
			rerollCost: FREE,
			offersRerollOn: vi.fn((context: { side: string }) => context.side === 'target'),
			rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
			...overrides,
		};
	}

	function makeRoll(isCritical: boolean, isMiss = false, forceMiss = false, primaryDieValue = 8) {
		return {
			isCritical,
			isMiss,
			primaryDieValue,
			primaryDie: { faces: 8 },
			originalFormula: '1d8 + 2',
			options: { forceMiss, rollMode: 0, primaryDieModifier: 1 } as Record<string, unknown>,
			toJSON: () => ({ class: 'DamageRoll', total: 10 }),
		};
	}

	describe('computeIncomingAttackPlan', () => {
		it('stamps the attacker rules for the roller and the target rules for the target', () => {
			const rollerRule = rerollRule({
				id: 'roller-rule',
				offersRerollOn: vi.fn((context: { side: string }) => context.side === 'roller'),
			});
			const targetRule = rerollRule({ id: 'target-rule' });
			const target = createToken({
				actor: createActor({ uuid: 'Actor.target', rules: [targetRule] as never }),
			});
			setCanvasTokens([target]);

			const plan = computeIncomingAttackPlan(
				target as never,
				{ uuid: 'Actor.attacker', rules: [rollerRule] } as never,
				{ delivery: 'melee' },
			);

			const rerolls = plan.reactionEntries.filter((entry) => entry.kind === 'reroll');
			expect(rerolls).toEqual([
				expect.objectContaining({
					actorUuid: 'Actor.attacker',
					ruleId: 'roller-rule',
					targetTokenUuid: null,
					side: 'roller',
				}),
				expect.objectContaining({
					actorUuid: 'Actor.target',
					ruleId: 'target-rule',
					targetTokenUuid: target.document.uuid,
					side: 'target',
				}),
			]);
			expect(rollerRule.offersRerollOn).toHaveBeenCalledWith({
				side: 'roller',
				roll: { kind: 'attack', delivery: 'melee' },
			});
			expect(targetRule.offersRerollOn).toHaveBeenCalledWith({
				side: 'target',
				roll: { kind: 'attack', delivery: 'melee' },
			});
		});

		it("stamps the ally rules of creatures on the attacker's scene after the roller rules", () => {
			const allyRule = rerollRule({
				id: 'ally-rule',
				usedBy: 'ally',
				offersRerollOn: vi.fn((context: { side: string }) => context.side === 'ally'),
			});
			const target = createToken({ actor: createActor({ uuid: 'Actor.target' }) });
			setCanvasTokens([target]);
			const scene = { grid: { isGridless: true, size: 100 }, tokens: [] as unknown[] };
			const placed = (id: string, actor: unknown) => ({
				id,
				uuid: `Scene.s.Token.${id}`,
				x: 0,
				y: 0,
				hidden: false,
				disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
				actor,
				parent: scene,
			});
			const attackerToken = placed('attacker', { uuid: 'Actor.attacker', rules: [] });
			scene.tokens.push(attackerToken, placed('bard', { uuid: 'Actor.bard', rules: [allyRule] }));

			const plan = computeIncomingAttackPlan(
				target as never,
				{ uuid: 'Actor.attacker', rules: [], token: attackerToken } as never,
				{ delivery: 'melee' },
			);

			expect(plan.reactionEntries.filter((entry) => entry.kind === 'reroll')).toEqual([
				expect.objectContaining({
					actorUuid: 'Actor.bard',
					tokenUuid: 'Scene.s.Token.bard',
					ruleId: 'ally-rule',
					side: 'ally',
					leftOut: null,
				}),
			]);
		});

		it('puts an automatic rule on the automatic list with its rule', () => {
			const rule = rerollRule({ automatic: true, rerollsByItself: true });
			const target = createToken({ actor: createActor({ rules: [rule] as never }) });
			setCanvasTokens([target]);

			const plan = computeIncomingAttackPlan(target as never);

			expect(plan.reactionEntries.some((entry) => entry.kind === 'reroll')).toBe(false);
			expect(plan.autoRerollEntries).toHaveLength(1);
			expect(plan.rerollRules?.get(plan.autoRerollEntries[0].id)).toBe(rule);
		});

		it('gives a target no reroll against an attack that misses by force', () => {
			const target = createToken({
				actor: createActor({
					rules: [rerollRule(), createRule({ modifier: 'autoMiss' })] as never,
				}),
			});
			setCanvasTokens([target]);

			const plan = computeIncomingAttackPlan(target as never);

			expect(plan.reactionEntries.some((entry) => entry.kind === 'reroll')).toBe(false);
		});
	});

	describe('applyPostRollIncomingBehavior', () => {
		function rerollEntry(outcomeTrigger: string, overrides: Record<string, unknown> = {}) {
			return {
				id: 'reroll-entry',
				kind: 'reroll' as const,
				source: 'rule' as const,
				actorUuid: 'Actor.target',
				tokenUuid: null,
				targetTokenUuid: 'Scene.s.Token.target',
				label: 'Pocket Sand',
				ruleId: 'reroll-1',
				itemUuid: 'Item.sand',
				used: false,
				outcomeTrigger: outcomeTrigger as 'always',
				...overrides,
			};
		}

		function plan(overrides: Record<string, unknown> = {}) {
			return {
				disadvantageCount: 0,
				forceMiss: false,
				missThreshold: 1,
				appliedEntries: [],
				reactionEntries: [],
				autoRerollEntries: [],
				...overrides,
			};
		}

		it('keeps a reroll button only for the outcome it names', async () => {
			const entries = [
				rerollEntry('miss', { id: 'on-miss' }),
				rerollEntry('nonCriticalHit', { id: 'on-plain-hit' }),
				rerollEntry('criticalHit', { id: 'on-crit' }),
			];
			const onMiss = await applyPostRollIncomingBehavior(
				makeRoll(false, true),
				plan({ reactionEntries: entries }),
				vi.fn(),
			);
			const onHit = await applyPostRollIncomingBehavior(
				makeRoll(false),
				plan({ reactionEntries: entries }),
				vi.fn(),
			);

			expect(onMiss.stampEntries.map((e) => e.id)).toEqual(['on-miss']);
			expect(onHit.stampEntries.map((e) => e.id)).toEqual(['on-plain-hit']);
		});

		it('drops reroll buttons from a roll that misses by force', async () => {
			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, true, true),
				plan({ reactionEntries: [rerollEntry('miss')] }),
				vi.fn(),
			);
			expect(result.stampEntries).toEqual([]);
		});

		it('rerolls by itself with the rule changes and keeps the history', async () => {
			const rule = rerollRule({
				automatic: true,
				rerollsByItself: true,
				rerollChanges: () => ({ rollModeChange: -1, primaryDieBonus: 2, extraDamage: '1d6' }),
			});
			const entry = rerollEntry('criticalHit');
			const rebuilt = makeRoll(false, false, false, 4);
			const rebuildRoll = vi.fn(
				async (_formula: string, _options: Record<string, unknown>) => rebuilt,
			);

			const result = await applyPostRollIncomingBehavior(
				makeRoll(true),
				plan({ autoRerollEntries: [entry], rerollRules: new Map([[entry.id, rule]]) }),
				rebuildRoll,
			);

			expect(rebuildRoll).toHaveBeenCalledWith('1d8 + 2 + (1d6)', {
				forceMiss: false,
				rollMode: 0,
				rollModeSources: [0, -1],
				primaryDieModifier: 3,
			});
			expect(result.roll).toBe(rebuilt);
			expect(result.discardedRoll).toEqual({ class: 'DamageRoll', total: 10 });
			expect(result.stampEntries).toEqual([expect.objectContaining({ id: entry.id, used: true })]);
			expect(result.rerollHistory).toEqual({
				rerolls: [
					{
						entryId: entry.id,
						itemUuid: 'Item.sand',
						ruleId: 'reroll-1',
						label: 'Pocket Sand',
						actorUuid: 'Actor.target',
						faces: 8,
						previous: { value: 8, outcome: 'crit' },
						next: { value: 4, outcome: null },
						usesLeft: null,
						woundsGained: 0,
					},
				],
				discardedCritTriggers: false,
			});
		});

		it('keeps the first roll when the cost cannot be paid', async () => {
			const actor = { system: { resources: { mana: { current: 0, max: 5 } } } };
			const entry = rerollEntry('always');
			const rule = rerollRule({
				automatic: true,
				rerollsByItself: true,
				actor,
				rerollCost: { ...FREE, manaCost: 1 },
			});
			const first = makeRoll(false);
			const rebuildRoll = vi.fn();

			const result = await applyPostRollIncomingBehavior(
				first,
				plan({ autoRerollEntries: [entry], rerollRules: new Map([[entry.id, rule]]) }),
				rebuildRoll,
			);

			expect(rebuildRoll).not.toHaveBeenCalled();
			expect(result.roll).toBe(first);
			expect(result.rerollHistory).toBeNull();
			expect(result.stampEntries).toEqual([]);
		});

		it('throws when the new roll fails', async () => {
			const entry = rerollEntry('always');
			const rule = rerollRule({ automatic: true, rerollsByItself: true });

			await expect(
				applyPostRollIncomingBehavior(
					makeRoll(false),
					plan({ autoRerollEntries: [entry], rerollRules: new Map([[entry.id, rule]]) }),
					vi.fn(async () => {
						throw new Error('roll failed');
					}),
				),
			).rejects.toThrow('roll failed');
		});

		function automaticPlan(entries: ReturnType<typeof rerollEntry>[]) {
			const rules = new Map(
				entries.map((entry) => [
					entry.id,
					rerollRule({ id: entry.ruleId, automatic: true, rerollsByItself: true }),
				]),
			);
			return plan({ autoRerollEntries: entries, rerollRules: rules });
		}

		it('runs the next automatic rule that matches the new roll', async () => {
			const onMiss = rerollEntry('miss', { id: 'on-miss', ruleId: 'rule-a' });
			const onCrit = rerollEntry('criticalHit', { id: 'on-crit', ruleId: 'rule-b' });
			const crit = makeRoll(true, false, false, 8);
			const hit = makeRoll(false, false, false, 5);
			const rebuildRoll = vi.fn().mockResolvedValueOnce(crit).mockResolvedValueOnce(hit);

			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, true, false, 1),
				automaticPlan([onMiss, onCrit]),
				rebuildRoll,
			);

			expect(rebuildRoll).toHaveBeenCalledTimes(2);
			expect(result.roll).toBe(hit);
			expect(result.stampEntries.map((entry) => [entry.id, entry.used])).toEqual([
				['on-miss', true],
				['on-crit', true],
			]);
			expect(result.rerollHistory?.rerolls).toMatchObject([
				{
					entryId: 'on-miss',
					previous: { value: 1, outcome: 'miss' },
					next: { value: 8, outcome: 'crit' },
				},
				{
					entryId: 'on-crit',
					previous: { value: 8, outcome: 'crit' },
					next: { value: 5, outcome: null },
				},
			]);
		});

		it('never runs one rule twice on a roll', async () => {
			const onMiss = rerollEntry('miss', { id: 'on-miss', ruleId: 'rule-a' });
			const rebuildRoll = vi.fn(async () => makeRoll(false, true, false, 1));

			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, true, false, 1),
				automaticPlan([onMiss]),
				rebuildRoll,
			);

			expect(rebuildRoll).toHaveBeenCalledTimes(1);
			expect(result.stampEntries.map((entry) => entry.id)).toEqual(['on-miss']);
		});

		it('runs no automatic rule on a roll that misses by force', async () => {
			const onMiss = rerollEntry('miss', { id: 'on-miss', ruleId: 'rule-a' });
			const rebuildRoll = vi.fn();

			const result = await applyPostRollIncomingBehavior(
				makeRoll(false, true, true, 1),
				automaticPlan([onMiss]),
				rebuildRoll,
			);

			expect(rebuildRoll).not.toHaveBeenCalled();
			expect(result.stampEntries).toEqual([]);
		});
	});
});

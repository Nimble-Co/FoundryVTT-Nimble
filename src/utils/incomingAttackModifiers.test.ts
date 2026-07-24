import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAreAllies, mockAreWithinSpaces } = vi.hoisted(() => ({
	mockAreAllies: vi.fn(),
	mockAreWithinSpaces: vi.fn(),
}));

vi.mock('./tokenAdjacency.js', () => ({
	areAllies: mockAreAllies,
	areWithinSpaces: mockAreWithinSpaces,
}));

// tests/setup.ts boots the system init hook, which eagerly imports the real
// tokenAdjacency module before any per-file vi.mock can register. Resetting the
// module registry and importing dynamically forces a fresh graph that resolves
// through the mocks above.
let collectTargetIncomingModifiers: typeof import('./incomingAttackModifiers.js').collectTargetIncomingModifiers;
let collectRedirectCandidates: typeof import('./incomingAttackModifiers.js').collectRedirectCandidates;
let computeIncomingAttackPlan: typeof import('./incomingAttackModifiers.js').computeIncomingAttackPlan;
let applyPostRollIncomingBehavior: typeof import('./incomingAttackModifiers.js').applyPostRollIncomingBehavior;

beforeAll(async () => {
	vi.resetModules();
	({
		collectTargetIncomingModifiers,
		collectRedirectCandidates,
		computeIncomingAttackPlan,
		applyPostRollIncomingBehavior,
	} = await import('./incomingAttackModifiers.js'));
});

interface MockRule {
	type?: string;
	id?: string;
	label?: string;
	modifier?: 'disadvantage' | 'forceReroll' | 'redirectToSelf' | 'autoMiss';
	range?: number;
	automatic?: boolean;
	rerollTrigger?: 'always' | 'criticalHit';
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
			rules: [createRule({ modifier: 'redirectToSelf' }), createRule({ modifier: 'forceReroll' })],
		});

		const entries = collectTargetIncomingModifiers(actor);

		expect(entries).toEqual([expect.objectContaining({ modifier: 'forceReroll' })]);
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
					createRule({ modifier: 'forceReroll', id: 'force-reroll' }),
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

	it('creates a forceReroll reaction entry bound to the target actor', () => {
		const target = createToken({
			actor: createActor({
				uuid: 'Actor.target-actor',
				rules: [
					createRule({
						modifier: 'forceReroll',
						id: 'reroll-rule',
						label: 'Fate Twist',
						item: { name: 'Fate Item', uuid: 'Item.fate' },
					}),
				],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.disadvantageCount).toBe(0);
		expect(plan.reactionEntries).toHaveLength(1);
		expect(plan.reactionEntries[0]).toEqual(
			expect.objectContaining({
				kind: 'forceReroll',
				source: 'rule',
				actorUuid: 'Actor.target-actor',
				tokenUuid: null,
				targetTokenUuid: target.document.uuid,
				label: 'Fate Twist',
				ruleId: 'reroll-rule',
				itemUuid: 'Item.fate',
				used: false,
			}),
		);
	});

	it('includes redirect candidates from allies alongside target-side reactions', () => {
		const target = createToken({
			actor: createActor({
				rules: [createRule({ modifier: 'forceReroll', id: 'reroll-rule' })],
			}),
		});
		const ally = createToken();
		setCanvasTokens([target, ally]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.reactionEntries).toHaveLength(2);
		expect(plan.reactionEntries.map((entry) => entry.kind)).toEqual([
			'forceReroll',
			'redirectToSelf',
		]);
	});

	it('assigns unique ids to reaction entries', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'forceReroll', id: 'rule-a' }),
					createRule({ modifier: 'forceReroll', id: 'rule-b' }),
				],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);
		const ids = plan.reactionEntries.map((entry) => entry.id);

		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
	});

	it('routes an automatic forceReroll rule into autoRerollEntries, not offers', () => {
		const target = createToken({
			actor: createActor({
				rules: [
					createRule({ modifier: 'forceReroll', automatic: true, rerollTrigger: 'criticalHit' }),
				],
			}),
		});
		setCanvasTokens([target]);

		const plan = computeIncomingAttackPlan(target as never);

		expect(plan.reactionEntries.some((e) => e.kind === 'forceReroll')).toBe(false);
		expect(plan.autoRerollEntries).toHaveLength(1);
		expect(plan.autoRerollEntries[0].rerollTrigger).toBe('criticalHit');
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

	function autoEntry(
		rerollTrigger: 'always' | 'hit' | 'criticalHit',
		rerollWithDisadvantage = false,
	) {
		return {
			id: 'auto-1',
			kind: 'forceReroll' as const,
			source: 'rule' as const,
			actorUuid: 'Actor.target',
			tokenUuid: null,
			targetTokenUuid: 'Scene.s.Token.target',
			label: "Mountain's Endurance",
			ruleId: 'rule-1',
			itemUuid: '',
			used: false,
			rerollTrigger,
			rerollWithDisadvantage,
		};
	}

	const emptyPlan = () => ({
		disadvantageCount: 0,
		forceMiss: false,
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
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('criticalHit')] },
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
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('criticalHit')] },
			rebuildRoll,
		);

		expect(rebuildRoll).not.toHaveBeenCalled();
		expect(result.roll).toBe(roll);
		expect(result.discardedRoll).toBeNull();
		expect(result.stampEntries).toEqual([]);
	});

	it('never rerolls when the attack was force-missed', async () => {
		const roll = makeRoll(true, true);
		const rebuildRoll = vi.fn(async () => makeRoll(false));

		const result = await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('always')] },
			rebuildRoll,
		);

		expect(rebuildRoll).not.toHaveBeenCalled();
		expect(result.roll).toBe(roll);
	});

	it('passes interactive offers through unchanged', async () => {
		const roll = makeRoll(false);
		const offer = { ...autoEntry('always'), id: 'offer-1', automatic: undefined };

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
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('hit')] },
			vi.fn(async () => makeRoll(false)),
		);
		expect(onHit.discardedRoll).not.toBeNull();

		const rebuildMiss = vi.fn(async () => makeRoll(false));
		const onMiss = await applyPostRollIncomingBehavior(
			missRoll,
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('hit')] },
			rebuildMiss,
		);
		expect(rebuildMiss).not.toHaveBeenCalled();
		expect(onMiss.roll).toBe(missRoll);
	});

	it('rebuilds an automatic reroll at disadvantage when the rule says so', async () => {
		const roll = makeRoll(true);
		const rebuildRoll = vi.fn(async (_formula: string, _options: Record<string, unknown>) =>
			makeRoll(false),
		);

		await applyPostRollIncomingBehavior(
			roll,
			{ ...emptyPlan(), autoRerollEntries: [autoEntry('criticalHit', true)] },
			rebuildRoll,
		);

		const opts = rebuildRoll.mock.calls[0][1] as {
			rollModeSources?: number[];
			netRollMode?: number;
		};
		expect(opts.rollModeSources).toContain(-1);
		expect(opts).not.toHaveProperty('netRollMode');
	});

	it('drops a hit-gated interactive offer when the final roll was a miss', async () => {
		const missRoll = makeRoll(false, false, true);
		const offer = { ...autoEntry('hit'), id: 'offer-1', automatic: undefined };

		const result = await applyPostRollIncomingBehavior(
			missRoll,
			{ ...emptyPlan(), reactionEntries: [offer] },
			vi.fn(async () => makeRoll(false)),
		);

		expect(result.stampEntries).toEqual([]);
	});
});

/**
 * Live regression tests for the modifyIncomingAttack rule merged from dev:
 * target-side attack modifiers (disadvantage, autoMiss), automatic force
 * rerolls with outcome triggers, and the interactive reactions (force reroll,
 * Interpose-style redirect) that render as buttons on the attack chat card.
 *
 * Attacks are posted through the real activation flow against real tokens on
 * a viewed scene; the interactive reactions are exercised by clicking the
 * actual card buttons in the chat DOM. `primaryDieValue` seeds only the
 * primary d8 (1 = miss, 4 = hit, 8 = crit) — damage dice stay random, so
 * assertions target structure (flags, entries, formulas), never totals.
 *
 * No combat is active anywhere in this file: baseline Interpose only routes
 * through the heroic-reaction spend (and its confirmation dialog) when a
 * combat is started.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	attackFeatureData,
	clearTargets,
	clickReactionButton,
	createViewedTestScene,
	importPackItem,
	placeToken,
	purgeTestDocuments,
	ruleFeatureData,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Incoming Attack';

interface ReactionEntryLike {
	id: string;
	kind: 'forceReroll' | 'redirectToSelf';
	source: 'baseline' | 'rule';
	label: string;
	tokenUuid: string | null;
	used: boolean;
}

interface AttackMessageLike {
	id: string;
	rolls: Array<{ options: Record<string, unknown>; formula: string }>;
	system: {
		isMiss: boolean;
		isCritical: boolean;
		targets: string[];
		incomingReactions: ReactionEntryLike[];
		activation: { effects: Array<Record<string, unknown>> };
	};
}

interface CombatantActor {
	id: string;
	items: { find(predicate: (item: Item) => boolean): Item | undefined };
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

describe('incoming attack modifiers', () => {
	let attacker: CombatantActor;
	let defender: CombatantActor;
	let protector: CombatantActor;
	let scene: Scene;
	let defenderToken: TokenDocument;
	let protectorToken: TokenDocument;
	let originalSceneId: string | null = null;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalSceneId = canvas.scene?.id ?? null;

		attacker = (await Actor.create({
			name: `${TEST_PREFIX} Attacker`,
			type: 'npc',
			items: [attackFeatureData(`${TEST_PREFIX} Claw`)],
		} as Actor.CreateData)) as unknown as CombatantActor;
		defender = (await Actor.create({
			name: `${TEST_PREFIX} Defender`,
			type: 'character',
		})) as unknown as CombatantActor;
		protector = (await Actor.create({
			name: `${TEST_PREFIX} Protector`,
			type: 'character',
		})) as unknown as CombatantActor;
		for (const combatant of [defender, protector]) {
			await combatant.update({
				'system.attributes.hp.max': 12,
				'system.attributes.hp.value': 12,
			});
		}

		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: 'ia-attacker',
			actor: attacker as unknown as Actor,
			gx: 3,
			gy: 6,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
		defenderToken = await placeToken(scene, {
			name: 'ia-defender',
			actor: defender as unknown as Actor,
			gx: 7,
			gy: 6,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		});
		// Far outside every redirect range until the redirect tests move it.
		protectorToken = await placeToken(scene, {
			name: 'ia-protector',
			actor: protector as unknown as Actor,
			gx: 20,
			gy: 20,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		});
	}, 120_000);

	afterAll(async () => {
		await clearTargets();
		// Re-view the world's original scene before the test scene is deleted.
		if (originalSceneId) await game.scenes.get(originalSceneId)?.view();
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** Post a real attack activation against the defender's token. */
	async function attack(primaryDieValue: number): Promise<AttackMessageLike> {
		await targetToken(defenderToken);
		const claw = attacker.items.find((item) => item.name === `${TEST_PREFIX} Claw`)!;
		const message = await (
			claw as unknown as {
				activate(options: Record<string, unknown>): Promise<{ id: string } | null>;
			}
		).activate({ fastForward: true, primaryDieValue });
		expect(message, 'the attack should post a chat card').toBeTruthy();
		await settle(400);
		return readMessage(message!.id);
	}

	function readMessage(id: string): AttackMessageLike {
		return game.messages.get(id) as unknown as AttackMessageLike;
	}

	function damageNode(message: AttackMessageLike) {
		return message.system.activation.effects.find((node) => node.type === 'damage') as
			| { roll?: Record<string, unknown>; discardedRoll?: unknown }
			| undefined;
	}

	/**
	 * Reposition the protector by re-placing its token. On V14 an `update({x, y})`
	 * routes through the token movement system — the document coordinates trail
	 * the movement animation — so a fresh placement is the deterministic way to
	 * stage adjacency.
	 */
	async function moveProtectorTo(gx: number, gy: number) {
		await scene.deleteEmbeddedDocuments('Token', [protectorToken.id!]);
		protectorToken = await placeToken(scene, {
			name: 'ia-protector',
			actor: protector as unknown as Actor,
			gx,
			gy,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		});
	}

	async function withDefenderRules(
		rules: Array<Record<string, unknown>>,
		body: () => Promise<void>,
	) {
		const [item] = await defender.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Defense`, rules),
		]);
		try {
			await body();
		} finally {
			await defender.deleteEmbeddedDocuments('Item', [item.id]);
		}
	}

	test('disadvantage applies to the attack roll with attribution', async () => {
		await withDefenderRules(
			[{ type: 'modifyIncomingAttack', modifier: 'disadvantage', label: 'Shroud of Gloom' }],
			async () => {
				const message = await attack(4);
				const roll = message.rolls[0]!;
				expect(roll.options.netRollMode).toBe(-1);
				const modifiers = roll.options.incomingAttackModifiers as Array<{ label: string }>;
				expect(modifiers?.some((entry) => entry.label === 'Shroud of Gloom')).toBe(true);
			},
		);
	}, 60_000);

	test('autoMiss forces a miss and suppresses all reaction offers', async () => {
		await withDefenderRules(
			[{ type: 'modifyIncomingAttack', modifier: 'autoMiss', label: 'Untouchable' }],
			async () => {
				// Would be a crit (primary die 8) without the forced miss.
				const message = await attack(8);
				expect(message.system.isMiss).toBe(true);
				expect(message.rolls[0]!.options.forceMiss).toBe(true);
				expect(message.system.incomingReactions).toHaveLength(0);
			},
		);
	}, 60_000);

	test("automatic forceReroll with the 'hit' trigger rerolls a hit", async () => {
		await withDefenderRules(
			[
				{
					type: 'modifyIncomingAttack',
					modifier: 'forceReroll',
					automatic: true,
					rerollTrigger: 'hit',
					label: 'Stubborn Defense',
				},
			],
			async () => {
				const message = await attack(4);
				expect(damageNode(message)?.discardedRoll).toBeTruthy();
				const entry = message.system.incomingReactions.find(
					(candidate) => candidate.kind === 'forceReroll',
				);
				expect(entry?.used).toBe(true);
				expect(entry?.label).toBe('Stubborn Defense');
			},
		);
	}, 60_000);

	test('automatic forceReroll respects its outcome trigger', async () => {
		await withDefenderRules(
			[
				{
					type: 'modifyIncomingAttack',
					modifier: 'forceReroll',
					automatic: true,
					rerollTrigger: 'hit',
				},
			],
			async () => {
				const message = await attack(1);
				expect(message.system.isMiss).toBe(true);
				expect(damageNode(message)?.discardedRoll).toBeFalsy();
			},
		);

		await withDefenderRules(
			[
				{
					type: 'modifyIncomingAttack',
					modifier: 'forceReroll',
					automatic: true,
					rerollTrigger: 'criticalHit',
					rerollWithDisadvantage: true,
				},
			],
			async () => {
				// A plain hit must not trip the crit trigger.
				const plainHit = await attack(4);
				expect(damageNode(plainHit)?.discardedRoll).toBeFalsy();

				// A forced crit does, and the reroll is made at disadvantage.
				const crit = await attack(8);
				expect(damageNode(crit)?.discardedRoll).toBeTruthy();
				const sources = crit.rolls[0]!.options.rollModeSources as number[] | undefined;
				expect(sources).toContain(-1);
			},
		);
	}, 120_000);

	test('interactive forceReroll (Pocket Sand) resolves via a real button click', async () => {
		const pocketSand = await importPackItem(
			defender as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === 'Pocket Sand',
		);
		try {
			const message = await attack(4);
			const pending = message.system.incomingReactions.find(
				(entry) => entry.kind === 'forceReroll' && !entry.used,
			);
			expect(pending?.label).toBe('Pocket Sand');
			expect(damageNode(message)?.discardedRoll).toBeFalsy();

			await clickReactionButton(message.id, 'Pocket Sand');

			await waitFor(
				() =>
					readMessage(message.id).system.incomingReactions.every(
						(entry) => entry.kind !== 'forceReroll' || entry.used,
					),
				'the force-reroll offer to be marked used',
			);
			expect(damageNode(readMessage(message.id))?.discardedRoll).toBeTruthy();
		} finally {
			await defender.deleteEmbeddedDocuments('Item', [pocketSand.id!]);
		}
	}, 120_000);

	test('rule-granted redirect (Aura of Refuge) swaps the target via a real button click', async () => {
		const aura = await importPackItem(
			protector as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === 'Aura of Refuge',
		);
		// 3 spaces from the defender: beyond the baseline Interpose range (2),
		// inside Aura of Refuge's rule range (4).
		await moveProtectorTo(10, 6);
		await settle(400);

		try {
			const message = await attack(4);
			const offer = message.system.incomingReactions.find(
				(entry) => entry.kind === 'redirectToSelf',
			);
			expect(offer?.source).toBe('rule');
			expect(offer?.label).toBe('Aura of Refuge');
			expect(offer?.tokenUuid).toBe(protectorToken.uuid);

			await clickReactionButton(message.id, 'Aura of Refuge');

			await waitFor(() => {
				const targets = readMessage(message.id).system.targets;
				return targets.length === 1 && targets[0] === protectorToken.uuid;
			}, 'the attack target to swap to the protector');
			expect(
				readMessage(message.id).system.incomingReactions.find((entry) => entry.id === offer!.id)
					?.used,
			).toBe(true);

			await waitFor(
				() =>
					game.messages.contents.some(
						(candidate) =>
							candidate.type === 'reaction' &&
							(candidate.system as { reactionType?: string }).reactionType === 'interpose',
					),
				'the Interpose announcement message',
			);
		} finally {
			await protector.deleteEmbeddedDocuments('Item', [aura.id!]);
		}
	}, 120_000);

	test('baseline heroic Interpose is offered to an adjacent allied character', async () => {
		// 2 spaces from the defender, no redirect rule item any more.
		await moveProtectorTo(9, 6);
		await settle(400);

		const message = await attack(4);
		const offer = message.system.incomingReactions.find(
			(entry) => entry.kind === 'redirectToSelf' && entry.tokenUuid === protectorToken.uuid,
		);
		expect(offer?.source).toBe('baseline');
		expect(offer?.used).toBe(false);
	}, 60_000);
});

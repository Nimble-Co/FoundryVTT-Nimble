/**
 * Live regression tests for the damage-defense pipeline merged from dev:
 * `attributes.damageResistances` / `damageVulnerabilities` / `damageImmunities`
 * applied when damage is dealt, and the per-target breakdown surfaced on the
 * activation card.
 *
 * Attacks are posted through the real activation flow against real tokens on a
 * viewed scene, and damage is applied by clicking the actual Apply Damage
 * button on the chat card. The attack feature rolls a bare `1d8`, so seeding
 * `primaryDieValue: 4` makes the damage total a deterministic 4 (a hit,
 * no crit explosion) and HP deltas can be asserted exactly.
 *
 * Heroes always report armor type 'none' (their Armor is a Defend value), so
 * character targets exercise the unarmored branches — resistance halving,
 * immunity zeroing, vulnerability doubling — while a heavy-armor NPC target
 * exercises "vulnerable damage ignores the target's armor".
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	clearTargets,
	createViewedTestScene,
	messageNode,
	placeToken,
	purgeTestDocuments,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Damage Defenses';

/** Deterministic damage total for `1d8` seeded with primaryDieValue 4. */
const ROLLED_DAMAGE = 4;
const STARTING_HP = 20;

interface DamageModifierLike {
	kind: 'immune' | 'vulnerable' | 'resistant' | 'reduction';
	label: string;
}

interface DamageBreakdownLike {
	total: number;
	components: Array<{ adjustedDamage: number; modifiers: DamageModifierLike[] }>;
}

/**
 * An attack feature shaped like authored pack content: the damage node carries
 * an `on.hit` damageOutcome child. Only outcome children surface the roll on a
 * hit (bare damage nodes surface on a miss alone), and the breakdown, badges,
 * and Apply Damage button all hang off the surfaced node.
 */
function fireAttackFeatureData(name: string) {
	return {
		name,
		type: 'feature',
		system: {
			activation: {
				cost: { type: 'action', quantity: 1 },
				targets: { attackType: 'reach', count: 1 },
				effects: [
					{
						id: 'atk',
						type: 'damage',
						formula: '1d8',
						damageType: 'fire',
						canCrit: true,
						canMiss: true,
						parentNode: null,
						parentContext: null,
						on: {
							hit: [
								{
									id: 'atk-hit',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'atk',
								},
							],
						},
					},
				],
			},
		},
	};
}

interface DefenseActor {
	id: string;
	name: string;
	items: { find(predicate: (item: Item) => boolean): Item | undefined };
	system: { attributes: { hp: { value: number } } };
	update(changes: Record<string, unknown>): Promise<unknown>;
}

describe('damage defenses', () => {
	let attacker: DefenseActor;
	let scene: Scene;
	let originalSceneId: string | null = null;
	const targetTokens = new Map<string, TokenDocument>();

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalSceneId = canvas.scene?.id ?? null;

		attacker = (await Actor.create({
			name: `${TEST_PREFIX} Attacker`,
			type: 'npc',
			items: [fireAttackFeatureData(`${TEST_PREFIX} Firebolt`)],
		} as Actor.CreateData)) as unknown as DefenseActor;

		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: 'dd-attacker',
			actor: attacker as unknown as Actor,
			gx: 3,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
	}, 120_000);

	afterAll(async () => {
		await clearTargets();
		if (originalSceneId) await game.scenes.get(originalSceneId)?.view();
		await purgeTestDocuments(TEST_PREFIX);
	});

	let nextTokenColumn = 5;

	/** Create a target actor with the given system data and drop its token. */
	async function createTarget(
		label: string,
		type: 'character' | 'npc',
		systemData: Record<string, unknown>,
	): Promise<DefenseActor> {
		const actor = (await Actor.create({
			name: `${TEST_PREFIX} ${label}`,
			type,
		})) as unknown as DefenseActor;
		await actor.update({
			'system.attributes.hp.max': STARTING_HP,
			'system.attributes.hp.value': STARTING_HP,
			...systemData,
		});
		const token = await placeToken(scene, {
			name: `dd-${label.toLowerCase()}`,
			actor: actor as unknown as Actor,
			gx: nextTokenColumn,
			gy: 6,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			// HP assertions read the base actor, so the token must be linked.
			actorLink: true,
		});
		nextTokenColumn += 2;
		targetTokens.set(actor.id, token);
		return actor;
	}

	/** Post a real fire attack activation against the target's token. */
	async function attack(target: DefenseActor): Promise<string> {
		await targetToken(targetTokens.get(target.id)!);
		const firebolt = attacker.items.find((item) => item.name === `${TEST_PREFIX} Firebolt`)!;
		const message = await (
			firebolt as unknown as {
				activate(options: Record<string, unknown>): Promise<{ id: string } | null>;
			}
		).activate({ fastForward: true, primaryDieValue: ROLLED_DAMAGE });
		expect(message, 'the attack should post a chat card').toBeTruthy();
		await settle(600);
		return message!.id;
	}

	function applyDamageButton(messageId: string): HTMLButtonElement | null {
		return (
			messageNode(messageId)?.querySelector<HTMLButtonElement>('.nimble-button--apply-damage') ??
			null
		);
	}

	/** Click the card's real Apply Damage button and wait for the HP write. */
	async function clickApplyDamage(messageId: string, target: DefenseActor, expectedHp: number) {
		await waitFor(
			() => applyDamageButton(messageId) !== null,
			`the Apply Damage button on message ${messageId}`,
		);
		const button = applyDamageButton(messageId)!;
		expect(button.disabled, 'Apply Damage should be enabled').toBe(false);
		button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await waitFor(
			() => target.system.attributes.hp.value === expectedHp,
			`${target.name} HP to drop to ${expectedHp}`,
		);
	}

	function breakdownFor(messageId: string, target: DefenseActor): DamageBreakdownLike {
		const message = game.messages.get(messageId) as unknown as {
			getDamageBreakdownForTarget(uuid: string): DamageBreakdownLike | null;
		};
		const breakdown = message.getDamageBreakdownForTarget(targetTokens.get(target.id)!.uuid!);
		expect(breakdown, 'the card should expose a damage breakdown for the target').toBeTruthy();
		return breakdown!;
	}

	function badgeKindsOn(messageId: string): string[] {
		const badges =
			messageNode(messageId)?.querySelectorAll<HTMLElement>('.nimble-target-badge') ?? [];
		return [...badges].map((badge) => badge.dataset.badgeKind ?? '');
	}

	test('resistance halves damage from the matching type', async () => {
		const target = await createTarget('Resistant', 'character', {
			'system.attributes.damageResistances': ['fire'],
		});

		const messageId = await attack(target);
		const breakdown = breakdownFor(messageId, target);
		expect(breakdown.total).toBe(ROLLED_DAMAGE / 2);
		expect(breakdown.components[0]!.modifiers.map((m) => m.kind)).toContain('resistant');
		expect(badgeKindsOn(messageId)).toContain('resistant');

		await clickApplyDamage(messageId, target, STARTING_HP - ROLLED_DAMAGE / 2);
	}, 60_000);

	test('vulnerability doubles damage against an unarmored target', async () => {
		const target = await createTarget('Vulnerable', 'character', {
			'system.attributes.damageVulnerabilities': ['fire'],
		});

		const messageId = await attack(target);
		const breakdown = breakdownFor(messageId, target);
		expect(breakdown.total).toBe(ROLLED_DAMAGE * 2);
		expect(breakdown.components[0]!.modifiers.map((m) => m.kind)).toContain('vulnerable');
		expect(badgeKindsOn(messageId)).toContain('vulnerable');

		await clickApplyDamage(messageId, target, STARTING_HP - ROLLED_DAMAGE * 2);
	}, 60_000);

	test('immunity zeroes the hit and outranks vulnerability; Apply Damage is disabled', async () => {
		const target = await createTarget('Immune', 'character', {
			'system.attributes.damageImmunities': ['fire'],
			'system.attributes.damageVulnerabilities': ['fire'],
		});

		const messageId = await attack(target);
		const breakdown = breakdownFor(messageId, target);
		expect(breakdown.total).toBe(0);
		expect(breakdown.components[0]!.modifiers.map((m) => m.kind)).toContain('immune');
		expect(badgeKindsOn(messageId)).toContain('immune');

		// With every target resolving to zero and no banked reduction to spend,
		// the card's real Apply Damage button renders disabled.
		await waitFor(
			() => applyDamageButton(messageId) !== null,
			`the Apply Damage button on message ${messageId}`,
		);
		expect(applyDamageButton(messageId)!.disabled).toBe(true);
		await settle(400);
		expect(target.system.attributes.hp.value).toBe(STARTING_HP);
	}, 60_000);

	test('heavy monster armor halves dice damage when no defenses match', async () => {
		const target = await createTarget('Armored', 'npc', {
			'system.attributes.armor': 'heavy',
		});

		const messageId = await attack(target);
		expect(breakdownFor(messageId, target).total).toBe(ROLLED_DAMAGE / 2);

		await clickApplyDamage(messageId, target, STARTING_HP - ROLLED_DAMAGE / 2);
	}, 60_000);

	test('vulnerable damage ignores heavy monster armor instead of doubling', async () => {
		const target = await createTarget('ArmoredVulnerable', 'npc', {
			'system.attributes.armor': 'heavy',
			'system.attributes.damageVulnerabilities': ['fire'],
		});

		const messageId = await attack(target);
		const breakdown = breakdownFor(messageId, target);
		expect(breakdown.total).toBe(ROLLED_DAMAGE);
		expect(breakdown.components[0]!.modifiers.map((m) => m.kind)).toContain('vulnerable');

		await clickApplyDamage(messageId, target, STARTING_HP - ROLLED_DAMAGE);
	}, 60_000);
});

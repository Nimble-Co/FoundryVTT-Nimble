/**
 * Live regression tests for the markTarget + conditionalBonus rules merged
 * from dev, exercised through the real Hunter's Mark pack feature: activating
 * the feature records the targeted quarry on the hunter and applies the
 * `marked` condition to the target, and subsequent attacks offer the
 * per-attack advantage-or-damage choice in the activation dialog.
 *
 * The choice is exercised through the real user path: the activation dialog
 * renders and the actual choice/Roll buttons are clicked in the DOM.
 *
 * markTarget dispatch is gated on the `automation.applyRuleEffects` world
 * setting (read live per call), which this suite enables and restores.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	attackFeatureData,
	clearTargets,
	createViewedTestScene,
	getRuleAutomationEnabled,
	importPackItem,
	placeToken,
	purgeTestDocuments,
	setRuleAutomationEnabled,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Mark Target';

interface MarkedEffectLike {
	id: string;
	statuses: Set<string>;
	getFlag(scope: string, key: string): unknown;
}

interface MarkActor {
	id: string;
	uuid: string;
	effects: { contents: MarkedEffectLike[] };
	getFlag(scope: string, key: string): unknown;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

/**
 * The enemies' tokens are unlinked (the normal state for NPCs), so marks are
 * recorded against — and marker effects applied to — the token-synthetic
 * actor, not the world actor. All target-side assertions go through this.
 */
function tokenActor(tokenDoc: TokenDocument): MarkActor {
	return tokenDoc.actor as unknown as MarkActor;
}

interface QuarryEntry {
	actorUuid: string;
	tokenUuid: string | null;
	name: string;
}

describe('mark target and conditional bonus', () => {
	let hunter: MarkActor;
	let enemyA: MarkActor;
	let enemyB: MarkActor;
	let enemyAToken: TokenDocument;
	let enemyBToken: TokenDocument;
	let huntersMark: Item;
	let attackItem: Item;
	let originalSceneId: string | null = null;
	let originalAutoApply: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalSceneId = canvas.scene?.id ?? null;

		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);

		hunter = (await Actor.create({
			name: `${TEST_PREFIX} Hunter`,
			type: 'character',
		})) as unknown as MarkActor;
		huntersMark = await importPackItem(
			hunter as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === "Hunter's Mark",
		);
		const [attack] = await (hunter as unknown as Actor).createEmbeddedDocuments('Item', [
			attackFeatureData(`${TEST_PREFIX} Shortbow`, { attackType: 'range' }) as Item.CreateData,
		]);
		attackItem = attack!;

		enemyA = (await Actor.create({
			name: `${TEST_PREFIX} Enemy A`,
			type: 'npc',
		})) as unknown as MarkActor;
		enemyB = (await Actor.create({
			name: `${TEST_PREFIX} Enemy B`,
			type: 'npc',
		})) as unknown as MarkActor;

		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: 'mt-hunter',
			actor: hunter as unknown as Actor,
			gx: 5,
			gy: 5,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		});
		enemyAToken = await placeToken(scene, {
			name: 'mt-enemy-a',
			actor: enemyA as unknown as Actor,
			gx: 8,
			gy: 5,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
		enemyBToken = await placeToken(scene, {
			name: 'mt-enemy-b',
			actor: enemyB as unknown as Actor,
			gx: 8,
			gy: 8,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
	}, 120_000);

	afterAll(async () => {
		await closeActivationDialogs();
		await clearTargets();
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		if (originalSceneId) await game.scenes.get(originalSceneId)?.view();
		await purgeTestDocuments(TEST_PREFIX);
	});

	const quarryList = (): QuarryEntry[] => {
		const flag = hunter.getFlag(game.system.id, 'toggledEffects') as
			| Record<string, QuarryEntry[]>
			| undefined;
		return flag?.quarry ?? [];
	};

	const markerEffects = (target: MarkActor) =>
		target.effects.contents.filter(
			(effect) => effect.getFlag(game.system.id, 'markTargetItemUuid') === huntersMark.uuid,
		);

	async function activateMarkOn(token: TokenDocument) {
		await targetToken(token);
		await (huntersMark as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
	}

	/** Close any open item-activation dialog, resolving its promise with null. */
	async function closeActivationDialogs() {
		for (const app of foundry.applications.instances.values()) {
			const title = (app as { title?: string }).title ?? '';
			if (title.startsWith('Activate ')) {
				await (app as { close(): Promise<unknown> }).close().catch(() => {});
			}
		}
	}

	function activationDialogElement(): HTMLElement | null {
		for (const app of foundry.applications.instances.values()) {
			const title = (app as { title?: string }).title ?? '';
			if (!title.startsWith('Activate ')) continue;
			// A just-submitted dialog lingers in the instances map while its close
			// animation runs; only a still-connected element is the live dialog.
			const element = (app as unknown as { element: HTMLElement | null }).element;
			if (element?.isConnected) return element;
		}
		return null;
	}

	/** The previous dialog's close is async; wait it out before opening another. */
	async function waitForDialogClosed() {
		await waitFor(() => activationDialogElement() === null, 'the activation dialog to close');
	}

	test('activating the mark records the quarry and applies the marked condition', async () => {
		await activateMarkOn(enemyAToken);

		await waitFor(
			() => quarryList().some((entry) => entry.actorUuid === tokenActor(enemyAToken).uuid),
			'the quarry flag to record enemy A',
		);
		expect(quarryList()[0]!.tokenUuid).toBe(enemyAToken.uuid);
		await waitFor(
			() => markerEffects(tokenActor(enemyAToken)).length === 1,
			"enemy A's marker effect",
		);
		const marker = markerEffects(tokenActor(enemyAToken))[0]!;
		expect(marker.statuses.has('marked')).toBe(true);
	}, 60_000);

	test('marking a second target evicts the first (maxTargets 1) and dedups', async () => {
		await activateMarkOn(enemyBToken);

		await waitFor(
			() => quarryList().some((entry) => entry.actorUuid === tokenActor(enemyBToken).uuid),
			'the quarry flag to record enemy B',
		);
		expect(quarryList()).toHaveLength(1);
		await waitFor(
			() => markerEffects(tokenActor(enemyAToken)).length === 0,
			"enemy A's marker to be evicted",
		);
		expect(markerEffects(tokenActor(enemyBToken))).toHaveLength(1);

		// Re-marking the same quarry must not stack a second marker effect.
		await activateMarkOn(enemyBToken);
		await settle(800);
		expect(quarryList()).toHaveLength(1);
		expect(markerEffects(tokenActor(enemyBToken))).toHaveLength(1);
	}, 60_000);

	test('the damage choice folds the bonus into the attack roll (real dialog clicks)', async () => {
		await targetToken(enemyBToken);
		const messagePromise = (
			attackItem as unknown as {
				activate(
					options: object,
				): Promise<{ id: string; rolls: Array<{ formula: string }> } | null>;
			}
		).activate({});

		await waitFor(
			() => !!document.querySelector('.nimble-conditional-bonus'),
			'the conditional-bonus section in the activation dialog',
		);
		const dialog = activationDialogElement()!;
		expect(dialog.textContent).toContain("Hunter's Mark");

		const choices = [
			...dialog.querySelectorAll<HTMLButtonElement>('.nimble-conditional-bonus__choice'),
		];
		const damageChoice = choices.find((button) => (button.textContent ?? '').includes('damage'));
		expect(damageChoice, 'the damage choice button').toBeTruthy();
		damageChoice!.click();
		await settle(300);
		expect(damageChoice!.getAttribute('aria-pressed')).toBe('true');

		dialog.querySelector<HTMLButtonElement>('.nimble-sheet__footer .nimble-button')!.click();
		const message = await messagePromise;
		expect(message).toBeTruthy();

		// The untyped bonus folds into the primary roll, credited via flavor.
		expect(message!.rolls[0]!.formula).toContain("Hunter's Mark");
		await waitForDialogClosed();
	}, 60_000);

	test('the advantage choice raises the roll mode instead (real dialog clicks)', async () => {
		await targetToken(enemyBToken);
		const messagePromise = (
			attackItem as unknown as {
				activate(options: object): Promise<{ rolls: Array<{ formula: string }> } | null>;
			}
		).activate({});

		await waitFor(
			() => !!document.querySelector('.nimble-conditional-bonus'),
			'the conditional-bonus section in the activation dialog',
		);
		const dialog = activationDialogElement()!;
		const choices = [
			...dialog.querySelectorAll<HTMLButtonElement>('.nimble-conditional-bonus__choice'),
		];
		const advantageChoice = choices.find((button) =>
			(button.textContent ?? '').includes('Advantage'),
		);
		expect(advantageChoice, 'the advantage choice button').toBeTruthy();
		advantageChoice!.click();
		await settle(300);

		dialog.querySelector<HTMLButtonElement>('.nimble-sheet__footer .nimble-button')!.click();
		const message = await messagePromise;
		expect(message).toBeTruthy();

		// Advantage rolls an extra primary die and keeps the highest.
		expect(message!.rolls[0]!.formula).toMatch(/2d8kh/);
		expect(message!.rolls[0]!.formula).not.toContain("Hunter's Mark");
		await waitForDialogClosed();
	}, 60_000);

	test('no conditional bonus is offered against an unmarked target', async () => {
		await targetToken(enemyAToken);
		const messagePromise = (
			attackItem as unknown as { activate(options: object): Promise<unknown> }
		).activate({});

		await waitFor(() => activationDialogElement() !== null, 'the activation dialog to open');
		await settle(400);
		const dialog = activationDialogElement()!;
		expect(dialog.querySelector('.nimble-conditional-bonus')).toBeNull();

		dialog.querySelector<HTMLButtonElement>('.nimble-sheet__footer .nimble-button')!.click();
		await messagePromise;
		await waitForDialogClosed();
	}, 60_000);
});

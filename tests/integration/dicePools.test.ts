/**
 * Live regression tests for the dice-pool resource rules, exercised through
 * the real Berserker content: Rage's dicePool rule surfaces the Fury pool on
 * the character sheet, dice are rolled into it by clicking the sheet's real
 * roll-die button, and "That all you got?!"'s manual diceConsumer opens the
 * spend panel whose chip + spend buttons are clicked to bank a one-shot
 * damage reduction (an ActiveEffect carrying the bankedDamageReduction flag).
 *
 * The consumer dispatch runs through ruleEventDispatch, gated on
 * `automation.autoApplyConditions`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	getAutoApplyConditions,
	importPackItem,
	purgeTestDocuments,
	setAutoApplyConditions,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Dice Pools';

interface PoolActor {
	id: string;
	effects: {
		contents: Array<{ id: string; name: string; getFlag(scope: string, key: string): unknown }>;
	};
	items: { get(id: string): Item | undefined };
	sheet: {
		render(force: boolean): Promise<unknown>;
		close(): Promise<unknown>;
		element: HTMLElement;
	};
	update(changes: Record<string, unknown>): Promise<unknown>;
}

interface PoolMapEntry {
	identifier: string;
	faces: number[];
}

describe('dice pool rules', () => {
	let actor: PoolActor;
	let rageItem: Item;
	let taygItem: Item;
	let originalAutoApply: boolean;

	const furyPool = (): PoolMapEntry | undefined => {
		const pools = foundry.utils.getProperty(
			actor.items.get(rageItem.id!)!,
			`flags.${game.system.id}.dicePools`,
		) as Record<string, PoolMapEntry> | undefined;
		return Object.values(pools ?? {}).find((pool) => pool.identifier === 'fury');
	};

	const bankedEffects = () =>
		actor.effects.contents.filter(
			(effect) => Number(effect.getFlag(game.system.id, 'bankedDamageReduction') ?? 0) > 0,
		);

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutoApply = getAutoApplyConditions();
		if (!originalAutoApply) await setAutoApplyConditions(true);

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Rager`,
			type: 'character',
			system: {
				abilities: { strength: { baseValue: 5 }, dexterity: { baseValue: 3 } },
				attributes: { hp: { value: 30, max: 30 } },
			},
		} as Actor.CreateData)) as unknown as PoolActor;

		rageItem = await importPackItem(
			actor as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === 'Rage',
		);
		taygItem = await importPackItem(actor as unknown as Actor, 'nimble-class-features', (entry) =>
			entry.name.startsWith('That all you got'),
		);

		// The pack pool's max is "@key" (the class key stat); this staged actor
		// has no class, so pin it the way the QA scripts do.
		const rules = (rageItem.toObject() as { system: { rules: Array<Record<string, unknown>> } })
			.system.rules;
		for (const rule of rules) if (rule.type === 'dicePool') rule.max = '4';
		await rageItem.update({ 'system.rules': rules } as Item.UpdateData);
	}, 90_000);

	afterAll(async () => {
		await actor.sheet.close().catch(() => {});
		if (getAutoApplyConditions() !== originalAutoApply) {
			await setAutoApplyConditions(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('rolling Fury dice through the real sheet button fills the pool', async () => {
		expect(furyPool()?.faces ?? []).toHaveLength(0);

		await actor.sheet.render(true);
		await settle(1500);

		// The pool tracker re-renders after every roll, replacing the button
		// node — re-query before each click instead of holding a reference.
		const clickRollButton = () => {
			const button = actor.sheet.element.querySelector<HTMLButtonElement>(
				'[data-tooltip*="Roll one die"], [aria-label*="Roll one die"]',
			);
			if (!button) {
				const labels = [...actor.sheet.element.querySelectorAll('button')]
					.map(
						(candidate) =>
							candidate.getAttribute('aria-label') || candidate.getAttribute('data-tooltip'),
					)
					.filter(Boolean)
					.join(' | ');
				throw new Error(`no roll-die button on the sheet; buttons: ${labels}`);
			}
			button.click();
		};

		clickRollButton();
		await waitFor(() => (furyPool()?.faces.length ?? 0) === 1, 'the first die to enter the pool');
		clickRollButton();
		await waitFor(() => (furyPool()?.faces.length ?? 0) === 2, 'the second die to enter the pool');

		for (const face of furyPool()!.faces) {
			expect(face).toBeGreaterThanOrEqual(1);
			expect(face).toBeLessThanOrEqual(4);
		}
	}, 90_000);

	test('the manual diceConsumer spend banks a damage reduction via real panel clicks', async () => {
		expect(bankedEffects()).toHaveLength(0);
		const messagesBefore = new Set(game.messages.contents.map((message) => message.id));

		await (taygItem as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
		await waitFor(
			() => !!document.querySelector('.dice-pool-panel'),
			'the dice-pool spend panel to open',
		);

		const chip = document.querySelector<HTMLButtonElement>('.dice-pool-panel__chip');
		expect(chip, 'a die chip in the spend panel').toBeTruthy();
		chip!.click();
		await settle(400);

		document.querySelector<HTMLButtonElement>('.dice-pool-panel__spend-button')!.click();

		// TAYG banks (@strength + @dexterity) * dice spent = (5 + 3) * 1.
		await waitFor(() => bankedEffects().length === 1, 'the banked reduction effect');
		const bank = bankedEffects()[0]!;
		expect(Number(bank.getFlag(game.system.id, 'bankedDamageReduction'))).toBe(8);
		expect(bank.name).toContain('8');

		// The spent die left the pool, and the spend posted a chat card.
		await waitFor(() => (furyPool()?.faces.length ?? 0) === 1, 'the spent die to leave the pool');
		await waitFor(
			() => game.messages.contents.some((message) => !messagesBefore.has(message.id)),
			'the spend chat card',
		);
	}, 90_000);
});

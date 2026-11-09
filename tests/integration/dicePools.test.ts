/**
 * Live regression tests for the dice-pool resource rules, exercised through
 * the real Berserker content: Rage's dicePool rule surfaces the Fury pool on
 * the character sheet, dice are rolled into it by clicking the roll button of
 * the Fury meter, and the use button of "That all you got?!" opens the dice
 * step of its row, whose die and Spend buttons are clicked to bank a one-shot
 * damage reduction (an ActiveEffect carrying the bankedDamageReduction flag).
 *
 * The consumer dispatch runs through ruleEventDispatch, gated on
 * `automation.applyRuleEffects`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	getRuleAutomationEnabled,
	importPackItem,
	purgeTestDocuments,
	setRuleAutomationEnabled,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Dice Pools';

const t = (key: string, data?: Record<string, string>) =>
	data ? game.i18n.format(key, data) : game.i18n.localize(key);

const buttonNamed = (root: ParentNode, name: string) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.getAttribute('aria-label') === name || button.textContent?.trim() === name,
	);

const rowOf = (sheet: HTMLElement, id: string) =>
	sheet.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);

interface PoolActor {
	id: string;
	effects: {
		contents: Array<{ id: string; name: string; getFlag(scope: string, key: string): unknown }>;
	};
	items: { get(id: string): Item | undefined };
	sheet: {
		render(options: object): Promise<unknown>;
		close(): Promise<unknown>;
		rendered: boolean;
		element: HTMLElement;
	};
	update(changes: Record<string, unknown>): Promise<unknown>;
}

interface PoolMapEntry {
	identifier: string;
	label: string;
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
		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);

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
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the roll button of the Fury meter fills the pool', async () => {
		expect(furyPool()?.faces ?? []).toHaveLength(0);

		await actor.sheet.render({ force: true, position: { width: 720, height: 850 } });
		await waitFor(() => actor.sheet.rendered && !!actor.sheet.element, 'the sheet to render');
		await settle(600);

		// The meter renders again after every roll, so find the button again before each click.
		const clickRollButton = () => {
			const label = t('NIMBLE.actorSheet.parts.dicePool.addLabel', { label: furyPool()!.label });
			const button = buttonNamed(actor.sheet.element, label);
			if (!button) throw new Error(`no "${label}" button on the sheet`);
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

	test('the dice step of the row spends a die and banks a damage reduction', async () => {
		expect(bankedEffects()).toHaveLength(0);
		const messagesBefore = new Set(game.messages.contents.map((message) => message.id));
		const sheet = actor.sheet.element;

		const actionsName = t('NIMBLE.actorSheet.hero.tabs.actions');
		const actionsTab = [...sheet.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) =>
			(tab.getAttribute('aria-label') || tab.textContent || '').trim().startsWith(actionsName),
		);
		actionsTab!.click();
		await waitFor(() => !!rowOf(sheet, taygItem.id!), 'the That all you got?! row');
		rowOf(sheet, taygItem.id!)!
			.querySelector<HTMLButtonElement>('button.use, button.main')!
			.click();

		const step = () =>
			rowOf(sheet, taygItem.id!)?.querySelector<HTMLElement>(
				`[role="group"][aria-label="${CSS.escape(t('NIMBLE.actorSheet.hero.actions.pickDice'))}"]`,
			);
		await waitFor(() => !!step(), 'the dice step of the row to open');

		const die = step()!.querySelector<HTMLButtonElement>('button[aria-pressed]');
		expect(die, 'a die in the dice step').toBeTruthy();
		die!.click();
		await waitFor(
			() => step()?.querySelector('button[aria-pressed="true"]') !== null,
			'the die to be picked',
		);

		buttonNamed(step()!, t('NIMBLE.actorSheet.hero.actions.spend'))!.click();

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

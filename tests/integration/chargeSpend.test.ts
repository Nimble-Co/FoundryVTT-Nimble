/**
 * Live regression tests for variable charge spends, exercised through the real
 * Oathsworn content: Lay on Hands surfaces a charge pool of 5 x LVL, activating
 * it from the Features tab opens the activation dialog's spend prompt, and the
 * amount named there is what gets deducted, healed, and reported on the card.
 *
 * Everything under test is driven by real DOM clicks (the feature card's
 * activate button, the dialog's stepper and roll button, the card's Apply
 * Healing button, the sheet's Safe Rest button); the API is used only to stage
 * the actor and to read resulting state.
 *
 * The refill on a Safe Rest runs through the charge system's rest hook, gated
 * on `automation.resourceRecovery`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	getAutomationToggle,
	importPackItem,
	placeToken,
	purgeTestDocuments,
	setAutomationToggle,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Charge Spend';

// The Oathsworn class item, so the Lay on Hands feature (whose system.class
// names that class) renders on the Features tab the way it does in play.
const OATHSWORN = 'Oathsworn';
const LAY_ON_HANDS = 'Lay on Hands';

const RESOURCE_RECOVERY_SETTING = 'automation.resourceRecovery';

/** How much of the pool the spend tests choose, from a starting pool of 5. */
const SPEND_AMOUNT = 3;
const POOL_MAX = 5;

const getResourceRecoveryEnabled = () => getAutomationToggle(RESOURCE_RECOVERY_SETTING);
const setResourceRecoveryEnabled = (value: boolean) =>
	setAutomationToggle(RESOURCE_RECOVERY_SETTING, value);

interface SheetActor {
	id: string;
	name: string;
	system: { attributes: { hp: { value: number; max: number } } };
	items: { get(id: string): Item | undefined };
	sheet: {
		render(force: boolean): Promise<unknown>;
		close(): Promise<unknown>;
		element: HTMLElement;
	};
	update(changes: Record<string, unknown>): Promise<unknown>;
}

interface ChargePoolEntry {
	identifier: string;
	current: number;
	max: number;
}

describe('variable charge spends', () => {
	let actor: SheetActor;
	let layOnHands: Item;
	let originalResourceRecovery: boolean;

	const pool = (): ChargePoolEntry | undefined => {
		const pools = foundry.utils.getProperty(
			actor.items.get(layOnHands.id!)!,
			`flags.${game.system.id}.chargePools`,
		) as Record<string, ChargePoolEntry> | undefined;
		return Object.values(pools ?? {}).find((entry) => entry.identifier === 'lay-on-hands');
	};

	/** The dialog holding the spend prompt, located from the prompt itself. */
	const spendInput = () =>
		document.querySelector<HTMLInputElement>('input.nimble-pool-spend__stepper-input');

	const submitButtonOutsideSheet = (): HTMLButtonElement | null => {
		const buttons = [
			...document.querySelectorAll<HTMLButtonElement>('footer.nimble-sheet__footer .nimble-button'),
		];
		return buttons.find((button) => !actor.sheet.element.contains(button)) ?? null;
	};

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalResourceRecovery = getResourceRecoveryEnabled();
		if (!originalResourceRecovery) await setResourceRecoveryEnabled(true);

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Oathsworn`,
			type: 'character',
		} as Actor.CreateData)) as unknown as SheetActor;

		await importPackItem(
			actor as unknown as Actor,
			'nimble-classes',
			(entry) => entry.name === OATHSWORN,
		);
		layOnHands = await importPackItem(
			actor as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === LAY_ON_HANDS,
		);

		// Pool flags only seed on a sync hook.
		await actor.update({ 'system.details.notes': `${TEST_PREFIX} staging` });
		await waitFor(() => !!pool(), 'the Lay on Hands pool to seed');

		// Wounded enough that the healing lands in full. This has to happen after
		// the class import, which sets current HP to the class's starting HP.
		await actor.update({
			'system.attributes.hp.value': Math.max(1, actor.system.attributes.hp.max - 10),
		});

		// A target for the card's Apply Healing button to land on.
		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		const token = await placeToken(scene, {
			name: `${TEST_PREFIX} Oathsworn`,
			actor: actor as unknown as Actor,
			gx: 5,
			gy: 5,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		await targetToken(token);

		await actor.sheet.render(true);
		await settle(1500);
	}, 120_000);

	afterAll(async () => {
		await actor?.sheet.close().catch(() => {});
		if (getResourceRecoveryEnabled() !== originalResourceRecovery) {
			await setResourceRecoveryEnabled(originalResourceRecovery);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** Puts the pool and the actor's wounds where a test needs them to start. */
	async function stage({ charges, wound }: { charges: number; wound: number }): Promise<void> {
		await layOnHands.update({
			[`flags.${game.system.id}.chargePools.lay-on-hands.current`]: charges,
		});
		await actor.update({
			'system.attributes.hp.value': actor.system.attributes.hp.max - wound,
		});
		await waitFor(() => pool()?.current === charges, `the pool to start at ${charges}`);
	}

	/** Closes any prompt a previous test left open, so each opens its own. */
	async function closeSpendPrompt(): Promise<void> {
		if (!spendInput()) return;
		for (const app of foundry.applications.instances.values()) {
			const element = (app as { element?: HTMLElement }).element;
			if (element?.querySelector('.nimble-pool-spend__stepper-input')) {
				await (app as { close(): Promise<unknown> }).close().catch(() => {});
			}
		}
		await waitFor(() => !spendInput(), 'the previous spend prompt to close');
	}

	/** Activates the feature from its card and waits for the spend prompt. */
	async function openSpendPrompt(): Promise<void> {
		await closeSpendPrompt();

		const featuresTab = actor.sheet.element.querySelector<HTMLButtonElement>(
			'.nimble-primary-navigation button[aria-label="Features"]',
		);
		expect(featuresTab, 'the Features tab button').toBeTruthy();
		featuresTab!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		featuresTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle(600);

		const activate = actor.sheet.element.querySelector<HTMLElement>(
			`.nimble-feature-card[data-item-id="${layOnHands.id}"] .nimble-feature-card__img-activate`,
		);
		expect(activate, 'the feature card activate button').toBeTruthy();
		activate!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		await waitFor(() => !!spendInput(), 'the spend prompt to open');
	}

	/** Raises the open prompt's amount to `amount`, which it opens below. */
	async function chooseSpend(amount: number): Promise<void> {
		const root = spendInput()!.closest('.application') ?? document;
		const increment = [
			...root.querySelectorAll<HTMLButtonElement>('button[aria-label^="Spend one more"]'),
		].at(-1);
		expect(increment, 'the increment button').toBeTruthy();
		// Opens at the consumer minimum of 1.
		for (let step = 1; step < amount; step += 1) increment!.click();
		await settle(300);
		expect(spendInput()!.value).toBe(String(amount));
	}

	/** Rolls the open prompt and returns the card it posts. */
	async function submitAndReadCard(): Promise<ChatMessage> {
		const before = new Set(game.messages.contents.map((message) => message.id));
		const submit = submitButtonOutsideSheet();
		expect(submit, 'the dialog Roll button').toBeTruthy();
		submit!.click();

		await waitFor(
			() => game.messages.contents.some((message) => !before.has(message.id)),
			'the activation card',
		);
		await settle(800);
		return game.messages.contents.find((message) => !before.has(message.id))!;
	}

	/** Clicks the newest card's Apply Healing button. */
	function applyHealingFromCard(): void {
		const applyHealing = [
			...document.querySelectorAll<HTMLButtonElement>('button.nimble-button--apply-healing'),
		].at(-1);
		expect(applyHealing, 'the Apply Healing button').toBeTruthy();
		applyHealing!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	test('the pack feature surfaces a pool of 5 x LVL', async () => {
		await stage({ charges: POOL_MAX, wound: 10 });

		// A level 1 character, so the pack's "5 * @level" resolves to 5.
		expect(pool()).toMatchObject({ current: POOL_MAX, max: POOL_MAX });
	}, 60_000);

	test('activating it prompts for an amount bounded by the pool', async () => {
		await stage({ charges: POOL_MAX, wound: 10 });
		await openSpendPrompt();

		// The consumer's cost is the floor, the pool's remaining charges the ceiling.
		expect(spendInput()!.min).toBe('1');
		expect(spendInput()!.max).toBe(String(POOL_MAX));
		expect(spendInput()!.value).toBe('1');
	}, 60_000);

	test('the amount chosen is spent, reported on the card, and healed', async () => {
		await stage({ charges: POOL_MAX, wound: 10 });
		const hpBefore = actor.system.attributes.hp.value;
		await openSpendPrompt();
		await chooseSpend(SPEND_AMOUNT);

		const card = await submitAndReadCard();

		const remaining = POOL_MAX - SPEND_AMOUNT;
		expect(card.rolls[0]?.total, 'the healing rolled from @spent').toBe(SPEND_AMOUNT);
		await waitFor(() => pool()?.current === remaining, 'the pool to drop by what was spent');
		expect(
			foundry.utils.getProperty(card, `flags.${game.system.id}.chargeConsumption`),
		).toMatchObject([
			{
				poolLabel: LAY_ON_HANDS,
				previousValue: POOL_MAX,
				currentValue: remaining,
				change: -SPEND_AMOUNT,
			},
		]);

		applyHealingFromCard();

		await waitFor(
			() => actor.system.attributes.hp.value === hpBefore + SPEND_AMOUNT,
			`the target to be healed by ${SPEND_AMOUNT}`,
		);
	}, 60_000);

	test('a Safe Rest refills the pool', async () => {
		await stage({ charges: POOL_MAX - SPEND_AMOUNT, wound: 10 });
		await closeSpendPrompt();

		const safeRest = actor.sheet.element.querySelector<HTMLButtonElement>(
			'button[aria-label="Safe Rest"]',
		);
		expect(safeRest, 'the sheet Safe Rest button').toBeTruthy();
		safeRest!.click();

		await waitFor(() => !!submitButtonOutsideSheet(), 'the Safe Rest dialog to open');
		const confirmRest = submitButtonOutsideSheet();
		expect(confirmRest, 'the Safe Rest confirm button').toBeTruthy();
		confirmRest!.click();

		await waitFor(() => pool()?.current === POOL_MAX, 'the pool to refill on the rest');
	}, 60_000);

	// The boundary the other tests walk past: the preUseItem gate validates a
	// variable consumer's minimum against what is left, so spending the pool to
	// empty has to survive its own validation.
	test('spending the whole pool still heals and posts a card', async () => {
		await stage({ charges: POOL_MAX, wound: POOL_MAX });
		const hpBefore = actor.system.attributes.hp.value;
		await openSpendPrompt();
		await chooseSpend(POOL_MAX);

		// The failure this guards against loses the charges and posts nothing, so
		// the card arriving at all is the assertion that matters.
		const card = await submitAndReadCard();

		expect(card.rolls[0]?.total, 'the healing rolled from @spent').toBe(POOL_MAX);
		await waitFor(() => pool()?.current === 0, 'the pool to empty');

		applyHealingFromCard();

		await waitFor(
			() => actor.system.attributes.hp.value === hpBefore + POOL_MAX,
			`the target to be healed by ${POOL_MAX}`,
		);
	}, 60_000);
});

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
	importPackItem,
	placeToken,
	purgeTestDocuments,
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

/**
 * The resource-recovery toggle, read through the same casts the system uses:
 * it is not in fvtt-types' registered settings map. Local to this file because
 * nothing else needs it yet.
 */
function getResourceRecoveryEnabled(): boolean {
	return Boolean(
		game.settings.get(game.system.id as 'core', RESOURCE_RECOVERY_SETTING as 'rollMode'),
	);
}

async function setResourceRecoveryEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		game.system.id as 'core',
		RESOURCE_RECOVERY_SETTING as 'rollMode',
		value as never,
	);
}

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
			system: { attributes: { hp: { value: 4, max: 17 } } },
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

	test('the pack feature surfaces a pool of 5 x LVL', () => {
		// A level 1 character, so the pack's "5 * @level" resolves to 5.
		expect(pool()).toMatchObject({ current: 5, max: 5 });
	});

	test('activating it prompts for an amount bounded by the pool', async () => {
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

		// The consumer's cost is the floor, the pool's remaining charges the ceiling.
		expect(spendInput()!.min).toBe('1');
		expect(spendInput()!.max).toBe('5');
		expect(spendInput()!.value).toBe('1');
	}, 60_000);

	test('the amount chosen is spent, healed, and reported on the card', async () => {
		const root = spendInput()!.closest('.application') ?? document;
		const increment = [
			...root.querySelectorAll<HTMLButtonElement>('button[aria-label="Spend one more"]'),
		].at(-1);
		expect(increment, 'the increment button').toBeTruthy();
		increment!.click();
		increment!.click();
		await settle(300);
		expect(spendInput()!.value).toBe('3');

		const before = new Set(game.messages.contents.map((message) => message.id));
		submitButtonOutsideSheet()!.click();
		await waitFor(
			() => game.messages.contents.some((message) => !before.has(message.id)),
			'the activation card',
		);
		await settle(800);

		const card = game.messages.contents.find((message) => !before.has(message.id))!;
		expect(card.rolls[0]?.total, 'the healing rolled from @spent').toBe(3);
		await waitFor(() => pool()?.current === 2, 'the pool to drop by what was spent');
		expect(
			foundry.utils.getProperty(card, `flags.${game.system.id}.chargeConsumption`),
		).toMatchObject([{ poolLabel: LAY_ON_HANDS, previousValue: 5, currentValue: 2, change: -3 }]);
	}, 60_000);

	test('applying the card restores exactly what was spent', async () => {
		expect(actor.system.attributes.hp.value).toBe(4);

		const applyHealing = [
			...document.querySelectorAll<HTMLButtonElement>('button.nimble-button--apply-healing'),
		].at(-1);
		expect(applyHealing, 'the Apply Healing button').toBeTruthy();
		applyHealing!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		await waitFor(() => actor.system.attributes.hp.value === 7, 'the target to be healed by 3');
	}, 60_000);

	test('a Safe Rest refills the pool', async () => {
		expect(pool()?.current).toBe(2);

		const safeRest = actor.sheet.element.querySelector<HTMLButtonElement>(
			'button[aria-label="Safe Rest"]',
		);
		expect(safeRest, 'the sheet Safe Rest button').toBeTruthy();
		safeRest!.click();

		await waitFor(() => !!submitButtonOutsideSheet(), 'the Safe Rest dialog to open');
		submitButtonOutsideSheet()!.click();

		await waitFor(() => pool()?.current === 5, 'the pool to refill on the rest');
	}, 60_000);
});

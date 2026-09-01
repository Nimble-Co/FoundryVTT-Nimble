/**
 * The sheet header's resource slot, through the rendered sheet.
 *
 * A promoted pool is only worth anything if a player can read it and correct it
 * where they already look, so these render the real sheet and use its controls.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { buildCharacter, type CharacterActor } from './builders/buildCharacter.ts';
import { purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Sheet Resource';

type SheetActor = CharacterActor & {
	sheet: {
		render(force: boolean): Promise<unknown>;
		element: HTMLElement;
		close(): Promise<unknown>;
	};
};

const openSheet = async (actor: SheetActor): Promise<HTMLElement> => {
	await actor.sheet.render(true);
	await waitFor(() => !!actor.sheet.element, 'the sheet to render');
	await settle(400);
	return actor.sheet.element;
};

const resourceSlot = (sheet: HTMLElement) => sheet.querySelector('.nimble-character-resources');

const resourceNames = (sheet: HTMLElement) =>
	[...(resourceSlot(sheet)?.querySelectorAll('.nimble-heading--resource') ?? [])].map((heading) =>
		heading.textContent?.trim(),
	);

const barFor = (sheet: HTMLElement, label: string): HTMLElement | null => {
	const headings = [...(resourceSlot(sheet)?.querySelectorAll('.nimble-heading--resource') ?? [])];
	const heading = headings.find((entry) => entry.textContent?.trim().startsWith(label));
	return (heading?.nextElementSibling as HTMLElement) ?? null;
};

const poolOf = (actor: CharacterActor, identifier: string) => {
	for (const item of actor.items.contents) {
		const pools = item.flags[game.system.id]?.chargePools as
			| Record<string, { current: number; max: number }>
			| undefined;
		if (pools?.[identifier]) return pools[identifier];
	}
	return undefined;
};

/** A feature carrying a pool the test controls, so promotion can be toggled. */
const addPoolFeature = async (
	actor: CharacterActor,
	name: string,
	rule: Record<string, unknown>,
): Promise<void> => {
	await actor.createEmbeddedDocuments('Item', [
		{
			name,
			type: 'feature',
			system: {
				rules: [
					{
						type: 'chargePool',
						id: `${name}-pool`,
						identifier: name.toLowerCase(),
						label: name,
						scope: 'item',
						max: '2',
						initial: 'max',
						predicate: {},
						priority: 1,
						recoveries: [],
						...rule,
					},
				],
			},
		},
	]);
	await settle(400);
};

describe('the sheet header shows the pools an author promoted', () => {
	let shadowmancer: SheetActor;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		shadowmancer = (await buildCharacter({
			name: `${TEST_PREFIX} Shadowmancer`,
			className: 'Shadowmancer',
			level: 5,
		})) as SheetActor;
	}, 120_000);

	afterEach(async () => {
		await shadowmancer.sheet.close();
		await settle(200);
	});

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('a promoted pool is read where mana is read', async () => {
		const sheet = await openSheet(shadowmancer);

		expect(resourceNames(sheet)).toContain('Pilfered Power');
	});

	test('its current value is editable and its maximum is not', async () => {
		const sheet = await openSheet(shadowmancer);
		const bar = barFor(sheet, 'Pilfered Power')!;

		const current = bar.querySelector<HTMLInputElement>('.nimble-resource-bar__input--current')!;
		const max = bar.querySelector<HTMLInputElement>('.nimble-resource-bar__input--max')!;

		expect(current.disabled).toBe(false);
		expect(max.disabled).toBe(true);
		expect(Number(max.value)).toBe(poolOf(shadowmancer, 'pilfered-power')!.max);
	});

	test('typing a new value into the header writes it to the pool', async () => {
		const sheet = await openSheet(shadowmancer);
		const bar = barFor(sheet, 'Pilfered Power')!;
		const current = bar.querySelector<HTMLInputElement>('.nimble-resource-bar__input--current')!;

		current.value = '1';
		current.dispatchEvent(new Event('change', { bubbles: true }));
		await settle(600);

		expect(poolOf(shadowmancer, 'pilfered-power')!.current).toBe(1);
	});

	test('the pool keeps its badge on the feature that grants it', async () => {
		const sheet = await openSheet(shadowmancer);

		expect(resourceNames(sheet)).toContain('Pilfered Power');
		// Promotion is additive: the granting feature still carries the pool.
		const granting = shadowmancer.items.contents.find((item) => item.name === 'Pilfered Power');
		const pools = granting?.flags[game.system.id]?.chargePools as Record<string, unknown>;
		expect(Object.keys(pools ?? {})).toContain('pilfered-power');
	});
});

describe('a pool reaches the header only when its author asks', () => {
	let actor: SheetActor;

	beforeAll(async () => {
		actor = (await buildCharacter({
			name: `${TEST_PREFIX} Toggles`,
			className: 'Shadowmancer',
			level: 5,
		})) as SheetActor;
	}, 120_000);

	afterEach(async () => {
		await actor.sheet.close();
		await settle(200);
	});

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('a pool that does not opt in stays off the header', async () => {
		await addPoolFeature(actor, 'Quiet', { showAsResource: false });
		const sheet = await openSheet(actor);

		// The pool has to exist, or its absence from the header proves nothing.
		expect(poolOf(actor, 'quiet')).toBeTruthy();
		expect(resourceNames(sheet)).not.toContain('Quiet');
	});

	test('a hidden pool is not promoted even when it opts in', async () => {
		await addPoolFeature(actor, 'Secret', { showAsResource: true, hidden: true });
		const sheet = await openSheet(actor);

		expect(poolOf(actor, 'secret')).toBeTruthy();
		expect(resourceNames(sheet)).not.toContain('Secret');
	});
});

describe('a mana class is unaffected', () => {
	let mage: SheetActor;

	beforeAll(async () => {
		mage = (await buildCharacter({
			name: `${TEST_PREFIX} Mage`,
			className: 'Mage',
			level: 4,
		})) as SheetActor;
	}, 120_000);

	afterAll(async () => {
		await mage.sheet.close();
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the mana bar is there and no pool joins it', async () => {
		const sheet = await openSheet(mage);

		expect(resourceSlot(sheet)?.querySelector('.nimble-heading--mana')).toBeTruthy();
		expect(resourceNames(sheet)).toEqual([]);
	});
});

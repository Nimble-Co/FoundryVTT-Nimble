import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NimbleClassItem } from './class.js';

/**
 * `NimbleClassItem._preUpdate` ends in `super._preUpdate(...)`. The shared `Item` mock has no
 * such method, so stand one up for the duration of this file rather than reaching into the
 * shared mocks.
 */
const itemPrototype = (globalThis as unknown as { Item: { prototype: Record<string, unknown> } })
	.Item.prototype;

beforeEach(() => {
	itemPrototype._preUpdate = vi.fn(async () => undefined);
});

afterEach(() => {
	delete itemPrototype._preUpdate;
	vi.restoreAllMocks();
});

interface MaxHpBonusSource {
	value: number;
	perLevel?: boolean;
	disabled?: boolean;
	type?: string;
}

/** An item carrying rules, in the `Map` shape `NimbleBaseItem#rules` exposes. */
function createRuleHost(rules: MaxHpBonusSource[]) {
	return {
		rules: new Map(
			rules.map((rule, index) => [
				`rule-${index}`,
				{ type: rule.type ?? 'maxHpBonus', value: rule.value, perLevel: rule.perLevel ?? false },
			]),
		),
	};
}

function createActor(hpBonus: number, items: ReturnType<typeof createRuleHost>[]) {
	return {
		classes: {},
		items,
		system: {
			attributes: { hp: { bonus: hpBonus }, hitDice: {} },
			classData: { levels: [], startingClass: 'shepherd' },
		},
		update: vi.fn(async (_data: Record<string, unknown>) => undefined),
	};
}

function createClassItem(actor: unknown, classLevel: number) {
	return {
		identifier: 'shepherd',
		isEmbedded: true,
		parent: actor,
		rules: new Map(),
		system: { classLevel, hitDieSize: 8 },
	};
}

async function runClassPreUpdate(classItem: unknown, changed: Record<string, unknown>) {
	return NimbleClassItem.prototype._preUpdate.call(
		classItem as NimbleClassItem,
		changed,
		{} as never,
		{} as never,
	);
}

/** The single `actor.update()` payload the hook builds. */
function updatePayload(actor: ReturnType<typeof createActor>): Record<string, unknown> {
	return actor.update.mock.calls.at(-1)?.[0] ?? {};
}

describe('NimbleClassItem._preUpdate: per-level maxHpBonus rules', () => {
	it('raises the stored HP bonus for a rule carried by a non-class item', async () => {
		// The reported case: a feature grants +2 max HP per level. Only the class item
		// receives the level update, so the feature's rule has to be totalled here.
		const actor = createActor(4, [createRuleHost([{ value: 2, perLevel: true }])]);
		const classItem = createClassItem(actor, 2);

		await runClassPreUpdate(classItem, { system: { classLevel: 3 } });

		expect(updatePayload(actor)['system.attributes.hp.bonus']).toBe(6);
	});

	it('lowers the stored HP bonus when a level up is reverted', async () => {
		const actor = createActor(6, [createRuleHost([{ value: 2, perLevel: true }])]);
		const classItem = createClassItem(actor, 3);

		await runClassPreUpdate(classItem, { system: { classLevel: 2 } });

		expect(updatePayload(actor)['system.attributes.hp.bonus']).toBe(4);
	});

	it('scales by the full difference when the level moves more than one step', async () => {
		// Level history validation resets a corrupt character straight back to 1.
		const actor = createActor(8, [createRuleHost([{ value: 2, perLevel: true }])]);
		const classItem = createClassItem(actor, 4);

		await runClassPreUpdate(classItem, { system: { classLevel: 1 } });

		expect(updatePayload(actor)['system.attributes.hp.bonus']).toBe(2);
	});

	it('totals every per-level rule on the actor, including the class item’s own', async () => {
		const actor = createActor(9, [
			createRuleHost([{ value: 2, perLevel: true }]),
			createRuleHost([{ value: 1, perLevel: true }]),
		]);
		const classItem = createClassItem(actor, 3);
		classItem.rules = new Map([
			['class-rule', { type: 'maxHpBonus', value: 3, perLevel: true }],
		]) as never;
		actor.items.push(classItem as never);

		await runClassPreUpdate(classItem, { system: { classLevel: 4 } });

		expect(updatePayload(actor)['system.attributes.hp.bonus']).toBe(15);
	});

	it('leaves the stored HP bonus alone for a flat maxHpBonus rule', async () => {
		// A flat bonus is worth the same at every level, so a level change must not move it.
		const actor = createActor(4, [createRuleHost([{ value: 2, perLevel: false }])]);
		const classItem = createClassItem(actor, 2);

		await runClassPreUpdate(classItem, { system: { classLevel: 3 } });

		expect(updatePayload(actor)).not.toHaveProperty('system.attributes.hp.bonus');
	});

	it('ignores rules of other types', async () => {
		const actor = createActor(4, [
			createRuleHost([{ type: 'maxWounds', value: 2, perLevel: true }]),
		]);
		const classItem = createClassItem(actor, 2);

		await runClassPreUpdate(classItem, { system: { classLevel: 3 } });

		expect(updatePayload(actor)).not.toHaveProperty('system.attributes.hp.bonus');
	});

	it('leaves the stored HP bonus alone when the class level does not change', async () => {
		const actor = createActor(4, [createRuleHost([{ value: 2, perLevel: true }])]);
		const classItem = createClassItem(actor, 2);

		await runClassPreUpdate(classItem, { system: { classLevel: 2 } });

		expect(updatePayload(actor)).not.toHaveProperty('system.attributes.hp.bonus');
	});
});

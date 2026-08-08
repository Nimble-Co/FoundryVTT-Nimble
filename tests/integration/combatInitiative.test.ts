/**
 * Live regression tests for the initiative pipeline consumers merged from
 * dev, exercised through a real Combat's `rollInitiative`: the initiative
 * formula reflects initiativeBonus and initiativeRollMode, the roll total
 * maps to the character's starting actions, a combatMana rule grants mana
 * once per combat, and an initiativeMessage rule whispers its resolved
 * reminder to the roller.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createCombatWith, purgeTestDocuments, ruleFeatureData, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Initiative';

interface InitiativeActor {
	id: string;
	type: string;
	system: {
		attributes: { initiative: { mod: number; defaultRollMode: number } };
		resources: { mana: { baseMax: number; current: number } };
	};
	getFlag(scope: string, key: string): unknown;
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

describe('combat initiative rule consumers', () => {
	let actor: InitiativeActor;
	const createdCombatIds = new Set<string>();

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Hero`,
			type: 'character',
		})) as unknown as InitiativeActor;

		await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Battle Instincts`, [
				{ type: 'initiativeBonus', value: '2' },
				{ type: 'initiativeRollMode', mode: 'adjust', value: 1 },
				{
					type: 'initiativeMessage',
					label: 'Instincts',
					formula: '1 + 1',
					message: 'Mystic insight: {value}',
				},
				{ type: 'combatMana', formula: '3' },
			]),
		]);
	}, 60_000);

	afterAll(async () => {
		for (const id of createdCombatIds) {
			await game.combats
				.get(id)
				?.delete()
				.catch((error) => console.error(error));
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('data prep feeds the initiative attributes the roll is built from', () => {
		expect(actor.system.attributes.initiative.mod).toBe(2);
		expect(actor.system.attributes.initiative.defaultRollMode).toBe(1);
	});

	test('rolling initiative applies actions, mana grant, reminder whisper, and chat card', async () => {
		const combat = await createCombatWith([{ actor: actor as unknown as Actor }], {
			start: false,
		});
		createdCombatIds.add(combat.id!);
		const combatant = combat.combatants.find((c) => c.actorId === actor.id)!;
		expect(combatant.initiative).toBeNull();

		const messagesBefore = new Set(game.messages.contents.map((message) => message.id));
		await combat.rollInitiative([combatant.id!]);

		await waitFor(() => combatant.initiative !== null, 'the combatant initiative to be set');
		const total = combatant.initiative!;

		// Nimble's action economy lives on the COMBATANT subtype's system data:
		// 20+ → 3 starting actions, 10-19 → 2, below → 1.
		const expectedActions = total >= 20 ? 3 : total >= 10 ? 2 : 1;
		const combatantActions = () =>
			(
				combatant.system as unknown as {
					actions?: { base?: { current?: number } };
				}
			).actions?.base?.current;
		await waitFor(
			() => combatantActions() === expectedActions,
			`starting actions to match the roll total (${total})`,
		);

		// combatMana grants once for this combat and records the grant.
		await waitFor(() => actor.system.resources.mana.current === 3, 'the combat mana grant');
		expect(actor.system.resources.mana.baseMax).toBe(3);
		const grants = actor.getFlag(game.system.id, 'combatManaGrants') as Record<
			string,
			{ mana: number }
		>;
		expect(grants[combat.id!]?.mana).toBe(3);

		const newMessages = game.messages.contents.filter((message) => !messagesBefore.has(message.id));

		// The initiativeMessage rule whispers its resolved template to the roller.
		const reminder = newMessages.find((message) =>
			(message.content ?? '').includes('Mystic insight: 2'),
		);
		expect(reminder, 'the initiative reminder whisper').toBeTruthy();
		expect(reminder!.whisper).toContain(game.user!.id);

		// The initiative roll card reflects both rules: an extra kept-highest
		// d20 from the roll mode and the +2 initiative mod.
		const rollCard = newMessages.find(
			(message) => foundry.utils.getProperty(message, 'flags.core.initiativeRoll') === true,
		);
		expect(rollCard, 'the initiative roll chat card').toBeTruthy();
		const formula = rollCard!.rolls[0]!.formula;
		expect(formula).toMatch(/2d20kh/);
		expect(formula).toContain('+ 2');

		await combat.delete();
		createdCombatIds.delete(combat.id!);
	}, 90_000);

	test('a second initiative roll in the same combat does not re-grant mana', async () => {
		const combat = await createCombatWith([{ actor: actor as unknown as Actor }], {
			start: false,
		});
		createdCombatIds.add(combat.id!);
		const combatant = combat.combatants.find((c) => c.actorId === actor.id)!;

		await combat.rollInitiative([combatant.id!]);
		await waitFor(() => combatant.initiative !== null, 'the first roll to land');

		// Spend some mana, clear initiative, and re-roll: the recorded grant
		// for this combat must prevent a top-up.
		await actor.update({ 'system.resources.mana.current': 1 });
		await combatant.update({ initiative: null });
		await combat.rollInitiative([combatant.id!]);
		await waitFor(() => combatant.initiative !== null, 'the re-roll to land');

		expect(actor.system.resources.mana.current).toBe(1);

		await combat.delete();
		createdCombatIds.delete(combat.id!);
	}, 90_000);
});

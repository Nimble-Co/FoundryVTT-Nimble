/**
 * Batch 4 (ActiveEffect V2) regression tests against live V14: every Nimble
 * condition applies and removes cleanly through Actor#toggleStatusEffect, the
 * created effects are eligible for token status icons under V14's draw filter
 * (appliedEffects + showIcon/isTemporary), linked conditions cascade, and the
 * condition subtype data model carries the AE V2 `changes` schema.
 */

import { afterAll, describe, expect, test } from 'vitest';

const TEST_ACTOR_NAME = 'V14 Conditions Test Actor';

interface StatusEffectLike {
	id: string;
	name: string;
	statuses?: string[];
}

interface EffectLike {
	id: string;
	statuses: Set<string>;
	isTemporary: boolean;
	showIcon: number;
	system: { changes?: unknown[] };
	type: string;
	flags: { core?: { overlay?: boolean } };
}

interface StatusActorLike {
	statuses: Set<string>;
	appliedEffects: EffectLike[];
	effects: { size: number };
	toggleStatusEffect: (
		statusId: string,
		options?: { active?: boolean; overlay?: boolean },
	) => Promise<unknown>;
	delete: () => Promise<unknown>;
}

describe('conditions under ActiveEffect V2', () => {
	afterAll(async () => {
		const leftovers = game.actors.filter((actor) => actor.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	test('the condition data model defines the AE V2 changes field', () => {
		const model = CONFIG.ActiveEffect.dataModels.condition as unknown as {
			schema: { fields: Record<string, unknown> };
		};
		expect(model).toBeDefined();
		const changes = model.schema.fields.changes;
		expect(changes).toBeInstanceOf(foundry.data.fields.ArrayField);
		const element = (changes as { element: { fields: Record<string, unknown> } }).element;
		expect(element.fields.type).toBeInstanceOf(foundry.data.fields.StringField);
		expect(element.fields.phase).toBeInstanceOf(foundry.data.fields.StringField);
		expect(element.fields.priority).toBeInstanceOf(foundry.data.fields.NumberField);
	});

	// The automatic-conditions hooks run additional un-awaited effect writes
	// after each toggle (linked condition application/removal). Give those
	// background chains time to finish before the next toggle so the test
	// doesn't race them — users never toggle 30 conditions in two seconds.
	const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

	test(
		'every registered condition applies and removes via toggleStatusEffect',
		{ timeout: 90_000 },
		async () => {
			const actor = (await Actor.create({
				name: TEST_ACTOR_NAME,
				type: 'character',
			})) as unknown as StatusActorLike;
			expect(actor).toBeDefined();

			const statusEffects = [...(CONFIG.statusEffects as unknown as StatusEffectLike[])];
			expect(statusEffects.length).toBeGreaterThan(0);

			for (const status of statusEffects) {
				await actor.toggleStatusEffect(status.id, { active: true });
				await settle();
				expect(actor.statuses.has(status.id), `${status.id} should be active`).toBe(true);

				// Linked conditions cascade onto the same effect's status set.
				for (const linked of status.statuses ?? []) {
					expect(actor.statuses.has(linked), `${status.id} should link ${linked}`).toBe(true);
				}

				// V14 tokens draw icons from appliedEffects where showIcon is ALWAYS,
				// or CONDITIONAL + temporary. fromStatusEffect stamps status-created
				// effects with ALWAYS (isTemporary is duration-based only in V14).
				const effect = actor.appliedEffects.find((e) => e.statuses.has(status.id));
				expect(effect, `${status.id} should produce an applied effect`).toBeDefined();
				expect(effect!.showIcon, `${status.id} effect should always show its icon`).toBe(
					CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
				);

				await actor.toggleStatusEffect(status.id, { active: false });
				await settle();
				expect(actor.statuses.has(status.id), `${status.id} should be removed`).toBe(false);
			}

			await settle();
			expect(actor.effects.size).toBe(0);
			await actor.delete();
		},
	);

	test('overlay application marks the effect as an overlay', async () => {
		const actor = (await Actor.create({
			name: TEST_ACTOR_NAME,
			type: 'character',
		})) as unknown as StatusActorLike;

		const status = (CONFIG.statusEffects as unknown as StatusEffectLike[])[0]!;
		await actor.toggleStatusEffect(status.id, { active: true, overlay: true });

		const effect = actor.appliedEffects.find((e) => e.statuses.has(status.id));
		expect(effect).toBeDefined();
		expect(effect!.flags.core?.overlay).toBe(true);

		await actor.toggleStatusEffect(status.id, { active: false });
		await actor.delete();
	});
});

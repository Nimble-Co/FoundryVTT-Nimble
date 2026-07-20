/**
 * Regression tests against live V14 for NimbleActiveEffect's showIcon
 * defaulting: system-created effects without a temporary duration (toggle
 * backing AEs, banked damage reduction, granted buffs) must still render a
 * token status icon. V14 tokens draw icons from Actor#appliedEffects where
 * showIcon is ALWAYS (or CONDITIONAL + temporary), and the core default of
 * CONDITIONAL would hide every duration-less effect.
 */

import { afterAll, describe, expect, test } from 'vitest';

const TEST_ACTOR_NAME = 'V14 Effect Visibility Test Actor';

interface EffectLike {
	id: string;
	name: string;
	showIcon: number;
}

interface EffectActorLike {
	appliedEffects: EffectLike[];
	createEmbeddedDocuments: (type: string, data: Record<string, unknown>[]) => Promise<EffectLike[]>;
	delete: () => Promise<unknown>;
}

describe('Active Effect token visibility under AE V2', () => {
	afterAll(async () => {
		const leftovers = game.actors.filter((actor) => actor.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	test('a duration-less effect defaults to showIcon ALWAYS and is token-eligible', async () => {
		const actor = (await Actor.create({
			name: TEST_ACTOR_NAME,
			type: 'character',
		})) as unknown as EffectActorLike;
		expect(actor).toBeDefined();

		const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [
			{ name: 'Banked Reduction Stand-in', img: 'icons/svg/shield.svg' },
		]);
		expect(effect.showIcon).toBe(CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS);

		const applied = actor.appliedEffects.find((e) => e.id === effect.id);
		expect(applied, 'effect should be token-icon eligible via appliedEffects').toBeDefined();

		await actor.delete();
	});

	test('an explicit showIcon choice is preserved', async () => {
		const actor = (await Actor.create({
			name: TEST_ACTOR_NAME,
			type: 'character',
		})) as unknown as EffectActorLike;

		const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [
			{
				name: 'Hidden Effect',
				img: 'icons/svg/aura.svg',
				showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER,
			},
		]);
		expect(effect.showIcon).toBe(CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER);

		await actor.delete();
	});
});

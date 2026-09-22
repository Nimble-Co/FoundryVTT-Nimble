/**
 * Live regression tests for concentration on cast: the condition is created on
 * the real actor as a persisted ActiveEffect, a second cast replaces it, and a
 * concentrationTrack rule keeps two schools apart. The unit tests mock
 * ActiveEffect.implementation, so only these exercise real persistence.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { messageFromFlow, purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Concentration';

interface ConcentratingActor {
	id: string;
	statuses: Set<string>;
	effects: {
		contents: Array<{
			id: string;
			origin: string | null;
			statuses: Set<string>;
			getFlag(scope: string, key: string): unknown;
		}>;
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
}

/** A roll-less concentration spell of the given school, so activation posts a card and nothing else. */
function concentrationSpellData(name: string, school: string) {
	return {
		name,
		type: 'spell',
		system: {
			school,
			tier: 1,
			properties: { selected: ['concentration'] },
			activation: { effects: [] },
		},
	};
}

function trackFeatureData(name: string, schools: string[]) {
	return {
		name,
		type: 'feature',
		system: {
			rules: [
				{
					type: 'concentrationTrack',
					id: 'test-concentration-track',
					label: name,
					schools,
				},
			],
		},
	};
}

describe('concentration on cast', () => {
	let caster: ConcentratingActor;
	function concentrationEffects() {
		return caster.effects.contents.filter((effect) => effect.statuses.has('concentration'));
	}

	async function castSpell(item: { id: string }) {
		return messageFromFlow('spell', () =>
			(item as unknown as { activate(options: object): Promise<unknown> }).activate({
				fastForward: true,
			}),
		);
	}

	async function addSpell(name: string, school: string) {
		const [item] = await caster.createEmbeddedDocuments('Item', [
			concentrationSpellData(`${TEST_PREFIX} ${name}`, school),
		]);
		return item;
	}

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		caster = (await Actor.create({
			name: `${TEST_PREFIX} Caster`,
			type: 'character',
		})) as unknown as ConcentratingActor;
		await caster.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});
	}, 60_000);

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	async function clearConcentration() {
		for (const effect of concentrationEffects()) {
			await (effect as unknown as { delete(): Promise<unknown> }).delete().catch(() => {});
		}
		await waitFor(() => concentrationEffects().length === 0, 'concentration to clear');
	}

	test('casting persists a concentration effect on the caster, credited to the spell', async () => {
		const spell = await addSpell('Persisting Gale', 'wind');

		await castSpell(spell);
		await waitFor(() => caster.statuses.has('concentration'), 'concentration to be applied');

		const [effect] = concentrationEffects();
		expect(effect.origin).toBe((spell as unknown as { uuid: string }).uuid);
		expect(effect.getFlag(game.system.id, 'concentrationTrack')).toBe('default');

		await clearConcentration();
	}, 60_000);

	test('the card reports the concentration it applied', async () => {
		const spell = await addSpell('Reported Gale', 'wind');

		const card = await castSpell(spell);

		expect((card?.system as { concentration?: boolean })?.concentration).toBe(true);

		await clearConcentration();
	}, 60_000);

	test('a second cast leaves the caster with exactly one concentration', async () => {
		const first = await addSpell('First Gale', 'wind');
		const second = await addSpell('Second Gale', 'wind');

		await castSpell(first);
		await waitFor(() => concentrationEffects().length === 1, 'the first concentration');

		await castSpell(second);
		await settle(800);

		expect(concentrationEffects()).toHaveLength(1);
		expect(concentrationEffects()[0].origin).toBe((second as unknown as { uuid: string }).uuid);

		await clearConcentration();
	}, 90_000);

	test('a concentrationTrack rule lets two tracked schools be held at once', async () => {
		const [feature] = await caster.createEmbeddedDocuments('Item', [
			trackFeatureData(`${TEST_PREFIX} Master of Storm`, ['lightning', 'wind']),
		]);
		await settle(400);

		const lightning = await addSpell('Tracked Bolt', 'lightning');
		const wind = await addSpell('Tracked Gale', 'wind');

		await castSpell(lightning);
		await waitFor(() => concentrationEffects().length === 1, 'the lightning concentration');

		await castSpell(wind);
		await waitFor(() => concentrationEffects().length === 2, 'the wind concentration alongside it');

		expect(
			concentrationEffects()
				.map((effect) => effect.getFlag(game.system.id, 'concentrationTrack'))
				.sort(),
		).toEqual(['lightning', 'wind']);

		// Two named schools are two concentrations, never three: a school the rule
		// does not name takes the whole capacity back.
		const fire = await addSpell('Untracked Flame', 'fire');
		await castSpell(fire);
		await waitFor(() => concentrationEffects().length === 1, 'the untracked concentration alone');

		expect(concentrationEffects()[0].getFlag(game.system.id, 'concentrationTrack')).toBe('default');

		await clearConcentration();
		await caster.deleteEmbeddedDocuments('Item', [feature.id]);
	}, 120_000);

	test('casting the same tracked school again replaces only that track', async () => {
		const [feature] = await caster.createEmbeddedDocuments('Item', [
			trackFeatureData(`${TEST_PREFIX} Master of Storm`, ['lightning', 'wind']),
		]);
		await settle(400);

		const bolt = await addSpell('Replacing Bolt', 'lightning');
		const gale = await addSpell('Held Gale', 'wind');
		const secondBolt = await addSpell('Second Bolt', 'lightning');

		await castSpell(bolt);
		await castSpell(gale);
		await waitFor(() => concentrationEffects().length === 2, 'both tracks held');

		await castSpell(secondBolt);
		await settle(800);

		expect(concentrationEffects()).toHaveLength(2);
		expect(
			concentrationEffects().find(
				(effect) => effect.getFlag(game.system.id, 'concentrationTrack') === 'lightning',
			)?.origin,
		).toBe((secondBolt as unknown as { uuid: string }).uuid);
		expect(
			concentrationEffects().find(
				(effect) => effect.getFlag(game.system.id, 'concentrationTrack') === 'wind',
			)?.origin,
		).toBe((gale as unknown as { uuid: string }).uuid);

		await clearConcentration();
		await caster.deleteEmbeddedDocuments('Item', [feature.id]);
	}, 120_000);

	test('a tracked school ends a concentration held on the default track', async () => {
		const [feature] = await caster.createEmbeddedDocuments('Item', [
			trackFeatureData(`${TEST_PREFIX} Master of Storm`, ['lightning', 'wind']),
		]);
		await settle(400);

		const flame = await addSpell('Displaced Flame', 'fire');
		const bolt = await addSpell('Displacing Bolt', 'lightning');

		await castSpell(flame);
		await waitFor(() => concentrationEffects().length === 1, 'the untracked concentration');

		await castSpell(bolt);
		await settle(800);

		expect(concentrationEffects()).toHaveLength(1);
		expect(concentrationEffects()[0].getFlag(game.system.id, 'concentrationTrack')).toBe(
			'lightning',
		);

		await clearConcentration();
		await caster.deleteEmbeddedDocuments('Item', [feature.id]);
	}, 120_000);
});

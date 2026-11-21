/**
 * Live test of the Attacker Takes rule's "Ends after it answers": the effect that holds the rule
 * ends once the rule answers a hit, and only that effect.
 *
 * A real attack card hits a hero who holds two effects with an Attacker Takes rule: one ends
 * after it answers, one stays. Damage goes on through the card's Apply Damage button. With
 * Feature Effects on, the effect ends by itself. With it off, the card shows a waiting End line,
 * and its End button ends the effect.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	attackFeatureData,
	clearTargets,
	createViewedTestScene,
	getRuleAutomationEnabled,
	messageNode,
	placeToken,
	purgeTestDocuments,
	setRuleAutomationEnabled,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Damage Back Ends';

/** `1d8` with the primary die set to 4: a hit for 4, no crit. */
const ROLLED_DAMAGE = 4;
const STARTING_HP = 20;

interface LiveActor {
	id: string;
	uuid: string;
	name: string;
	items: { find(predicate: (item: Item) => boolean): Item | undefined };
	effects: { contents: Array<{ id: string; name: string }> };
	system: { attributes: { hp: { value: number } } };
	update(changes: Record<string, unknown>): Promise<unknown>;
	createEmbeddedDocuments(name: string, data: object[]): Promise<Array<{ id: string }>>;
}

function damageBackRule(id: string, endsEffect: boolean) {
	return {
		id,
		type: 'damageBack',
		disabled: false,
		identifier: '',
		label: '',
		predicate: {},
		priority: 1,
		trigger: 'damaged',
		attackDelivery: 'any',
		onlyCrits: false,
		amount: 'formula',
		formula: '3',
		damageType: 'cold',
		ignoreArmor: true,
		endsEffect,
	};
}

function effectData(name: string, endsEffect: boolean) {
	return {
		name,
		type: 'nimble',
		img: 'icons/svg/frozen.svg',
		disabled: false,
		system: { rules: [damageBackRule(`${name.toLowerCase()}-back`, endsEffect)] },
	};
}

describe('an Attacker Takes rule that ends after it answers', () => {
	let attacker: LiveActor;
	let scene: Scene;
	let originalSceneId: string | null = null;
	let ruleAutomationBefore = true;
	let nextColumn = 5;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalSceneId = canvas.scene?.id ?? null;
		ruleAutomationBefore = getRuleAutomationEnabled();

		// The card shows Apply Damage on a hit only when the damage node has a hit outcome.
		const clubData = attackFeatureData(`${TEST_PREFIX} Club`);
		const [clubDamage] = clubData.system.activation.effects;
		Object.assign(clubDamage!, {
			on: {
				hit: [
					{
						id: 'atk-hit',
						type: 'damageOutcome',
						outcome: 'fullDamage',
						parentContext: 'hit',
						parentNode: 'atk',
					},
				],
			},
		});
		attacker = (await Actor.create({
			name: `${TEST_PREFIX} Ogre`,
			type: 'npc',
			items: [clubData],
		} as Actor.CreateData)) as unknown as LiveActor;
		await attacker.update({ 'system.attributes.hp.max': 50, 'system.attributes.hp.value': 50 });

		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: 'dbe-ogre',
			actor: attacker as unknown as Actor,
			gx: 3,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
	}, 120_000);

	afterAll(async () => {
		await setRuleAutomationEnabled(ruleAutomationBefore);
		await clearTargets();
		if (originalSceneId) await game.scenes.get(originalSceneId)?.view();
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** A hero next to the ogre with the two effects: Aura ends after it answers, Ward stays. */
	async function heldHero(label: string): Promise<{ hero: LiveActor; token: TokenDocument }> {
		const hero = (await Actor.create({
			name: `${TEST_PREFIX} ${label}`,
			type: 'character',
		})) as unknown as LiveActor;
		await hero.update({
			'system.attributes.hp.max': STARTING_HP,
			'system.attributes.hp.value': STARTING_HP,
		});
		await hero.createEmbeddedDocuments('ActiveEffect', [
			effectData('Aura', true),
			effectData('Ward', false),
		]);
		const token = await placeToken(scene, {
			name: `dbe-${label.toLowerCase()}`,
			actor: hero as unknown as Actor,
			gx: nextColumn,
			gy: 4,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		nextColumn += 3;
		await settle(300);
		return { hero, token };
	}

	const effectNames = (hero: LiveActor) => hero.effects.contents.map((effect) => effect.name);

	/** Attack the hero with the club and click the card's Apply Damage button. */
	async function hitAndApply(hero: LiveActor, token: TokenDocument): Promise<string> {
		await targetToken(token);
		const club = attacker.items.find((item) => item.name === `${TEST_PREFIX} Club`)!;
		const message = await (
			club as unknown as {
				activate(options: Record<string, unknown>): Promise<{ id: string } | null>;
			}
		).activate({ fastForward: true, primaryDieValue: ROLLED_DAMAGE });
		expect(message, 'the attack posts a card').toBeTruthy();
		const messageId = message!.id;
		await settle(600);

		const applyButton = () =>
			messageNode(messageId)?.querySelector<HTMLButtonElement>('.nimble-button--apply-damage') ??
			null;
		await waitFor(() => applyButton() !== null, `the Apply Damage button on ${messageId}`);
		applyButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await waitFor(
			() => hero.system.attributes.hp.value === STARTING_HP - ROLLED_DAMAGE,
			`${hero.name} to take ${ROLLED_DAMAGE} damage`,
		);
		await settle(800);
		return messageId;
	}

	test('with Feature Effects on, the effect that answered ends and the other stays', async () => {
		await setRuleAutomationEnabled(true);
		const { hero, token } = await heldHero('Vex');
		expect(effectNames(hero)).toEqual(expect.arrayContaining(['Aura', 'Ward']));

		await hitAndApply(hero, token);

		await waitFor(() => !effectNames(hero).includes('Aura'), 'the Aura effect to end');
		expect(effectNames(hero)).toContain('Ward');
	}, 60_000);

	test('with Feature Effects off, the effect waits for End, and End ends it', async () => {
		await setRuleAutomationEnabled(false);
		const { hero, token } = await heldHero('Rime');

		const messageId = await hitAndApply(hero, token);

		expect(effectNames(hero)).toEqual(expect.arrayContaining(['Aura', 'Ward']));
		const endLabel = game.i18n.format('NIMBLE.lastsUntil.chat.endLabel', {
			effect: 'Aura',
			name: hero.name,
		});
		const endButton = () =>
			[
				...(messageNode(messageId)?.querySelectorAll<HTMLButtonElement>(
					'.nimble-card-events__action',
				) ?? []),
			].find((button) => button.getAttribute('aria-label') === endLabel) ?? null;
		await waitFor(() => endButton() !== null, 'the End button of the Aura line on the card');

		endButton()!.click();

		await waitFor(() => !effectNames(hero).includes('Aura'), 'End to end the Aura effect');
		expect(effectNames(hero)).toContain('Ward');
	}, 60_000);
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { getChargePoolRollData } from '#utils/chargePool/helpers.js';
import { Predicate } from '../../../etc/Predicate.js';

const SHINING_MANDATE = 'packs/classFeatures/core/oathsworn/sacred-decree/shining-mandate.json';
const RADIANT_JUDGMENT =
	'packs/classFeatures/core/oathsworn/oathsworn-progression/radiant-judgement.json';

const readItem = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));

type PackRule = Record<string, unknown> & {
	id: string;
	type: string;
	predicate?: Record<string, unknown>;
};

/** The Radiant Judgment rules of a hero of this level, each with its predicate checked. */
function judgmentHero(level: number) {
	const rules = (readItem(RADIANT_JUDGMENT).system.rules as PackRule[]).map((rule) => ({
		...rule,
		appliesTo: () => new Predicate((rule.predicate ?? {}) as never).test([`level:${level}`]),
	}));
	return {
		type: 'character',
		uuid: 'Actor.paladin',
		flags: {},
		items: {
			contents: [
				{
					id: 'judgment',
					name: 'Radiant Judgement',
					flags: {},
					rules: new Map(rules.map((rule) => [String(rule.id), rule])),
				},
			],
		},
		getRollData: vi.fn(() => ({})),
	};
}

describe('Shining Mandate pack item', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const item = readItem(SHINING_MANDATE);

	it('spends one Judgment Die of the Radiant Judgment pool to give its effect', () => {
		const judgmentPool = (readItem(RADIANT_JUDGMENT).system.rules as PackRule[]).find(
			(rule) => rule.type === 'dicePool',
		);

		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'diceConsumer',
				poolIdentifier: 'judgment',
				poolScope: judgmentPool?.scope,
				mode: 'manual',
				cost: '1',
				effectFormula: null,
				effectType: 'giveEffect',
				selectionOutcome: 'consume',
				cardOffer: null,
			}),
		]);
		expect(item.system.activation.effects).toEqual([]);
	});

	it('has an effect for the ally: radiant extra damage on its next attack, until combat ends', () => {
		const effects = item.effects as Record<string, any>[];
		const given = effects.find((effect) => effect.transfer === false);

		expect(given?.name).toBe('Shining Mandate');
		expect(given?._id).toMatch(/^[A-Za-z0-9]{16}$/);
		expect(given?.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'extraDamage',
				formula: '1d@pools.judgment.faces',
				damageType: 'radiant',
				whichRoll: 'holderAttacks',
				usedUp: true,
			}),
		]);
		expect(given?.system.rules[0].id).toMatch(/^[A-Za-z0-9]{16}$/);
		expect(given?.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
		expect(given?.system.escape.saves).toEqual(['strength', 'dexterity']);
	});

	it('gives the ally the die size of the Oathsworn when it is applied', () => {
		vi.stubGlobal('Roll', {
			replaceFormulaData: (formula: string, data: Record<string, any>) =>
				formula.replace('@pools.judgment.faces', String(data.pools.judgment.faces)),
		});
		const hero = judgmentHero(5);
		const user = {
			type: 'character',
			uuid: hero.uuid,
			getRollData: () => ({ pools: getChargePoolRollData(hero as never) }),
		};
		const effect = (item.effects as Record<string, unknown>[])[0];

		const payload = payloadFromEffect(
			{ toObject: () => structuredClone(effect) },
			{ itemUuid: 'Actor.paladin.Item.mandate', user },
		);

		expect((payload.data.system as { rules: { formula: string }[] }).rules[0].formula).toBe('1d10');
	});
});

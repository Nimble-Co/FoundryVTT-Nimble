import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Migration048ShadowmancerPilferedPower } from './Migration048ShadowmancerPilferedPower.js';

const PACKS_ROOT = join(process.cwd(), 'packs');

function readPackDoc(relativePath: string): Record<string, any> {
	return JSON.parse(readFileSync(join(PACKS_ROOT, relativePath), 'utf-8'));
}

const CLASS_PATH = 'classes/core/shadowmancer.json';
const PILFERED_POWER_PATH =
	'classFeatures/core/shadowmancer/shadowmancer-progression/pilfered-power.json';
const HEART_PATH =
	'classFeatures/core/shadowmancer/shadowmancer-subclasses/pact-of-the-red-dragon/heart-of-burning-fire.json';

function sourceFor(doc: Record<string, any>, pack: string): Record<string, any> {
	// An embedded copy on a live character, before this migration: same
	// document, but without the rules and declarations the pack now ships.
	const source = foundry.utils.deepClone(doc);
	source._stats = { compendiumSource: `Compendium.nimble.${pack}.Item.${doc._id}` };
	return source;
}

describe('the Shadowmancer pack content', () => {
	it('clears the class mana formula and declares the Pilfered Power spell cost', () => {
		const classDoc = readPackDoc(CLASS_PATH);
		expect(classDoc.system.mana.formula).toBe('');
		expect(classDoc.system.spellcasting).toEqual({
			castAtHighestTier: true,
			cost: {
				poolIdentifier: 'pilfered-power',
				amount: '1',
				overdraftConsequence: 'halfMaxHpDamage',
			},
		});
	});

	it('authors the Pilfered Power charge pool on the level 2 feature', () => {
		const feature = readPackDoc(PILFERED_POWER_PATH);
		const pool = feature.system.rules.find(
			(rule: Record<string, unknown>) => rule.type === 'chargePool',
		);
		expect(pool).toMatchObject({
			identifier: 'pilfered-power',
			max: 'max(@dexterity, 0)',
			initial: 'max',
			recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
		});
	});

	it('authors the initiative use recovery on Heart of Burning Fire', () => {
		const feature = readPackDoc(HEART_PATH);
		const modifier = feature.system.rules.find(
			(rule: Record<string, unknown>) => rule.type === 'modifyPool',
		);
		expect(modifier).toMatchObject({
			poolType: 'charge',
			poolIdentifier: 'pilfered-power',
			addRefills: [{ trigger: 'onInitiativeRolled', mode: 'add', value: '1', predicate: {} }],
		});
	});
});

describe('Migration048ShadowmancerPilferedPower', () => {
	it('brings a pre-migration embedded class item to the pack shape', async () => {
		const classDoc = readPackDoc(CLASS_PATH);
		const source = sourceFor(classDoc, 'nimble-classes');
		source.system.mana.formula = '(max(@dexterity, 0))';
		source.system.spellcasting = undefined;

		await new Migration048ShadowmancerPilferedPower().updateItem(source);

		expect(source.system.mana.formula).toBe('');
		expect(source.system.spellcasting).toEqual(classDoc.system.spellcasting);
	});

	it('matches an embedded class item by identifier when no source id survives', async () => {
		const classDoc = readPackDoc(CLASS_PATH);
		const source = foundry.utils.deepClone(classDoc);
		source._stats = {};
		source.system.mana.formula = '(max(@dexterity, 0))';
		source.system.spellcasting = undefined;

		await new Migration048ShadowmancerPilferedPower().updateItem(source);

		expect(source.system.mana.formula).toBe('');
		expect(source.system.spellcasting).toEqual(classDoc.system.spellcasting);
	});

	it('adds exactly the rules the pack ships to pre-migration embedded features', async () => {
		for (const path of [PILFERED_POWER_PATH, HEART_PATH]) {
			const featureDoc = readPackDoc(path);
			const source = sourceFor(featureDoc, 'nimble-class-features');
			source.system.rules = [];

			await new Migration048ShadowmancerPilferedPower().updateItem(source);

			expect(source.system.rules).toEqual(featureDoc.system.rules);
		}
	});

	it('is idempotent across repeat runs', async () => {
		const featureDoc = readPackDoc(PILFERED_POWER_PATH);
		const source = sourceFor(featureDoc, 'nimble-class-features');

		const migration = new Migration048ShadowmancerPilferedPower();
		await migration.updateItem(source);
		await migration.updateItem(source);

		expect(source.system.rules).toEqual(featureDoc.system.rules);
	});

	it('leaves other classes and features untouched', async () => {
		const mageDoc = readPackDoc('classes/core/mage.json');
		const source = sourceFor(mageDoc, 'nimble-classes');
		const before = foundry.utils.deepClone(source);

		await new Migration048ShadowmancerPilferedPower().updateItem(source);

		expect(source).toEqual(before);
	});
});

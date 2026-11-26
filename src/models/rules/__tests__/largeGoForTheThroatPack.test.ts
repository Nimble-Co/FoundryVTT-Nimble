import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { placeOf } from '../../../view/actorSheets/shared/placeOf.js';

type Json = Record<string, any>;

const ITEM =
	'packs/classFeatures/core/hunter/hunter-subclasses/beastmaster/large-go-for-the-throat.json';

function readItem(): Json {
	return JSON.parse(readFileSync(resolve(ITEM), 'utf8'));
}

function expectKnownFields(rule: Json): void {
	const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
	expect(ruleClass, rule.type).toBeDefined();
	const schema = ruleClass.defineSchema() as Record<string, unknown>;
	expect(Object.keys(rule).filter((key) => !(key in schema))).toEqual([]);
}

describe('Large Go for the Throat', () => {
	const item = readItem();
	const rules = item.system.rules as Json[];

	it('spends 2 actions and 2 Thrill of the Hunt charges, and attacks for the printed damage', () => {
		for (const rule of rules) expectKnownFields(rule);

		expect(item.system.identifier).toBe('large-go-for-the-throat');
		expect(item.system.activation.cost).toMatchObject({ type: 'action', quantity: 2 });
		expect(
			placeOf({
				id: item._id,
				uuid: `Item.${item._id}`,
				name: item.name,
				img: item.img,
				type: item.type,
				system: item.system,
				rules: rules.map((rule) => ({
					id: String(rule.id),
					type: String(rule.type),
					active: true,
					fields: rule,
				})),
			}),
		).toBe('action');

		expect(rules.find((rule) => rule.type === 'chargePool')).toMatchObject({
			identifier: 'large-go-for-the-throat',
			scope: 'item',
			max: '1',
			recoveries: [{ trigger: 'encounterEnd', mode: 'refresh', value: '1' }],
		});
		expect(rules.find((rule) => rule.type === 'modifyPool')).toMatchObject({
			poolIdentifier: 'large-go-for-the-throat',
			maxDelta: '1',
			predicate: { level: { min: 11 } },
		});
		expect(rules.filter((rule) => rule.type === 'chargeConsumer')).toEqual([
			expect.objectContaining({
				poolIdentifier: 'large-go-for-the-throat',
				poolScope: 'item',
				cost: '1',
			}),
			expect.objectContaining({
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '2',
			}),
		]);

		expect(item.system.activation.effects[0]).toMatchObject({
			type: 'damage',
			formula: '1d12+(4*@level)',
			ignoreArmor: true,
			canMiss: false,
			canCrit: true,
			damageType: 'piercing',
		});
	});

	it('offers half the rolled damage within 4 spaces when the attack kills', () => {
		expect(rules.find((rule) => rule.type === 'halfDamageOnKill')).toMatchObject({
			reach: 4,
			label: 'Half on a kill',
		});
	});
});

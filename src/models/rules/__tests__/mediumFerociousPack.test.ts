import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { Predicate } from '../../../etc/Predicate.js';
import { placeOf } from '../../../view/actorSheets/shared/placeOf.js';

type Json = Record<string, any>;

const ITEM = 'packs/classFeatures/core/hunter/hunter-subclasses/beastmaster/medium-ferocious.json';

function readItem(): Json {
	return JSON.parse(readFileSync(resolve(ITEM), 'utf8'));
}

function expectKnownFields(rule: Json): void {
	const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
	expect(ruleClass, rule.type).toBeDefined();
	const schema = ruleClass.defineSchema() as Record<string, unknown>;
	expect(Object.keys(rule).filter((key) => !(key in schema))).toEqual([]);
}

function applies(rule: Json, level: number): boolean {
	return new Predicate(rule.predicate ?? {}).test(new Set([`level:${level}`]));
}

describe('Medium Ferocious', () => {
	const item = readItem();
	const rules = item.system.rules as Json[];

	it('follows a quarry crit with an ignore-armor attack that can miss, and offers no button', () => {
		for (const rule of rules) expectKnownFields(rule);

		expect(item.system.identifier).toBe('medium-ferocious');
		expect(item.system.activation.cost.type).toBe('none');
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
		).toBe('passive');

		const free = rules.find((rule) => rule.type === 'useItemFree');
		expect(free).toMatchObject({
			itemIdentifier: 'medium-ferocious',
			triggers: ['onCrit'],
			againstQuarry: true,
		});

		const damage = item.system.activation.effects[0];
		expect(damage).toMatchObject({
			type: 'damage',
			formula: '@level',
			ignoreArmor: true,
			canMiss: true,
			canCrit: true,
			damageType: 'piercing',
		});
		expect(rules.some((rule) => rule.type === 'chargeConsumer')).toBe(false);
	});

	it('offers 2 spaces, then 4 at level 7, then 6 at level 15', () => {
		const distanceAt = (level: number) =>
			rules
				.filter((rule) => rule.type === 'freeMove' && applies(rule, level))
				.map((rule) => rule.distance);

		expect(rules.filter((rule) => rule.type === 'freeMove').map((rule) => rule.trigger)).toEqual([
			'onActivation',
			'onActivation',
			'onActivation',
		]);
		expect(distanceAt(1)).toEqual(['2']);
		expect(distanceAt(6)).toEqual(['2']);
		expect(distanceAt(7)).toEqual(['4']);
		expect(distanceAt(14)).toEqual(['4']);
		expect(distanceAt(15)).toEqual(['6']);
		expect(distanceAt(20)).toEqual(['6']);
	});
});

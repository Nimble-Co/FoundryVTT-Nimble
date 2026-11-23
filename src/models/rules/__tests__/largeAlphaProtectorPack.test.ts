import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { placeOf } from '../../../view/actorSheets/shared/placeOf.js';

type Json = Record<string, any>;

const ITEM =
	'packs/classFeatures/core/hunter/hunter-subclasses/beastmaster/large-alpha-protector.json';

function readItem(): Json {
	return JSON.parse(readFileSync(resolve(ITEM), 'utf8'));
}

describe('Large Alpha Protector', () => {
	const item = readItem();
	const rules = item.system.rules as Json[];

	it('halves the first attack each round and offers no button', () => {
		expect(item.system.identifier).toBe('large-alpha-protector');
		expect(item.system.activation.cost.type).toBe('none');
		expect(rules).toHaveLength(1);

		const rule = rules[0];
		const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
		expect(ruleClass, rule.type).toBeDefined();
		const schema = ruleClass.defineSchema() as Record<string, unknown>;
		expect(Object.keys(rule).filter((key) => !(key in schema))).toEqual([]);
		expect(rule).toMatchObject({ type: 'halveFirstAttack', label: 'Alpha Protector' });

		expect(
			placeOf({
				id: item._id,
				uuid: `Item.${item._id}`,
				name: item.name,
				img: item.img,
				type: item.type,
				system: item.system,
				rules: rules.map((entry) => ({
					id: String(entry.id),
					type: String(entry.type),
					active: true,
					fields: entry,
				})),
			}),
		).toBe('passive');
	});
});

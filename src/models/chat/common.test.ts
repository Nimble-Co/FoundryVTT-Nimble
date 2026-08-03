import { describe, expect, it } from 'vitest';
import { grantedActionOffers } from './common.js';

describe('grantedActionOffers schema factory', () => {
	it('defines an offers array that is empty by default', () => {
		const schema = grantedActionOffers();
		const field = schema.grantedActionOffers as unknown as { options: { initial: unknown } };
		expect(schema).toHaveProperty('grantedActionOffers');
		expect(field.options.initial).toEqual([]);
	});

	it('defines the per-offer fields the executor revalidates against', () => {
		const schema = grantedActionOffers();
		const element = (schema.grantedActionOffers as unknown as { element: { fields: object } })
			.element;
		const fieldNames = Object.keys(element.fields);

		expect(fieldNames).toEqual([
			'id',
			'targetActorUuid',
			'label',
			'activationType',
			'ruleId',
			'sourceItemUuid',
			'used',
			'usedBy',
		]);
	});

	it('starts offers unused with no consuming user', () => {
		const schema = grantedActionOffers();
		const element = (
			schema.grantedActionOffers as unknown as {
				element: { fields: Record<string, { options: { initial: unknown } }> };
			}
		).element;

		expect(element.fields.used.options.initial).toBe(false);
		expect(element.fields.usedBy.options.initial).toBeNull();
	});

	it('constrains the activation type to the closed weaponAttack set', () => {
		const schema = grantedActionOffers();
		const element = (
			schema.grantedActionOffers as unknown as {
				element: { fields: Record<string, { choices?: string[]; options: { initial: unknown } }> };
			}
		).element;

		expect(element.fields.activationType.choices).toEqual(['weaponAttack']);
		expect(element.fields.activationType.options.initial).toBe('weaponAttack');
	});
});

import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { RicochetRule } from '../ricochet.js';

function ricochet(data: Record<string, unknown>, options: { embedded?: boolean } = {}) {
	const actor = { uuid: 'Actor.cheat', getDomain: () => new Set<string>() };
	const parent = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Trickshot',
		uuid: 'Actor.cheat.Item.trickshot',
		getDomain: () => new Set<string>(),
	};
	const rule = new RicochetRule({ type: 'ricochet' } as never, { parent, strict: false } as never);
	Object.assign(rule, {
		weapon: '',
		weaponProperty: '',
		reach: 2,
		...data,
		predicate: new Predicate({}),
	});
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

function weapon(name: string, properties: string[] = ['light', 'thrown'], weaponType = '') {
	return {
		name,
		type: 'object',
		system: { objectType: 'weapon', weaponType, properties: { selected: properties } },
	};
}

describe('RicochetRule', () => {
	it('starts as any weapon, any property, Reach 2', () => {
		const schema = RicochetRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown } }
		>;
		expect(schema.weapon?.options.initial).toBe('');
		expect(schema.weaponProperty?.options.initial).toBe('');
		expect(schema.reach?.options.initial).toBe(2);
	});

	it('ricochets a thrown dagger, by its name or its weapon type', () => {
		const rule = ricochet({ weapon: 'dagger', weaponProperty: 'thrown' });

		expect(rule.ricochetFor(weapon('Dagger'))).toEqual({
			source: 'Trickshot',
			reach: 2,
			thrownWeapon: 'Dagger',
		});
		expect(rule.ricochetFor(weapon('Venomfang Dagger'))).not.toBeNull();
		expect(rule.ricochetFor(weapon('Mindlink Daggers'))).not.toBeNull();
		expect(rule.ricochetFor(weapon('Fang', ['thrown'], 'Dagger'))).not.toBeNull();
	});

	it('does not ricochet another weapon, or a dagger without the property', () => {
		const rule = ricochet({ weapon: 'dagger', weaponProperty: 'thrown' });

		expect(rule.ricochetFor(weapon('Handaxe'))).toBeNull();
		expect(rule.ricochetFor(weapon('Daggerfall Spear'))).toBeNull();
		expect(rule.ricochetFor(weapon('Dagger', ['light']))).toBeNull();
		expect(rule.ricochetFor(null)).toBeNull();
	});

	it('ricochets every weapon when no weapon is named', () => {
		expect(ricochet({}).ricochetFor(weapon('Handaxe', []))).not.toBeNull();
	});

	it('names the thrown weapon only when the rule asks for a thrown weapon', () => {
		expect(ricochet({ weapon: 'dagger' }).ricochetFor(weapon('Dagger'))).toEqual({
			source: 'Trickshot',
			reach: 2,
		});
	});

	it('does not ricochet while its item is not on a creature, or while it is off', () => {
		expect(ricochet({}, { embedded: false }).ricochetFor(weapon('Dagger'))).toBeNull();
		expect(ricochet({ disabled: true }).ricochetFor(weapon('Dagger'))).toBeNull();
	});
});

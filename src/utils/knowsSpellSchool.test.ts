import { describe, expect, it } from 'vitest';

import knowsSpellSchool from './knowsSpellSchool.js';

function createActor(spells: Array<{ type: string; school?: string; tier?: number }>) {
	return {
		items: spells.map(({ type, school, tier }) => ({
			type,
			system: { ...(school ? { school } : {}), ...(tier === undefined ? {} : { tier }) },
		})),
	};
}

describe('knowsSpellSchool', () => {
	it('is true when the actor holds a spell of that school', () => {
		const actor = createActor([{ type: 'spell', school: 'lightning' }]);

		expect(knowsSpellSchool(actor, 'lightning')).toBe(true);
	});

	it('counts a cantrip, since the exemption turns on the school not the tier', () => {
		// Modrisse knows Zap and Overload, both tier-0 lightning. A tier filter here
		// would be wrong, so hold a cantrip and nothing else.
		const actor = createActor([{ type: 'spell', school: 'lightning', tier: 0 }]);

		expect(knowsSpellSchool(actor, 'lightning')).toBe(true);
	});

	it('counts a tiered spell too, so neither tier is privileged', () => {
		const actor = createActor([{ type: 'spell', school: 'lightning', tier: 3 }]);

		expect(knowsSpellSchool(actor, 'lightning')).toBe(true);
	});

	it('is false for a school the actor does not know', () => {
		const actor = createActor([
			{ type: 'spell', school: 'fire' },
			{ type: 'spell', school: 'ice' },
		]);

		expect(knowsSpellSchool(actor, 'radiant')).toBe(false);
	});

	it('is false for an actor with no spells', () => {
		expect(knowsSpellSchool(createActor([]), 'fire')).toBe(false);
	});

	it('ignores a non-spell item that happens to carry a school', () => {
		const actor = createActor([{ type: 'object', school: 'fire' }]);

		expect(knowsSpellSchool(actor, 'fire')).toBe(false);
	});

	it('is false for an empty school, so a scroll with no school never skips the check', () => {
		const actor = createActor([{ type: 'spell', school: 'fire' }]);

		expect(knowsSpellSchool(actor, '')).toBe(false);
	});

	// `SpellDataModel.school` initializes to '', so a schoolless spell is a real
	// document. Without the empty-school guard the two blanks would match and the
	// wielder would skip the DC 10 Arcana check the scroll owes.
	it('is false for an empty school even when the actor holds a schoolless spell', () => {
		const actor = { items: [{ type: 'spell', system: { school: '' } }] };

		expect(knowsSpellSchool(actor, '')).toBe(false);
	});

	it('is false for a null actor', () => {
		expect(knowsSpellSchool(null, 'fire')).toBe(false);
	});

	it('is false for an undefined actor', () => {
		expect(knowsSpellSchool(undefined, 'fire')).toBe(false);
	});

	it('is false for an actor with no items collection', () => {
		expect(knowsSpellSchool({}, 'fire')).toBe(false);
	});
});

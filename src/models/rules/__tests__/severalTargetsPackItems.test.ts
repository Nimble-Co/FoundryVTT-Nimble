import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DivideDiceRule } from '../divideDice.js';
import { RicochetRule } from '../ricochet.js';

const readItem = (file: string) => JSON.parse(readFileSync(resolve('packs', file), 'utf8'));

function liveRule<T>(RuleClass: new (...args: never[]) => T, data: Record<string, unknown>): T {
	const actor = { uuid: 'Actor.hero', getDomain: () => new Set<string>(), rules: [] };
	const parent = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: 'Actor.hero.Item.pack',
		getDomain: () => new Set<string>(),
	};
	const rule = new RuleClass({ type: data.type } as never, { parent, strict: false } as never);
	Object.assign(rule as object, { ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('Trickshot', () => {
	const trickshot = readItem('classFeatures/core/the-cheat/underhanded-abilities/trickshot.json');
	const rule = () =>
		liveRule(
			RicochetRule,
			trickshot.system.rules.find((each: { type: string }) => each.type === 'ricochet'),
		);

	it('ricochets every thrown dagger of the packs within 2 spaces', () => {
		for (const file of [
			'items/core/weapons/dagger.json',
			'magicItems/core/coreRules/mindlink-daggers.json',
			'magicItems/core/gmGuide/venomfang-dagger.json',
		]) {
			expect(rule().ricochetFor(readItem(file)), file).toMatchObject({ reach: 2 });
		}
	});

	it('does not ricochet a thrown hand axe', () => {
		const handAxe = readItem('items/core/weapons/hand-axe.json');

		expect(handAxe.system.properties.selected).toContain('thrown');
		expect(rule().ricochetFor(handAxe)).toBeNull();
	});

	it('reminds that the dagger returns to the hand', () => {
		expect(trickshot.system.activation.effects).toEqual([
			expect.objectContaining({
				type: 'note',
				text: expect.stringContaining('returns to your hand'),
			}),
		]);
	});
});

describe('Grim Harrow', () => {
	const REAVER = 'classFeatures/core/shadowmancer/shadowmancer-subclasses/reaver';

	it('divides the dice of an attack made through the Bonescythe, and no other', () => {
		const rule = liveRule(DivideDiceRule, readItem(`${REAVER}/grim-harrow.json`).system.rules[0]);
		const bonescythe = readItem(`${REAVER}/bonescythe.json`).system.identifier;

		expect(rule.dividesDiceFor(bonescythe)).not.toBeNull();
		expect(rule.dividesDiceFor('shadow-blast')).toBeNull();
	});

	it('has the DEX of each die of the Bonescythe divide with its dice', () => {
		const [slashing, necrotic] = readItem(`${REAVER}/bonescythe.json`).system.activation.effects;

		expect(slashing).toMatchObject({ damageType: 'slashing', canMiss: true, canCrit: true });
		expect(necrotic).toMatchObject({ damageType: 'necrotic', dividesWithDice: true });
	});
});

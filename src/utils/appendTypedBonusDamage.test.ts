import { describe, expect, it } from 'vitest';
import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { appendTypedBonusDamage } from './appendTypedBonusDamage.js';

const PRIMARY_ROLL = {
	class: 'DamageRoll',
	formula: '1d8 + 2',
	total: 8,
	isCritical: true,
	terms: [{ class: 'Die', number: 1, faces: 8, evaluated: true, results: [{ result: 6 }] }],
};

function activation() {
	return {
		effects: [
			{
				id: 'damage-node',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8 + 2',
				parentNode: null,
				parentContext: null,
				roll: { ...PRIMARY_ROLL },
				on: {
					hit: [
						{
							id: 'damage-node-hit',
							type: 'damageOutcome',
							outcome: 'fullDamage',
							parentNode: 'damage-node',
							parentContext: 'hit',
						},
					],
				},
			},
		],
	} as Record<string, unknown>;
}

function bonusRoll(total = 18) {
	return {
		class: 'Roll',
		formula: String(total),
		total,
		evaluated: true,
		options: {},
		terms: [{ class: 'NumericTerm', number: total, evaluated: true, options: {} }],
	};
}

function append(
	overrides: Partial<Parameters<typeof appendTypedBonusDamage>[3]> = {},
	tree = activation(),
) {
	const result = appendTypedBonusDamage(tree, [JSON.stringify(PRIMARY_ROLL)], bonusRoll(), {
		damageType: 'radiant',
		flavor: 'Death Blow',
		isCritical: true,
		...overrides,
	});
	if (!result) throw new Error('expected a patched activation');
	return result;
}

/** A saving-throw card: the damage hangs under the save, not at the root. */
function saveActivation() {
	return {
		effects: [
			{
				id: 'save-node',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentNode: null,
				parentContext: null,
				on: {
					failedSave: [
						{
							id: 'save-damage',
							type: 'damage',
							damageType: 'necrotic',
							formula: '3d20',
							parentNode: 'save-node',
							parentContext: 'failedSave',
							roll: { ...PRIMARY_ROLL },
						},
					],
				},
			},
		],
	} as Record<string, unknown>;
}

function bonusNodeOf(result: ReturnType<typeof append>) {
	const effects = result.activation.effects as EffectNode[];
	return effects.find((node) => node.id !== 'damage-node') as DamageNode & {
		roll: Record<string, unknown>;
	};
}

describe('appendTypedBonusDamage', () => {
	it('adds a second root damage node carrying the requested type', () => {
		const result = append();
		const effects = result.activation.effects as EffectNode[];

		expect(effects).toHaveLength(2);
		expect(bonusNodeOf(result)).toMatchObject({
			type: 'damage',
			damageType: 'radiant',
			canCrit: false,
			canMiss: false,
			parentNode: null,
		});
	});

	it('leaves the primary damage node and its roll alone', () => {
		const result = append();
		const effects = result.activation.effects as Array<DamageNode & { roll: { total: number } }>;
		const primary = effects.find((node) => node.id === 'damage-node');

		expect(primary?.roll.total).toBe(8);
		expect(primary?.damageType).toBe('slashing');
	});

	it('flavors the numeric term so the total counts as dice against armor', () => {
		const terms = bonusNodeOf(append()).roll.terms as Array<{ options: { flavor: string } }>;

		expect(terms[0].options.flavor).toBe('Death Blow');
	});

	it('keeps the bonus a plain Roll, so the reroll and fold paths ignore it', () => {
		expect(bonusNodeOf(append()).roll.class).toBe('Roll');
	});

	it('mirrors the crit state of the card onto the bonus roll', () => {
		expect(bonusNodeOf(append()).roll.isCritical).toBe(true);
		expect(bonusNodeOf(append({ isCritical: false })).roll.isCritical).toBe(false);
	});

	it('appends to the rolls source without displacing the primary DamageRoll', () => {
		const result = append();

		expect(result.rolls).toHaveLength(2);
		expect(JSON.parse(result.rolls[0]).class).toBe('DamageRoll');
		expect(JSON.parse(result.rolls[1])).toMatchObject({ class: 'Roll', total: 18 });
	});

	it('refuses a card with no primary damage roll to ride along with', () => {
		const empty = appendTypedBonusDamage({ effects: [] }, [], bonusRoll(), {
			damageType: 'radiant',
			flavor: 'Death Blow',
			isCritical: false,
		});

		expect(empty).toBeNull();
	});

	it('hangs the packet under the saving throw when that is where the damage is', () => {
		const result = append({}, saveActivation());
		const save = (result.activation.effects as EffectNode[])[0] as EffectNode & {
			on: { failedSave: EffectNode[] };
		};

		// Beside the save-gated damage, so a passed save leaves it out entirely
		// rather than applying it in full.
		expect(save.on.failedSave).toHaveLength(2);
		expect(save.on.failedSave[1]).toMatchObject({
			type: 'damage',
			damageType: 'radiant',
			parentNode: 'save-node',
			parentContext: 'failedSave',
		});
		expect((save.on.failedSave[1] as DamageNode).on ?? {}).toEqual({});
	});

	it('gives the bonus node a hit outcome child, so it reaches the card', () => {
		const bonusNode = bonusNodeOf(append());

		expect(bonusNode.on?.hit).toHaveLength(1);
		expect(bonusNode.on?.hit?.[0]).toMatchObject({
			type: 'damageOutcome',
			parentNode: bonusNode.id,
		});
	});
});

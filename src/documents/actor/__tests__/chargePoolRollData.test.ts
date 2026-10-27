import { describe, expect, it } from 'vitest';
import { ChargePoolRuleConfig } from '#utils/chargePool/chargePoolRuleConfig.js';
import { NimbleCharacter } from '../character.js';

const characterProto = NimbleCharacter.prototype as unknown as {
	getRollData(): Record<string, unknown>;
};

function makeCharacterStub(chargePools: Record<string, Record<string, unknown>>) {
	return {
		type: 'character',
		system: {
			abilities: { strength: { mod: 0 } },
			savingThrows: { strength: { mod: 0 } },
			skills: { might: { mod: 0 } },
		},
		classes: {},
		levels: { character: 5 },
		items: { contents: [] },
		flags: {
			[ChargePoolRuleConfig.flagScope]: { [ChargePoolRuleConfig.flagKey]: chargePools },
		},
	};
}

describe('NimbleCharacter#getRollData - charge pool dice', () => {
	it('exposes the die face count of a stored pool as pools.<identifier>.faces', () => {
		const stub = makeCharacterStub({
			'actor:combat-dice': { identifier: 'combat-dice', current: 2, max: 3, dieSize: 'd8' },
			'actor:charges': { identifier: 'charges', current: 1, max: 1, dieSize: null },
		});

		const rollData = characterProto.getRollData.call(stub);

		expect(rollData.pools).toEqual({ 'combat-dice': { faces: 8 } });
		expect(foundry.utils.getProperty(rollData, 'pools.combat-dice.faces')).toBe(8);
	});
});

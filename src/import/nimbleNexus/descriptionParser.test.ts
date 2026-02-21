import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildEffectTree,
	extractDiceFormula,
	parseConditions,
	parseDamage,
	parseDamageType,
	parseRangeReach,
	parseSavingThrow,
} from './descriptionParser.js';
import type { NimbleNexusAction } from './types.js';

// Mock foundry.utils.randomID
let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: {
			randomID: () => `mock-id-${++idCounter}`,
		},
	});
});

describe('extractDiceFormula', () => {
	it('should extract formula from simple dice notation', () => {
		expect(extractDiceFormula('2d6+4')).toBe('2d6+4');
	});

	it('should extract formula with damage type suffix', () => {
		expect(extractDiceFormula('5d8+13 Radiant')).toBe('5d8+13');
	});

	it('should extract formula with negative modifier', () => {
		expect(extractDiceFormula('1d4-1')).toBe('1d4-1');
	});

	it('should handle formula with damage type and extra text', () => {
		expect(extractDiceFormula('3d10+5 Fire')).toBe('3d10+5');
	});

	it('should return empty string for empty input', () => {
		expect(extractDiceFormula('')).toBe('');
	});

	it('should handle formula without modifier', () => {
		expect(extractDiceFormula('2d8 Cold')).toBe('2d8');
	});
});

describe('parseDamageType', () => {
	describe('from formula', () => {
		it('should extract damage type from formula suffix', () => {
			expect(parseDamageType('5d8+13 Radiant')).toBe('radiant');
		});

		it('should handle lowercase damage type', () => {
			expect(parseDamageType('2d6+4 fire')).toBe('fire');
		});

		it('should handle various damage types', () => {
			expect(parseDamageType('1d8 Necrotic')).toBe('necrotic');
			expect(parseDamageType('3d6+2 Cold')).toBe('cold');
			expect(parseDamageType('2d10 Lightning')).toBe('lightning');
			expect(parseDamageType('4d6 Psychic')).toBe('psychic');
		});
	});

	describe('from description', () => {
		it('should extract damage type from "X damage" pattern', () => {
			expect(parseDamageType(undefined, 'deals 2d6 fire damage')).toBe('fire');
		});

		it('should extract damage type from "deals X" pattern', () => {
			expect(parseDamageType(undefined, 'deals necrotic damage to the target')).toBe('necrotic');
		});

		it('should prefer formula over description', () => {
			expect(parseDamageType('2d6 Cold', 'deals fire damage')).toBe('cold');
		});

		it('should fall back to description if formula has no type', () => {
			expect(parseDamageType('2d6+4', 'deals radiant damage')).toBe('radiant');
		});
	});

	describe('defaults', () => {
		it('should default to bludgeoning if no type found', () => {
			expect(parseDamageType('2d6+4')).toBe('bludgeoning');
		});

		it('should default to bludgeoning for undefined inputs', () => {
			expect(parseDamageType(undefined, undefined)).toBe('bludgeoning');
		});
	});

	describe('damage type aliases', () => {
		it('should map "electric" to "lightning"', () => {
			expect(parseDamageType(undefined, 'deals electric damage')).toBe('lightning');
		});

		it('should map "holy" to "radiant"', () => {
			expect(parseDamageType(undefined, 'deals holy damage')).toBe('radiant');
		});
	});
});

describe('parseSavingThrow', () => {
	it('should parse "DC X STAT save" pattern', () => {
		const result = parseSavingThrow('DC 15 DEX save or take damage');
		expect(result).toEqual({
			dc: 15,
			saveType: 'dexterity',
			consequence: 'take damage',
			halfOnSave: false,
		});
	});

	it('should parse "DC X STAT saving throw" pattern', () => {
		const result = parseSavingThrow('make a DC 18 STR saving throw');
		expect(result).toEqual({
			dc: 18,
			saveType: 'strength',
			consequence: undefined,
			halfOnSave: false,
		});
	});

	it('should detect "half damage" pattern', () => {
		const result = parseSavingThrow('DC 21 DEX save for half damage');
		expect(result).toEqual({
			dc: 21,
			saveType: 'dexterity',
			consequence: undefined,
			halfOnSave: true,
		});
	});

	it('should handle full save type names', () => {
		const result = parseSavingThrow('DC 12 Dexterity save');
		expect(result).toEqual({
			dc: 12,
			saveType: 'dexterity',
			consequence: undefined,
			halfOnSave: false,
		});
	});

	it('should handle Intelligence saves', () => {
		const result = parseSavingThrow('DC 16 INT save');
		expect(result).toEqual({
			dc: 16,
			saveType: 'intelligence',
			consequence: undefined,
			halfOnSave: false,
		});
	});

	it('should handle Will/Wisdom saves', () => {
		const result = parseSavingThrow('DC 14 WIL save');
		expect(result).toEqual({
			dc: 14,
			saveType: 'will',
			consequence: undefined,
			halfOnSave: false,
		});

		const result2 = parseSavingThrow('DC 14 WIS save');
		expect(result2).toEqual({
			dc: 14,
			saveType: 'will',
			consequence: undefined,
			halfOnSave: false,
		});
	});

	it('should return null for descriptions without saves', () => {
		const result = parseSavingThrow('The target takes 2d6 fire damage');
		expect(result).toBeNull();
	});

	it('should return null for undefined input', () => {
		const result = parseSavingThrow(undefined);
		expect(result).toBeNull();
	});
});

describe('parseConditions', () => {
	describe('bracket notation', () => {
		it('should parse [[Condition]] bracket notation', () => {
			const result = parseConditions('On hit: [[Slowed]]');
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				condition: 'slowed',
				context: 'hit',
				escapeDC: undefined,
				escapeType: undefined,
			});
		});

		it('should parse multiple conditions', () => {
			const result = parseConditions('[[Slowed]] and [[Dazed]]');
			expect(result).toHaveLength(2);
			expect(result.map((c) => c.condition)).toContain('slowed');
			expect(result.map((c) => c.condition)).toContain('dazed');
		});

		it('should detect critical hit context from surrounding text', () => {
			const result = parseConditions('On crit: [[Stunned]]');
			expect(result).toHaveLength(1);
			expect(result[0].context).toBe('criticalHit');
		});

		it('should detect failed save context', () => {
			const result = parseConditions('On failed save, target is [[Grappled]]');
			expect(result).toHaveLength(1);
			expect(result[0].context).toBe('failedSave');
		});

		it('should parse escape DC', () => {
			const result = parseConditions('Target is [[Grappled]] (escape DC 15 STR)');
			expect(result).toHaveLength(1);
			expect(result[0].escapeDC).toBe(15);
			expect(result[0].escapeType).toBe('strength');
		});
	});

	describe('context patterns', () => {
		it('should parse "On hit: Condition" pattern', () => {
			const result = parseConditions('On hit: Slowed');
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				condition: 'slowed',
				context: 'hit',
			});
		});

		it('should parse "On crit: Condition" pattern', () => {
			const result = parseConditions('On crit: Poisoned');
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				condition: 'poisoned',
				context: 'criticalHit',
			});
		});
	});

	describe('target patterns', () => {
		it('should parse "target is/becomes X" pattern', () => {
			const result = parseConditions('The target is stunned');
			expect(result).toHaveLength(1);
			expect(result[0].condition).toBe('stunned');
		});

		it('should parse "target becomes X" pattern', () => {
			const result = parseConditions('The target becomes frightened');
			expect(result).toHaveLength(1);
			expect(result[0].condition).toBe('frightened');
		});
	});

	describe('condition aliases', () => {
		it('should map condition variations', () => {
			expect(parseConditions('target is feared')[0]?.condition).toBe('frightened');
			expect(parseConditions('target is grabbed')[0]?.condition).toBe('grappled');
		});
	});

	it('should return empty array for no conditions', () => {
		const result = parseConditions('The target takes 2d6 damage');
		expect(result).toEqual([]);
	});

	it('should return empty array for undefined input', () => {
		const result = parseConditions(undefined);
		expect(result).toEqual([]);
	});

	it('should avoid duplicates', () => {
		// Both bracket and "On hit:" mention slowed
		const result = parseConditions('On hit: Slowed, target is [[Slowed]]');
		expect(result).toHaveLength(1);
		expect(result[0].condition).toBe('slowed');
	});
});

describe('parseRangeReach', () => {
	describe('from existing target', () => {
		it('should prefer existing range', () => {
			const result = parseRangeReach('(Range: 10)', { range: 8 });
			expect(result).toEqual({ type: 'range', distance: 8 });
		});

		it('should prefer existing reach', () => {
			const result = parseRangeReach('Reach 5', { reach: 3 });
			expect(result).toEqual({ type: 'reach', distance: 3 });
		});
	});

	describe('from description', () => {
		it('should parse "(Range: X)" pattern', () => {
			const result = parseRangeReach('(Range: 8)');
			expect(result).toEqual({ type: 'range', distance: 8 });
		});

		it('should parse "Range X" pattern without parentheses', () => {
			const result = parseRangeReach('Range 10');
			expect(result).toEqual({ type: 'range', distance: 10 });
		});

		it('should parse "Reach X" pattern', () => {
			const result = parseRangeReach('Reach 3');
			expect(result).toEqual({ type: 'reach', distance: 3 });
		});

		it('should parse "Cone X" pattern', () => {
			const result = parseRangeReach('Cone 6');
			expect(result).toEqual({ type: 'cone', distance: 6 });
		});

		it('should parse "Line XxY" pattern', () => {
			const result = parseRangeReach('Line 10x2');
			expect(result).toEqual({ type: 'line', distance: 10, width: 2 });
		});

		it('should parse "Burst X" pattern', () => {
			const result = parseRangeReach('Burst 4');
			expect(result).toEqual({ type: 'burst', distance: 4 });
		});
	});

	it('should return null for no range info', () => {
		const result = parseRangeReach('The target takes damage');
		expect(result).toBeNull();
	});

	it('should return null for undefined input', () => {
		const result = parseRangeReach(undefined);
		expect(result).toBeNull();
	});
});

describe('parseDamage', () => {
	it('should parse damage from action', () => {
		const action: NimbleNexusAction = {
			name: 'Claw',
			damage: { roll: '2d6+4 Slashing' },
		};
		const result = parseDamage(action);
		expect(result).toEqual({
			formula: '2d6+4',
			damageType: 'slashing',
		});
	});

	it('should use description for damage type if not in formula', () => {
		const action: NimbleNexusAction = {
			name: 'Fire Breath',
			damage: { roll: '4d6' },
			description: 'Deals fire damage in a cone',
		};
		const result = parseDamage(action);
		expect(result).toEqual({
			formula: '4d6',
			damageType: 'fire',
		});
	});

	it('should return null for actions without damage', () => {
		const action: NimbleNexusAction = {
			name: 'Roar',
			description: 'The creature roars menacingly',
		};
		const result = parseDamage(action);
		expect(result).toBeNull();
	});
});

describe('buildEffectTree', () => {
	describe('damage-based actions', () => {
		it('should build damage tree for simple attack', () => {
			const action: NimbleNexusAction = {
				name: 'Claw',
				damage: { roll: '2d6+4 Slashing' },
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.damageType).toBe('slashing');
			expect(damageNode.formula).toBe('2d6+4');
			expect(damageNode.canCrit).toBe(true);
			expect(damageNode.canMiss).toBe(true);
			expect(damageNode.on?.hit).toHaveLength(1);
			expect(damageNode.on?.hit[0].type).toBe('damageOutcome');
		});

		it('should add conditions to damage tree', () => {
			const action: NimbleNexusAction = {
				name: 'Venomous Bite',
				damage: { roll: '1d8+3 Piercing' },
				description: 'On hit: [[Poisoned]]',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			const damageNode = result[0] as any;
			expect(damageNode.on?.hit).toHaveLength(2); // DamageOutcome + Condition
			expect(damageNode.on?.hit[1].type).toBe('condition');
			expect(damageNode.on?.hit[1].condition).toBe('poisoned');
		});

		it('should add critical hit conditions', () => {
			const action: NimbleNexusAction = {
				name: 'Power Strike',
				damage: { roll: '2d8+5' },
				description: 'On crit: Stunned',
			};
			const result = buildEffectTree(action);

			const damageNode = result[0] as any;
			expect(damageNode.on?.criticalHit).toHaveLength(1);
			expect(damageNode.on?.criticalHit[0].type).toBe('condition');
			expect(damageNode.on?.criticalHit[0].condition).toBe('stunned');
		});
	});

	describe('saving throw actions', () => {
		it('should build saving throw tree', () => {
			const action: NimbleNexusAction = {
				name: 'Fire Breath',
				damage: { roll: '4d6 Fire' },
				description: 'DC 15 DEX save for half damage',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('dexterity');
			expect(saveNode.saveDC).toBe(15);
			expect(saveNode.sharedRolls).toHaveLength(1);
			expect(saveNode.sharedRolls[0].damageType).toBe('fire');
			expect(saveNode.sharedRolls[0].on?.failedSave).toBeDefined();
			expect(saveNode.sharedRolls[0].on?.passedSave).toBeDefined();
		});

		it('should add conditions to failed save', () => {
			const action: NimbleNexusAction = {
				name: 'Petrifying Gaze',
				description: 'DC 14 INT save or the target is [[Petrified]]',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			const saveNode = result[0] as any;
			expect(saveNode.on?.failedSave).toHaveLength(1);
			expect(saveNode.on?.failedSave[0].type).toBe('condition');
			expect(saveNode.on?.failedSave[0].condition).toBe('petrified');
		});

		it('should handle save without half damage', () => {
			const action: NimbleNexusAction = {
				name: 'Mind Blast',
				damage: { roll: '3d6 Psychic' },
				description: 'DC 16 INT save or take full damage',
			};
			const result = buildEffectTree(action);

			const saveNode = result[0] as any;
			expect(saveNode.sharedRolls[0].on?.failedSave).toBeDefined();
			expect(saveNode.sharedRolls[0].on?.passedSave).toBeUndefined();
		});
	});

	describe('edge cases', () => {
		it('should return empty array for actions with no damage or conditions', () => {
			const action: NimbleNexusAction = {
				name: 'Move',
				description: 'The creature moves up to its speed',
			};
			const result = buildEffectTree(action);
			expect(result).toEqual([]);
		});

		it('should handle malformed input gracefully', () => {
			const action = {} as NimbleNexusAction;
			const result = buildEffectTree(action);
			expect(result).toEqual([]);
		});
	});

	describe('real Nimble Nexus monster data', () => {
		// Test data based on actual monsters from nimble.nexus API

		it('should parse Alchemist Dragon Potion Breath with DC and half damage', () => {
			// From: Alchemist Dragon - Potion Breath action
			const action: NimbleNexusAction = {
				name: 'Potion Breath',
				damage: { roll: '4d12+4' },
				description: 'Cone: 12. DC 21 DEX save for half damage, on fail Roll a D6',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('dexterity');
			expect(saveNode.saveDC).toBe(21);
			expect(saveNode.sharedRolls[0].on?.passedSave).toBeDefined();
		});

		it('should parse Ancient Dragon Breath Weapon with DC and half damage', () => {
			// From: Ancient Dragon - Breath weapon action
			const action: NimbleNexusAction = {
				name: 'Breath Weapon',
				damage: { roll: '1d66' },
				description:
					'AOE 4x4 (fire) for Argonath or line 8 (Electricity). Dex DC 20 save for half damage.',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('dexterity');
			expect(saveNode.saveDC).toBe(20);
		});

		it('should parse Magmin Uraniac Steamblast with STR save', () => {
			// From: "Asuvius" the Magmin Uraniac - Steamblast action
			const action: NimbleNexusAction = {
				name: 'Steamblast',
				damage: { roll: '2d8+2' },
				description: '(1 use, cone 6) DC 10 STR save or 2d8+2 damage (half on save)',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('strength');
			expect(saveNode.saveDC).toBe(10);
			expect(saveNode.sharedRolls[0].on?.passedSave).toBeDefined();
		});

		it('should parse Mad Troll Mad Ravings with WIL save and psychic damage', () => {
			// From: Angor the Mad Troll - Mad Ravings action
			const action: NimbleNexusAction = {
				name: 'Mad Ravings',
				damage: { roll: '2d4+10' },
				description: 'DC 10 WIL or 2d4+10 psychic, half on save',
				target: { reach: 10 },
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('will');
			expect(saveNode.saveDC).toBe(10);
			expect(saveNode.sharedRolls[0].damageType).toBe('psychic');
		});

		it('should parse Bed Dragon Wyrmling Splinter Breath with DEX save', () => {
			// From: Bed Dragon Wyrmling + Noke - Splinter Breath action
			const action: NimbleNexusAction = {
				name: 'Splinter Breath',
				damage: { roll: '2d4+1' },
				description: '(1 use, Reach: cone 3) 2d4+1 or half on DC 10 DEX save.',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('savingThrow');
			const saveNode = result[0] as any;
			expect(saveNode.savingThrowType).toBe('dexterity');
			expect(saveNode.saveDC).toBe(10);
		});

		it('should parse Alchemist Dragon Tooth and Claw as damage action', () => {
			// From: Alchemist Dragon - Tooth and Claw action
			const action: NimbleNexusAction = {
				name: 'Tooth and Claw',
				damage: { roll: '2d12+7' },
				description: "On hit: Roll a d10 on the Alchemist's table.",
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.formula).toBe('2d12+7');
		});

		it('should parse Bed Dragon Wyrmling Bite with piercing damage', () => {
			// From: Bed Dragon Wyrmling + Noke - Bite action
			const action: NimbleNexusAction = {
				name: 'Bite',
				damage: { roll: '2d4+3 piercing' },
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.damageType).toBe('piercing');
			expect(damageNode.formula).toBe('2d4+3');
		});

		it('should parse Mad Troll Claws with grappled condition on crit', () => {
			// From: Mad Troll - Claws action
			const action: NimbleNexusAction = {
				name: 'Claws',
				damage: { roll: '1d4+6' },
				description: 'On crit: [[Grappled]] (escape DC 12)',
				target: { reach: 2 },
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.on?.criticalHit).toHaveLength(1);
			expect(damageNode.on?.criticalHit[0].condition).toBe('grappled');
		});

		it('should parse A Pale Snail Divine Call with taunted condition', () => {
			// From: A Pale Snail - Divine Call action
			const action: NimbleNexusAction = {
				name: 'Divine Call',
				damage: { roll: '1d4' },
				description: 'On hit: [[Taunted]]',
				target: { range: 13 },
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.on?.hit).toHaveLength(2); // DamageOutcome + Condition
			expect(damageNode.on?.hit[1].condition).toBe('taunted');
		});

		it('should parse Magmin Touch with fire damage from formula', () => {
			// From: "Asuvius" the Magmin Uraniac - Touch action
			const action: NimbleNexusAction = {
				name: 'Touch',
				damage: { roll: '2d8+2 fire' },
				description:
					'If target is a creature or flammable it starts burning. A burning creature or object takes 1d4 fire damage at the start of each of its turns.',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.damageType).toBe('fire');
			expect(damageNode.formula).toBe('2d8+2');
		});

		it('should parse Angor the Mad Troll Raking Claw with grappled condition', () => {
			// From: Angor the Mad Troll - Raking Claw action
			const action: NimbleNexusAction = {
				name: 'Raking Claw',
				damage: { roll: '1d4+6' },
				description: 'Move 6, then strike for 1d4+6. On hit: [[Grappled]] (escape DC 10)',
			};
			const result = buildEffectTree(action);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('damage');
			const damageNode = result[0] as any;
			expect(damageNode.on?.hit).toHaveLength(2); // DamageOutcome + Condition
			expect(damageNode.on?.hit[1].condition).toBe('grappled');
		});
	});

	describe('comprehensive Nimble Nexus creature tests', () => {
		// VAMPIRES
		describe('Vampires', () => {
			it('should parse Alaric Draegoth Ebonfang', () => {
				const action: NimbleNexusAction = {
					name: 'Ebonfang',
					damage: { roll: '1d10+15' },
					description:
						'1d10+15. Your target is considered Bloodied for 1 round. Fly 8 before or after attacking.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).formula).toBe('1d10+15');
			});

			it('should parse Alaric Draegoth Beguile with WIL save', () => {
				const action: NimbleNexusAction = {
					name: 'Beguile',
					description:
						'If no creature is Beguiled, Beguile a target on a failed DC 18 WIL save (w/ disadvantage if Bloodied). Beguiled: Dazed.',
				};
				const result = buildEffectTree(action);
				expect(result).toHaveLength(1);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(18);
				expect((result[0] as any).savingThrowType).toBe('will');
			});

			it('should parse Crimson Clergy Consume with necrotic damage and crit effect', () => {
				const action: NimbleNexusAction = {
					name: 'Consume',
					damage: { roll: '2d6+3' },
					description: '2d6+3 necrotic. On CRIT, target cannot heal for 1 round.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('necrotic');
			});
		});

		// WYVERNS
		describe('Wyverns', () => {
			it('should parse Cave Wyvern Stinger with poison damage', () => {
				const action: NimbleNexusAction = {
					name: 'Stinger',
					damage: { roll: '1d6+2' },
					description: '1d6+2. +9 poison damage.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('poison');
			});

			it('should parse Cave Wyvern Howl with STR save and psychic damage', () => {
				const action: NimbleNexusAction = {
					name: 'Howl',
					damage: { roll: '3d8' },
					description: 'DC12 STR save. Cone 3. Failure: 3d8 Psychic & Dazed 2.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(12);
				expect((result[0] as any).savingThrowType).toBe('strength');
			});

			it('should parse Cinderashe Fire Breath with DEX save for half', () => {
				const action: NimbleNexusAction = {
					name: 'Fire Breath',
					damage: { roll: '6d10+3' },
					description: 'Fire. Cone 8. DEX Save DC 15. Half Damage on success.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(15);
				expect((result[0] as any).sharedRolls[0].damageType).toBe('fire');
				expect((result[0] as any).sharedRolls[0].on?.passedSave).toBeDefined();
			});

			it('should parse Lightning Wyvern Talons with grappled on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Talons',
					damage: { roll: '1d4+16' },
					description: 'On crit: grappled.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.criticalHit).toHaveLength(1);
				expect((result[0] as any).on?.criticalHit[0].condition).toBe('grappled');
			});

			it('should parse Lightning Wyvern Lightning Breath with STR save', () => {
				const action: NimbleNexusAction = {
					name: 'Lightning Breath',
					damage: { roll: '1d20+30' },
					description: 'Cone 8: DC 15 STR save or take 1d20+30 lightning damage...',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).sharedRolls[0].damageType).toBe('lightning');
			});
		});

		// TREANTS
		describe('Treants', () => {
			it('should parse Blighted Treant Vine Lash with restrained and poisoned', () => {
				const action: NimbleNexusAction = {
					name: 'Vine Lash',
					damage: { roll: 'd44' },
					description:
						'(Line: 6) d44. On damage: [[restrained]] and [[poisoned]] (escape DC 17, or any fire ends both).',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				const conditions = (result[0] as any).on?.hit?.filter((n: any) => n.type === 'condition');
				expect(conditions).toHaveLength(2);
			});

			it('should parse Oak Treant Branching Pull with STR save', () => {
				const action: NimbleNexusAction = {
					name: 'Branching Pull',
					description: '(range 6) DC14 STR save. Push/pull a creature 4 spaces, half on sucess',
					target: { range: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(14);
			});

			it('should parse Oak Treant Shaking Roots with DEX save and prone', () => {
				const action: NimbleNexusAction = {
					name: 'Shaking Roots',
					damage: { roll: '1d10' },
					description:
						'(All adjacent creatures) DC12 DEX save, on fail 1d10 dmg and fall [[prone]]',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(12);
			});

			it('should parse Spruce Treant Slam with prone on damage', () => {
				const action: NimbleNexusAction = {
					name: 'Slam',
					damage: { roll: '3d10' },
					description: '3d10.. On damage: fall [[prone]]',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// DEVILS
		describe('Devils', () => {
			it('should parse Barbed Devil Claws with grappled', () => {
				const action: NimbleNexusAction = {
					name: 'Claws',
					damage: { roll: '1d6+3' },
					description: '1d6+3. On hit: [[grappled]] (escape DC 13).',
					target: { reach: 2 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.hit).toHaveLength(2);
				expect((result[0] as any).on?.hit[1].condition).toBe('grappled');
			});

			it('should parse Barbed Devil Hurl Flame with DEX save and smoldering', () => {
				const action: NimbleNexusAction = {
					name: 'Hurl Flame',
					damage: { roll: '2d6+10' },
					description:
						'2d6+10 fire. (Reach 8) Lobs fire in a 2x2 area. Creatures make a DC 15 DEX save, half on success. On hit: Smoldering.',
					target: { reach: 8 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).sharedRolls[0].damageType).toBe('fire');
			});

			it('should parse Bone Devil Infernal Sting with poison and poisoned', () => {
				const action: NimbleNexusAction = {
					name: 'Infernal Sting',
					damage: { roll: '2d10+20' },
					description:
						"2d10+20 poison. On hit: [[Poisoned]], and can't regain HP. Lasts for one round.",
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('poison');
				expect((result[0] as any).on?.hit).toHaveLength(2);
			});
		});

		// DINOSAURS
		describe('Dinosaurs', () => {
			it('should parse Aerosaur Talons', () => {
				const action: NimbleNexusAction = {
					name: 'Talons',
					damage: { roll: '1d6+3' },
					description: '1d6+3. (Range 1) initiates "Lift" on small and medium targets.',
					target: { range: 1 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).formula).toBe('1d6+3');
			});

			it('should parse Allosaurus Claw', () => {
				const action: NimbleNexusAction = {
					name: 'Claw',
					damage: { roll: '1d8+4' },
					description: '1d8+4.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// DROW
		describe('Drow', () => {
			it('should parse The Black Spider Web with DEX save and restrained', () => {
				const action: NimbleNexusAction = {
					name: 'Web',
					description:
						'Cover a Reach 3 circle on the floor in webbing, creating Difficult Terrain. Creatures within: DC 13 DEX save or Restrained until the end of their next turn.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(13);
			});

			it('should parse The Black Spider Shadow Strike with dazed on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Shadow Strike',
					damage: { roll: '1d8+6' },
					description: 'Move 8 and 1d8+6 damage (Range 6) On crit: Dazed.',
					target: { range: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.criticalHit).toHaveLength(1);
				expect((result[0] as any).on?.criticalHit[0].condition).toBe('dazed');
			});
		});

		// GARGOYLES
		describe('Gargoyles', () => {
			it('should parse Gargoyle Swooping Slam', () => {
				const action: NimbleNexusAction = {
					name: 'Swooping Slam',
					damage: { roll: '2d8+15' },
					description: '2d8+15. Push target 4. Must fly 6 towards target first.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});

			it('should parse Gargoyle Guards Stone Claws with dazed on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Stone Claws',
					damage: { roll: '3d8+10' },
					description: '3d8+10. Slashing, On CRIT the target is Dazed.',
					target: { reach: 1 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('slashing');
			});

			it('should parse Vrock Hammer Smash with prone on hit', () => {
				const action: NimbleNexusAction = {
					name: 'Hammer Smash',
					damage: { roll: '1d8+40' },
					description:
						'1d8+40. Reach 2. Disadvantage 2 if target successfully assessed in their last turn. On hit: Prone',
					target: { reach: 2 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// GHOULS
		describe('Ghouls', () => {
			it('should parse Ghoul Sickening Claw with dazed on damage', () => {
				const action: NimbleNexusAction = {
					name: 'Sickening Claw',
					damage: { roll: '1d4+8' },
					description: '1d4+8. On damage: Dazed.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// GIANTS
		describe('Giants', () => {
			it('should parse Alpengrendal Frost Breath with STR save', () => {
				const action: NimbleNexusAction = {
					name: 'Frost Breath',
					damage: { roll: '4d10' },
					description: 'Cone 6. When 2 enemies are within the area, DC 15 STR save...',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(15);
			});

			it('should parse Beastheaded Giant Homing Boulder', () => {
				const action: NimbleNexusAction = {
					name: 'Homing Boulder',
					damage: { roll: '2d6+15' },
					description: 'Range 16, AoE burst 1) 2d6+15 bludgeoning.',
					target: { range: 16 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('bludgeoning');
			});
		});

		// GOBLINS (Bugbears)
		describe('Goblins/Bugbears', () => {
			it('should parse Bugbear Enforcer Headbutt with dazed and STR save', () => {
				const action: NimbleNexusAction = {
					name: 'Headbutt',
					damage: { roll: '1d4+2' },
					description: '1d4+2. On damage: Dazed 2 (Str save 12)',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});

			it('should parse Bugbear Warrior Grab with grappled', () => {
				const action: NimbleNexusAction = {
					name: 'Grab',
					damage: { roll: '2d6+2' },
					description:
						'2d6+2 Bludgeoning Damage. If the target is a medium or smaller creature, it has the Grappled condition. (DC12 to escape)',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('bludgeoning');
			});
		});

		// GRIFFINS
		describe('Griffins', () => {
			it('should parse Griffin Piercing Cry with deafened save', () => {
				const action: NimbleNexusAction = {
					name: 'Piercing Cry',
					damage: { roll: '1d4' },
					description:
						'1d4. Targets within 2x2 tiles around the griffin must succeed a DC 7 saving roll or are deafened for 2 turns',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// HAGS
		describe('Hags', () => {
			it('should parse Forest Hag Command with WIL save', () => {
				const action: NimbleNexusAction = {
					name: 'Command',
					description:
						"(Range: 8) One enemy must make a DC 12 WIL Save or be forced to lose 2 actions doing a silly dance, telling you a secret, or throwing what they're holding 6 squares.",
					target: { range: 8 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(12);
				expect((result[0] as any).savingThrowType).toBe('will');
			});

			it('should parse Kwasi Uchechi Force Vibration with INT save and psychic damage', () => {
				const action: NimbleNexusAction = {
					name: 'Force Vibration',
					damage: { roll: '2d6' },
					description:
						"(Reach 2) 2d6 piercing, INT DC 15 or 6d6 psychic, Vicious, can't be reduced, on hit: Dazed.",
					target: { reach: 2 },
				};
				const result = buildEffectTree(action);
				// This is complex - has both damage and save
				expect(result).toHaveLength(1);
			});
		});

		// MYCONIDS
		describe('Myconids', () => {
			it('should parse Myconid Scrape', () => {
				const action: NimbleNexusAction = {
					name: 'Scrape',
					damage: { roll: '1d6' },
					description: '1d6',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// MANTICORES
		describe('Manticores', () => {
			it('should parse Ravager of the Lowlands Venomous Stinger', () => {
				const action: NimbleNexusAction = {
					name: 'Venomous Stinger',
					damage: { roll: '5d12' },
					description: '5d12. (1 use) Reach 3.',
					target: { reach: 3 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// RAKSHASAS
		describe('Rakshasas', () => {
			it('should parse Rakshasa Claw with confused on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Claw',
					damage: { roll: '3d6+10' },
					description: '3d6+10. On Crit: Confused 1 turn (the GM spends your first action).',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.criticalHit).toHaveLength(1);
				expect((result[0] as any).on?.criticalHit[0].condition).toBe('confused');
			});

			it('should parse Rakshasa Horrific Visions with INT save and frightened', () => {
				const action: NimbleNexusAction = {
					name: 'Horrific Visions',
					damage: { roll: 'd66' },
					description:
						'(3x3 area in Reach: 6) DC 17 INT save or [[frightened]] and d66 psychic, half on save.',
					target: { reach: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(17);
				expect((result[0] as any).savingThrowType).toBe('intelligence');
			});

			it('should parse Rakshasa Dominate with WIL save', () => {
				const action: NimbleNexusAction = {
					name: 'Dominate',
					description:
						'DC 17 WIL save or you spend 3 actions, 2 actions on save. (Cannot spend resources, they regain spent actions afterwards.)',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(17);
				expect((result[0] as any).savingThrowType).toBe('will');
			});
		});

		// SALAMANDERS
		describe('Salamanders', () => {
			it('should parse Eyeless Salamander Acid Spit', () => {
				const action: NimbleNexusAction = {
					name: 'Acid Spit',
					damage: { roll: '2d6+6' },
					description:
						'Melts away stone, steel, or organic structures. On crit: target chooses 1 weapon, armour, or magic item on their person...',
					target: { range: 8 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});

			it('should parse Salamander Lavamancer Tail with grappled', () => {
				const action: NimbleNexusAction = {
					name: 'Tail',
					damage: { roll: '2d6+3' },
					description: '(Reach: 2) 2d6+3. On hit: [[Grappled]].',
					target: { reach: 2 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.hit).toHaveLength(2);
				expect((result[0] as any).on?.hit[1].condition).toBe('grappled');
			});

			it('should parse Salamander Lavamancer Lavalash with DEX save', () => {
				const action: NimbleNexusAction = {
					name: 'Lavalash',
					damage: { roll: '6d6' },
					description: '(Line: 8) 6d6 fire or half on DC 15 DEX save. Leaves cracked ground.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).sharedRolls[0].damageType).toBe('fire');
			});

			it('should parse Salamander Lavamancer Eruption with DEX save', () => {
				const action: NimbleNexusAction = {
					name: 'Eruption',
					damage: { roll: 'd66' },
					description:
						'd66 fire to creatures on cracked ground, or half on DC 17 DEX save. Removes cracked ground.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(17);
			});
		});

		// SHAMBLING MOUNDS
		describe('Shambling Mounds', () => {
			it('should parse Greytouched Shambling Mount Hill Grasp with grappled', () => {
				const action: NimbleNexusAction = {
					name: 'Hill Grasp',
					damage: { roll: '2d8+12' },
					description: '(Reach 2) 2d8+12, on hit: Grappled.',
					target: { reach: 2 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});

			it('should parse Shambling Mound Enveloping Tendrils with restrained', () => {
				const action: NimbleNexusAction = {
					name: 'Enveloping Tendrils',
					damage: { roll: '2d10' },
					description:
						'2d10. On damage: [[Restrained]]. If a hero ends their turn [[restrained]], they take 5 dmg',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// SPHINXES
		describe('Sphinxes', () => {
			it('should parse The Sphinx Extract Knowledge with psychic damage', () => {
				const action: NimbleNexusAction = {
					name: 'Extract Knowledge',
					damage: { roll: '2d4+7' },
					description: 'Reach: 6) 2d4+7 psychic. On hit: The Sphinx learns one...',
					target: { reach: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('psychic');
			});

			it('should parse The Sphinx Impatient Swipe with slashing damage', () => {
				const action: NimbleNexusAction = {
					name: 'Impatient Swipe',
					damage: { roll: '2d4+7' },
					description: 'Move up to 4, then attack for 2d4+7 slashing.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('slashing');
			});
		});

		// TROGLODYTES
		describe('Troglodytes', () => {
			it('should parse Troglodyte Bite & Claw with piercing/slashing', () => {
				const action: NimbleNexusAction = {
					name: 'Bite & Claw',
					damage: { roll: '1d4+2' },
					description: '1d4+2 Piercing/Slashing',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('piercing');
			});
		});

		// UNICORNS
		describe('Unicorns', () => {
			it('should parse Unicorn Charge with piercing damage and wound on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Charge',
					damage: { roll: '3d8+20' },
					description:
						'3d8+20 piercing.. On crit: 1 wound (can only be used after moving at least 4 spaces in a straight line).',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('piercing');
			});

			it('should parse Unicorn Horn and Hooves', () => {
				const action: NimbleNexusAction = {
					name: 'Horn and Hooves',
					damage: { roll: '1d8+5' },
					description: '1d8+5 piercing,. then 2d6+5 bludgeoning.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('piercing');
			});
		});

		// YETIS
		describe('Yetis', () => {
			it('should parse Abominable Yeti Claw with slowed on hit', () => {
				const action: NimbleNexusAction = {
					name: 'Claw',
					damage: { roll: '3d4+5' },
					description: '3d4+5. On hit: [[Slowed]]',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.hit).toHaveLength(2);
				expect((result[0] as any).on?.hit[1].condition).toBe('slowed');
			});

			it('should parse Yeti Gaze with dazed and WIL escape', () => {
				const action: NimbleNexusAction = {
					name: "Yeti's Gaze",
					damage: { roll: '8d4+10' },
					description: '8d4+10. (Range: 6) On hit: [[Dazed]] 2 (escape DC 17 WIL)',
					target: { range: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.hit).toHaveLength(2);
				expect((result[0] as any).on?.hit[1].condition).toBe('dazed');
			});

			it('should parse Yeti Claw with slowed on crit', () => {
				const action: NimbleNexusAction = {
					name: 'Claw',
					damage: { roll: '2d4+2' },
					description: '2d4+2. On crit: [[Slowed]]',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).on?.criticalHit).toHaveLength(1);
				expect((result[0] as any).on?.criticalHit[0].condition).toBe('slowed');
			});
		});

		// DOPPELGANGERS
		describe('Doppelgangers', () => {
			it('should parse Doppelganger True Form with WIL save and frightened', () => {
				const action: NimbleNexusAction = {
					name: 'True Form',
					description:
						'Transform back into its true form. Creatures within 6 spaces make a DC 13 WIL save or are Frightened for 3 rounds.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(13);
				expect((result[0] as any).savingThrowType).toBe('will');
			});

			it('should parse Doppelganger Lure with INT save', () => {
				const action: NimbleNexusAction = {
					name: 'Lure',
					description:
						'DC 14 INT save. On fail: target moves 4 spaces in a direction of your choosing. Then:',
					target: { reach: 6 },
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(14);
				expect((result[0] as any).savingThrowType).toBe('intelligence');
			});
		});

		// DEATH KNIGHTS
		describe('Death Knights', () => {
			it('should parse Death Knight Grave Swing', () => {
				const action: NimbleNexusAction = {
					name: 'Grave Swing',
					damage: { roll: '1d4+15' },
					description: '1d4 + 15',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
			});
		});

		// COCKATRICES
		describe('Cockatrices', () => {
			it('should parse Cockatrice Bite with piercing damage', () => {
				const action: NimbleNexusAction = {
					name: 'Bite',
					damage: { roll: '1d4+1' },
					description: '(1d4+1). piercing damage + Turn to Stone',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('piercing');
			});
		});

		// CARRION CRAWLERS
		describe('Carrion Crawlers', () => {
			it('should parse Carrion Crawler Bite with piercing and poison damage', () => {
				const action: NimbleNexusAction = {
					name: 'Bite',
					damage: { roll: '2d4+2' },
					description: '2d4+2 Piercing Damage + 1d6 Poison Damage',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('piercing');
			});
		});

		// BEHOLDERS
		describe('Beholders', () => {
			it('should parse Gauth Enervation Ray with necrotic damage', () => {
				const action: NimbleNexusAction = {
					name: 'Enervation Ray',
					damage: { roll: '2d8+4' },
					description: '2d8+4 Necrotic',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('necrotic');
			});

			it('should parse Gauth Fire Ray with fire damage', () => {
				const action: NimbleNexusAction = {
					name: 'Fire Ray',
					damage: { roll: '4d8+4' },
					description: '4d8+4 Fire',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('fire');
			});

			it('should parse Gauth Disintegration Ray with DEX save and force damage', () => {
				const action: NimbleNexusAction = {
					name: 'Disintegration Ray',
					damage: { roll: '8d8+4' },
					description: 'Dex saving throw 13 or 8d8+4 Force damage half on save',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(13);
				expect((result[0] as any).sharedRolls[0].damageType).toBe('force');
			});

			it('should parse Gauth Frost Ray with STR save', () => {
				const action: NimbleNexusAction = {
					name: 'Frost Ray',
					description: 'DC 13 STR save or frozen for 1 minute; can retry at turn end',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(13);
				expect((result[0] as any).savingThrowType).toBe('strength');
			});

			it('should parse Gauth Blind Ray with WIL save', () => {
				const action: NimbleNexusAction = {
					name: 'Blind Ray',
					description: 'DC 13 WIL save or gains blind condition',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(13);
				expect((result[0] as any).savingThrowType).toBe('will');
			});
		});

		// ANIMATED ARMOR
		describe('Animated Armor', () => {
			it('should parse Animated Armor Slam with bludgeoning', () => {
				const action: NimbleNexusAction = {
					name: 'Slam',
					damage: { roll: '1d8+1' },
					description: '1d8+1. bludgeoning.',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('bludgeoning');
			});
		});

		// ANGELS
		describe('Angels', () => {
			it('should parse Angel Divine Smite with radiant damage', () => {
				const action: NimbleNexusAction = {
					name: 'Divine Smite',
					damage: { roll: '5d8+13 Radiant' },
					description: '5d8+13 Radiant',
				};
				const result = buildEffectTree(action);
				expect(result[0].type).toBe('damage');
				expect((result[0] as any).damageType).toBe('radiant');
				expect((result[0] as any).formula).toBe('5d8+13');
			});

			it('should parse Angel Smite with WIL save and blinded', () => {
				const action: NimbleNexusAction = {
					name: 'Smite',
					damage: { roll: '4d8+12' },
					description:
						'4d8+12. Reach 1. DC 15 WIL save or you are permanently blinded as divine light singes your eyes.',
					target: { reach: 1 },
				};
				const result = buildEffectTree(action);
				// Has both damage and save - returns save since save is detected
				expect(result[0].type).toBe('savingThrow');
				expect((result[0] as any).saveDC).toBe(15);
			});
		});
	});
});

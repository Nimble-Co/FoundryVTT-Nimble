import { describe, expect, it } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from './flattenEffectsTree.js';

describe('flattenEffectsTree', () => {
	describe('Edge cases: empty/null input', () => {
		it.each([
			['null input', null],
			['undefined input', undefined],
			['empty array', []],
		])('should return empty array for %s', (_description, input) => {
			const result = flattenEffectsTree(input as unknown as (EffectNode | string)[]);
			expect(result).toEqual([]);
		});
	});

	describe('String references', () => {
		it('should parse valid string reference with single key-value pair', () => {
			const input = ['@{id=test1; type=condition; condition=poisoned}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test1',
				type: 'condition',
				condition: 'poisoned',
				parentNode: null,
				parentContext: null,
			});
		});

		it('should parse string reference with multiple key-value pairs', () => {
			const input = ['@{id=test2; type=damage; damageType=fire; formula=1d6}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test2',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
			});
		});

		it('should convert number strings to numbers in string references', () => {
			const input = ['@{id=test3; type=damage; saveDC=15; value=42}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test3',
				type: 'damage',
				saveDC: 15,
				value: 42,
			});
			expect(typeof result[0].saveDC).toBe('number');
			expect(typeof result[0].value).toBe('number');
		});

		it('should convert boolean strings to booleans in string references', () => {
			const input = ['@{id=test4; type=damage; canCrit=true; canMiss=false}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test4',
				type: 'damage',
				canCrit: true,
				canMiss: false,
			});
			expect(typeof result[0].canCrit).toBe('boolean');
			expect(typeof result[0].canMiss).toBe('boolean');
		});

		it('should convert "null" string to null in string references', () => {
			const input = ['@{id=test5; type=condition; value=null}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test5',
				type: 'condition',
				value: null,
			});
			expect(result[0].value).toBeNull();
		});

		it.each([
			['invalid-string', 'invalid string'],
			['@{id=test6', 'invalid string reference'],
		])('should skip invalid string references for %s', (input, _description) => {
			const result = flattenEffectsTree([input] as (EffectNode | string)[]);

			expect(result).toEqual([]);
		});

		it('should set parentNode and parentContext on parsed string references', () => {
			const input = ['@{id=test7; type=condition; condition=poisoned}'];
			const result = flattenEffectsTree(input, 'parent-id', 'parent-context');

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				parentNode: 'parent-id',
				parentContext: 'parent-context',
			});
		});

		it('should handle string references with whitespace in key-value pairs', () => {
			const input = ['@{id = test8 ; type = damage ; damageType = fire }'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test8',
				type: 'damage',
				damageType: 'fire',
			});
		});
	});

	describe('Simple EffectNode objects (no nesting)', () => {
		it('should flatten simple ConditionNode', () => {
			const input: EffectNode[] = [
				{
					id: 'cond1',
					type: 'condition',
					condition: 'poisoned',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'cond1',
				type: 'condition',
				condition: 'poisoned',
				parentNode: null,
				parentContext: null,
			});
		});

		it('should flatten simple DamageNode without on property', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'dmg1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
			});
			expect(result[0]).not.toHaveProperty('on');
		});

		it('should flatten simple HealingNode', () => {
			const input: EffectNode[] = [
				{
					id: 'heal1',
					type: 'healing',
					healingType: 'healing',
					formula: '1d4',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'heal1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d4',
			});
		});

		it('should flatten simple TextNode', () => {
			const input: EffectNode[] = [
				{
					id: 'text1',
					type: 'note',
					noteType: 'flavor',
					text: 'A magical effect',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'text1',
				type: 'note',
				noteType: 'flavor',
				text: 'A magical effect',
			});
		});

		it('should set parentNode and parentContext on simple nodes', () => {
			const input: EffectNode[] = [
				{
					id: 'node1',
					type: 'condition',
					condition: 'poisoned',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input, 'parent-123', 'parent-ctx');

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				parentNode: 'parent-123',
				parentContext: 'parent-ctx',
			});
		});

		it('should deep clone nodes to avoid mutating input', () => {
			const input: EffectNode[] = [
				{
					id: 'node1',
					type: 'condition',
					condition: 'poisoned',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			// Modify the result
			result[0].parentNode = 'modified';

			// Original should not be affected
			expect(input[0].parentNode).toBeNull();
		});
	});

	describe('EffectNode with on property', () => {
		it('should flatten damage node with on.hit', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							{
								id: 'cond1',
								type: 'condition',
								condition: 'burning',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				id: 'dmg1',
				type: 'damage',
			});
			expect(result[0]).not.toHaveProperty('on');
			expect(result[1]).toMatchObject({
				id: 'cond1',
				type: 'condition',
				condition: 'burning',
				parentNode: 'dmg1',
				parentContext: 'hit',
			});
		});

		it('should flatten damage node with on.miss', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						miss: [
							{
								id: 'text1',
								type: 'note',
								noteType: 'general',
								text: 'Missed!',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'text1',
				parentNode: 'dmg1',
				parentContext: 'miss',
			});
		});

		it('should flatten damage node with on.criticalHit', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						criticalHit: [
							{
								id: 'dmg2',
								type: 'damage',
								damageType: 'fire',
								formula: '1d6',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'dmg2',
				parentNode: 'dmg1',
				parentContext: 'criticalHit',
			});
		});

		it('should flatten savingThrow node with on.failedSave', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					on: {
						failedSave: [
							{
								id: 'dmg1',
								type: 'damage',
								damageType: 'fire',
								formula: '2d6',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'dmg1',
				parentNode: 'save1',
				parentContext: 'failedSave',
			});
		});

		it('should flatten savingThrow node with on.passedSave', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					on: {
						passedSave: [
							{
								id: 'dmg1',
								type: 'damage',
								damageType: 'fire',
								formula: '1d6',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'dmg1',
				parentNode: 'save1',
				parentContext: 'passedSave',
			});
		});

		it('should flatten damage node with on.failedSaveBy with different degrees', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					on: {
						failedSaveBy: {
							1: [
								{
									id: 'dmg1',
									type: 'damage',
									damageType: 'fire',
									formula: '1d6',
									parentContext: null,
									parentNode: null,
								},
							],
							2: [
								{
									id: 'dmg2',
									type: 'damage',
									damageType: 'fire',
									formula: '2d6',
									parentContext: null,
									parentNode: null,
								},
							],
						},
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({ id: 'save1' });
			expect(result[0]).not.toHaveProperty('on');
			expect(result[1]).toMatchObject({
				id: 'dmg1',
				parentNode: 'save1',
				parentContext: 'failedSaveBy1',
			});
			expect(result[2]).toMatchObject({
				id: 'dmg2',
				parentNode: 'save1',
				parentContext: 'failedSaveBy2',
			});
		});

		it('should handle on property with multiple contexts', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							{
								id: 'cond1',
								type: 'condition',
								condition: 'burning',
								parentContext: null,
								parentNode: null,
							},
						],
						miss: [
							{
								id: 'text1',
								type: 'note',
								noteType: 'general',
								text: 'Missed',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({ id: 'dmg1' });
			expect(result[1]).toMatchObject({
				id: 'cond1',
				parentContext: 'hit',
			});
			expect(result[2]).toMatchObject({
				id: 'text1',
				parentContext: 'miss',
			});
		});

		it('should handle on property with string references', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: ['@{id=cond1; type=condition; condition=burning}'],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'cond1',
				type: 'condition',
				condition: 'burning',
				parentNode: 'dmg1',
				parentContext: 'hit',
			});
		});

		it('should handle on property with mixed string references and objects', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							'@{id=cond1; type=condition; condition=burning}',
							{
								id: 'text1',
								type: 'note',
								noteType: 'general',
								text: 'Hit!',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[1]).toMatchObject({
				id: 'cond1',
				parentContext: 'hit',
			});
			expect(result[2]).toMatchObject({
				id: 'text1',
				parentContext: 'hit',
			});
		});

		it('should not process on property for non-damage/savingThrow types', () => {
			const input = [
				{
					id: 'cond1',
					type: 'condition',
					condition: 'poisoned',
					// Testing edge case where on might be incorrectly added
					on: {
						hit: [
							{
								id: 'cond2',
								type: 'condition',
								condition: 'burning',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			// Should only return the parent node, on property should remain
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ id: 'cond1' });
		});
	});

	describe('EffectNode with sharedRolls property', () => {
		it('should flatten savingThrow node with sharedRolls', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					sharedRolls: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '2d6',
							parentContext: null,
							parentNode: null,
						},
					],
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({ id: 'save1' });
			expect(result[0]).not.toHaveProperty('sharedRolls');
			expect(result[1]).toMatchObject({
				id: 'dmg1',
				parentNode: 'save1',
				parentContext: 'sharedRolls',
			});
		});

		it('should handle sharedRolls with string references', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					sharedRolls: ['@{id=dmg1; type=damage; damageType=fire; formula=2d6}'],
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(2);
			expect(result[1]).toMatchObject({
				id: 'dmg1',
				type: 'damage',
				damageType: 'fire',
				formula: '2d6',
				parentNode: 'save1',
				parentContext: 'sharedRolls',
			});
		});

		it('should handle sharedRolls with multiple nodes', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					sharedRolls: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '2d6',
							parentContext: null,
							parentNode: null,
						},
						{
							id: 'dmg2',
							type: 'damage',
							damageType: 'cold',
							formula: '1d6',
							parentContext: null,
							parentNode: null,
						},
					],
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[1]).toMatchObject({ id: 'dmg1', parentContext: 'sharedRolls' });
			expect(result[2]).toMatchObject({ id: 'dmg2', parentContext: 'sharedRolls' });
		});

		it('should not process sharedRolls for non-savingThrow types', () => {
			const input = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					// Testing edge case where sharedRolls might be incorrectly added
					sharedRolls: [
						{
							id: 'dmg2',
							type: 'damage',
							damageType: 'cold',
							formula: '1d6',
							parentContext: null,
							parentNode: null,
						},
					],
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			// Should only return the parent node, sharedRolls should remain
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ id: 'dmg1' });
		});
	});

	describe('Complex nested structures', () => {
		it('should flatten savingThrow with both on and sharedRolls', () => {
			const input: EffectNode[] = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					sharedRolls: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '2d6',
							parentContext: null,
							parentNode: null,
						},
					],
					on: {
						failedSave: [
							{
								id: 'dmg2',
								type: 'damage',
								damageType: 'fire',
								formula: '1d6',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({ id: 'save1' });
			expect(result[0]).not.toHaveProperty('on');
			expect(result[0]).not.toHaveProperty('sharedRolls');
			// on property is processed before sharedRolls, so on.failedSave comes first
			expect(result[1]).toMatchObject({
				id: 'dmg2',
				parentNode: 'save1',
				parentContext: 'failedSave',
			});
			expect(result[2]).toMatchObject({
				id: 'dmg1',
				parentNode: 'save1',
				parentContext: 'sharedRolls',
			});
		});

		it('should flatten deeply nested structures', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							{
								id: 'dmg2',
								type: 'damage',
								damageType: 'fire',
								formula: '1d4',
								on: {
									criticalHit: [
										{
											id: 'cond1',
											type: 'condition',
											condition: 'burning',
											parentContext: null,
											parentNode: null,
										},
									],
								},
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({ id: 'dmg1' });
			expect(result[1]).toMatchObject({
				id: 'dmg2',
				parentNode: 'dmg1',
				parentContext: 'hit',
			});
			expect(result[1]).not.toHaveProperty('on');
			expect(result[2]).toMatchObject({
				id: 'cond1',
				parentNode: 'dmg2',
				parentContext: 'criticalHit',
			});
		});

		it('should handle multiple root nodes with nested structures', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							{
								id: 'cond1',
								type: 'condition',
								condition: 'burning',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
				{
					id: 'heal1',
					type: 'healing',
					healingType: 'healing',
					formula: '1d4',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({ id: 'dmg1' });
			expect(result[1]).toMatchObject({ id: 'cond1', parentNode: 'dmg1' });
			expect(result[2]).toMatchObject({ id: 'heal1' });
		});

		it('should handle mixed string references and objects in nested structures', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							'@{id=cond1; type=condition; condition=burning}',
							{
								id: 'dmg2',
								type: 'damage',
								damageType: 'fire',
								formula: '1d4',
								on: {
									criticalHit: ['@{id=cond2; type=condition; condition=stunned}'],
								},
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(4);
			expect(result[0]).toMatchObject({ id: 'dmg1' });
			expect(result[1]).toMatchObject({ id: 'cond1', parentNode: 'dmg1', parentContext: 'hit' });
			expect(result[2]).toMatchObject({ id: 'dmg2', parentNode: 'dmg1', parentContext: 'hit' });
			expect(result[3]).toMatchObject({
				id: 'cond2',
				parentNode: 'dmg2',
				parentContext: 'criticalHit',
			});
		});
	});

	describe('Parent context propagation', () => {
		it('should propagate parentNode and parentContext to all nested nodes', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: [
							{
								id: 'cond1',
								type: 'condition',
								condition: 'burning',
								parentContext: null,
								parentNode: null,
							},
						],
					},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input, 'root-parent', 'root-context');

			expect(result[0]).toMatchObject({
				id: 'dmg1',
				parentNode: 'root-parent',
				parentContext: 'root-context',
			});
			expect(result[1]).toMatchObject({
				id: 'cond1',
				parentNode: 'dmg1',
				parentContext: 'hit',
			});
		});

		it('should handle null parentNode and parentContext', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input, null, null);

			expect(result[0]).toMatchObject({
				id: 'dmg1',
				parentNode: null,
				parentContext: null,
			});
		});
	});

	describe('Edge cases in on property', () => {
		it('should handle empty on object', () => {
			const input: EffectNode[] = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {},
					parentContext: null,
					parentNode: null,
				},
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('on');
		});

		it('should handle on property with null/undefined arrays', () => {
			const input = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: null,
						miss: undefined,
					},
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('on');
		});

		it('should handle on.failedSaveBy with null arrays', () => {
			const input = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					on: {
						failedSaveBy: {
							1: null,
							2: [],
						},
					},
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('on');
		});

		it('should handle on property with non-array values', () => {
			const input = [
				{
					id: 'dmg1',
					type: 'damage',
					damageType: 'fire',
					formula: '1d6',
					on: {
						hit: 'not-an-array',
					},
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('on');
		});
	});

	describe('Edge cases in sharedRolls', () => {
		it.each([
			['null', null],
			['undefined', undefined],
			['empty array', []],
		])('should handle %s sharedRolls', (_description, sharedRolls) => {
			const input = [
				{
					id: 'save1',
					type: 'savingThrow',
					savingThrowType: 'dexterity',
					sharedRolls,
					parentContext: null,
					parentNode: null,
				} as unknown as EffectNode,
			];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('sharedRolls');
		});
	});

	describe('String reference parsing edge cases', () => {
		it('should handle string reference with empty content', () => {
			const input = ['@{}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			// Empty string reference still gets parentContext and parentNode set (to null by default)
			expect(result[0]).toMatchObject({
				parentContext: null,
				parentNode: null,
			});
		});

		it('should handle string reference with malformed key-value pairs', () => {
			const input = ['@{id=test; invalid; key=value}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test',
				key: 'value',
			});
		});

		it('should handle string reference with empty values', () => {
			const input = ['@{id=test; empty=}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test',
			});
		});

		it('should handle string reference with numeric zero', () => {
			const input = ['@{id=test; value=0}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test',
				value: 0,
			});
			expect(typeof result[0].value).toBe('number');
		});

		it('should handle string reference with negative numbers', () => {
			const input = ['@{id=test; value=-5}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test',
				value: -5,
			});
			expect(typeof result[0].value).toBe('number');
		});

		it('should handle string reference with decimal numbers', () => {
			const input = ['@{id=test; value=3.14}'];
			const result = flattenEffectsTree(input);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'test',
				value: 3.14,
			});
			expect(typeof result[0].value).toBe('number');
		});
	});
});

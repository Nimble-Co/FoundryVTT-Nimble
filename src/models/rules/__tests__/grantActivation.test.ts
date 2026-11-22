import { describe, expect, it } from 'vitest';
import { GrantActivationRule } from '../grantActivation.js';

describe('GrantActivationRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = GrantActivationRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('activationType');
		});

		it('declares a closed activation-type choice set defaulting to weaponAttack', () => {
			const schema = GrantActivationRule.defineSchema();
			const activationType = schema.activationType as unknown as {
				choices: string[];
				options: { initial: string };
			};
			expect(activationType.choices).toEqual(['weaponAttack']);
			expect(activationType.options.initial).toBe('weaponAttack');
		});

		it('keeps the behaviour of older data with every new option at its default', () => {
			const schema = GrantActivationRule.defineSchema() as unknown as Record<
				string,
				{ options: { initial: unknown }; choices?: Record<string, string> }
			>;
			expect(schema.trigger?.options.initial).toBe('onActivation');
			expect(Object.keys(schema.trigger?.choices ?? {})).toEqual([
				'onActivation',
				'afterMove',
				'onInterpose',
				'onFullBlock',
				'onAllyOpportunityAttack',
				'onMovementTrigger',
			]);
			expect(schema.free?.options.initial).toBe(false);
			expect(schema.spendsReaction?.options.initial).toBe(false);
			expect(schema.weaponKind?.options.initial).toBe('any');
			expect(Object.keys(schema.weaponKind?.choices ?? {})).toEqual([
				'any',
				'melee',
				'ranged',
				'unarmed',
			]);
			expect(schema.allowsCantrips?.options.initial).toBe(false);
			expect(schema.ignoresRushed?.options.initial).toBe(false);
			expect(schema.condition?.options.initial).toBe('');
			expect(schema.includesTargets?.options.initial).toBe(true);
			expect(schema.targetCount?.options.initial).toBe(0);
			expect(schema.afterMoveCheck?.options.initial).toBe('none');
			expect(schema.afterMoveFlagKey?.options.initial).toBe('');
			expect(schema.emptyPoolIdentifier?.options.initial).toBe('');
		});

		it('offers the named checks a card can make at the Stop', () => {
			const schema = GrantActivationRule.defineSchema() as unknown as Record<
				string,
				{ choices?: Record<string, string>; options: Record<string, unknown> }
			>;
			expect(Object.keys(schema.afterMoveCheck?.choices ?? {})).toEqual([
				'none',
				'adjacentToMarked',
				'adjacentEnemies',
				'adjacentToCondition',
			]);
			const shows = (field: string, data: Record<string, unknown>) =>
				(schema[field]?.options.showWhen as (d: object) => boolean)(data);
			expect(shows('afterMoveCheck', { trigger: 'onActivation' })).toBe(false);
			expect(shows('afterMoveCheck', { trigger: 'afterMove' })).toBe(true);
			expect(
				shows('afterMoveFlagKey', { trigger: 'afterMove', afterMoveCheck: 'adjacentToMarked' }),
			).toBe(true);
			expect(
				shows('afterMoveFlagKey', { trigger: 'afterMove', afterMoveCheck: 'adjacentEnemies' }),
			).toBe(false);
			expect(
				shows('afterMoveMinEnemies', { trigger: 'afterMove', afterMoveCheck: 'adjacentEnemies' }),
			).toBe(true);
			expect(
				shows('afterMoveStatus', { trigger: 'afterMove', afterMoveCheck: 'adjacentEnemies' }),
			).toBe(false);
			expect(shows('includesUser', { trigger: 'afterMove' })).toBe(false);
			expect(shows('includesTargets', { trigger: 'afterMove' })).toBe(false);
			expect(schema.chargePoolIdentifier?.options.initial).toBe('');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(GrantActivationRule.group).toBe('resource');
			expect(GrantActivationRule.description).toBe('NIMBLE.rules.grantActivation.description');
		});

		it('declares no lifecycle hooks', () => {
			// A pure offer descriptor must never run during data preparation.
			expect(GrantActivationRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(GrantActivationRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});
});

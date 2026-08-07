import type { NimbleRollData } from '#types/rollData.d.ts';

import getDeterministicBonus from '../../dice/getDeterministicBonus.js';

export interface MovementAdjustment {
	itemName: string;
	value: number;
}

interface AdjustmentRule {
	type: string;
	disabled?: boolean;
	label?: string;
	value?: string;
	speed?: string;
	mode?: string;
	movementType?: string | null;
	test?: () => boolean;
}

interface AdjustmentItem {
	name: string;
	rules?: Iterable<AdjustmentRule> | { values(): Iterable<AdjustmentRule> };
}

type RollData = NimbleRollData;

function ruleValues(item: AdjustmentItem): AdjustmentRule[] {
	const { rules } = item;
	if (!rules) return [];
	if (typeof (rules as { values?: unknown }).values === 'function') {
		return [...(rules as { values(): Iterable<AdjustmentRule> }).values()];
	}
	return [...(rules as Iterable<AdjustmentRule>)];
}

function isActive(rule: AdjustmentRule): boolean {
	if (rule.disabled) return false;
	// A rule whose predicate fails contributes nothing to the actor's speed.
	return !(rule.test && !rule.test());
}

/**
 * The movement type a speedBonus applies to.
 *
 * `movementType` is nullable with a `null` schema initial, so an embedded rule that was never
 * given an explicit type reads as `null` rather than `undefined`. Both mean "generic bonus",
 * which Nimble applies to walk — matching SpeedBonusRule.applySpeedBonus().
 */
function resolveMovementType(rule: AdjustmentRule): string {
	return rule.movementType ?? 'walk';
}

/**
 * Collect speedBonus adjustments from an actor's items, grouped by movement type.
 *
 * Bonuses from the same item and movement type are summed into a single entry. A rule label
 * that says something beyond the item's own name is appended, so a feature contributing for a
 * specific reason reads as "Item — Reason".
 */
export function collectSpeedBonuses(
	items: Iterable<AdjustmentItem>,
	rollData: RollData = {},
): Record<string, MovementAdjustment[]> {
	const bonusesByType: Record<string, MovementAdjustment[]> = {};

	for (const item of items) {
		const itemBonusesByType: Record<string, { value: number; labels: Set<string> }> = {};

		for (const rule of ruleValues(item)) {
			if (rule.type !== 'speedBonus') continue;
			if (!isActive(rule)) continue;

			const value = getDeterministicBonus(rule.value ?? '', rollData) ?? 0;
			if (value === 0) continue;

			const movementType = resolveMovementType(rule);
			itemBonusesByType[movementType] ??= { value: 0, labels: new Set() };
			itemBonusesByType[movementType].value += value;

			// Track the label only when it adds information the item name does not.
			const label = rule.label ?? '';
			if (label && !label.startsWith(item.name)) itemBonusesByType[movementType].labels.add(label);
		}

		for (const [movementType, data] of Object.entries(itemBonusesByType)) {
			if (data.value === 0) continue;

			const labels = [...data.labels];
			bonusesByType[movementType] ??= [];
			bonusesByType[movementType].push({
				itemName: labels.length > 0 ? `${item.name} — ${labels.join(', ')}` : item.name,
				value: data.value,
			});
		}
	}

	return bonusesByType;
}

/**
 * Collect grantMovement speeds from an actor's items, grouped by movement type.
 *
 * Grants set a base rather than stacking, so only the highest grant per movement type is kept.
 */
export function collectMovementGrants(
	items: Iterable<AdjustmentItem>,
	rollData: RollData = {},
): Record<string, MovementAdjustment[]> {
	const grantsByType: Record<string, MovementAdjustment[]> = {};
	const bestByType: Record<string, number> = {};

	for (const item of items) {
		for (const rule of ruleValues(item)) {
			if (rule.type !== 'grantMovement') continue;
			if (!isActive(rule)) continue;

			const value = getDeterministicBonus(rule.speed ?? '', rollData) ?? 0;
			if (value <= 0) continue;

			// `mode` is required and non-nullable, so an embedded rule always carries one. The
			// fallback matches the schema's initial for the plain objects tests build.
			const mode = rule.mode ?? 'fly';
			if (value <= (bestByType[mode] ?? 0)) continue;

			bestByType[mode] = value;
			grantsByType[mode] = [{ itemName: rule.label || item.name, value }];
		}
	}

	return grantsByType;
}

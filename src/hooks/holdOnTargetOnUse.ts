import { systemHookName } from '#system';
import type { HeldChangeKind } from '#types/heldChange.d.ts';
import { createHeldChange } from '#utils/heldChange/heldChange.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface HoldRule {
	type?: string;
	disabled?: boolean;
	heldKind?: HeldChangeKind;
	damageType?: string;
	test?(): boolean;
}

interface UsedItem {
	name?: string;
	rules?: Iterable<unknown> | Map<string, unknown>;
}

interface UseContext {
	isMiss?: boolean;
	targets?: Array<{ actor?: unknown }>;
}

function holdRulesOf(item: UsedItem): HoldRule[] {
	const rules = item.rules;
	if (!rules) return [];
	const list = (rules instanceof Map ? [...rules.values()] : [...rules]) as HoldRule[];
	return list.filter(
		(rule) => rule?.type === 'holdOnTarget' && !rule.disabled && rule.test?.() !== false,
	);
}

/** The client that used the item holds the change. It lasts until spent, or the combat ends. */
export function registerHoldOnTargetHooks(): void {
	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: UsedItem, _card: unknown, context: UseContext) => {
			if (!isRuleAutomationEnabled() || context?.isMiss) return;
			const combat = game.combat;
			if (!combat?.started) return;
			for (const rule of holdRulesOf(item)) {
				for (const target of context.targets ?? []) {
					if (!target.actor) continue;
					await createHeldChange(target.actor as never, {
						kind: rule.heldKind ?? 'mustAttackOther',
						value: 0,
						label: item.name ?? '',
						sourceName: item.name ?? '',
						appliesTo: rule.heldKind === 'vulnerableOnce' ? 'attacksOnHolder' : 'holderAttacks',
						spentBy: 'oneRoll',
						ends: 'combat',
						combatId: combat.id ?? '',
						round: combat.round ?? 0,
						turn: combat.turn ?? 0,
						...(rule.damageType ? { damageType: rule.damageType } : {}),
					});
				}
			}
		}) as never,
	);
}

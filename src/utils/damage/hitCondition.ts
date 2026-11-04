import { SYSTEM_ID } from '#system';
import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { actorRules } from '../actor/actorRules.js';
import applyConditionToActor, {
	type ConditionTargetActor,
} from '../actor/applyConditionToActor.js';

const HELD_CREATURE_FLAG = 'heldCreature';

interface HitConditionRule {
	type?: string;
	disabled?: boolean;
	test?(): boolean;
	item?: { id?: string | null } | null;
	condition?: string;
	when?: 'hit' | 'crit';
	recipient?: 'target' | 'self';
}

type Creature = ConditionTargetActor & {
	uuid?: string | null;
	name?: string | null;
	rules?: unknown;
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
	applyDamage?(amount: number): Promise<unknown>;
};

export interface HeldCreature {
	uuid: string;
	name: string;
}

/**
 * Applies the conditions of the attack's item when its damage is applied.
 * A condition on the attacker also stores the creature that was hit: the table
 * can apply the condition by hand with Feature Effects off.
 */
export async function applyHitConditions(input: {
	attacker: Creature | null;
	item: { id?: string | null; uuid?: string } | null;
	hurt: Creature[];
	isCritical: boolean;
	isMiss: boolean;
}): Promise<void> {
	const { attacker, item, hurt, isCritical, isMiss } = input;
	if (!attacker || !item || isMiss || hurt.length === 0) return;
	const automatic = isRuleAutomationEnabled();
	const context = { sourceItem: item, sourceActor: attacker };

	for (const rule of actorRules<HitConditionRule>(attacker)) {
		if (rule?.type !== 'hitCondition' || rule.disabled || !rule.condition) continue;
		if (rule.item?.id !== item.id || rule.test?.() === false) continue;
		if (rule.when === 'crit' && !isCritical) continue;

		if (rule.recipient === 'self') {
			const held = hurt[0];
			await attacker.setFlag?.(SYSTEM_ID, HELD_CREATURE_FLAG, {
				uuid: held?.uuid ?? '',
				name: held?.name ?? '',
			});
			if (automatic) await applyConditionToActor(attacker, rule.condition, context);
			continue;
		}
		if (!automatic) continue;
		for (const creature of hurt) await applyConditionToActor(creature, rule.condition, context);
	}
}

/** The creature a Latched creature holds, read from the card's target. */
export function latchedCreatureOf(target: Creature | null | undefined): HeldCreature | null {
	if (!target?.statuses?.has(STATUS_EFFECT_IDS.latched)) return null;
	const held = target.getFlag?.(SYSTEM_ID, HELD_CREATURE_FLAG) as HeldCreature | undefined;
	return held?.uuid ? held : null;
}

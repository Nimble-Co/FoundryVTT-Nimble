import type { UseOptionGroup } from '#types/useOption.d.ts';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import { useOptionGroups } from './useOptionGroups.js';

type OptionWeapon = Parameters<UseOptionRule['appliesToWeapon']>[0];

/** The Spell or Attack Options the attacker can turn on for this weapon, grouped as for a spell. */
export function weaponUseOptionGroups(
	actor: Actor | null | undefined,
	weapon: OptionWeapon,
): UseOptionGroup[] {
	return useOptionGroups(actor, (rule) => rule.appliesToWeapon(weapon));
}

import type { AbilityKeyType } from './abilityKey.d.ts';
import type { SaveKeyType } from './saveKey.d.ts';
import type { SkillKeyType } from './skillKey.d.ts';

type NimbleRollDataPrimitive = string | number | boolean | null | undefined;

/**
 * A nested plain-object roll data structure suitable for resolving `@path.to.value`
 * references in Foundry roll formulas.
 *
 * Note: This is intentionally "open" because `super.getRollData()` and modules
 * can contribute additional keys.
 */
export interface NimbleRollData {
	[key: string]: NimbleRollDataPrimitive | NimbleRollData;
}

/**
 * Nimble-specific "shortcut" keys that we intentionally inject into rollData
 * for ergonomics in roll formulas.
 */
export type NimbleRollDataShortcuts = {
	level?: number | undefined;
	key?: number | undefined;
} & Partial<Record<AbilityKeyType | SkillKeyType | `${SaveKeyType}Save`, number>>;

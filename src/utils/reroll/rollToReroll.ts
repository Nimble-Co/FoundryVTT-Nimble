import type { AttackDelivery } from '../damage/attackDelivery.js';

/** The kinds of roll a `reroll` rule can reroll. */
const REROLL_ROLL_KINDS = ['attack', 'save', 'skillCheck', 'abilityCheck'] as const;
type RerollRollKind = (typeof REROLL_ROLL_KINDS)[number];
type CheckRollKind = Exclude<RerollRollKind, 'attack'>;

/**
 * The roll a reroll replaces: an attack, how it is delivered and the item it
 * is made with, or a check and its save, skill or ability key.
 */
type RollToReroll =
	| { kind: 'attack'; delivery: AttackDelivery; itemUuid?: string | null }
	| { kind: CheckRollKind; key: string };

export { REROLL_ROLL_KINDS, type CheckRollKind, type RerollRollKind, type RollToReroll };

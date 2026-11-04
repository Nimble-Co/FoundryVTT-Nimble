import type { AttackDelivery } from '../damage/attackDelivery.js';

/** The kinds of roll a `reroll` rule can reroll. */
const REROLL_ROLL_KINDS = ['attack', 'save', 'skillCheck', 'abilityCheck'] as const;
type RerollRollKind = (typeof REROLL_ROLL_KINDS)[number];
/** Every kind of roll a rule can be used on. Initiative takes only a change of its result. */
type RollUseKind = RerollRollKind | 'initiative';
type CheckRollKind = Exclude<RollUseKind, 'attack'>;

/**
 * The roll a reroll replaces: an attack, how it is delivered and the item it
 * is made with, or a check and its save, skill or ability key.
 */
type RollToReroll =
	| {
			kind: 'attack';
			delivery: AttackDelivery;
			itemUuid?: string | null;
			damageTypes?: readonly string[];
			/** The stats the attack's formula has. */
			stats?: readonly string[];
			/** The identifier of the item whose offer row made this attack. */
			offerSource?: string;
			/** The upcast steps of the spell. */
			upcastSteps?: number;
	  }
	| { kind: CheckRollKind; key: string };

export {
	REROLL_ROLL_KINDS,
	type CheckRollKind,
	type RerollRollKind,
	type RollToReroll,
	type RollUseKind,
};

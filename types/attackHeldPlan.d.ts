import type { DamageRoll } from '../src/dice/DamageRoll.ts';
import type { HeldChange } from './heldChange.d.ts';

/** What one attack uses of its Held Changes, and what it spends. */
export interface AttackHeldPlan {
	/** The Primary Die changes the roll adds. Empty when the roll keeps an amount. */
	primaryDie: HeldChange[];
	primaryDieBonus: number;
	ignoreDisadvantage: HeldChange | null;
	mustAttackOther: HeldChange | null;
	/** The Primary Die lines of the card. */
	bonusLines(): { label: string; value: number; itemUuid: string }[];
	/** Take disadvantage out and name who the attack must be against. */
	applyToRoll(options: DamageRoll.Options & { rollModeSources?: number[] }): void;
	/** The same plan for a roll that has no Primary Die to add to. */
	withoutPrimaryDie(): AttackHeldPlan;
	/** Remove what the attack spent. */
	spend(): Promise<void>;
}

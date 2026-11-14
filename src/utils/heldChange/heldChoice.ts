import type { HeldChange } from '#types/heldChange.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { heldChangeKey, keptAmountEndedBy, keptAmountFor } from './heldChange.js';

type Attacker = Parameters<typeof keptAmountFor>[0];
type ActivatedItem = Parameters<typeof keptAmountFor>[1];

/**
 * The keys (`heldChangeKey`) of the Held Changes the player ticked. Null with Feature Effects on,
 * when every change that fits applies. A roll with no window ticks none.
 */
export function heldChosenOf(ticked: readonly string[] = []): ReadonlySet<string> | null {
	return isRuleAutomationEnabled() ? null : new Set(ticked);
}

/**
 * The kept amount a roll uses, and the one it ends. With Feature Effects on (`chosen` null), an
 * unticked kept amount (`tick` false) is not used but still ends, as an area attack ends one. With
 * Feature Effects off, only a ticked kept amount applies or ends.
 */
export function keptAmountOfRoll(
	attacker: Attacker,
	item: ActivatedItem,
	{ tick, chosen }: { tick?: boolean; chosen: ReadonlySet<string> | null },
): { kept: HeldChange | null; toEnd: HeldChange | null } {
	const usable = keptAmountFor(attacker, item);
	const ended = keptAmountEndedBy(attacker, item);
	if (!chosen) {
		return { kept: tick === false ? null : usable, toEnd: usable ?? ended };
	}
	const kept = tick === true ? usable : null;
	return { kept, toEnd: kept ?? (ended && chosen.has(heldChangeKey(ended)) ? ended : null) };
}

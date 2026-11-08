import type { NimbleRoll } from '../../dice/NimbleRoll.js';
import type { ConditionRollMode } from './conditionRollModes.js';

/** Roll options that keep the conditions a roll used, for its card. None when it used none. */
export function conditionRollOptions(
	lines: readonly ConditionRollMode[] | undefined,
): NimbleRoll.Options | undefined {
	return lines?.length ? { conditionRollModes: [...lines] } : undefined;
}

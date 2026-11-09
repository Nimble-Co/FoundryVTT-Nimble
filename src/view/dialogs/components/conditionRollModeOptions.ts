import type { SituationalRollModeListOption } from '#types/components/SituationalRollModeList.d.ts';
import type { ConditionRollMode } from '#types/conditionRollMode.d.ts';
import { conditionRollModeLabel } from '#utils/rolls/conditionRollModeText.js';

/** The condition lines as ticks of the Situational Modifiers list. */
function conditionRollModeOptions(
	lines: readonly ConditionRollMode[],
): SituationalRollModeListOption[] {
	const images = (CONFIG.NIMBLE?.conditionDefaultImages ?? {}) as Record<string, string>;
	return lines.map((line) => ({
		key: line.key,
		label: conditionRollModeLabel(line),
		icon: images[line.condition] ?? '',
		value: line.step,
		on: line.on,
	}));
}

export { conditionRollModeOptions };

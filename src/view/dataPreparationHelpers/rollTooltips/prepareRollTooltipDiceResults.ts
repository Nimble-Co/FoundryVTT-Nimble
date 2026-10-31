import { critFaceOf } from '../../../dice/critFace.js';
import { PrimaryDie } from '../../../dice/terms/PrimaryDie.js';
import { DEFAULT_MISS_THRESHOLD } from '../../../utils/damage/missThreshold.js';

export default function prepareRollTooltipDiceResults(
	part,
	rollOptions: { canCrit?: boolean; canMiss?: boolean } = {},
) {
	const { faces, flavor, options, results } = part;
	const isPrimaryDie = part instanceof PrimaryDie || flavor === 'Primary Die';
	const missThreshold = options?.missThreshold ?? DEFAULT_MISS_THRESHOLD;
	const canCrit = rollOptions?.canCrit !== false;
	const canMiss = rollOptions?.canMiss !== false;
	let keptFaceFound = false;

	return results.reduce((acc, { rerolled, discarded, result }) => {
		const isDiscarded = discarded || rerolled;
		// Only the kept face reads the crit face. A crit die crits on its max.
		const critFace = !isDiscarded && !keptFaceFound ? critFaceOf(faces, options) : faces;
		if (!isDiscarded) keptFaceFound = true;
		const isCritical = result >= critFace;
		const isMiss = result <= missThreshold && !isCritical;

		let classes = `nimble-die nimble-die--${faces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isPrimaryDie && isMiss && canMiss) classes += ' nimble-die--min';
		else if (isPrimaryDie && isCritical && canCrit) classes += ' nimble-die--max';

		return `${acc}<li class="${classes}">${result}</li>`;
	}, '');
}

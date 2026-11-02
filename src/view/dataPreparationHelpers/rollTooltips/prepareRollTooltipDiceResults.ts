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

	return results.reduce((acc, { rerolled, discarded, result, faces: ownFaces }) => {
		const isDiscarded = discarded || rerolled;
		const dieFaces = ownFaces ?? faces;
		// Only the kept face reads the crit face. A crit die crits on its max.
		const critFace = !isDiscarded && !keptFaceFound ? critFaceOf(faces, options) : dieFaces;
		if (!isDiscarded) keptFaceFound = true;
		const isCritical = result >= critFace;
		const isMiss = result <= missThreshold && !isCritical && !ownFaces;

		let classes = `nimble-die nimble-die--${dieFaces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isPrimaryDie && isMiss && canMiss) classes += ' nimble-die--min';
		else if (isPrimaryDie && isCritical && canCrit) classes += ' nimble-die--max';

		const size = ownFaces ? ` data-die-size="d${ownFaces}"` : '';
		return `${acc}<li class="${classes}"${size}>${result}</li>`;
	}, '');
}

import { critFaceOf } from '../../../dice/critFace.js';
import { PrimaryDie } from '../../../dice/terms/PrimaryDie.js';
import { DEFAULT_MISS_THRESHOLD } from '../../../utils/damage/missThreshold.js';

export function isViciousBonus(result: { provenance?: string } | undefined): boolean {
	return result?.provenance === 'viciousBonus';
}

function dieItem(
	{ rerolled, discarded, result, faces: ownFaces },
	termFaces: number,
	mark = '',
): string {
	const dieFaces = ownFaces ?? termFaces;
	let classes = `nimble-die nimble-die--${dieFaces}`;
	if (discarded || rerolled) classes += ' nimble-die--discarded';
	else classes += mark;
	const size = ownFaces ? ` data-die-size="d${ownFaces}"` : '';
	return `<li class="${classes}"${size}>${result}</li>`;
}

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

	return results.reduce((acc, die) => {
		if (isViciousBonus(die)) return acc;
		const { rerolled, discarded, result, faces: ownFaces } = die;
		const isDiscarded = discarded || rerolled;
		const dieFaces = ownFaces ?? faces;
		// Only the kept face reads the crit face. A crit die crits on its max.
		const critFace = !isDiscarded && !keptFaceFound ? critFaceOf(faces, options) : dieFaces;
		if (!isDiscarded) keptFaceFound = true;
		const isCritical = result >= critFace;
		const isMiss = result <= missThreshold && !isCritical && !ownFaces;

		let mark = '';
		if (isPrimaryDie && isMiss && canMiss) mark = ' nimble-die--min';
		else if (isPrimaryDie && isCritical && canCrit) mark = ' nimble-die--max';

		return acc + dieItem(die, faces, mark);
	}, '');
}

/** The Vicious dice of a term. Only the Primary Die can crit, so they get no crit or miss mark. */
export function prepareRollTooltipViciousDiceResults(part): string {
	return part.results
		.filter(isViciousBonus)
		.map((die) => dieItem(die, part.faces))
		.join('');
}

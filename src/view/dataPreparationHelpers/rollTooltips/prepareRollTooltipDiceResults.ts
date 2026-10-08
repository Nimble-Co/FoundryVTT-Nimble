import { DEFAULT_MISS_THRESHOLD } from '../../../utils/missThreshold.js';

export default function prepareRollTooltipDiceResults({ faces, flavor, options, results }) {
	const isPrimaryDie = flavor === 'Primary Die';
	const missThreshold = options?.missThreshold ?? DEFAULT_MISS_THRESHOLD;

	return results.reduce((acc, { rerolled, discarded, result }) => {
		const isCritical = (faces === 20 && result === 20) || result === faces;

		const isDiscarded = discarded || rerolled;
		const isMiss = result <= missThreshold && !isCritical;

		let classes = `nimble-die nimble-die--${faces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isPrimaryDie && isMiss) classes += ' nimble-die--min';
		else if (isPrimaryDie && isCritical) classes += ' nimble-die--max';

		return `${acc}<li class="${classes}">${result}</li>`;
	}, '');
}

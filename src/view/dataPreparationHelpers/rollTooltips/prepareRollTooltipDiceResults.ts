export default function prepareRollTooltipDiceResults({ faces, results, options }) {
	const isHitMissDie = options?.flavor === 'Primary Die';

	return results.reduce((acc, { rerolled, discarded, result }) => {
		const isCritical = (faces === 20 && result === 20) || result === faces;

		const isDiscarded = discarded || rerolled;
		const isFumble = isHitMissDie && result === 1;

		let classes = `nimble-die nimble-die--${faces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isFumble) classes += ' nimble-die--min';
		else if (isCritical) classes += ' nimble-die--max';

		return `${acc}<li class="${classes}">${result}</li>`;
	}, '');
}

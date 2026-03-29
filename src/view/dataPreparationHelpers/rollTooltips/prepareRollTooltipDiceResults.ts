export default function prepareRollTooltipDiceResults({ faces, flavor, results }) {
	const isPrimaryDie = flavor === 'Primary Die';

	return results.reduce((acc, { rerolled, discarded, result }) => {
		const isCritical = (faces === 20 && result === 20) || result === faces;

		const isDiscarded = discarded || rerolled;
		const isFumble = result === 1;

		let classes = `nimble-die nimble-die--${faces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isPrimaryDie && isFumble) classes += ' nimble-die--min';
		else if (isPrimaryDie && isCritical) classes += ' nimble-die--max';

		return `${acc}<li class="${classes}">${result}</li>`;
	}, '');
}

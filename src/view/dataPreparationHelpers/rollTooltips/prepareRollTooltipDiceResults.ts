export default function prepareRollTooltipDiceResults({ faces, results, showFumble = false }) {
	return results.reduce((acc, { rerolled, discarded, result }) => {
		const isCritical = (faces === 20 && result === 20) || result === faces;

		const isDiscarded = discarded || rerolled;
		const isFumble = showFumble && result === 1;

		let classes = `nimble-die nimble-die--${faces}`;
		let inlineStyle = '';

		if (isDiscarded) {
			classes += ' nimble-die--discarded';
		} else if (isFumble) {
			classes += ' nimble-die--min';
		} else if (isCritical) {
			classes += ' nimble-die--max';
		} else if (!showFumble && faces > 1) {
			// Gradient coloring for explosion/damage dice: grey (low) to green (high)
			// Calculate percentage from min (1) to max (faces)
			const percentage = (result - 1) / (faces - 1);
			// hue-rotate: 0deg = grey, 60deg = green (matching --max class)
			const hueRotate = Math.round(percentage * 60);
			// sepia creates the base color, hue-rotate shifts it toward green
			const sepia = 0.5 * percentage;
			inlineStyle = ` style="filter: sepia(${sepia.toFixed(2)}) hue-rotate(${hueRotate}deg);"`;
		}

		return `${acc}<li class="${classes}"${inlineStyle}>${result}</li>`;
	}, '');
}

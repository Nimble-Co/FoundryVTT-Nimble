interface DieResult {
	result: number;
	rerolled?: boolean;
	discarded?: boolean;
	exploded?: boolean;
}

interface DicePart {
	faces: number;
	results: DieResult[];
}

export default function prepareRollTooltipDiceResults({ faces, results }: DicePart): string {
	// If any die exploded (crit), subsequent 1s are not fumbles
	// Only the initial roll can fumble - explosion dice cannot miss
	const hasExploded = results.some((r) => r.exploded);

	return results.reduce((acc, { rerolled, discarded, result, exploded }) => {
		const isCritical = (faces === 20 && result === 20) || result === faces;
		const isDiscarded = discarded || rerolled;

		// A fumble only occurs if:
		// 1. The result is 1
		// 2. No explosion happened (if any die exploded, the roll is a crit and can't fumble)
		// 3. This specific die didn't explode (edge case: rolled 1 then somehow exploded)
		const isFumble = result === 1 && !hasExploded && !exploded;

		let classes = `nimble-die nimble-die--${faces}`;

		if (isDiscarded) classes += ' nimble-die--discarded';
		else if (isFumble) classes += ' nimble-die--min';
		else if (isCritical) classes += ' nimble-die--max';

		return `${acc}<li class="${classes}">${result}</li>`;
	}, '');
}

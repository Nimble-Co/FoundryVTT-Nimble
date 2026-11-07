import localize from '../../../utils/localize.js';
import prepareRollTooltipDiceResults, {
	isViciousBonus,
	prepareRollTooltipViciousDiceResults,
} from './prepareRollTooltipDiceResults.js';

function rollDetailsSection(formula: string, flavor: string, total, dice: string): string {
	let section = `<section class="nimble-roll-details">
          <header class="nimble-roll-details__header">
              <div class="nimble-roll-details__formula">
                  ${formula}
                  <span class="nimble-roll-details__flavor">`;

	if (flavor) section += ` [${flavor}]`;

	section += `</span></div>
              <span class="nimble-roll-details__total">${total}</span>
          </header>

      <ol class="nimble-roll-details__dice-list">`;

	section += dice;
	section += '</ol></section>';

	return section;
}

export default function prepareRollTooltipRollParts(roll) {
	return roll.dice.reduce((acc, part) => {
		const vicious = (part.results ?? []).filter(isViciousBonus);
		const viciousTotal = vicious.reduce(
			(sum, die) => (die.active !== false && !die.discarded ? sum + die.result : sum),
			0,
		);
		const total =
			vicious.length > 0 && typeof part.total === 'number' ? part.total - viciousTotal : part.total;

		let parts =
			acc +
			rollDetailsSection(
				part.expression,
				part.flavor,
				total,
				prepareRollTooltipDiceResults(part, roll.options),
			);

		if (vicious.length > 0) {
			parts += rollDetailsSection(
				`${vicious.length}d${part.faces}`,
				localize('NIMBLE.properties.vicious'),
				viciousTotal,
				prepareRollTooltipViciousDiceResults(part),
			);
		}

		return parts;
	}, '');
}

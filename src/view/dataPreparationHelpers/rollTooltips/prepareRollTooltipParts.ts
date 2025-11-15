import prepareRollTooltipDiceResults from './prepareRollTooltipDiceResults';

export default function prepareRollTooltipRollParts(roll) {
	return roll.dice.reduce((acc, part) => {
		let newPart = `<section class="nimble-roll-details">
          <header class="nimble-roll-details__header">
              <div class="nimble-roll-details__formula">
                  ${part.expression}
                  <span class="nimble-roll-details__flavor">`;

		if (part.flavor) newPart += ` [${part.flavor}]`;

		newPart += `</span></div>
              <span class="nimble-roll-details__total">${part.total}</span>
          </header>

      <ol class="nimble-roll-details__dice-list">`;

		newPart += prepareRollTooltipDiceResults(part);
		newPart += '</ol></section>';

		return acc + newPart;
	}, '');
}

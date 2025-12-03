import createEnricherButton from './createEnricherButton.js';
import localize from '../utils/localize.js';

export default function enrichCondition(
	args: Record<string, string>,
	_options?: foundry.applications.ux.TextEditor.EnrichmentOptions,
) {
	const { conditions, conditionDescriptions } = CONFIG.NIMBLE;
	const { enricherType, condition: conditionKey } = args;
	const condition = localize(conditions[conditionKey]);
	const icon = 'fa-solid fa-biohazard';
	const label = condition;

	const tooltipHeader = `
    <header class="nimble-tooltip__enricher-header">
      <h3 class="nimble-tooltip__enricher-heading">${condition}</h3>
      <span class="nimble-tooltip__tag">Condition</span>
    </header>
  `;

	const tooltipFooter =
		'<footer><small>Left click to apply this condition to all selected tokens.</small></footer>';

	const tooltip = [
		tooltipHeader,
		localize(conditionDescriptions[conditionKey]),
		tooltipFooter,
	].join('');

	return createEnricherButton(enricherType, { icon, label, tooltip });
}

import localize from '../utils/localize.js';
import createEnricherButton from './createEnricherButton.js';

export default function enrichCondition(
	args: Record<string, string>,
	_options?: foundry.applications.ux.TextEditor.EnrichmentOptions,
) {
	const { conditions, conditionDescriptions } = CONFIG.NIMBLE;
	const { enricherType, condition: conditionKey } = args;
	// Names can be free-form GM text, and both the button label and the header are built as HTML
	// strings. Descriptions are already HTML by the time they reach CONFIG, so they stay raw.
	const condition = foundry.utils.escapeHTML(localize(conditions[conditionKey]));
	const icon = 'fa-solid fa-biohazard';
	const label = condition;

	const tooltipHeader = `
    <header class="nimble-tooltip__enricher-header">
      <h3 class="nimble-tooltip__enricher-heading">${condition}</h3>
      <span class="nimble-tooltip__tag">Condition</span>
    </header>
  `;

	const tooltip = [tooltipHeader, localize(conditionDescriptions[conditionKey])].join('');

	return createEnricherButton(enricherType, { icon, label, tooltip });
}

<script>
	import { getContext } from 'svelte';

	let { node } = $props();

	let messageDocument = getContext('messageDocument');

	function getConditionTooltip(condition) {
		const label = conditions[condition];
		const description = conditionDescriptions[condition];

		const tooltipHeader = `
        <header class="nimble-tooltip__enricher-header">
          <h3 class="nimble-tooltip__enricher-heading">${label}</h3>
          <span class="nimble-tooltip__tag">Condition</span>
        </header>
   `;

		const tooltipFooter =
			'<footer><small>Left click to apply this condition to all targets.</small></footer>';

		return [tooltipHeader, description, tooltipFooter].join('');
	}

	const { conditions, conditionDescriptions } = CONFIG.NIMBLE;

	let tooltip = $derived(getConditionTooltip(node.condition));

	async function applyCondition() {
		const condition = node.condition;

		if (messageDocument) {
			await messageDocument.applyCondition(condition);
			return;
		}

		// Fallback: apply to controlled tokens if no message context
		const targets = canvas.tokens.controlled;
		targets.forEach((token) => {
			if (!token.actor.statuses.has(condition)) {
				token.actor.toggleStatusEffect(condition);
			}
		});
	}
</script>

<button
	class="nimble-button"
	data-button-variant="enricher"
	data-enricher-type="condition"
	type="button"
	aria-label="Apply condition to selected targets"
	data-tooltip={tooltip}
	data-tooltip-class="nimble-tooltip nimble-tooltip--rules"
	data-tooltip-position="UP"
	onclick={applyCondition}
>
	<i class="nimble-button__icon fa-solid fa-biohazard"></i>

	{conditions[node.condition]}
</button>

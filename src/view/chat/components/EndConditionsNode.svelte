<script lang="ts">
	import type { EndConditionsNodeProps } from '#types/components/EndConditionsNode.d.ts';
	import EffectStepRow from './EffectStepRow.svelte';
	import { createCardStep } from './cardStep.svelte.ts';
	import { endConditionsFromCard, endedConditions } from '#utils/chat/endConditionsFromCard.ts';
	import localize from '#utils/localize.ts';
	import { endConditionsRow } from './endConditionsRow.ts';

	let { node }: EndConditionsNodeProps = $props();

	const step = createCardStep((card) => endConditionsFromCard(card, node));

	const row = $derived.by(() => {
		const context = step.rowContext(node.recipient);
		if (!context) return null;
		return endConditionsRow({
			node,
			ended: endedConditions(context.card, node.id),
			conditionNames: CONFIG.NIMBLE.conditions as Record<string, string>,
			canApply: context.canApply,
			hasRecipient: context.hasRecipient,
			localize,
			format: localize,
		});
	});
</script>

{#if row}
	<EffectStepRow
		img="icons/svg/cancel.svg"
		name={row.name}
		appliedLines={row.appliedLines}
		notes={row.notes}
		button={row.button}
		busy={step.busy}
		onApply={step.apply}
	/>
{/if}

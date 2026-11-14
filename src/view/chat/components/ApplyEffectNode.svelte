<script lang="ts">
	import type { ApplyEffectNodeProps } from '#types/components/ApplyEffectNode.d.ts';
	import EffectStepRow from './EffectStepRow.svelte';
	import { createCardStep } from './cardStep.svelte.ts';
	import {
		appliedEffects,
		applyEffectFromCard,
		applyEffectSource,
	} from '#utils/chat/applyEffectFromCard.ts';
	import localize from '#utils/localize.ts';
	import { isRuleAutomationEnabled } from '../../../settings/automationSettings.ts';
	import { applyEffectRow } from './applyEffectRow.ts';

	let { node }: ApplyEffectNodeProps = $props();

	const step = createCardStep((card) => applyEffectFromCard(card, node));

	const row = $derived.by(() => {
		const context = step.rowContext(node.recipient);
		if (!context) return null;
		return applyEffectRow({
			node,
			source: applyEffectSource(context.card, node),
			applied: appliedEffects(context.card, node.id),
			saversApplyThemselves: isRuleAutomationEnabled(),
			canApply: context.canApply,
			hasRecipient: context.hasRecipient,
			localize,
			format: localize,
		});
	});
</script>

{#if row}
	<EffectStepRow
		img={row.img}
		name={row.name}
		lasts={row.lasts}
		appliedLines={row.appliedLines}
		notes={row.note ? [row.note] : []}
		button={row.button}
		busy={step.busy}
		onApply={step.apply}
	/>
{/if}

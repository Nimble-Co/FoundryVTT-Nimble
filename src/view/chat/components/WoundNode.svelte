<script lang="ts">
	import type { WoundNodeProps } from '#types/components/WoundNode.d.ts';
	import EffectStepRow from './EffectStepRow.svelte';
	import { createCardStep } from './cardStep.svelte.ts';
	import { SYSTEM_PATH } from '#system';
	import { appliedWounds, giveWoundsFromCard } from '#utils/chat/woundFromCard.ts';
	import localize from '#utils/localize.ts';
	import { woundRow } from './woundRow.ts';

	let { node }: WoundNodeProps = $props();

	const step = createCardStep((card) => giveWoundsFromCard(card, node));

	const row = $derived.by(() => {
		const context = step.rowContext(node.recipient);
		if (!context) return null;
		return woundRow({
			node,
			applied: appliedWounds(context.card, node.id),
			canApply: context.canApply,
			hasRecipient: context.hasRecipient,
			localize,
			format: localize,
		});
	});
</script>

{#if row}
	<EffectStepRow
		img={`${SYSTEM_PATH}/assets/icons/wound.svg`}
		name={row.name}
		appliedLines={row.appliedLines}
		notes={row.noTrackLines}
		button={row.button}
		busy={step.busy}
		onApply={step.apply}
	/>
{/if}

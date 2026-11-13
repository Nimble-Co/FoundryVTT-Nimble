<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { EndConditionsNodeProps } from '#types/components/EndConditionsNode.d.ts';
	import { getContext } from 'svelte';
	import EffectStepRow from './EffectStepRow.svelte';
	import { cardTargets, cardUser } from '#utils/chat/applyEffectFromCard.ts';
	import { endConditionsFromCard, endedConditions } from '#utils/chat/endConditionsFromCard.ts';
	import localize from '#utils/localize.ts';
	import { endConditionsRow } from './endConditionsRow.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	let { node }: EndConditionsNodeProps = $props();

	let busy = $state(false);

	const row = $derived.by(() => {
		const card = messageDocument?.reactive;
		if (!card) return null;
		return endConditionsRow({
			node,
			ended: endedConditions(card, node.id),
			conditionNames: CONFIG.NIMBLE.conditions as Record<string, string>,
			canApply: !!game.user?.isGM || card.author?.id === game.user?.id,
			hasRecipient: node.recipient === 'self' ? !!cardUser(card) : cardTargets(card).length > 0,
			localize,
			format: localize,
		});
	});

	async function apply() {
		if (!messageDocument || busy) return;
		busy = true;
		try {
			await endConditionsFromCard(messageDocument, node);
		} finally {
			busy = false;
		}
	}
</script>

{#if row}
	<EffectStepRow
		img="icons/svg/cancel.svg"
		name={row.name}
		appliedLines={row.appliedLines}
		notes={row.notes}
		button={row.button}
		{busy}
		onApply={apply}
	/>
{/if}

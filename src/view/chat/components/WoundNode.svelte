<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { WoundNodeProps } from '#types/components/WoundNode.d.ts';
	import { getContext } from 'svelte';
	import EffectStepRow from './EffectStepRow.svelte';
	import { SYSTEM_PATH } from '#system';
	import { cardTargets, cardUser } from '#utils/chat/applyEffectFromCard.ts';
	import { appliedWounds, giveWoundsFromCard } from '#utils/chat/woundFromCard.ts';
	import localize from '#utils/localize.ts';
	import { woundRow } from './woundRow.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	let { node }: WoundNodeProps = $props();

	let busy = $state(false);

	const row = $derived.by(() => {
		const card = messageDocument?.reactive;
		if (!card) return null;
		return woundRow({
			node,
			applied: appliedWounds(card, node.id),
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
			await giveWoundsFromCard(messageDocument, node);
		} finally {
			busy = false;
		}
	}
</script>

{#if row}
	<EffectStepRow
		img={`${SYSTEM_PATH}/assets/icons/wound.svg`}
		name={row.name}
		appliedLines={row.appliedLines}
		notes={row.noTrackLines}
		button={row.button}
		{busy}
		onApply={apply}
	/>
{/if}

<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { ApplyEffectNodeProps } from '#types/components/ApplyEffectNode.d.ts';
	import { getContext } from 'svelte';
	import EffectStepRow from './EffectStepRow.svelte';
	import {
		appliedEffects,
		applyEffectFromCard,
		applyEffectSource,
		cardTargets,
		cardUser,
	} from '#utils/chat/applyEffectFromCard.ts';
	import localize from '#utils/localize.ts';
	import { isRuleAutomationEnabled } from '../../../settings/automationSettings.ts';
	import { applyEffectRow } from './applyEffectRow.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	let { node }: ApplyEffectNodeProps = $props();

	let busy = $state(false);

	const row = $derived.by(() => {
		const card = messageDocument?.reactive;
		if (!card) return null;
		return applyEffectRow({
			node,
			source: applyEffectSource(card, node),
			applied: appliedEffects(card, node.id),
			canApply: !!game.user?.isGM || card.author?.id === game.user?.id,
			saversApplyThemselves: isRuleAutomationEnabled(),
			hasRecipient: node.recipient === 'self' ? !!cardUser(card) : cardTargets(card).length > 0,
			localize,
			format: localize,
		});
	});

	async function apply() {
		if (!messageDocument || busy) return;
		busy = true;
		try {
			await applyEffectFromCard(messageDocument, node);
		} finally {
			busy = false;
		}
	}
</script>

{#if row}
	<EffectStepRow
		img={row.img}
		name={row.name}
		lasts={row.lasts}
		appliedLines={row.appliedLines}
		notes={row.note ? [row.note] : []}
		button={row.button}
		{busy}
		onApply={apply}
	/>
{/if}

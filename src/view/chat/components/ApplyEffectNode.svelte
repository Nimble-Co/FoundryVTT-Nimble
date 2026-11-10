<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { ApplyEffectNodeProps } from '#types/components/ApplyEffectNode.d.ts';
	import { getContext } from 'svelte';
	import {
		appliedEffects,
		applyEffectFromCard,
		applyEffectSource,
		cardTargets,
		cardUser,
	} from '#utils/chat/applyEffectFromCard.ts';
	import localize from '#utils/localize.ts';
	import { applyEffectRow } from './applyEffectRow.ts';

	let { node }: ApplyEffectNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	let busy = $state(false);

	const row = $derived.by(() => {
		const card = messageDocument?.reactive;
		if (!card) return null;
		return applyEffectRow({
			node,
			source: applyEffectSource(card, node),
			applied: appliedEffects(card, node.id),
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
			await applyEffectFromCard(messageDocument, node);
		} finally {
			busy = false;
		}
	}
</script>

{#if row}
	<div class="nimble-apply-effect">
		<img class="nimble-apply-effect__img" src={row.img} alt="" />

		<div class="nimble-apply-effect__text">
			<span class="nimble-apply-effect__name">{row.name}</span>

			{#if row.lasts}
				<span class="nimble-apply-effect__lasts">
					<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
					<span>{row.lasts}</span>
				</span>
			{/if}
		</div>

		{#if row.appliedLine}
			<span class="nimble-apply-effect__applied">
				<i class="fa-solid fa-check" aria-hidden="true"></i>
				{row.appliedLine}
			</span>
		{:else if row.button}
			<button
				class="nimble-button nimble-apply-effect__button"
				type="button"
				disabled={row.button.disabled || busy}
				data-tooltip={row.button.tooltip}
				onclick={apply}
			>
				<i class="nimble-button__icon fa-solid fa-crosshairs" aria-hidden="true"></i>
				{row.button.label}
			</button>
		{:else if row.note}
			<span class="nimble-apply-effect__note">{row.note}</span>
		{/if}
	</div>
{/if}

<style lang="scss">
	.nimble-apply-effect {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;

		&__img {
			flex: 0 0 auto;
			width: 2rem;
			height: 2rem;
			border: 0;
			border-radius: 4px;
			object-fit: cover;
		}

		&__text {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			line-height: 1.2;
			overflow-wrap: anywhere;
		}

		&__lasts {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
			color: var(--nimble-medium-text-color);

			i {
				flex: 0 0 auto;
				margin-block-start: 0.125rem;
			}
		}

		&__button {
			display: flex;
			flex: 0 0 auto;
			align-items: center;
			gap: 0.375rem;
			min-height: 1.5rem;
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-sm-text);
			white-space: nowrap;
		}

		&__applied,
		&__note {
			flex: 0 1 auto;
			max-width: 50%;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			overflow-wrap: anywhere;
		}

		&__applied {
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__note {
			color: var(--nimble-medium-text-color);
		}
	}
</style>

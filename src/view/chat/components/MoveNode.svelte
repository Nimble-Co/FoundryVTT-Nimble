<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';
	import { isTargetsSectionShown } from '../targetsSection.ts';
	import MovementStatusChip from './MovementStatusChip.svelte';
	import { moveNodeText } from './moveNodeText.ts';

	let { node }: MoveNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	// Not reactive: Foundry mounts a new card on each message update.
	const tracking = isMovementOffersAutomationEnabled();
	const targetsShown = isTargetsSectionShown();
	const targetUuids = new Set(
		((messageDocument?.system ?? {}) as { targets?: string[] }).targets ?? [],
	);

	const text = $derived(moveNodeText(messageDocument, node, { tracking }));
	// A creature with a TARGETS row shows its chip there instead.
	const rowOffers = $derived(
		text.offers.filter((offer) => !targetsShown || !targetUuids.has(offer.tokenUuid)),
	);
	const damageLines = $derived(
		text.offers.flatMap((offer) => {
			const line = text.obstacleDamage(offer);
			return line ? [{ id: offer.id, line }] : [];
		}),
	);

	function tokenImage(uuid: string): string {
		const token = fromUuidSync(uuid, { strict: false }) as {
			texture?: { src?: string | null };
			actor?: { img?: string | null } | null;
		} | null;
		return token?.texture?.src || token?.actor?.img || 'icons/svg/mystery-man.svg';
	}
</script>

<div class="nimble-move-node">
	<p class="nimble-move-node__line">
		<i
			class="fa-solid fa-person-running"
			role="img"
			aria-label={text.kindLabel}
			data-tooltip={text.kindLabel}
		></i>
		<span>{text.summary}</span>
	</p>

	{#if text.offers.length === 0}
		<p class="nimble-move-node__hint">{localize('NIMBLE.chat.movementOffers.noRecipient')}</p>
	{/if}

	{#if rowOffers.length > 0}
		<ul class="nimble-move-node__rows">
			{#each rowOffers as offer (offer.id)}
				<li class="nimble-move-node__row">
					<img class="nimble-move-node__img" src={tokenImage(offer.tokenUuid)} alt={offer.name} />
					<span class="nimble-move-node__name" data-tooltip={offer.name}>{offer.name}</span>
					<MovementStatusChip chip={text.chip(offer)} />
				</li>
			{/each}
		</ul>
	{/if}

	{#each damageLines as { id, line } (id)}
		<p class="nimble-move-node__damage">{line}</p>
	{/each}
</div>

<style lang="scss">
	.nimble-move-node {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&__line {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			line-height: 1.3;
			overflow-wrap: anywhere;

			i {
				flex: 0 0 auto;
			}

			span {
				min-width: 0;
			}
		}

		&__hint,
		&__damage {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
		}

		&__hint {
			color: var(--nimble-medium-text-color);
		}

		&__damage {
			color: var(--nimble-dark-text-color);
		}

		&__rows {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			min-width: 0;
			padding: 0.125rem 0.25rem;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__img {
			flex: 0 0 auto;
			width: 1.25rem;
			height: 1.25rem;
			border: 0;
			border-radius: 3px;
			object-fit: cover;
		}

		&__name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			font-size: var(--nimble-sm-text);
			white-space: nowrap;
			pointer-events: all;
			text-overflow: ellipsis;
		}
	}
</style>

<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
	import type { MovementOffer } from '#types/movement.js';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { movementOfferOutcome } from '#utils/movement/movementOffers.js';
	import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';

	let { node }: MoveNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	const offersEnabled = isMovementOffersAutomationEnabled();

	// Read through the reactive system data so the card redraws when an offer is settled.
	const system = $derived(
		(messageDocument?.reactive?.system ?? {}) as {
			actorName?: string;
			movementOffers?: MovementOffer[];
		},
	);
	const sourceName = $derived(system.actorName ?? '');
	const kindLabel = $derived(localize(`NIMBLE.chat.movementOffers.kinds.${node.kind}`));
	const directionText = $derived(
		localize(`NIMBLE.chat.movementOffers.directions.${node.direction}`, { source: sourceName }),
	);
	const offers = $derived(
		(system.movementOffers ?? []).filter((offer) => offer.nodeId === node.id),
	);

	function spacesText(count: number): string {
		return localize(`NIMBLE.chat.movementOffers.${count === 1 ? 'space' : 'spaces'}`, {
			count: String(count),
		});
	}

	function chooserText(offer: MovementOffer): string {
		return localize(`NIMBLE.chat.movementOffers.choosers.${node.chooser}`, {
			mover: offer.name,
			source: sourceName,
		});
	}
</script>

<div class="nimble-move-node">
	<h4 class="nimble-heading nimble-move-node__heading" data-heading-variant="field">
		<i class="fa-solid fa-person-running" aria-hidden="true"></i>
		{kindLabel}
	</h4>

	{#if offers.length === 0}
		<p class="nimble-move-node__hint">{localize('NIMBLE.chat.movementOffers.noRecipient')}</p>
	{/if}

	{#each offers as offer (offer.id)}
		{@const outcome = movementOfferOutcome(offer)}
		<div class="nimble-move-node__recipient">
			<span class="nimble-move-node__text">
				{localize('NIMBLE.chat.movementOffers.offer', {
					name: offer.name,
					distance: spacesText(offer.spaces),
					direction: directionText,
				})}
				<small class="nimble-move-node__hint">{chooserText(offer)}</small>
			</span>

			{#if outcome.state === 'taken'}
				<span class="nimble-move-node__result">
					{outcome.shortfall > 0
						? localize('NIMBLE.chat.movementOffers.resultShortened', {
								name: offer.name,
								moved: String(outcome.moved ?? 0),
								offered: spacesText(outcome.offered),
								short: String(outcome.shortfall),
							})
						: localize('NIMBLE.chat.movementOffers.result', {
								name: offer.name,
								moved: String(outcome.moved ?? 0),
								offered: spacesText(outcome.offered),
							})}
					{#if outcome.damageOwed}
						<small class="nimble-move-node__hint">
							{localize('NIMBLE.chat.movementOffers.forcedShortenedHint')}
						</small>
					{/if}
				</span>
			{:else if outcome.state === 'unused'}
				<span class="nimble-move-node__result">
					{localize('NIMBLE.chat.movementOffers.unused', { name: offer.name })}
				</span>
			{:else if offersEnabled && offer.spaces > 0}
				<small class="nimble-move-node__hint">
					{localize('NIMBLE.chat.movementOffers.dragHint', {
						name: offer.name,
						distance: spacesText(offer.spaces),
					})}
				</small>
			{/if}
		</div>
	{/each}
</div>

<style lang="scss">
	.nimble-move-node {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		&__heading {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}

		&__recipient {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__text,
		&__result {
			display: flex;
			flex-direction: column;
		}

		&__hint {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-style: normal;
			color: var(--nimble-medium-text-color);
		}

		&__result {
			font-style: italic;
		}
	}
</style>

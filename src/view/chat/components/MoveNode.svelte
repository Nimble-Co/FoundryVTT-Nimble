<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
	import type { MovementOffer } from '#types/movement.js';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { movementOfferOutcome, speakerTokenUuid } from '#utils/movement/movementOffers.js';

	let { node }: MoveNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	// Read through the reactive system data so the card redraws when an offer is settled.
	const reactiveMessage = $derived(messageDocument?.reactive);
	const system = $derived(
		(reactiveMessage?.system ?? {}) as {
			actorName?: string;
			movementOffers?: MovementOffer[];
		},
	);
	const offers = $derived(
		(system.movementOffers ?? []).filter((offer) => offer.nodeId === node.id),
	);
	const selfOffer = $derived.by(() => {
		if (offers.length !== 1) return null;
		const speakerUuid = speakerTokenUuid({ speaker: reactiveMessage?.speaker ?? undefined });
		return offers[0].tokenUuid === speakerUuid ? offers[0] : null;
	});
	const directionText = $derived(
		node.direction === 'any'
			? null
			: localize(`NIMBLE.chat.movementOffers.directions.${node.direction}`, {
					source: system.actorName ?? '',
				}),
	);
	const headingParts = $derived.by(() => {
		const parts = directionText ? [directionText] : [];
		if (selfOffer) parts.push(resultText(selfOffer) ?? distanceText(selfOffer));
		return parts;
	});
	const showsTerrainTag = $derived(node.kind === 'free' && node.ignoreDifficultTerrain);

	function spacesText(count: number): string {
		return localize(`NIMBLE.chat.movementOffers.${count === 1 ? 'space' : 'spaces'}`, {
			count: String(count),
		});
	}

	function distanceText(offer: MovementOffer): string {
		return localize('NIMBLE.chat.movementOffers.upTo', { distance: spacesText(offer.spaces) });
	}

	function resultText(offer: MovementOffer): string | null {
		const outcome = movementOfferOutcome(offer);
		switch (outcome.state) {
			case 'taken':
				return localize(
					`NIMBLE.chat.movementOffers.results.${outcome.shortfall > 0 ? 'shortened' : 'taken'}`,
					{
						moved: String(outcome.moved ?? 0),
						offered: spacesText(outcome.offered),
						short: String(outcome.shortfall),
					},
				);
			case 'unused':
				return localize('NIMBLE.chat.movementOffers.results.unused');
			case 'lapsed':
				return localize('NIMBLE.chat.movementOffers.results.lapsed');
			default:
				return null;
		}
	}
</script>

{#snippet damageReminder(offer: MovementOffer)}
	{#if movementOfferOutcome(offer).damageOwed}
		<small class="nimble-move-node__hint">
			{localize('NIMBLE.chat.movementOffers.forcedShortenedHint')}
		</small>
	{/if}
{/snippet}

<div class="nimble-move-node">
	<h4 class="nimble-heading nimble-move-node__heading" data-heading-variant="field">
		<i class="fa-solid fa-person-running" aria-hidden="true"></i>
		<span>
			{localize(`NIMBLE.chat.movementOffers.kinds.${node.kind}`)}<span
				class="nimble-move-node__part">{headingParts.map((part) => ` - ${part}`).join('')}</span
			>
		</span>
	</h4>

	{#if showsTerrainTag}
		<small class="nimble-move-node__hint">
			{localize('NIMBLE.chat.movementOffers.ignoresDifficultTerrain')}
		</small>
	{/if}

	{#if offers.length === 0}
		<p class="nimble-move-node__hint">{localize('NIMBLE.chat.movementOffers.noRecipient')}</p>
	{:else if selfOffer}
		{@render damageReminder(selfOffer)}
	{:else}
		<div class="nimble-move-node__rows">
			{#each offers as offer (offer.id)}
				{@const result = resultText(offer)}
				<div class="nimble-move-node__row">
					<span class="nimble-move-node__name">{offer.name}</span>
					<span class="nimble-move-node__details">
						{distanceText(offer)}<span class="nimble-move-node__result"
							>{result ? ` - ${result}` : ''}</span
						>
					</span>
					{@render damageReminder(offer)}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-move-node {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&__heading {
			--nimble-heading-size: var(--nimble-md-text);

			white-space: normal;
		}

		&__part {
			font-weight: normal;
		}

		&__rows {
			display: grid;
			grid-template-columns: max-content 1fr;
			column-gap: 0.75rem;
			row-gap: 0.125rem;
		}

		&__row {
			display: contents;
		}

		&__rows &__hint {
			grid-column: 2;
		}

		&__hint {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-style: normal;
			color: var(--nimble-medium-text-color);
		}

		&__result {
			font-style: italic;
		}
	}
</style>

<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
	import type { MovementOffer } from '#types/movement.js';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { createMoveNodeState } from './MoveNodeState.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	let { node }: MoveNodeProps = $props();

	const moveNode = createMoveNodeState(() => ({ node }), messageDocument);

	const { distanceText, resultSuffix, damageOwed } = moveNode;
	const offers = $derived(moveNode.offers);
	const selfOffer = $derived(moveNode.selfOffer);
	const headingSuffix = $derived(moveNode.headingSuffix);
	const kindLabel = $derived(moveNode.kindLabel);
	const showsTerrainTag = $derived(moveNode.showsTerrainTag);
</script>

{#snippet damageReminder(offer: MovementOffer)}
	{#if damageOwed(offer)}
		<small class="nimble-move-node__hint">
			{localize('NIMBLE.chat.movementOffers.forcedShortenedHint')}
		</small>
	{/if}
{/snippet}

<div class="nimble-move-node">
	<h4 class="nimble-heading nimble-move-node__heading" data-heading-variant="field">
		<i class="fa-solid fa-person-running" aria-hidden="true"></i>
		<span class="nimble-move-node__line">
			{kindLabel}<span class="nimble-move-node__part">{headingSuffix}</span>
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
				<div class="nimble-move-node__row">
					<span class="nimble-move-node__name">{offer.name}</span>
					<span class="nimble-move-node__details">
						{distanceText(offer)}<span class="nimble-move-node__result">{resultSuffix(offer)}</span>
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
			--nimble-heading-line-height: 1.25;

			i {
				align-self: flex-start;
				line-height: inherit;
			}
		}

		&__line {
			min-width: 0;
			white-space: normal;
			overflow-wrap: anywhere;
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

<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
	import type { MovementOfferEntry } from '#utils/movement/movementOfferEntry.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import {
		buildCardMovementOffer,
		cardMoveRecipients,
		canUserTakeMovementOffer,
		type OfferMessage,
	} from '#utils/movement/buildCardMovementOffer.js';
	import { takeMovementOffer } from '#utils/movement/takeMovementOffer.js';
	import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';

	interface Recipient {
		id: string;
		tokenUuid: string;
		name: string;
		spaces: number;
		entry: MovementOfferEntry | null;
		canUse: boolean;
	}

	let { node }: MoveNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	const offersEnabled = isMovementOffersAutomationEnabled();

	const system = $derived(
		(messageDocument?.reactive?.system ?? {}) as {
			actorName?: string;
			targets?: string[];
			movementOffers?: MovementOfferEntry[];
		},
	);
	const sourceName = $derived(system.actorName ?? '');
	const kindLabel = $derived(localize(`NIMBLE.chat.movementOffers.kinds.${node.kind}`));
	const directionText = $derived(
		localize(`NIMBLE.chat.movementOffers.directions.${node.direction}`, { source: sourceName }),
	);
	const recipients = $derived.by<Recipient[]>(() => {
		if (!messageDocument?.id) return [];
		// The card's stored effects may lag behind the node being rendered; build
		// the recipient list from the live message but offers from the card itself.
		const message = messageDocument as unknown as OfferMessage;
		const entries = system.movementOffers ?? [];
		return cardMoveRecipients({ ...message, system }, node).flatMap((tokenUuid) => {
			const card = buildCardMovementOffer(
				{ messageId: messageDocument.id ?? '', nodeId: node.id, tokenUuid },
				{ message },
			);
			if (!card) return [];
			return [
				{
					id: card.offer.id,
					tokenUuid,
					name: card.token.name,
					spaces: card.offer.spaces,
					entry: entries.find((entry) => entry.id === card.offer.id) ?? null,
					canUse: canUserTakeMovementOffer(game.user, card),
				},
			];
		});
	});

	let busyId = $state<string | null>(null);

	function spacesText(count: number): string {
		return count === 1
			? localize('NIMBLE.chat.movementOffers.space')
			: localize('NIMBLE.chat.movementOffers.spaces', { count });
	}

	function chooserText(recipient: Recipient): string {
		return localize(`NIMBLE.chat.movementOffers.choosers.${node.chooser}`, {
			mover: recipient.name,
			source: sourceName,
		});
	}

	function resultText(recipient: Recipient): string | null {
		const entry = recipient.entry;
		if (!entry?.used || entry.movedSpaces === null) return null;
		const short = Math.max(0, entry.spaces - entry.movedSpaces);
		return entry.stopped && short > 0
			? localize('NIMBLE.chat.movementOffers.resultShortened', {
					name: recipient.name,
					moved: entry.movedSpaces,
					offered: spacesText(entry.spaces),
					short,
				})
			: localize('NIMBLE.chat.movementOffers.result', {
					name: recipient.name,
					moved: entry.movedSpaces,
					offered: spacesText(entry.spaces),
				});
	}

	function showsShortenedHint(recipient: Recipient): boolean {
		const entry = recipient.entry;
		return (
			node.kind === 'forced' &&
			!!entry?.used &&
			entry.stopped &&
			entry.movedSpaces !== null &&
			entry.movedSpaces < entry.spaces
		);
	}

	async function take(recipient: Recipient) {
		if (busyId || !messageDocument?.id) return;
		busyId = recipient.id;
		try {
			await takeMovementOffer({
				messageId: messageDocument.id,
				nodeId: node.id,
				tokenUuid: recipient.tokenUuid,
			});
		} finally {
			busyId = null;
		}
	}
</script>

<div class="nimble-move-node">
	<h4 class="nimble-heading nimble-move-node__heading" data-heading-variant="field">
		<i class="fa-solid fa-person-running" aria-hidden="true"></i>
		{kindLabel}
	</h4>

	{#if recipients.length === 0}
		<p class="nimble-move-node__hint">{localize('NIMBLE.chat.movementOffers.noRecipient')}</p>
	{/if}

	{#each recipients as recipient (recipient.id)}
		{@const result = resultText(recipient)}
		<div class="nimble-move-node__recipient">
			<span class="nimble-move-node__text">
				{localize('NIMBLE.chat.movementOffers.offer', {
					name: recipient.name,
					distance: spacesText(recipient.spaces),
					direction: directionText,
				})}
				<small class="nimble-move-node__hint">{chooserText(recipient)}</small>
			</span>

			{#if result}
				<span class="nimble-move-node__result">
					{result}
					{#if showsShortenedHint(recipient)}
						<small class="nimble-move-node__hint">
							{localize('NIMBLE.chat.movementOffers.forcedShortenedHint')}
						</small>
					{/if}
				</span>
			{:else if offersEnabled && recipient.canUse && recipient.spaces > 0}
				<button
					class="nimble-button nimble-move-node__button"
					type="button"
					data-button-variant="card-action"
					disabled={busyId !== null}
					onclick={() => take(recipient)}
				>
					<i class="fa-solid fa-arrows-up-down-left-right" aria-hidden="true"></i>
					{localize('NIMBLE.chat.movementOffers.moveButton', { spaces: recipient.spaces })}
				</button>
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
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.375rem;
		}

		&__text,
		&__result {
			display: flex;
			flex-direction: column;
		}

		&__hint {
			margin: 0;
			color: var(--nimble-medium-text-color);
		}

		&__result {
			font-style: italic;
		}
	}
</style>

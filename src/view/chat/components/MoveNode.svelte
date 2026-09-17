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
		const messageId = messageDocument?.id;
		if (!messageId) return [];
		// Reads go through the reactive system data so the card re-renders when
		// a stamp lands.
		const message: OfferMessage = {
			id: messageId,
			author: messageDocument.author,
			speaker: messageDocument.speaker,
			system,
		};
		return cardMoveRecipients(message, node)
			.map((tokenUuid) =>
				buildCardMovementOffer({ messageId, nodeId: node.id, tokenUuid }, { message }),
			)
			.filter((card) => card !== null)
			.map((card) => ({
				id: card.offer.id,
				tokenUuid: card.offer.tokenUuid,
				name: card.token.name,
				spaces: card.offer.spaces,
				entry: card.entry,
				canUse: canUserTakeMovementOffer(game.user, card),
			}));
	});

	// One drag at a time: starting a second plan would cancel the first.
	let busy = $state(false);

	function spacesText(count: number): string {
		return localize(`NIMBLE.chat.movementOffers.${count === 1 ? 'space' : 'spaces'}`, { count });
	}

	function chooserText(recipient: Recipient): string {
		return localize(`NIMBLE.chat.movementOffers.choosers.${node.chooser}`, {
			mover: recipient.name,
			source: sourceName,
		});
	}

	function resultText(recipient: Recipient): string | null {
		const entry = recipient.entry;
		if (!entry?.used) return null;
		if (entry.movedSpaces === null) {
			return localize('NIMBLE.chat.movementOffers.taken', { name: recipient.name });
		}
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
		if (busy || !messageDocument?.id) return;
		busy = true;
		try {
			await takeMovementOffer({
				messageId: messageDocument.id,
				nodeId: node.id,
				tokenUuid: recipient.tokenUuid,
			});
		} finally {
			busy = false;
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
					disabled={busy}
					onclick={() => take(recipient)}
				>
					<i class="fa-solid fa-arrows-up-down-left-right" aria-hidden="true"></i>
					{localize('NIMBLE.chat.movementOffers.moveButton', {
						distance: spacesText(recipient.spaces),
					})}
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
			font-size: var(--nimble-xs-text);
			font-style: normal;
			color: var(--nimble-medium-text-color);
		}

		&__result {
			font-style: italic;
		}
	}
</style>

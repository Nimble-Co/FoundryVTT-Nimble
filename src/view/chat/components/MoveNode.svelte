<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
	import type { MovementOfferEntry } from '#utils/movement/movementOffers.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { buildMovementOfferId, takeMovementOffer } from '#utils/movement/movementOffers.js';
	import { resolveMoveDistance } from '#utils/movement/resolveMoveDistance.js';
	import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';

	interface RecipientToken {
		id: string | null;
		uuid: string;
		name: string;
		actor?: {
			isOwner?: boolean;
			getRollData(): Record<string, unknown>;
			system?: { attributes?: { movement?: { walk?: number }; sizeCategory?: string } };
		} | null;
	}

	interface Recipient {
		token: RecipientToken;
		id: string;
		spaces: number;
		entry: MovementOfferEntry | null;
		canUse: boolean;
	}

	let { node }: MoveNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	const offersEnabled = isMovementOffersAutomationEnabled();

	function resolveToken(uuid: string): RecipientToken | null {
		return (fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0]) ??
			null) as RecipientToken | null;
	}

	function resolveRecipientTokens(targetUuids: string[]): RecipientToken[] {
		if (node.recipient === 'self') {
			const speaker = messageDocument?.speaker as { scene?: string | null; token?: string | null };
			if (!speaker?.scene || !speaker.token) return [];
			const token = resolveToken(`Scene.${speaker.scene}.Token.${speaker.token}`);
			return token ? [token] : [];
		}
		return targetUuids.map(resolveToken).filter((token): token is RecipientToken => !!token);
	}

	const sourceName = $derived(
		(messageDocument?.reactive?.system as { actorName?: string } | undefined)?.actorName ?? '',
	);
	const kindLabel = $derived(localize(`NIMBLE.chat.movementOffers.kinds.${node.kind}`));
	const directionText = $derived(
		localize(`NIMBLE.chat.movementOffers.directions.${node.direction}`, { source: sourceName }),
	);
	const entries = $derived(
		(messageDocument?.reactive?.system as { movementOffers?: MovementOfferEntry[] } | undefined)
			?.movementOffers ?? [],
	);
	const targetUuids = $derived(
		(messageDocument?.reactive?.system as { targets?: string[] } | undefined)?.targets ?? [],
	);
	const recipients = $derived<Recipient[]>(
		resolveRecipientTokens(targetUuids).map((token) => {
			const id = buildMovementOfferId(messageDocument?.id ?? '', node.id, token.id ?? '');
			return {
				token,
				id,
				spaces: token.actor ? resolveMoveDistance(node, token.actor) : 0,
				entry: entries.find((entry) => entry.id === id) ?? null,
				canUse: game.user?.isGM === true || token.actor?.isOwner === true,
			};
		}),
	);

	let busyId = $state<string | null>(null);

	function chooserText(recipient: Recipient): string {
		return localize(`NIMBLE.chat.movementOffers.choosers.${node.chooser}`, {
			mover: recipient.token.name,
			source: sourceName,
		});
	}

	function resultText(recipient: Recipient): string | null {
		const entry = recipient.entry;
		if (!entry?.used) return null;
		if (entry.movedSpaces === null) {
			return localize('NIMBLE.chat.movementOffers.started', { name: recipient.token.name });
		}
		const short = Math.max(0, entry.spaces - entry.movedSpaces);
		return entry.stopped && short > 0
			? localize('NIMBLE.chat.movementOffers.resultShortened', {
					name: recipient.token.name,
					moved: entry.movedSpaces,
					offered: entry.spaces,
					short,
				})
			: localize('NIMBLE.chat.movementOffers.result', {
					name: recipient.token.name,
					moved: entry.movedSpaces,
					offered: entry.spaces,
				});
	}

	async function take(recipient: Recipient) {
		if (busyId || !messageDocument?.id) return;
		busyId = recipient.id;
		try {
			await takeMovementOffer({
				messageId: messageDocument.id,
				node,
				token: recipient.token,
				spaces: recipient.spaces,
				label: sourceName,
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
					name: recipient.token.name,
					spaces: recipient.spaces,
					direction: directionText,
				})}
				<small class="nimble-move-node__hint">{chooserText(recipient)}</small>
			</span>

			{#if result}
				<span class="nimble-move-node__result">{result}</span>
			{:else if offersEnabled && recipient.canUse && recipient.spaces > 0}
				<button
					class="nimble-button nimble-move-node__button"
					type="button"
					data-button-variant="card-action"
					aria-label={localize('NIMBLE.chat.movementOffers.moveButton', {
						spaces: recipient.spaces,
					})}
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

		&__text {
			display: flex;
			flex-direction: column;
		}

		&__hint {
			margin: 0;
			opacity: 0.75;
		}

		&__result {
			font-style: italic;
		}
	}
</style>

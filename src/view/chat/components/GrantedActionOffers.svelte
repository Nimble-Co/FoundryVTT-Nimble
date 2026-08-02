<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { GrantedActionOffer } from '#utils/grantedActionOffers.ts';

	import { getContext } from 'svelte';
	import { requestGrantedActionOfferUse } from '#utils/grantedActionOffers.js';
	import localize from '../../../utils/localize.js';

	interface OfferRecipientActor {
		name?: string;
		isOwner?: boolean;
		items?: Iterable<OfferRecipientItem>;
		activateItem?: (id: string) => Promise<unknown>;
	}

	interface OfferRecipientItem {
		id: string | null;
		name: string;
		type: string;
		system?: { objectType?: string };
	}

	function getRecipientActor(offer: GrantedActionOffer): OfferRecipientActor | null {
		return (fromUuidSync(offer.targetActorUuid as Parameters<typeof fromUuidSync>[0]) ??
			null) as OfferRecipientActor | null;
	}

	function canUseOffer(offer: GrantedActionOffer): boolean {
		if (game.user?.isGM) return true;
		const actor = getRecipientActor(offer);
		return !!actor?.isOwner;
	}

	function getOfferHeading(offer: GrantedActionOffer): string {
		return localize(`NIMBLE.chat.grantedActionOffers.${offer.activationType}`);
	}

	function getOfferLabel(offer: GrantedActionOffer): string {
		const heading = getOfferHeading(offer);
		const actorName = getRecipientActor(offer)?.name ?? '';
		const source = offer.label ? `: ${offer.label}` : '';
		return `${heading}${source} — ${actorName}`;
	}

	function getOfferTooltip(offer: GrantedActionOffer): string | null {
		if (!offer.sourceItemUuid) return null;
		const item = fromUuidSync(offer.sourceItemUuid as Parameters<typeof fromUuidSync>[0]) as {
			name?: string;
		} | null;
		return item?.name ?? null;
	}

	function getUsedAttribution(offer: GrantedActionOffer): string {
		const actorName = getRecipientActor(offer)?.name ?? '';
		return offer.label
			? localize('NIMBLE.chat.grantedActionOffers.usedByVia', {
					name: actorName,
					label: offer.label,
				})
			: localize('NIMBLE.chat.grantedActionOffers.usedBy', { name: actorName });
	}

	/** The recipient's items the offer allows them to activate. */
	function getEligibleItems(offer: GrantedActionOffer): OfferRecipientItem[] {
		const actor = getRecipientActor(offer);
		if (!actor?.items) return [];
		// weaponAttack is the only activation type; extend here alongside the
		// rule's choice set.
		return [...actor.items].filter(
			(item) => item.type === 'object' && item.system?.objectType === 'weapon',
		);
	}

	function toggleOffer(offerId: string): void {
		expandedOfferId = expandedOfferId === offerId ? null : offerId;
	}

	/**
	 * Run the recipient's normal activation flow, then consume the offer. The
	 * activation resolves its own costs (including any adjustments the granting
	 * feature's rules declared), so the offer itself carries none. A cancelled
	 * activation returns null and leaves the offer available.
	 */
	async function useOfferWithItem(offer: GrantedActionOffer, itemId: string | null) {
		if (busy || !itemId) return;
		busy = true;

		try {
			const actor = getRecipientActor(offer);
			if (!actor?.activateItem) return;

			const activationCard = await actor.activateItem(itemId);
			if (!activationCard) return;

			await requestGrantedActionOfferUse({
				messageId: messageDocument.id ?? '',
				offerId: offer.id,
			});
			expandedOfferId = null;
		} finally {
			busy = false;
		}
	}

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let busy = $state(false);
	let expandedOfferId = $state<string | null>(null);

	let offers = $derived(
		(messageDocument?.reactive?.system as { grantedActionOffers?: GrantedActionOffer[] })
			?.grantedActionOffers ?? [],
	);
	let pendingOffers = $derived(offers.filter((offer) => !offer.used && canUseOffer(offer)));
	let usedOffers = $derived(offers.filter((offer) => offer.used));
</script>

{#if pendingOffers.length > 0 || usedOffers.length > 0}
	<section class="nimble-card-section nimble-card-section--granted-action-offers">
		{#if pendingOffers.length > 0}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.grantedActionOffers.heading')}
				</h3>
			</header>

			<ul class="nimble-granted-action-offer-list">
				{#each pendingOffers as offer (offer.id)}
					<li>
						<button
							class="nimble-button nimble-granted-action-offer-button"
							type="button"
							disabled={busy}
							data-tooltip={getOfferTooltip(offer)}
							onclick={() => toggleOffer(offer.id)}
						>
							<i class="nimble-button__icon fa-solid fa-hand-point-right"></i>
							{getOfferLabel(offer)}
						</button>

						{#if expandedOfferId === offer.id}
							{@const eligibleItems = getEligibleItems(offer)}

							{#if eligibleItems.length > 0}
								<ul
									class="nimble-granted-action-offer-list nimble-granted-action-offer-list--items"
								>
									{#each eligibleItems as item (item.id)}
										<li>
											<button
												class="nimble-button nimble-granted-action-offer-button"
												type="button"
												disabled={busy}
												onclick={() => useOfferWithItem(offer, item.id)}
											>
												<i class="nimble-button__icon fa-solid fa-dice-d20"></i>
												{item.name}
											</button>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="nimble-granted-action-offer-empty">
									{localize('NIMBLE.chat.grantedActionOffers.noEligibleItems')}
								</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#each usedOffers as offer (offer.id)}
			<p class="nimble-granted-action-offer-attribution">
				<i class="fa-solid fa-hand-point-right"></i>
				{getUsedAttribution(offer)}
			</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-granted-action-offer-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;

		&--items {
			margin-block-start: 0.25rem;
			margin-inline-start: 1rem;
		}
	}

	.nimble-granted-action-offer-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.25rem 0.5rem;
		font-size: var(--nimble-sm-text);
		text-align: left;
	}

	.nimble-granted-action-offer-empty {
		margin: 0.25rem 0 0 1rem;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}

	.nimble-granted-action-offer-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>

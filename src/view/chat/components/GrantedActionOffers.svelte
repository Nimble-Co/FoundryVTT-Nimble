<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { GrantedActionOffer } from '#utils/combat/grantedActionOffers.ts';

	import { getContext } from 'svelte';
	import { grantedAttackGroups, makeGrantedAttack } from '#utils/combat/grantedAttack.js';
	import { requestGrantedActionOfferUse } from '#utils/combat/grantedActionOffers.js';
	import { docLink, type LinkedPart, linkedParts } from '#utils/documents/docLink.ts';
	import localize from '../../../utils/localize.js';
	import LinkedText from '../../components/LinkedText.svelte';
	import { resolveGrantedOfferTargeting } from '../utils/resolveGrantedOfferTargeting.ts';

	type OfferRecipientActor = Parameters<typeof grantedAttackGroups>[0] & {
		id?: string | null;
		name?: string;
		isOwner?: boolean;
	};

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
		if (offer.weaponKind === 'unarmed') return localize('NIMBLE.ui.heroicActions.unarmedStrike');
		return localize(`NIMBLE.chat.grantedActionOffers.${offer.activationType}`);
	}

	function getOfferLabel(offer: GrantedActionOffer): string {
		const heading = getOfferHeading(offer);
		const name = getRecipientActor(offer)?.name ?? '';
		return offer.label
			? localize('NIMBLE.chat.grantedActionOffers.offerLabel', {
					name,
					heading,
					source: offer.label,
				})
			: localize('NIMBLE.chat.grantedActionOffers.offerLabelNoSource', { name, heading });
	}

	function getOfferTooltip(offer: GrantedActionOffer): string | null {
		if (!offer.sourceItemUuid) return null;
		const item = fromUuidSync(offer.sourceItemUuid as Parameters<typeof fromUuidSync>[0]) as {
			name?: string;
		} | null;
		return item?.name ?? null;
	}

	function getUsedAttribution(offer: GrantedActionOffer): LinkedPart[] {
		const actorName = getRecipientActor(offer)?.name ?? '';
		return offer.label
			? linkedParts('NIMBLE.chat.grantedActionOffers.usedByVia', {
					name: actorName,
					label: docLink(offer.label, offer.sourceItemUuid),
				})
			: linkedParts('NIMBLE.chat.grantedActionOffers.usedBy', { name: actorName });
	}

	function getChoiceGroups(offer: GrantedActionOffer) {
		const actor = getRecipientActor(offer);
		return actor ? grantedAttackGroups(actor, offer) : [];
	}

	function getChosen(offer: GrantedActionOffer, groups: ReturnType<typeof getChoiceGroups>) {
		return chosenByOffer[offer.id] ?? groups[0]?.choices[0]?.value ?? '';
	}

	/**
	 * What the line is currently pointed at. Reading `targetingVersion` re-runs
	 * this the moment the user retargets, so the display never sits on a stale
	 * answer.
	 */
	function getOfferTargeting(offer: GrantedActionOffer) {
		void targetingVersion;

		const recipientActorId = getRecipientActor(offer)?.id ?? '';
		// Read the target set directly so the names stay in the order the user
		// targeted them. Partitioning it here instead would hoist one group.
		const targetedTokens = Array.from(game.user?.targets ?? []);

		return resolveGrantedOfferTargeting({ recipientActorId, targetedTokens });
	}

	/**
	 * Make the attack of the line, then mark the line used. A cancelled attack
	 * leaves the line available.
	 */
	async function attackWith(offer: GrantedActionOffer, choice: string) {
		if (busy || !choice) return;
		busy = true;

		try {
			const actor = getRecipientActor(offer);
			if (!actor || !(await makeGrantedAttack(actor, offer, choice))) return;

			await requestGrantedActionOfferUse({
				messageId: messageDocument.id ?? '',
				offerId: offer.id,
			});
		} finally {
			busy = false;
		}
	}

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let busy = $state(false);
	let chosenByOffer = $state<Record<string, string>>({});
	let targetingVersion = $state(0);

	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion += 1;
		});
		return () => {
			Hooks.off('targetToken', hookId);
		};
	});

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
					{@const groups = getChoiceGroups(offer)}
					{@const chosen = getChosen(offer, groups)}
					{@const targeting = getOfferTargeting(offer)}
					{@const label = getOfferLabel(offer)}

					<li class="nimble-granted-action-offer">
						<p class="nimble-granted-action-offer__label" data-tooltip={getOfferTooltip(offer)}>
							<i class="fa-solid fa-hand-point-right"></i>
							<span>{label}</span>
						</p>

						{#if offer.condition}
							<p class="nimble-granted-action-offer__note">{offer.condition}</p>
						{/if}

						{#if groups.length > 0}
							<div class="nimble-granted-action-offer__row">
								<select
									class="nimble-granted-action-offer__choice"
									aria-label={label}
									value={chosen}
									disabled={busy}
									onchange={(event) => {
										chosenByOffer[offer.id] = event.currentTarget.value;
									}}
								>
									{#each groups as group, index (index)}
										{#if group.label}
											<optgroup label={group.label}>
												{#each group.choices as choice (choice.value)}
													<option value={choice.value}>{choice.name}</option>
												{/each}
											</optgroup>
										{:else}
											{#each group.choices as choice (choice.value)}
												<option value={choice.value}>{choice.name}</option>
											{/each}
										{/if}
									{/each}
								</select>

								<button
									class="nimble-button nimble-granted-action-offer__attack"
									type="button"
									disabled={busy}
									onclick={() => attackWith(offer, chosen)}
								>
									<i class="nimble-button__icon fa-solid fa-dice-d20"></i>
									{localize('NIMBLE.chat.grantedActionOffers.attack')}
								</button>
							</div>

							{#if targeting.targetsRecipient}
								<p class="nimble-granted-action-offer__note">
									<i class="fa-solid fa-circle-info"></i>
									{localize('NIMBLE.chat.grantedActionOffers.targetingRecipient', {
										name: targeting.recipientTargetNames.join(', '),
									})}
								</p>
							{/if}

							{#if targeting.otherTargetNames.length > 0}
								<p class="nimble-granted-action-offer__note">
									{localize('NIMBLE.chat.grantedActionOffers.currentTarget', {
										name: targeting.otherTargetNames.join(', '),
									})}
								</p>
							{/if}
						{:else}
							<p class="nimble-granted-action-offer__note nimble-granted-action-offer__note--empty">
								{localize('NIMBLE.chat.grantedActionOffers.noEligibleItems')}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#each usedOffers as offer (offer.id)}
			<p class="nimble-granted-action-offer-attribution">
				<i class="fa-solid fa-hand-point-right"></i>
				<LinkedText parts={getUsedAttribution(offer)} />
			</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-granted-action-offer-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nimble-granted-action-offer {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&__label {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
		}

		&__note {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			&--empty {
				font-style: italic;
			}
		}

		&__row {
			display: flex;
			gap: 0.25rem;
		}

		// The dropdown takes the look of the card's buttons, so the line reads as one control row.
		&__choice,
		&__attack {
			height: var(--button-size, 2em);
			font-family: var(--font-sans);
			font-size: var(--nimble-sm-text);
		}

		&__choice {
			flex: 1;
			min-width: 0;
			padding: 0 0.375rem;
			line-height: normal;
			color: inherit;
			background: var(--button-background-color);
			border: 1px solid var(--button-border-color);
			border-radius: 4px;
			box-shadow: none;
			cursor: pointer;
		}

		&__attack {
			flex: none;
			gap: 0.375rem;
			padding: 0 0.5rem;
		}
	}

	.nimble-granted-action-offer-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>

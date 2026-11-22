<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import { createGrantedActionOffersState } from './GrantedActionOffers.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const lines = createGrantedActionOffersState(() => messageDocument);
</script>

{#if lines.pendingOffers.length > 0 || lines.usedOffers.length > 0}
	<section class="nimble-card-section nimble-card-section--granted-action-offers">
		{#if lines.pendingOffers.length > 0}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.grantedActionOffers.heading')}
				</h3>
			</header>

			{#each lines.targetWarnings as warning (warning)}
				<p class="nimble-granted-action-offer__note nimble-granted-action-offer__note--warning">
					<i class="fa-solid fa-triangle-exclamation"></i>
					{warning}
				</p>
			{/each}

			<ul class="nimble-granted-action-offer-list">
				{#each lines.pendingOffers as offer (offer.id)}
					{@const groups = lines.getChoiceGroups(offer)}
					{@const chosen = lines.getChosen(offer, groups)}
					{@const targeting = lines.getOfferTargeting(offer)}
					{@const label = lines.getOfferLabel(offer)}
					{@const sharedTargetsNote = lines.getSharedTargetsNote(offer)}

					<li class="nimble-granted-action-offer">
						<p
							class="nimble-granted-action-offer__label"
							data-tooltip={lines.getOfferTooltip(offer)}
						>
							<i class="fa-solid fa-hand-point-right"></i>
							<span>{label}</span>
						</p>

						{#if offer.condition}
							<p class="nimble-granted-action-offer__note">{offer.condition}</p>
						{/if}

						{#if sharedTargetsNote}
							<p class="nimble-granted-action-offer__note">{sharedTargetsNote}</p>
						{/if}

						{#if groups.length > 0}
							<div class="nimble-granted-action-offer__row">
								<select
									class="nimble-granted-action-offer__choice"
									aria-label={label}
									value={chosen}
									disabled={lines.busy}
									onchange={(event) => lines.choose(offer, event.currentTarget.value)}
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
									disabled={lines.busy}
									onclick={() => lines.attackWith(offer, chosen)}
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

		{#each lines.usedOffers as offer (offer.id)}
			<p class="nimble-granted-action-offer-attribution">
				<i class="fa-solid fa-hand-point-right"></i>
				{lines.getUsedAttribution(offer)}
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

			&--warning {
				margin-block-end: 0.25rem;
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

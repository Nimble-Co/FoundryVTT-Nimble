<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import LinkedText from '../../components/LinkedText.svelte';
	import { createGrantedActionOffersState } from './GrantedActionOffers.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const lines = createGrantedActionOffersState(() => messageDocument);
</script>

{#each lines.sections as section (section.kind)}
	<section class="nimble-card-section nimble-card-section--granted-action-offers">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">{section.heading}</h3>
		</header>

		{#if section.warning}
			<p class="nimble-granted-action-offer__warning">
				<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
				<span><LinkedText parts={section.warning} /></span>
			</p>
		{/if}

		<ul class="nimble-granted-action-offer-list">
			{#each section.offers as offer (offer.id)}
				{#if offer.used}
					<li class="nimble-granted-action-offer nimble-granted-action-offer--used">
						<i class="fa-solid fa-check" aria-hidden="true"></i>
						<span><LinkedText parts={lines.getUsedLine(offer)} /></span>
					</li>
				{:else}
					{@const groups = lines.getChoiceGroups(offer)}
					{@const chosen = lines.getChosen(offer, groups)}
					{@const name = lines.recipientName(offer)}

					<li class="nimble-granted-action-offer">
						<p
							class="nimble-granted-action-offer__name"
							data-tooltip-text={lines.getOfferTooltip(offer)}
						>
							<i class="fa-solid fa-hand-point-right" aria-hidden="true"></i>
							<span>{name}</span>
						</p>

						{#if groups.length > 0}
							<div class="nimble-granted-action-offer__row">
								<select
									class="nimble-granted-action-offer__choice"
									aria-label={localize('NIMBLE.chat.grantedActionOffers.choiceLabel', { name })}
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
									class="nimble-button"
									data-button-variant="card-action"
									style="--nimble-card-action-color: currentColor"
									type="button"
									disabled={lines.busy}
									onclick={() => lines.attackWith(offer, chosen)}
								>
									<i class="fa-solid fa-dice-d20" aria-hidden="true"></i>
									{localize('NIMBLE.chat.grantedActionOffers.attack')}
								</button>
							</div>
						{:else}
							<p class="nimble-granted-action-offer__empty">
								{localize('NIMBLE.chat.grantedActionOffers.noEligibleItems')}
							</p>
						{/if}
					</li>
				{/if}
			{/each}
		</ul>
	</section>
{/each}

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
		// The dropdown and the Attack button share this height, so the row reads as one control.
		--nimble-granted-row-height: 2.25rem;

		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&--used {
			flex-direction: row;
			align-items: baseline;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);
		}

		&__name {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
		}

		&__warning {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0 0 0.375rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			i {
				color: var(--nimble-warning-icon-color);
			}

			&--warning i {
				color: var(--nimble-warning-icon-color);
			}
		}

		&__empty {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-style: italic;
			color: var(--nimble-medium-text-color);
		}

		// The card-action button fills its grid column, and the column is as wide as the button's text.
		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.375rem;
		}

		&__choice {
			box-sizing: border-box;
			width: 100%;
			height: var(--nimble-granted-row-height);
			margin: 0;
			padding: 0 0.5rem;
			font-family: var(--font-sans);
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 4px;
			box-shadow: none;
			cursor: pointer;

			&:focus {
				outline: none;
				border-color: var(--nimble-input-focus-border-color);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}
	}

	.nimble-granted-action-offer--used i {
		color: var(--nimble-medium-text-color);
	}
</style>

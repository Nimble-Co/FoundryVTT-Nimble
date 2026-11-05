<!--
@component
The heroes who can react to an attack: one button each that opens the Defend
window. A Defend made shows on the hero's target row; its reminder lines and the
buttons for allies who react to it show here.
-->
<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import { createDefendReactionsState } from './DefendReactions.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const reactions = createDefendReactionsState(() => messageDocument);
</script>

{#if reactions.blocked && reactions.isGM}
	<p class="nimble-defend__blocked">{localize('NIMBLE.chat.defend.cannotBeDefended')}</p>
{:else if reactions.showSection}
	<section class="nimble-defend" aria-label={localize('NIMBLE.chat.defend.reactions')}>
		{#if !reactions.solo}
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.chat.defend.reactions')}
			</h3>
		{/if}
		<div class="nimble-defend__heroes" class:nimble-defend__heroes--solo={reactions.solo}>
			{#each reactions.open as reactor (reactor.actor.uuid)}
				<button
					class="nimble-defend__hero"
					type="button"
					disabled={reactions.opening === reactor.actor.uuid}
					onclick={() => reactions.react(reactor.actor)}
				>
					<img src={reactor.actor.img || 'icons/svg/mystery-man.svg'} alt="" />
					<span>
						{reactions.solo
							? localize('NIMBLE.chat.defend.reactAs', { name: reactor.actor.name ?? '' })
							: reactor.actor.name}
					</span>
				</button>
			{/each}
			{#each reactions.allyOffers as offer (offer.key)}
				<button
					class="nimble-defend__hero"
					type="button"
					disabled={reactions.opening === offer.key}
					onclick={() => reactions.useAlly(offer)}
				>
					<img src={offer.actor.img || 'icons/svg/mystery-man.svg'} alt="" />
					<span>
						{localize('NIMBLE.chat.defend.allyUse', {
							label: offer.pick.label,
							name: offer.defenderName,
						})}
					</span>
				</button>
			{/each}
		</div>
		{#each reactions.reminders as line}
			<p class="nimble-defend__reminder">{line}</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-defend {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0.5rem 0;

		&__blocked {
			margin: 0;
			padding: 0.375rem 0.5rem 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
		}

		&__reminder {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			line-height: 1.3;
		}

		&__heroes:empty {
			display: none;
		}

		&__heroes {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
			gap: 0.375rem;

			&--solo {
				grid-template-columns: 1fr;
			}
		}

		&__hero {
			display: flex;
			align-items: center;
			margin: 0;
			font-family: var(--nimble-primary-font);
			line-height: 1;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			box-shadow: none;
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease;

			&:hover:not(:disabled) {
				color: inherit;
				background: color-mix(in srgb, currentColor 8%, transparent);
			}

			&:focus-visible {
				outline: 2px solid currentColor;
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}

			justify-content: center;
			gap: 0.5rem;
			width: 100%;
			height: 2.25rem;
			padding: 0 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 900;
			border-radius: 4px;

			img {
				flex: none;
				width: 1.375rem;
				height: 1.375rem;
				border: 0;
				border-radius: 50%;
				object-fit: cover;
			}

			span {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}
	}
</style>

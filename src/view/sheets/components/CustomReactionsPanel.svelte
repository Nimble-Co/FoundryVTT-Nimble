<script lang="ts">
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createCustomReactionsPanelState } from './CustomReactionsPanel.svelte.ts';

	let { showEmbeddedDocumentImages = true } = $props();

	const actor = getContext<NimbleCharacter>('actor');
	// `_onDragStart` is a Foundry sheet mixin method not present on the typed sheet class.
	const sheet = getContext('application') as { _onDragStart: (event: DragEvent) => void };

	const state = createCustomReactionsPanelState(() => actor);
</script>

<section class="custom-reactions-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.customReactions.title')}
		</h3>
	</header>

	<div class="custom-reactions-panel__content">
		{#if state.reactions.length > 0}
			<ul class="custom-reactions-panel__list">
				{#each state.reactions as reaction (reaction._id)}
					{@const actionCost = state.getActionCost(reaction)}
					{@const trigger = state.getReactionTrigger(reaction)}
					{@const description = state.getDescription(reaction)}
					{@const expanded = state.isExpanded(reaction._id)}

					<li class="reaction-card" class:reaction-card--expanded={expanded}>
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<div
							class="reaction-card__row"
							role="button"
							tabindex="0"
							draggable="true"
							data-item-id={reaction._id}
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => state.activateReaction(reaction._id)}
							onkeydown={(event) =>
								state.handleKeydown(event, () => state.activateReaction(reaction._id))}
						>
							{#if showEmbeddedDocumentImages}
								<img
									class="reaction-card__img"
									src={reaction.reactive.img}
									alt={reaction.reactive.name}
								/>
							{/if}

							<div class="reaction-card__content">
								<div class="reaction-card__header">
									<span class="reaction-card__name">{reaction.reactive.name}</span>
									{#if actionCost}
										<span class="reaction-card__action-cost">{actionCost}</span>
									{/if}
								</div>

								{#if trigger}
									<div class="reaction-card__trigger">
										<i class="fa-solid fa-bolt"></i>
										<span>{trigger}</span>
									</div>
								{/if}
							</div>

							{#if description}
								<button
									class="reaction-card__expand"
									type="button"
									onclick={(event) => state.toggleDescription(reaction._id, event)}
									aria-label={localize(
										expanded
											? 'NIMBLE.ui.heroicActions.collapse'
											: 'NIMBLE.ui.heroicActions.expand',
									)}
								>
									<i class="fa-solid fa-caret-{expanded ? 'up' : 'down'}"></i>
								</button>
							{/if}
						</div>

						{#if expanded && description}
							<div class="reaction-card__description">
								{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(description) then enriched}
									{@html enriched}
								{:catch}
									{@html description}
								{/await}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="custom-reactions-panel__empty">
				{localize('NIMBLE.ui.heroicActions.customReactions.empty')}
			</p>
		{/if}
	</div>
</section>

<style lang="scss">
	.custom-reactions-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}

	.reaction-card {
		display: flex;
		flex-direction: column;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			cursor: pointer;
		}

		&__img {
			width: 2rem;
			height: 2rem;
			object-fit: cover;
			border-radius: 3px;
			flex-shrink: 0;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__header {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__action-cost {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			padding: 0 0.25rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 2px;
		}

		&__trigger {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);

			i {
				font-size: 0.625rem;
				color: hsl(45, 70%, 45%);
			}
		}

		&__expand {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			background: transparent;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			flex-shrink: 0;
			color: var(--nimble-medium-text-color);
			transition: all 0.15s ease;

			&:hover {
				background: var(--nimble-basic-button-background-color);
				color: var(--nimble-dark-text-color);
			}

			i {
				font-size: 0.875rem;
			}
		}

		&__description {
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			border-top: 1px solid var(--nimble-card-border-color);
			line-height: 1.5;

			:global(p) {
				margin: 0 0 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}
</style>

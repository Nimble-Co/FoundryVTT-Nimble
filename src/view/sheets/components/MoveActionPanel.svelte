<script>
	import localize from '../../../utils/localize.js';
	import { getMovementSpeeds } from '../../../utils/movementSpeeds.js';

	let { actor, inCombat = false, actionsRemaining = 0, onDeductAction = async () => {} } = $props();

	let movementSpeeds = $derived(getMovementSpeeds(actor));

	async function handleMove() {
		if (!inCombat || actionsRemaining <= 0) return;

		// Deduct action pip
		await onDeductAction();

		// Send chat message
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor }),
			content: localize('NIMBLE.ui.heroicActions.moveAction', { name: actor.name }),
		});
	}
</script>

<section class="move-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.move.title')}
		</h3>
	</header>

	<div class="move-panel__content">
		{#if movementSpeeds.length > 0}
			<div class="move-panel__speeds">
				<span class="move-panel__speeds-label">
					{localize('NIMBLE.ui.heroicActions.move.yourMovement')}
				</span>
				<div class="move-panel__speeds-list">
					{#each movementSpeeds as speed}
						<div class="move-panel__speed">
							<i class={speed.icon}></i>
							<span class="move-panel__speed-value">{speed.value}</span>
							<span class="move-panel__speed-label">
								{localize('NIMBLE.ui.heroicActions.move.spaces')}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<p class="move-panel__no-movement">
				{localize('NIMBLE.ui.heroicActions.move.noMovement')}
			</p>
		{/if}

		<div class="move-panel__info">
			<i class="fa-solid fa-circle-info"></i>
			<span>{localize('NIMBLE.ui.heroicActions.move.actionCost')}</span>
		</div>

		<button
			class="nimble-button move-panel__confirm"
			data-button-variant="primary"
			disabled={!inCombat || actionsRemaining <= 0}
			onclick={handleMove}
		>
			<i class="fa-solid fa-person-running"></i>
			{localize('NIMBLE.ui.heroicActions.move.confirm')}
		</button>
	</div>
</section>

<style lang="scss">
	.move-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__speeds {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__speeds-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		&__speeds-list {
			display: flex;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__speed {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.25rem 0.5rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 4px;

			i {
				font-size: 0.75rem;
				color: var(--nimble-action-icon-color);
			}
		}

		&__speed-value {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__speed-label {
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
		}

		&__no-movement {
			margin: 0;
			padding: 0.5rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__info {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.5rem;
			background: var(--nimble-action-info-background);
			border: 1px solid var(--nimble-action-info-border-color);
			border-radius: 4px;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-action-info-text-color);

			i {
				color: var(--nimble-action-info-icon-color);
			}
		}

		&__confirm {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.375rem;
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;

			i {
				font-size: 0.875rem;
			}
		}
	}
</style>

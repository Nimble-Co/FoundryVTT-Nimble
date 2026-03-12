<script>
	import localize from '../../../utils/localize.js';
	import { getMovementSpeeds } from '../../../utils/movementSpeeds.js';

	let { actor, inCombat = false, actionsRemaining = 0, onDeductAction = async () => {} } = $props();

	let movementSpeeds = $derived(getMovementSpeeds(actor));
	let primarySpeed = $derived(movementSpeeds.find((s) => s.type === 'walk') ?? movementSpeeds[0]);

	async function handleMove() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor }),
			content: localize('NIMBLE.ui.heroicActions.moveAction', { name: actor.name }),
		});
	}
</script>

<section class="action-card action-card--move">
	<div class="action-card__header">
		<div class="action-card__icon">
			<i class="fa-solid fa-person-running"></i>
		</div>
		<div class="action-card__title-group">
			<h3 class="action-card__title">
				{localize('NIMBLE.ui.heroicActions.move.title')}
			</h3>
			<span class="action-card__cost">
				<i class="fa-solid fa-bolt"></i> 1 Action
			</span>
		</div>
		{#if primarySpeed}
			<div class="action-card__stat">
				<span class="action-card__stat-label">Speed</span>
				<span class="action-card__stat-value">{primarySpeed.value}</span>
			</div>
		{/if}
	</div>

	<p class="action-card__description">
		Move up to your speed. You can split movement around other actions and move multiple times per
		turn.
	</p>

	{#if movementSpeeds.length > 1}
		<div class="action-card__speeds">
			{#each movementSpeeds as speed}
				<div class="action-card__speed">
					<i class={speed.icon}></i>
					<span class="action-card__speed-value">{speed.value}</span>
				</div>
			{/each}
		</div>
	{/if}

	<button
		class="action-card__button"
		disabled={!inCombat || actionsRemaining <= 0}
		onclick={handleMove}
	>
		<i class="fa-solid fa-person-running"></i>
		Confirm Move
	</button>
</section>

<style lang="scss">
	.action-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 8px;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.625rem;
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			background: linear-gradient(135deg, hsl(185, 60%, 45%) 0%, hsl(185, 60%, 35%) 100%);
			border-radius: 6px;
			flex-shrink: 0;

			i {
				font-size: 1.125rem;
				color: white;
			}
		}

		&__title-group {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-base-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__cost {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);

			i {
				font-size: 0.625rem;
			}
		}

		&__stat {
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: 0.375rem 0.625rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 6px;
		}

		&__stat-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		&__stat-value {
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: hsl(185, 60%, 40%);
			line-height: 1;
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;
		}

		&__speeds {
			display: flex;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__speed {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.625rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 6px;

			i {
				font-size: 0.875rem;
				color: hsl(185, 60%, 40%);
			}
		}

		&__speed-value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);

			&::after {
				content: ' spaces';
				font-weight: 500;
				color: var(--nimble-medium-text-color);
			}
		}

		&__button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.625rem 1rem;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: white;
			background: linear-gradient(135deg, hsl(185, 60%, 45%) 0%, hsl(185, 60%, 35%) 100%);
			border: none;
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover:not(:disabled) {
				background: linear-gradient(135deg, hsl(185, 60%, 50%) 0%, hsl(185, 60%, 40%) 100%);
				transform: translateY(-1px);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			i {
				font-size: 0.875rem;
			}
		}
	}

	:global(.theme-dark) .action-card {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 28%);
	}

	:global(.theme-dark) .action-card__stat-value {
		color: hsl(185, 70%, 60%);
	}

	:global(.theme-dark) .action-card__speed i {
		color: hsl(185, 70%, 60%);
	}
</style>

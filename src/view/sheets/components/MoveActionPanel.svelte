<script lang="ts">
	import type { MoveActionPanelProps } from '../../../../types/components/MoveActionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { getMovementSpeeds } from '../../../utils/movementSpeeds.js';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: MoveActionPanelProps = $props();

	let movementSpeeds = $derived(getMovementSpeeds(actor));
	let primarySpeed = $derived(movementSpeeds.find((s) => s.type === 'walk') ?? movementSpeeds[0]);

	async function handleMove() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

		const chatData = {
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor }),
			type: 'moveAction',
			system: {
				actorName: actor.name,
				speed: primarySpeed?.value ?? 0,
			},
		};

		await ChatMessage.create(chatData);
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
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.move.cost')}
			</span>
		</div>
		{#if primarySpeed}
			<div class="action-card__stat">
				<span class="action-card__stat-label">{localize('NIMBLE.ui.heroicActions.move.speed')}</span
				>
				<span class="action-card__stat-value">{primarySpeed.value}</span>
			</div>
		{/if}
	</div>

	<p class="action-card__description">
		{localize('NIMBLE.ui.heroicActions.move.panelDescription')}
	</p>

	{#if movementSpeeds.length > 1}
		<div class="action-card__speeds">
			{#each movementSpeeds as speed}
				<div class="action-card__speed">
					<i class={speed.icon}></i>
					<span class="action-card__speed-value">
						{speed.value}
						<span class="action-card__speed-unit"
							>{localize('NIMBLE.ui.heroicActions.move.spaces')}</span
						>
					</span>
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
		{localize('NIMBLE.ui.heroicActions.move.confirmMove')}
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
			background: linear-gradient(
				135deg,
				var(--nimble-reaction-move-primary) 0%,
				var(--nimble-reaction-move-secondary) 100%
			);
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
			color: var(--nimble-reaction-move-accent);
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
			background: var(--nimble-reaction-move-light);
			border-radius: 6px;

			i {
				font-size: 0.875rem;
				color: var(--nimble-reaction-move-secondary);
			}
		}

		&__speed-value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-reaction-move-text);
		}

		&__speed-unit {
			font-weight: 500;
			color: var(--nimble-reaction-move-text);
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
			background: linear-gradient(
				135deg,
				var(--nimble-reaction-move-primary) 0%,
				var(--nimble-reaction-move-secondary) 100%
			);
			border: none;
			border-radius: 6px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover:not(:disabled) {
				filter: brightness(1.1);
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
</style>

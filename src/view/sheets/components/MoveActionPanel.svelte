<script>
	import localize from '../../../utils/localize.js';

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;

	let { actor, inCombat = false, actionsRemaining = 0, onDeductAction = async () => {} } = $props();

	let movementSpeeds = $derived.by(() => {
		const movement = actor.system?.attributes?.movement ?? {};
		const speeds = [];

		// Always show walk first if it exists
		if (movement.walk > 0) {
			speeds.push({
				type: 'walk',
				value: movement.walk,
				label: game.i18n.localize(movementTypes.walk),
				icon: movementTypeIcons.walk,
			});
		}

		// Add other movement types if non-zero
		for (const type of ['fly', 'climb', 'swim', 'burrow']) {
			if (movement[type] > 0) {
				speeds.push({
					type,
					value: movement[type],
					label: game.i18n.localize(movementTypes[type]),
					icon: movementTypeIcons[type],
				});
			}
		}

		return speeds;
	});

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
				color: hsl(210, 60%, 50%);
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
			background: hsla(45, 70%, 50%, 0.1);
			border: 1px solid hsla(45, 70%, 50%, 0.3);
			border-radius: 4px;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: hsl(45, 60%, 35%);

			i {
				color: hsl(45, 70%, 45%);
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

	:global(.theme-dark) .move-panel {
		&__speed i {
			color: hsl(210, 70%, 65%);
		}

		&__info {
			background: hsla(45, 70%, 50%, 0.15);
			border-color: hsla(45, 70%, 50%, 0.4);
			color: hsl(45, 60%, 65%);

			i {
				color: hsl(45, 70%, 55%);
			}
		}
	}
</style>

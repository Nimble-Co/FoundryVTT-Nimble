<script>
	import localize from '../../utils/localize.js';

	let { document, dialog, deductActionPip, inCombat = false } = $props();

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;

	// Get movement speeds, filtering to only show non-zero values
	let movementSpeeds = $derived.by(() => {
		const movement = document.system?.attributes?.movement ?? {};
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

	async function handleConfirm() {
		// Deduct action pip if in combat
		if (inCombat) {
			await deductActionPip();
		}

		// Send chat message
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: document }),
			content: localize('NIMBLE.ui.heroicActions.moveAction', { name: document.name }),
		});

		dialog.submit({ confirmed: true });
	}

	function handleCancel() {
		dialog.close();
	}
</script>

<article class="nimble-sheet__body move-dialog">
	<section class="move-dialog__content">
		<div class="move-dialog__icon-wrapper">
			<i class="fa-solid fa-person-running move-dialog__icon"></i>
		</div>

		<h3 class="move-dialog__title">{localize('NIMBLE.ui.heroicActions.move.confirmTitle')}</h3>

		<p class="move-dialog__description">
			{localize('NIMBLE.ui.heroicActions.move.confirmDescription')}
		</p>

		{#if movementSpeeds.length > 0}
			<div class="move-dialog__speeds">
				<span class="move-dialog__speeds-label"
					>{localize('NIMBLE.ui.heroicActions.move.yourMovement')}</span
				>
				<div class="move-dialog__speeds-list">
					{#each movementSpeeds as speed}
						<div class="move-dialog__speed">
							<i class={speed.icon}></i>
							<span class="move-dialog__speed-value">{speed.value}</span>
							<span class="move-dialog__speed-label">{speed.label}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="move-dialog__warning">
			<i class="fa-solid fa-circle-info"></i>
			<span>{localize('NIMBLE.ui.heroicActions.move.actionCost')}</span>
		</div>
	</section>
</article>

<footer class="nimble-sheet__footer move-dialog__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={handleCancel}>
		{localize('NIMBLE.ui.heroicActions.move.cancel')}
	</button>
	<button class="nimble-button" data-button-variant="primary" onclick={handleConfirm}>
		<i class="fa-solid fa-check"></i>
		{localize('NIMBLE.ui.heroicActions.move.confirm')}
	</button>
</footer>

<style lang="scss">
	.move-dialog {
		padding: 1.25rem;

		&__content {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.75rem;
			text-align: center;
		}

		&__icon-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 3.5rem;
			height: 3.5rem;
			background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 70%, 40%) 100%);
			border-radius: 50%;
			box-shadow: 0 4px 12px hsla(210, 70%, 40%, 0.3);
		}

		&__icon {
			font-size: 1.5rem;
			color: white;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.5;
		}

		&__speeds {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			padding: 0.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 8px;
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
			justify-content: center;
			gap: 0.75rem;
		}

		&__speed {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.625rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 4px;

			i {
				font-size: 0.875rem;
				color: hsl(210, 60%, 50%);
			}
		}

		&__speed-value {
			font-size: var(--nimble-md-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__speed-label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__warning {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.5rem 0.75rem;
			background: hsla(45, 70%, 50%, 0.1);
			border: 1px solid hsla(45, 70%, 50%, 0.3);
			border-radius: 6px;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: hsl(45, 60%, 35%);

			i {
				color: hsl(45, 70%, 45%);
			}
		}

		&__footer {
			display: flex;
			gap: 0.5rem;

			.nimble-button {
				flex: 1;
				padding: 0.625rem 1rem;
				font-size: var(--nimble-sm-text);
				font-weight: 600;
			}

			.nimble-button[data-button-variant='primary'] {
				background: var(--nimble-box-background-color);
				border: 2px solid hsl(45, 60%, 45%);
				color: var(--nimble-dark-text-color);

				&:hover {
					background: hsla(45, 60%, 50%, 0.15);
					border-color: hsl(45, 60%, 50%);
				}

				i {
					margin-right: 0.375rem;
					color: hsl(45, 60%, 45%);
				}
			}
		}
	}

	:global(.theme-dark) .move-dialog {
		&__warning {
			background: hsla(45, 70%, 50%, 0.15);
			border-color: hsla(45, 70%, 50%, 0.4);
			color: hsl(45, 60%, 65%);

			i {
				color: hsl(45, 70%, 55%);
			}
		}

		&__speed i {
			color: hsl(210, 70%, 65%);
		}

		&__footer .nimble-button[data-button-variant='primary'] {
			background: hsl(220, 15%, 18%);
			border-color: hsl(45, 70%, 55%);
			color: var(--nimble-light-text-color);

			&:hover {
				background: hsla(45, 60%, 50%, 0.2);
				border-color: hsl(45, 70%, 60%);
			}

			i {
				color: hsl(45, 70%, 60%);
			}
		}
	}
</style>

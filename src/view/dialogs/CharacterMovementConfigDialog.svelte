<script>
	import localize from '../../utils/localize.js';
	import {
		collectMovementGrants,
		collectSpeedBonuses,
	} from './CharacterMovementConfigDialog.utils.js';

	let { document } = $props();

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;
	const movementKeys = ['walk', 'fly', 'climb', 'swim', 'burrow'];

	// Get base movement values from source (before rule modifications)
	let baseMovement = $derived(document._source?.system?.attributes?.movement ?? {});

	// Get current (derived) movement values with bonuses applied
	let currentMovement = $derived(document.reactive?.system?.attributes?.movement ?? {});

	// Collect speed bonuses from rules, grouped by movement type and item
	let speedBonusesByType = $derived.by(() =>
		collectSpeedBonuses(document.reactive.items, document.getRollData?.() ?? {}),
	);

	// Collect movement grants from grantMovement rules, grouped by movement type
	let movementGrantsByType = $derived.by(() =>
		collectMovementGrants(document.reactive.items, document.getRollData?.() ?? {}),
	);

	// Get bonuses for a specific movement type
	function getBonusesForType(type) {
		return speedBonusesByType[type] ?? [];
	}

	// Get grants for a specific movement type
	function getGrantsForType(type) {
		return movementGrantsByType[type] ?? [];
	}

	// Get total bonus for a specific movement type
	function getTotalBonusForType(type) {
		return getBonusesForType(type).reduce((acc, b) => acc + b.value, 0);
	}

	function updateMovement(key, value) {
		document.update({
			[`system.attributes.movement.${key}`]: Number.parseInt(value, 10) || 0,
		});
	}

	function formatBonus(value) {
		return value >= 0 ? `+${value}` : `${value}`;
	}
</script>

<section class="nimble-sheet__body nimble-movement-config">
	<!-- Movement Types Grid -->
	<div class="movement-grid">
		{#each movementKeys as key}
			{@const icon = movementTypeIcons[key]}
			{@const label = localize(movementTypes[key])}
			{@const baseValue = baseMovement[key] ?? 0}
			{@const currentValue = currentMovement[key] ?? 0}
			{@const bonuses = getBonusesForType(key)}
			{@const grants = getGrantsForType(key)}
			{@const totalBonus = getTotalBonusForType(key)}
			{@const hasModifiers = totalBonus !== 0 || grants.length > 0}

			<div class="movement-card" class:movement-card--has-bonus={hasModifiers}>
				<div class="movement-card__header">
					<i class="movement-card__icon {icon}"></i>
					<span class="movement-card__label">{label}</span>
				</div>

				<div class="movement-card__body">
					<div class="movement-card__input-wrapper">
						<input
							class="movement-card__input"
							type="number"
							data-look="plain"
							min="0"
							value={baseValue}
							onchange={({ target }) => updateMovement(key, target.value)}
						/>
						<span class="movement-card__unit">{localize('NIMBLE.movementConfig.spaces')}</span>
					</div>

					{#if hasModifiers}
						<div class="movement-card__bonus-list">
							{#each grants as grant}
								<div class="movement-card__bonus-item">
									<span class="movement-card__bonus-item-name">{grant.itemName}</span>
									<span class="movement-card__bonus-value">
										= {grant.value}
									</span>
								</div>
							{/each}
							{#each bonuses as bonus}
								<div class="movement-card__bonus-item">
									<span class="movement-card__bonus-item-name">{bonus.itemName}</span>
									<span
										class="movement-card__bonus-value"
										class:movement-card__bonus-value--negative={bonus.value < 0}
									>
										{formatBonus(bonus.value)}
									</span>
								</div>
							{/each}
						</div>
						<div class="movement-card__total">
							<span class="movement-card__total-label"
								>{localize('NIMBLE.movementConfig.total')}</span
							>
							<span class="movement-card__total-value">{currentValue}</span>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<aside class="movement-note">
		<i class="fa-solid fa-circle-info"></i>
		<span>{localize('NIMBLE.movementConfig.gridSpacesNote')}</span>
	</aside>
</section>

<style lang="scss">
	:global(.nimble-window) .nimble-sheet__body.nimble-movement-config {
		padding: 4px 12px 12px;
	}

	.nimble-movement-config {
		--nimble-sheet-body-padding-block-start: 0.5rem;

		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}

	.movement-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 8px;
		align-items: stretch;
	}

	.movement-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		height: 100%;
		padding: 5px 8px 6px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		background: none;
		box-shadow: none;

		&__header {
			display: flex;
			align-items: center;
			gap: 4px;
			white-space: nowrap;
		}

		&__icon {
			font-size: 0.688rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__label {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-ui-ink-dim);
		}

		&__body {
			display: flex;
			flex: 1;
			flex-direction: column;
			gap: 4px;
		}

		&__input-wrapper {
			display: flex;
			align-items: baseline;
			gap: 6px;
		}

		&__input {
			flex: none;
			width: 2.75rem;
			min-width: 0;
			height: 26px;
			margin: 0;
			padding: 0 2px;
			border: 0;
			border-bottom: 1px dashed var(--nimble-ui-ring);
			border-radius: 0;
			background: none;
			box-shadow: none;
			outline: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.875rem;
			font-weight: 700;
			text-align: center;
			color: var(--nimble-ui-ink);
			appearance: textfield;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				display: none;
			}

			&:focus {
				border-bottom: 1px solid var(--nimble-ui-highlight);
				box-shadow: none;
				outline: none;
			}
		}

		&__unit {
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
		}

		&__bonus-list {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		&__bonus-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 6px;
			font-size: 0.75rem;
		}

		&__bonus-item-name {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__bonus-value {
			flex: none;
			font-weight: 700;
			color: var(--nimble-ui-action);

			&--negative {
				color: var(--nimble-ui-vital);
			}
		}

		&__total {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: auto;
			padding: 4px 0 0;
			border-top: 1px solid var(--nimble-ui-soft);
			border-radius: 0;
			background: none;
		}

		&__total-label {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-ui-ink-dim);
		}

		&__total-value {
			font-size: 1rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}
	}

	.movement-note {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0 4px;
		border: 0;
		background: none;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);

		i {
			color: var(--nimble-ui-ink-dim);
		}
	}
</style>

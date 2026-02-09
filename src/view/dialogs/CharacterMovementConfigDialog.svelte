<script>
	import localize from '../../utils/localize.js';
	import getDeterministicBonus from '../../dice/getDeterministicBonus.js';

	let { document } = $props();

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;
	const movementKeys = ['walk', 'fly', 'climb', 'swim', 'burrow'];

	// Get base movement values from source (before rule modifications)
	let baseMovement = $derived(document._source?.system?.attributes?.movement ?? {});

	// Get current (derived) movement values with bonuses applied
	let currentMovement = $derived(document.reactive?.system?.attributes?.movement ?? {});

	// Collect speed bonuses from rules, grouped by movement type
	let speedBonusesByType = $derived.by(() => {
		const bonusesByType = {};
		const rollData = document.getRollData?.() ?? {};

		for (const item of document.items ?? []) {
			if (!item.rules) continue;

			for (const rule of item.rules.values()) {
				if (rule.type !== 'speedBonus') continue;
				if (rule.disabled) continue;

				const value = getDeterministicBonus(rule.value, rollData) ?? 0;
				if (value === 0) continue;

				// Check if movementType was explicitly set in source data
				const hasExplicitMovementType = rule._source?.movementType !== undefined;

				if (hasExplicitMovementType) {
					// Specific movement type bonus (e.g., "gain climb = walk")
					const movementType = rule.movementType;
					bonusesByType[movementType] ??= [];
					bonusesByType[movementType].push({
						itemName: item.name,
						label: rule.label,
						value,
					});
				} else {
					// Generic speed bonus: only applies to walk
					// (other movement types granted via formula inherit walk's bonuses)
					bonusesByType['walk'] ??= [];
					bonusesByType['walk'].push({
						itemName: item.name,
						label: rule.label,
						value,
					});
				}
			}
		}

		return bonusesByType;
	});

	// Get bonuses for a specific movement type
	function getBonusesForType(type) {
		return speedBonusesByType[type] ?? [];
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
			{@const totalBonus = getTotalBonusForType(key)}
			{@const hasBonus = totalBonus !== 0}

			<div class="movement-card" class:movement-card--has-bonus={hasBonus}>
				<div class="movement-card__header">
					<i class="movement-card__icon {icon}"></i>
					<span class="movement-card__label">{label}</span>
				</div>

				<div class="movement-card__body">
					<div class="movement-card__input-wrapper">
						<input
							class="movement-card__input"
							type="number"
							min="0"
							value={baseValue}
							onchange={({ target }) => updateMovement(key, target.value)}
						/>
						<span class="movement-card__unit">spaces</span>
					</div>

					{#if hasBonus}
						<div class="movement-card__bonus-list">
							{#each bonuses as bonus}
								<div class="movement-card__bonus-item">
									<div class="movement-card__bonus-source">
										<span class="movement-card__bonus-item-name">{bonus.itemName}</span>
										{#if bonus.label && bonus.label !== bonus.itemName}
											<span class="movement-card__bonus-label">{bonus.label}</span>
										{/if}
									</div>
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
							<span class="movement-card__total-label">Total</span>
							<span class="movement-card__total-value">{currentValue}</span>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<aside class="movement-note">
		<i class="fa-solid fa-circle-info"></i>
		<span>All measurements are in grid spaces.</span>
	</aside>
</section>

<style lang="scss">
	.nimble-movement-config {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.movement-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.5rem;
	}

	.movement-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border-radius: 6px;
		border: 1px solid var(--nimble-card-border-color);

		&--has-bonus {
			border-color: hsl(200, 50%, 50%);
			background: linear-gradient(
				to bottom,
				var(--nimble-box-background-color),
				hsl(200, 30%, 95%)
			);
		}

		&__header {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding-bottom: 0.375rem;
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__icon {
			font-size: 0.875rem;
			color: var(--nimble-accent-color);
		}

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__input-wrapper {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__input {
			width: 3.5rem;
			padding: 0.375rem;
			font-size: var(--nimble-md-text);
			font-weight: 600;
			text-align: center;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-input-background-color);
			color: var(--nimble-dark-text-color);

			&:focus {
				outline: 2px solid var(--nimble-accent-color);
				outline-offset: -1px;
				border-color: var(--nimble-accent-color);
			}
		}

		&__unit {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__total {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0.25rem 0.375rem;
			background: hsl(200, 50%, 45%);
			border-radius: 4px;
		}

		&__total-label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: hsl(200, 30%, 95%);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__total-value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: #fff;
		}

		&__bonus-list {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__bonus-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: var(--nimble-xs-text);
		}

		&__bonus-source {
			display: flex;
			flex-direction: column;
			gap: 0.0625rem;
		}

		&__bonus-item-name {
			color: var(--nimble-dark-text-color);
			font-weight: 500;
		}

		&__bonus-label {
			color: var(--nimble-medium-text-color);
			font-size: var(--nimble-2xs-text, 0.625rem);
		}

		&__bonus-value {
			font-weight: 600;
			color: hsl(139, 50%, 40%);

			&--negative {
				color: hsl(0, 50%, 50%);
			}
		}
	}

	.movement-note {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);

		i {
			color: var(--nimble-accent-color);
		}
	}
</style>

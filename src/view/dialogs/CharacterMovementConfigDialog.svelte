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

	// Collect speed bonuses from rules
	let speedBonuses = $derived.by(() => {
		const bonuses = [];
		const rollData = document.getRollData?.() ?? {};

		for (const item of document.items ?? []) {
			if (!item.rules) continue;

			for (const rule of item.rules.values()) {
				if (rule.type !== 'speedBonus') continue;
				if (rule.disabled) continue;

				const value = getDeterministicBonus(rule.value, rollData) ?? 0;

				if (value !== 0) {
					bonuses.push({
						name: item.name,
						value,
					});
				}
			}
		}

		return bonuses;
	});

	let totalSpeedBonus = $derived(speedBonuses.reduce((acc, b) => acc + b.value, 0));

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
			{@const hasBonus = key === 'walk' && totalSpeedBonus !== 0}

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
						<div class="movement-card__total">
							<span class="movement-card__total-label">Total</span>
							<span class="movement-card__total-value">{currentValue}</span>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Speed Bonuses from Rules -->
	{#if speedBonuses.length > 0}
		<div class="speed-bonuses">
			<div class="speed-bonuses__header">
				<i class="fa-solid fa-bolt"></i>
				<span>Speed Bonuses</span>
			</div>

			<div class="speed-bonuses__list">
				{#each speedBonuses as bonus}
					<div class="speed-bonus-item">
						<span class="speed-bonus-item__name">{bonus.name}</span>
						<span
							class="speed-bonus-item__value"
							class:speed-bonus-item__value--negative={bonus.value < 0}
						>
							{formatBonus(bonus.value)}
						</span>
					</div>
				{/each}
			</div>

			<div class="speed-bonuses__total">
				<span class="speed-bonuses__total-label">Total Bonus</span>
				<span
					class="speed-bonuses__total-value"
					class:speed-bonuses__total-value--negative={totalSpeedBonus < 0}
				>
					{formatBonus(totalSpeedBonus)}
				</span>
			</div>
		</div>
	{/if}

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
	}

	.speed-bonuses {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border-radius: 6px;
		border: 1px solid var(--nimble-card-border-color);

		&__header {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);

			i {
				color: hsl(45, 70%, 50%);
			}
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__total {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: 0.5rem;
			margin-top: 0.25rem;
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__total-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__total-value {
			font-size: var(--nimble-md-text);
			font-weight: 700;
			color: hsl(139, 50%, 40%);

			&--negative {
				color: hsl(0, 50%, 50%);
			}
		}
	}

	.speed-bonus-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0.375rem;
		background: var(--nimble-input-background-color);
		border-radius: 4px;

		&__name {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__value {
			font-size: var(--nimble-sm-text);
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

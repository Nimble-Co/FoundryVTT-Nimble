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

	// Collect speed bonuses from rules, grouped by movement type and item
	let speedBonusesByType = $derived.by(() => {
		const bonusesByType = {};
		const rollData = document.getRollData?.() ?? {};

		for (const item of document.items ?? []) {
			if (!item.rules) continue;

			// Group bonuses by movement type for this item
			// Track value and unique labels that differ from item name
			const itemBonusesByType = {};

			for (const rule of item.rules.values()) {
				if (rule.type !== 'speedBonus') continue;
				if (rule.disabled) continue;

				// Only include rules that pass their predicate
				if (rule.test && !rule.test()) continue;

				const value = getDeterministicBonus(rule.value, rollData) ?? 0;
				if (value === 0) continue;

				// Check if movementType was explicitly set in source data
				const hasExplicitMovementType = rule._source?.movementType !== undefined;
				const movementType = hasExplicitMovementType ? rule.movementType : 'walk';

				// Initialize tracking for this movement type
				itemBonusesByType[movementType] ??= { value: 0, labels: new Set() };
				itemBonusesByType[movementType].value += value;

				// Track label if it's meaningfully different from the item name
				// (not just the item name with a suffix like "(2)" or "(9)")
				const label = rule.label ?? '';
				const isLabelDifferent = label && !label.startsWith(item.name);
				if (isLabelDifferent) {
					itemBonusesByType[movementType].labels.add(label);
				}
			}

			// Add accumulated bonuses for this item to the main list
			for (const [movementType, data] of Object.entries(itemBonusesByType)) {
				if (data.value === 0) continue;
				bonusesByType[movementType] ??= [];

				// Build display name: "ItemName" or "ItemName — Label" if label differs
				const uniqueLabels = [...data.labels];
				const displayName =
					uniqueLabels.length > 0 ? `${item.name} — ${uniqueLabels.join(', ')}` : item.name;

				bonusesByType[movementType].push({
					itemName: displayName,
					value: data.value,
				});
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
						<span class="movement-card__unit">{localize('NIMBLE.movementConfig.spaces')}</span>
					</div>

					{#if hasBonus}
						<div class="movement-card__bonus-list">
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
		align-items: stretch;
	}

	.movement-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border-radius: 6px;
		border: 1px solid var(--nimble-card-border-color);
		height: 100%;

		&--has-bonus {
			border-color: var(--nimble-accent-color);
			background: linear-gradient(
				to bottom,
				var(--nimble-box-background-color),
				color-mix(in srgb, var(--nimble-accent-color) 10%, var(--nimble-box-background-color))
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
			flex: 1;
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
			background: var(--nimble-accent-color);
			border-radius: 4px;
			margin-top: auto;
		}

		&__total-label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: white;
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__total-value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: white;
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

		&__bonus-item-name {
			color: var(--nimble-dark-text-color);
			font-weight: 500;
		}

		&__bonus-value {
			font-weight: 600;
			color: var(--nimble-roll-success-color);

			&--negative {
				color: var(--nimble-roll-failure-color);
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

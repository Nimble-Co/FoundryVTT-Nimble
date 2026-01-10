<script>
	import arraysAreEqual from '../../utils/arraysAreEqual.js';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function checkBaseStatsMatchCoreArray(characterAbilityScores) {
		const baseScores = Object.values(characterAbilityScores).map(({ baseValue }) => baseValue);

		return Object.values(statArrayModifiers).some((standardArrayOption) =>
			arraysAreEqual(standardArrayOption, baseScores),
		);
	}

	/**
	 * Extracts ability bonus sources from all items on the character
	 * Returns a map of ability -> array of { itemName, value }
	 */
	function getAbilityBonusSources(actor) {
		const bonusSources = Object.keys(abilityScores).reduce((acc, key) => {
			acc[key] = [];
			return acc;
		}, {});

		if (!actor?.items) return bonusSources;

		for (const item of actor.items) {
			if (!item.rules) continue;

			for (const [, rule] of item.rules) {
				if (rule.type !== 'abilityBonus') continue;
				if (rule.disabled) continue;

				let abilities = rule.abilities ?? [];
				if (abilities.includes('all')) {
					abilities = Object.keys(abilityScores);
				}

				const value =
					typeof rule.value === 'string' ? parseInt(rule.value, 10) || 0 : (rule.value ?? 0);

				if (value === 0) continue;

				for (const ability of abilities) {
					if (bonusSources[ability]) {
						bonusSources[ability].push({
							itemName: item.name,
							itemId: item.id,
							value,
						});
					}
				}
			}
		}

		return bonusSources;
	}

	/**
	 * Prepares the ability score increase data from class levels
	 */
	function prepareAbilityScoreIncreases(abilityScoreData, currentClassLevel) {
		if (!abilityScoreData || currentClassLevel === 0) return [];

		const increases = [];

		Object.entries(abilityScoreData).forEach(([level, data]) => {
			if (Number(level) > currentClassLevel) return;

			const { statIncreaseType, type, value } = data;

			if (type === 'boon') {
				increases.push({
					level: Number(level),
					type: 'boon',
					statIncreaseType: null,
					value,
					label: `Level ${level}`,
				});
				return;
			}

			// Handle both single values and arrays (for capstone)
			const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

			increases.push({
				level: Number(level),
				type: 'statIncrease',
				statIncreaseType,
				selectedAbilities: selectedValues,
				label: `Level ${level}`,
			});
		});

		return increases.sort((a, b) => a.level - b.level);
	}

	function toggleStatIncreaseOption(level, key) {
		if (!characterClass) return;

		const currentData = characterClass.system.abilityScoreData?.[level];
		if (!currentData) return;

		const { value, statIncreaseType } = currentData;

		// For capstone, toggle between adding/removing from array (max 2)
		if (statIncreaseType === 'capstone') {
			let newValue;

			if (!value || value.length === 0) {
				newValue = [key];
			} else if (Array.isArray(value)) {
				if (value.includes(key)) {
					newValue = value.filter((k) => k !== key);
				} else if (value.length < 2) {
					newValue = [...value, key];
				} else {
					// Already have 2 selected, replace the first one
					newValue = [value[1], key];
				}
			} else {
				// Value is a string, convert to array
				newValue = value === key ? [] : [value, key];
			}

			return document.updateItem(characterClass._id, {
				[`system.abilityScoreData.${level}.value`]: newValue,
			});
		}

		// For normal stat increases, just set the single value
		return document.updateItem(characterClass._id, {
			[`system.abilityScoreData.${level}.value`]: key,
		});
	}

	function updateBaseAbilityScore(abilityKey, newValue) {
		document.update({
			[`system.abilities.${abilityKey}.baseValue`]: newValue,
		});
	}

	function formatModifier(value) {
		return replaceHyphenWithMinusSign(
			new Intl.NumberFormat('en-US', {
				signDisplay: 'always',
			}).format(value),
		);
	}

	function getStatIncreaseTypeLabel(type) {
		const labels = {
			primary: 'Primary',
			secondary: 'Secondary',
			capstone: 'Capstone',
		};
		return labels[type] ?? type;
	}

	function getStatIncreaseTypeTooltip(type) {
		const tooltips = {
			primary: "Choose one of your class's key ability scores",
			secondary: 'Choose one ability score that is not a key ability',
			capstone: 'Choose any two ability scores',
		};
		return tooltips[type] ?? '';
	}

	const { abilityScores, statArrayModifiers } = CONFIG.NIMBLE;
	const abilityScoreKeys = Object.keys(abilityScores);
	const abilityScoreLabels = Object.values(abilityScores);
	const abilityScoreCount = abilityScoreLabels.length;

	let { document } = $props();

	// Get class data directly from reactive document each time to ensure proper reactivity
	let characterClass = $derived(document.reactive.items.find((item) => item.type === 'class'));

	let characterAbilityScores = $derived(document.reactive.system.abilities);
	let keyAbilityScores = $derived(characterClass?.system?.keyAbilityScores ?? []);

	let baseStatsMatchCoreArray = $derived(checkBaseStatsMatchCoreArray(characterAbilityScores));

	let abilityBonusSources = $derived(getAbilityBonusSources(document.reactive));

	// Use $derived.by to ensure reactive tracking of nested class properties
	let abilityScoreIncreases = $derived.by(() => {
		const classItem = document.reactive.items.find((item) => item.type === 'class');
		if (!classItem) return [];

		const classLevel = classItem.system?.classLevel ?? 0;
		const abilityScoreData = classItem.system?.abilityScoreData ?? {};

		return prepareAbilityScoreIncreases(abilityScoreData, classLevel);
	});

	let classASI = $derived.by(() => {
		const classItem = document.reactive.items.find((item) => item.type === 'class');
		return classItem?.ASI ?? {};
	});

	// Calculate totals for each section
	let bonusTotals = $derived(
		abilityScoreKeys.reduce((acc, key) => {
			acc[key] = abilityBonusSources[key]?.reduce((sum, source) => sum + source.value, 0) ?? 0;
			return acc;
		}, {}),
	);

	let asiTotals = $derived(
		abilityScoreKeys.reduce((acc, key) => {
			acc[key] = classASI[key] ?? 0;
			return acc;
		}, {}),
	);
</script>

{#snippet sectionHeader(title, subtitle = null)}
	<tr class="nimble-stat-config__section-header">
		<th colspan={abilityScoreCount + 1}>
			<div class="nimble-stat-config__section-title">
				<span class="nimble-stat-config__section-title-text">{title}</span>
				{#if subtitle}
					<span class="nimble-stat-config__section-subtitle">{subtitle}</span>
				{/if}
			</div>
		</th>
	</tr>
{/snippet}

{#snippet abilityToggle(level, type, key, active)}
	{@const validityTest =
		type === 'capstone'
			? true
			: type === 'primary'
				? keyAbilityScores.includes(key)
				: !keyAbilityScores.includes(key)}

	<td class="nimble-stat-config__toggle-cell">
		{#if validityTest}
			<button
				class="nimble-stat-config__toggle"
				class:nimble-stat-config__toggle--active={active}
				aria-label="Toggle Stat Increase"
				data-tooltip="Toggle Stat Increase"
				onclick={() => toggleStatIncreaseOption(level, key)}
			>
				{#if active}
					<span class="nimble-stat-config__toggle-value">+1</span>
				{/if}
			</button>
		{:else}
			<span class="nimble-stat-config__toggle-unavailable">-</span>
		{/if}
	</td>
{/snippet}

<section class="nimble-sheet__body nimble-sheet__body--ability-score-config">
	{#if !baseStatsMatchCoreArray}
		<aside class="nimble-stat-config__warning">
			<i class="nimble-stat-config__warning-icon fa-solid fa-circle-exclamation"></i>
			<span>Your base scores do not match any of the standard Nimble stat arrays.</span>
		</aside>
	{/if}

	<div class="nimble-stat-config">
		<table class="nimble-stat-config__table">
			<!-- Header Row -->
			<thead>
				<tr class="nimble-stat-config__header-row">
					<th class="nimble-stat-config__row-label"></th>
					{#each abilityScoreKeys as abilityKey, i}
						{@const isKeyAbility = keyAbilityScores.includes(abilityKey)}
						<th
							class="nimble-stat-config__ability-header"
							class:nimble-stat-config__ability-header--key={isKeyAbility}
						>
							{#if isKeyAbility}
								<span class="nimble-stat-config__key-indicator" data-tooltip="Key Ability Score">
									<i class="fa-solid fa-star"></i>
								</span>
							{/if}
							<span class="nimble-stat-config__ability-name">{abilityScoreLabels[i]}</span>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				<!-- Base Values Section -->
				{@render sectionHeader('Base Scores', 'Starting ability scores from character creation')}
				<tr class="nimble-stat-config__data-row">
					<th class="nimble-stat-config__row-label">
						Base Values
						{#if !baseStatsMatchCoreArray}
							<i
								class="nimble-stat-config__warning-indicator fa-solid fa-circle-exclamation"
								data-tooltip="Doesn't match standard array"
							></i>
						{/if}
					</th>
					{#each abilityScoreKeys as abilityKey}
						<td class="nimble-stat-config__input-cell">
							<input
								class="nimble-stat-config__base-input"
								type="number"
								value={characterAbilityScores[abilityKey]?.baseValue ?? 0}
								min="0"
								max="12"
								onchange={({ target }) => updateBaseAbilityScore(abilityKey, Number(target.value))}
							/>
						</td>
					{/each}
				</tr>

				<!-- Bonuses Section -->
				{@render sectionHeader('Bonuses', 'Modifiers from feats, items, and other sources')}

				{#if Object.values(abilityBonusSources).every((sources) => sources.length === 0)}
					<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--empty">
						<td colspan={abilityScoreCount + 1} class="nimble-stat-config__empty-message">
							<i class="fa-regular fa-circle-info"></i>
							No bonuses from feats or items
						</td>
					</tr>
				{:else}
					<!-- Show each unique item that provides bonuses -->
					{@const uniqueItems = new Map()}
					{#each abilityScoreKeys as abilityKey}
						{#each abilityBonusSources[abilityKey] as source}
							{#if !uniqueItems.has(source.itemId)}
								{@const _ = uniqueItems.set(source.itemId, { name: source.itemName, bonuses: {} })}
							{/if}
							{@const item = uniqueItems.get(source.itemId)}
							{@const __ = item.bonuses[abilityKey] =
								(item.bonuses[abilityKey] ?? 0) + source.value}
						{/each}
					{/each}

					{#each [...uniqueItems.values()] as item}
						<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--bonus">
							<th class="nimble-stat-config__row-label nimble-stat-config__row-label--item">
								<i class="fa-solid fa-scroll"></i>
								{item.name}
							</th>
							{#each abilityScoreKeys as abilityKey}
								<td class="nimble-stat-config__value-cell">
									{#if item.bonuses[abilityKey]}
										<span class="nimble-stat-config__bonus-value">
											{formatModifier(item.bonuses[abilityKey])}
										</span>
									{:else}
										<span class="nimble-stat-config__empty-value">-</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}

					<!-- Bonus Subtotal -->
					<tr class="nimble-stat-config__subtotal-row">
						<th class="nimble-stat-config__row-label">Bonus Total</th>
						{#each abilityScoreKeys as abilityKey}
							<td class="nimble-stat-config__value-cell">
								{#if bonusTotals[abilityKey] !== 0}
									<span class="nimble-stat-config__subtotal-value">
										{formatModifier(bonusTotals[abilityKey])}
									</span>
								{:else}
									<span class="nimble-stat-config__empty-value">-</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/if}

				<!-- Level-Up Increases Section -->
				{@render sectionHeader(
					'Ability Score Increases',
					'Improvements gained at certain class levels',
				)}

				{#if abilityScoreIncreases.length === 0}
					<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--empty">
						<td colspan={abilityScoreCount + 1} class="nimble-stat-config__empty-state">
							<div class="nimble-stat-config__empty-state-content">
								<i class="fa-regular fa-hourglass-half nimble-stat-config__empty-state-icon"></i>
								<span class="nimble-stat-config__empty-state-text"
									>No ability score increases available yet</span
								>
								<span class="nimble-stat-config__empty-state-hint"
									>Ability score increases are gained at levels 4, 5, 8, 9, 12, 13, 16, 17, and 20</span
								>
							</div>
						</td>
					</tr>
				{:else}
					{#each abilityScoreIncreases as increase}
						{#if increase.type === 'boon'}
							<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--boon">
								<th class="nimble-stat-config__row-label">
									{increase.label}
									<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--boon">
										Boon
									</span>
								</th>
								<td colspan={abilityScoreCount} class="nimble-stat-config__boon-cell">
									<i class="fa-solid fa-gift"></i>
									Special Boon Available
								</td>
							</tr>
						{:else}
							<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--asi">
								<th class="nimble-stat-config__row-label">
									{increase.label}
									<span
										class="nimble-stat-config__type-badge nimble-stat-config__type-badge--{increase.statIncreaseType}"
										data-tooltip={getStatIncreaseTypeTooltip(increase.statIncreaseType)}
									>
										{getStatIncreaseTypeLabel(increase.statIncreaseType)}
									</span>
								</th>
								{#each abilityScoreKeys as abilityKey}
									{@const isActive = increase.selectedAbilities?.includes(abilityKey)}
									{@render abilityToggle(
										increase.level,
										increase.statIncreaseType,
										abilityKey,
										isActive,
									)}
								{/each}
							</tr>
						{/if}
					{/each}

					<!-- ASI Subtotal -->
					<tr class="nimble-stat-config__subtotal-row">
						<th class="nimble-stat-config__row-label">ASI Total</th>
						{#each abilityScoreKeys as abilityKey}
							<td class="nimble-stat-config__value-cell">
								{#if asiTotals[abilityKey] > 0}
									<span class="nimble-stat-config__subtotal-value">
										{formatModifier(asiTotals[abilityKey])}
									</span>
								{:else}
									<span class="nimble-stat-config__empty-value">-</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/if}

				<!-- Spacer before totals -->
				<tr class="nimble-stat-config__spacer-row">
					<td colspan={abilityScoreCount + 1}></td>
				</tr>
			</tbody>

			<!-- Final Totals -->
			<tfoot>
				<tr class="nimble-stat-config__total-row">
					<th class="nimble-stat-config__row-label nimble-stat-config__row-label--total">
						Final Modifier
					</th>
					{#each abilityScoreKeys as abilityKey}
						<td class="nimble-stat-config__total-cell">
							<span class="nimble-stat-config__total-value">
								{formatModifier(characterAbilityScores[abilityKey]?.mod ?? 0)}
							</span>
						</td>
					{/each}
				</tr>
			</tfoot>
		</table>

		<!-- Legend -->
		<aside class="nimble-stat-config__legend">
			<div class="nimble-stat-config__legend-item">
				<i class="fa-solid fa-star nimble-stat-config__legend-icon--key"></i>
				<span>Key Ability Score</span>
			</div>
			<div class="nimble-stat-config__legend-item">
				<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--primary"
					>Primary</span
				>
				<span>Choose a key ability</span>
			</div>
			<div class="nimble-stat-config__legend-item">
				<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--secondary"
					>Secondary</span
				>
				<span>Choose a non-key ability</span>
			</div>
			<div class="nimble-stat-config__legend-item">
				<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--capstone"
					>Capstone</span
				>
				<span>Choose any two abilities</span>
			</div>
		</aside>
	</div>
</section>

<style lang="scss">
	.nimble-stat-config {
		display: flex;
		flex-direction: column;
		gap: 1rem;

		&__warning {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem 0.75rem;
			margin-bottom: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			background-color: var(--nimble-warning-background-color);
			border: 1px solid var(--nimble-warning-border-color);
			border-radius: 4px;
		}

		&__warning-icon {
			color: var(--nimble-warning-icon-color);
			background: var(--nimble-warning-icon-background-color);
			border-radius: 50%;
		}

		&__warning-indicator {
			margin-left: 0.25rem;
			color: var(--nimble-warning-icon-color);
		}

		&__table {
			width: 100%;
			border-collapse: separate;
			border-spacing: 0;
			background: var(--nimble-box-background-color);
			border-radius: 6px;
			box-shadow: var(--nimble-box-shadow);
			overflow: hidden;
		}

		&__header-row {
			background: var(--nimble-box-background-color);
			border-bottom: 2px solid var(--nimble-box-color);
		}

		&__ability-header {
			padding: 0.75rem 0.5rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-dark-text-color);
			position: relative;
			vertical-align: middle;

			&--key {
				box-shadow: inset 0 -3px 0 0 var(--nimble-box-color);
			}
		}

		&__ability-name {
			display: block;
			line-height: 1.3;
		}

		&__key-indicator {
			position: absolute;
			top: 0.25rem;
			right: 0.25rem;
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
			line-height: 1;
		}

		&__section-header {
			th {
				padding: 0;
				border: 0;
			}
		}

		&__section-title {
			display: flex;
			align-items: baseline;
			gap: 0.75rem;
			padding: 0.625rem 0.75rem;
			background: hsla(0, 0%, 0%, 0.04);
			border-top: 1px solid var(--nimble-card-border-color);
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__section-title-text {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-dark-text-color);
		}

		&__section-subtitle {
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__row-label {
			padding: 0.5rem 0.75rem;
			text-align: left;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			white-space: nowrap;

			&--item {
				font-weight: 500;

				i {
					margin-right: 0.375rem;
					color: var(--nimble-medium-text-color);
				}
			}

			&--total {
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.03em;
			}
		}

		&__data-row {
			&:hover {
				background: hsla(0, 0%, 0%, 0.02);
			}

			&--empty {
				&:hover {
					background: transparent;
				}
			}

			&--bonus,
			&--asi {
				border-bottom: 1px solid hsla(0, 0%, 0%, 0.05);
			}
		}

		&__empty-message {
			padding: 1rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;

			i {
				margin-right: 0.375rem;
			}
		}

		&__empty-state {
			padding: 1.5rem 1rem;
		}

		&__empty-state-content {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.5rem;
			padding: 1rem;
			background: var(--nimble-hint-background-color);
			border: 1px dashed var(--nimble-hint-border-color);
			border-radius: 6px;
		}

		&__empty-state-icon {
			font-size: var(--nimble-xl-text);
			color: var(--nimble-medium-text-color);
			opacity: 0.6;
		}

		&__empty-state-text {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__empty-state-hint {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			text-align: center;
		}

		&__spacer-row {
			td {
				height: 0.75rem;
				padding: 0;
				background: linear-gradient(
					to bottom,
					transparent 0%,
					transparent 40%,
					var(--nimble-card-border-color) 40%,
					var(--nimble-card-border-color) 60%,
					transparent 60%,
					transparent 100%
				);
			}
		}

		&__input-cell {
			padding: 0.375rem;
			text-align: center;
		}

		&__base-input {
			display: block;
			width: 3rem;
			height: 1.75rem;
			margin: 0 auto;
			padding: 0.25rem;
			font-size: var(--nimble-md-text);
			font-weight: 600;
			text-align: center;
			color: var(--nimble-dark-text-color);
			background-color: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 2px;
			outline: none;
			box-shadow: none;
			transition: var(--nimble-standard-transition);

			&:hover,
			&:focus {
				border-color: var(--nimble-input-focus-border-color);
				outline: none;
				box-shadow: none;
			}
		}

		&__value-cell {
			padding: 0.5rem;
			text-align: center;
		}

		&__bonus-value {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: hsl(145, 50%, 35%);
		}

		&__empty-value {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			opacity: 0.5;
		}

		&__subtotal-row {
			background: hsla(0, 0%, 0%, 0.03);
			border-top: 1px dashed var(--nimble-card-border-color);
		}

		&__subtotal-value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__type-badge {
			display: inline-block;
			margin-left: 0.5rem;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xxs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			border-radius: 3px;
			vertical-align: middle;

			&--primary {
				background: hsla(200, 70%, 50%, 0.15);
				color: hsl(200, 70%, 35%);
			}

			&--secondary {
				background: hsla(280, 50%, 50%, 0.15);
				color: hsl(280, 50%, 40%);
			}

			&--capstone {
				background: hsla(45, 90%, 50%, 0.2);
				color: hsl(35, 80%, 35%);
			}

			&--boon {
				background: hsla(320, 60%, 50%, 0.15);
				color: hsl(320, 60%, 40%);
			}
		}

		&__toggle-cell {
			padding: 0.375rem;
			text-align: center;
		}

		&__toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			margin: 0;
			padding: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
			background: hsla(0, 0%, 0%, 0.05);
			border: 2px solid var(--nimble-card-border-color);
			border-radius: 50%;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				background: hsla(0, 0%, 0%, 0.1);
				border-color: var(--nimble-medium-text-color);
				transform: scale(1.1);
			}

			&--active {
				color: white;
				background: hsl(145, 50%, 40%);
				border-color: hsl(145, 50%, 35%);

				&:hover {
					background: hsl(145, 50%, 45%);
					border-color: hsl(145, 50%, 40%);
				}
			}
		}

		&__toggle-value {
			line-height: 1;
		}

		&__toggle-unavailable {
			color: var(--nimble-medium-text-color);
			opacity: 0.3;
		}

		&__boon-cell {
			padding: 0.5rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: hsl(320, 60%, 40%);

			i {
				margin-right: 0.375rem;
			}
		}

		&__total-row {
			background: var(--nimble-box-background-color);
			border-top: 2px solid var(--nimble-box-color);
		}

		&__total-cell {
			padding: 0.75rem 0.5rem;
			text-align: center;
		}

		&__total-value {
			display: inline-block;
			min-width: 2.5rem;
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			border: 1px solid var(--nimble-box-color);
			border-radius: 4px;
		}

		&__legend {
			display: flex;
			flex-wrap: wrap;
			gap: 1rem;
			padding: 0.75rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			background: hsla(0, 0%, 0%, 0.03);
			border-radius: 4px;
		}

		&__legend-item {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}

		&__legend-icon--key {
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
		}
	}
</style>

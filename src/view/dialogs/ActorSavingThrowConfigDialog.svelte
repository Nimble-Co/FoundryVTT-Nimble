<script>
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function formatModifier(value) {
		return replaceHyphenWithMinusSign(
			new Intl.NumberFormat('en-US', {
				signDisplay: 'always',
			}).format(value),
		);
	}

	function formatRollModeLabel(value) {
		if (value > 0) return `Adv ×${value}`;
		if (value < 0) return `Dis ×${Math.abs(value)}`;
		return 'Normal';
	}

	function toggleSavingThrowRollMode(savingThrow, rollMode) {
		return document.update({
			[`system.savingThrows.${savingThrow}.defaultRollMode`]: rollMode,
		});
	}

	function updateSavingThrowBonus(savingThrow, newValue) {
		document.update({
			[`system.savingThrows.${savingThrow}.bonus`]: newValue,
		});
	}

	async function resetSavingThrowRollModes() {
		const classes = document.classes;
		const primaryClass = Object.values(classes)[0];
		if (!primaryClass) return;

		const savingThrowDefaults = primaryClass.system.savingThrows;

		// Start with all saves at 0
		const rollModes = Object.fromEntries(savingThrowKeys.map((key) => [key, 0]));

		// Apply class defaults (+1 advantage, -1 disadvantage)
		if (savingThrowDefaults.advantage) {
			rollModes[savingThrowDefaults.advantage] = 1;
		}
		if (savingThrowDefaults.disadvantage) {
			rollModes[savingThrowDefaults.disadvantage] = -1;
		}

		// Apply savingThrowRollMode rules from ancestry and items
		// Process rules in priority order (same as prePrepareData)
		const allRules = document.items.contents
			.flatMap((item) => [...item.rules.values()])
			.filter((rule) => !rule.disabled && rule.type === 'savingThrowRollMode')
			.sort((a, b) => a.priority - b.priority);

		for (const rule of allRules) {
			// Skip choice-based rules that haven't been configured
			if (rule.requiresChoice && !rule.selectedSave) continue;

			const targetSaves = getTargetSavesForRule(rule, rollModes);

			for (const saveKey of targetSaves) {
				if (rule.mode === 'set') {
					rollModes[saveKey] = rule.value;
				} else {
					// adjust mode
					rollModes[saveKey] = Math.max(-3, Math.min(3, rollModes[saveKey] + rule.value));
				}
			}
		}

		// Build update object
		const updates = {};
		for (const saveKey of savingThrowKeys) {
			updates[`system.savingThrows.${saveKey}.defaultRollMode`] = rollModes[saveKey];
		}

		await document.update(updates);
	}

	function getTargetSavesForRule(rule, currentRollModes) {
		const { target, selectedSave } = rule;

		// If a specific save was selected (for choice-based rules like Fiendkin)
		if (selectedSave && savingThrowKeys.includes(selectedSave)) {
			return [selectedSave];
		}

		// Handle specific save key targets
		if (savingThrowKeys.includes(target)) {
			return [target];
		}

		// Handle special targets
		switch (target) {
			case 'all':
				return savingThrowKeys;

			case 'advantaged':
				return savingThrowKeys.filter((key) => currentRollModes[key] > 0);

			case 'disadvantaged':
				return savingThrowKeys.filter((key) => currentRollModes[key] < 0);

			case 'neutral':
				return savingThrowKeys.filter((key) => currentRollModes[key] === 0);

			default:
				return [];
		}
	}

	const { savingThrows, saveConfig } = CONFIG.NIMBLE;
	const savingThrowKeys = Object.keys(savingThrows);
	const rollModes = [-3, -2, -1, 0, 1, 2, 3];

	let { document } = $props();

	let characterSavingThrows = $derived(document.reactive.system.savingThrows);
	let characterAbilities = $derived(document.reactive.system.abilities);

	// Fix any corrupted rules arrays by restoring from compendium
	async function fixCorruptedRulesArrays() {
		for (const item of document.items) {
			if (item.type !== 'ancestry') continue;

			const rulesArray = item.system?.rules;
			if (!Array.isArray(rulesArray)) continue;

			// Check if any rules are undefined/null or missing type
			const hasCorruption = rulesArray.some((r) => !r || !r.type);
			if (!hasCorruption) continue;

			// Try to restore from compendium
			const sourceId = item.flags?.core?.sourceId;
			if (sourceId) {
				const compendiumItem = await fromUuid(sourceId);
				if (compendiumItem?.system?.rules) {
					// Restore the original rules from compendium
					await item.update({ 'system.rules': compendiumItem.system.rules });
					continue;
				}
			}

			// Fallback: just remove corrupted entries if we can't find compendium source
			const cleanedRules = rulesArray.filter((r) => r && r.type);
			await item.update({ 'system.rules': cleanedRules });
		}
	}

	// Run cleanup on mount
	$effect(() => {
		fixCorruptedRulesArrays();
	});

	// Find all choice-based saving throw rules from items (ancestry, etc.)
	let choiceBasedRules = $derived.by(() => {
		// Access reactive to ensure this derived re-runs when items update
		const _ = document.reactive.items;
		const rules = [];
		for (const item of document.items) {
			if (!item.rules) continue;
			for (const [, rule] of item.rules) {
				if (rule.type === 'savingThrowRollMode' && rule.requiresChoice && !rule.disabled) {
					rules.push({
						rule,
						item,
						label: rule.label || item.name,
						selectedSave: rule.selectedSave,
						target: rule.target,
						value: rule.value,
					});
				}
			}
		}
		return rules;
	});

	// Get available save options for a choice-based rule based on its target
	function getAvailableSavesForRule(rule) {
		const { target } = rule;

		// For 'neutral' target, we need to calculate which saves would be neutral
		// based on class defaults (not current customized values)
		if (target === 'neutral') {
			const classes = document.classes;
			const primaryClass = Object.values(classes)[0];
			if (!primaryClass) return savingThrowKeys;

			const classAdvantage = primaryClass.system?.savingThrows?.advantage;
			const classDisadvantage = primaryClass.system?.savingThrows?.disadvantage;

			return savingThrowKeys.filter((key) => key !== classAdvantage && key !== classDisadvantage);
		}

		// For other targets, return all saves
		return savingThrowKeys;
	}

	// Update the selected save for a choice-based rule
	async function updateRuleSelectedSave(ruleData, newSaveKey) {
		const { rule, item } = ruleData;

		// Use source data, not prepared data, to avoid losing information
		const sourceRules = item._source.system.rules;
		if (!Array.isArray(sourceRules)) return;

		// Find the rule index in the source rules array
		const ruleIndex = sourceRules.findIndex(
			(r) => r.type === 'savingThrowRollMode' && r.requiresChoice && r.label === rule.label,
		);

		if (ruleIndex === -1) return;

		// Create a new rules array with the updated selectedSave
		const updatedRules = sourceRules.map((r, i) => {
			if (i === ruleIndex) {
				return { ...r, selectedSave: newSaveKey };
			}
			return r;
		});

		// Safety check - never update with fewer rules than we started with
		if (updatedRules.length !== sourceRules.length) return;

		// Update the item with the new rules array
		await item.update({ 'system.rules': updatedRules });

		// Recalculate roll modes with the new selection
		await resetSavingThrowRollModes();
	}

	// Check if current roll modes differ from calculated defaults
	let rollModesDifferFromDefaults = $derived.by(() => {
		const classes = document.classes;
		const primaryClass = Object.values(classes)[0];
		if (!primaryClass) return false;

		const savingThrowDefaults = primaryClass.system.savingThrows;

		// Calculate expected defaults (same logic as reset function)
		const expectedRollModes = Object.fromEntries(savingThrowKeys.map((key) => [key, 0]));

		if (savingThrowDefaults.advantage) {
			expectedRollModes[savingThrowDefaults.advantage] = 1;
		}
		if (savingThrowDefaults.disadvantage) {
			expectedRollModes[savingThrowDefaults.disadvantage] = -1;
		}

		// Apply savingThrowRollMode rules
		const allRules = document.items.contents
			.flatMap((item) => [...item.rules.values()])
			.filter((rule) => !rule.disabled && rule.type === 'savingThrowRollMode')
			.sort((a, b) => a.priority - b.priority);

		for (const rule of allRules) {
			if (rule.requiresChoice && !rule.selectedSave) continue;

			const targetSaves = getTargetSavesForRule(rule, expectedRollModes);

			for (const saveKey of targetSaves) {
				if (rule.mode === 'set') {
					expectedRollModes[saveKey] = rule.value;
				} else {
					expectedRollModes[saveKey] = Math.max(
						-3,
						Math.min(3, expectedRollModes[saveKey] + rule.value),
					);
				}
			}
		}

		// Compare current values to expected defaults
		for (const saveKey of savingThrowKeys) {
			const current = characterSavingThrows[saveKey]?.defaultRollMode ?? 0;
			const expected = expectedRollModes[saveKey];
			if (current !== expected) return true;
		}

		return false;
	});
</script>

{#snippet sectionHeader(title, subtitle = null, onReset = null)}
	<tr class="nimble-save-config__section-header">
		<th colspan={savingThrowKeys.length + 1}>
			<div class="nimble-save-config__section-title">
				<span class="nimble-save-config__section-title-text">{title}</span>
				{#if subtitle}
					<span class="nimble-save-config__section-subtitle">{subtitle}</span>
				{/if}
				{#if onReset}
					<button
						class="nimble-save-config__reset-btn"
						type="button"
						aria-label={saveConfig.resetToClassDefaults}
						data-tooltip={saveConfig.resetToClassDefaults}
						onclick={onReset}
					>
						<i class="fa-solid fa-rotate-left"></i>
					</button>
				{/if}
			</div>
		</th>
	</tr>
{/snippet}

{#snippet rollModeButton(saveKey, rollMode, currentRollMode)}
	{@const isActive = rollMode === currentRollMode}
	{@const isDisadvantage = rollMode < 0}
	{@const isAdvantage = rollMode > 0}

	<button
		class="nimble-save-config__roll-mode-btn"
		class:nimble-save-config__roll-mode-btn--active={isActive}
		class:nimble-save-config__roll-mode-btn--disadvantage={isDisadvantage && isActive}
		class:nimble-save-config__roll-mode-btn--advantage={isAdvantage && isActive}
		type="button"
		aria-label={formatRollModeLabel(rollMode)}
		data-tooltip={formatRollModeLabel(rollMode)}
		onclick={() => toggleSavingThrowRollMode(saveKey, rollMode)}
	>
		{#if isActive}
			<i class="fa-solid fa-circle"></i>
		{:else}
			<i class="fa-regular fa-circle"></i>
		{/if}
	</button>
{/snippet}

<section class="nimble-sheet__body nimble-sheet__body--save-config">
	<div class="nimble-save-config">
		<table class="nimble-save-config__table">
			<!-- Header Row -->
			<thead>
				<tr class="nimble-save-config__header-row">
					<th class="nimble-save-config__row-label"></th>
					{#each savingThrowKeys as saveKey}
						<th class="nimble-save-config__save-header">
							<span class="nimble-save-config__save-name">{savingThrows[saveKey]}</span>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				<!-- Ability Modifier Section -->
				{@render sectionHeader(saveConfig.abilityModifier, saveConfig.abilityModifierSubtitle)}
				<tr class="nimble-save-config__data-row">
					<th class="nimble-save-config__row-label">
						<i class="fa-solid fa-dice-d20"></i>
						{saveConfig.abilityMod}
					</th>
					{#each savingThrowKeys as saveKey}
						{@const abilityMod = characterAbilities[saveKey]?.mod ?? 0}
						<td class="nimble-save-config__value-cell">
							<span class="nimble-save-config__ability-value">
								{formatModifier(abilityMod)}
							</span>
						</td>
					{/each}
				</tr>

				<!-- Bonus Section -->
				{@render sectionHeader(saveConfig.bonusPenalty, saveConfig.bonusPenaltySubtitle)}
				<tr class="nimble-save-config__data-row">
					<th class="nimble-save-config__row-label">
						<i class="fa-solid fa-plus-minus"></i>
						{saveConfig.flatBonus}
					</th>
					{#each savingThrowKeys as saveKey}
						{@const bonus = characterSavingThrows[saveKey]?.bonus ?? 0}
						<td class="nimble-save-config__input-cell">
							<input
								class="nimble-save-config__bonus-input"
								type="number"
								value={bonus}
								onchange={({ target }) => updateSavingThrowBonus(saveKey, Number(target.value))}
							/>
						</td>
					{/each}
				</tr>

				<!-- Roll Mode Section -->
				{@render sectionHeader(
					saveConfig.defaultRollMode,
					saveConfig.defaultRollModeSubtitle,
					rollModesDifferFromDefaults ? resetSavingThrowRollModes : null,
				)}
				<tr class="nimble-save-config__data-row nimble-save-config__data-row--roll-mode">
					<th class="nimble-save-config__row-label">
						<i class="fa-solid fa-dice"></i>
						{saveConfig.rollMode}
					</th>
					{#each savingThrowKeys as saveKey}
						{@const currentRollMode = characterSavingThrows[saveKey]?.defaultRollMode ?? 0}
						<td class="nimble-save-config__roll-mode-cell">
							<div class="nimble-save-config__roll-mode-selector">
								{#each rollModes as rollMode}
									{@render rollModeButton(saveKey, rollMode, currentRollMode)}
								{/each}
							</div>
							<span class="nimble-save-config__roll-mode-label">
								{formatRollModeLabel(currentRollMode)}
							</span>
						</td>
					{/each}
				</tr>

				<!-- Ancestry Choices Section (only shown for choice-based rules) -->
				{#if choiceBasedRules.length > 0}
					{@render sectionHeader(saveConfig.ancestryTraits, saveConfig.ancestryTraitsSubtitle)}
					{#each choiceBasedRules as ruleData}
						<tr class="nimble-save-config__data-row nimble-save-config__data-row--ancestry">
							<th class="nimble-save-config__row-label">
								<i class="fa-solid fa-star"></i>
								{ruleData.label}
							</th>
							{#each savingThrowKeys as saveKey}
								{@const availableSaves = getAvailableSavesForRule(ruleData)}
								{@const isAvailable = availableSaves.includes(saveKey)}
								{@const isSelected = ruleData.selectedSave === saveKey}
								<td class="nimble-save-config__ancestry-cell">
									{#if isAvailable}
										<button
											class="nimble-save-config__ancestry-btn"
											class:nimble-save-config__ancestry-btn--selected={isSelected}
											type="button"
											aria-label="Select {savingThrows[saveKey]} for {ruleData.label}"
											data-tooltip={isSelected
												? 'Current selection'
												: 'Select ' + savingThrows[saveKey]}
											onclick={() => updateRuleSelectedSave(ruleData, saveKey)}
										>
											{#if isSelected}
												<i class="fa-solid fa-check-circle"></i>
											{:else}
												<i class="fa-regular fa-circle"></i>
											{/if}
										</button>
									{:else}
										<span class="nimble-save-config__ancestry-unavailable">—</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}

				<!-- Spacer before totals -->
				<tr class="nimble-save-config__spacer-row">
					<td colspan={savingThrowKeys.length + 1}></td>
				</tr>
			</tbody>

			<!-- Final Totals -->
			<tfoot>
				<tr class="nimble-save-config__total-row">
					<th class="nimble-save-config__row-label nimble-save-config__row-label--total">
						<i class="fa-solid fa-shield"></i>
						{saveConfig.totalModifier}
					</th>
					{#each savingThrowKeys as saveKey}
						{@const totalMod = characterSavingThrows[saveKey]?.mod ?? 0}
						<td class="nimble-save-config__total-cell">
							<span class="nimble-save-config__total-value">
								{formatModifier(totalMod)}
							</span>
						</td>
					{/each}
				</tr>
			</tfoot>
		</table>

		<!-- Legend -->
		<aside class="nimble-save-config__legend">
			<div class="nimble-save-config__legend-item">
				<span
					class="nimble-save-config__legend-badge nimble-save-config__legend-badge--disadvantage"
					>Dis</span
				>
				<span>{saveConfig.legendDisadvantage}</span>
			</div>
			<div class="nimble-save-config__legend-item">
				<span class="nimble-save-config__legend-badge nimble-save-config__legend-badge--normal"
					>Normal</span
				>
				<span>{saveConfig.legendNormal}</span>
			</div>
			<div class="nimble-save-config__legend-item">
				<span class="nimble-save-config__legend-badge nimble-save-config__legend-badge--advantage"
					>Adv</span
				>
				<span>{saveConfig.legendAdvantage}</span>
			</div>
		</aside>
	</div>
</section>

<style lang="scss">
	.nimble-save-config {
		display: flex;
		flex-direction: column;
		gap: 1rem;

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

		&__save-header {
			padding: 0.75rem 0.5rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-dark-text-color);
			vertical-align: middle;
		}

		&__save-name {
			display: block;
			line-height: 1.3;
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

		&__reset-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			margin-left: auto;
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				color: var(--nimble-dark-text-color);
				background: hsla(0, 0%, 0%, 0.05);
				border-color: var(--nimble-dark-text-color);
			}
		}

		&__row-label {
			padding: 0.5rem 0.75rem;
			text-align: left;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			white-space: nowrap;

			i {
				margin-right: 0.375rem;
				color: var(--nimble-medium-text-color);
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

			&--roll-mode {
				vertical-align: top;
			}
		}

		&__value-cell {
			padding: 0.5rem;
			text-align: center;
		}

		&__ability-value {
			font-size: var(--nimble-md-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__input-cell {
			padding: 0.375rem;
			text-align: center;
		}

		&__bonus-input {
			display: block;
			width: 3.5rem;
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

		&__roll-mode-cell {
			padding: 0.5rem;
			text-align: center;
		}

		&__roll-mode-selector {
			display: flex;
			justify-content: center;
			gap: 0.125rem;
			margin-bottom: 0.375rem;
		}

		&__roll-mode-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.25rem;
			height: 1.25rem;
			margin: 0;
			padding: 0;
			font-size: 0.5rem;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 0;
			border-radius: 50%;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				transform: scale(1.2);
				color: var(--nimble-dark-text-color);
			}

			&--active {
				color: var(--nimble-dark-text-color);
			}

			&--disadvantage {
				color: var(--nimble-roll-failure-color);
			}

			&--advantage {
				color: hsl(139, 48%, 36%);
			}
		}

		&__roll-mode-label {
			display: block;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__data-row--ancestry {
			background: hsla(45, 80%, 50%, 0.03);
		}

		&__ancestry-cell {
			padding: 0.5rem;
			text-align: center;
		}

		&__ancestry-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			margin: 0;
			padding: 0;
			font-size: 0.75rem;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 0;
			border-radius: 50%;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				transform: scale(1.15);
				color: hsl(45, 80%, 40%);
			}

			&--selected {
				color: hsl(45, 80%, 40%);

				&:hover {
					color: hsl(45, 90%, 35%);
				}
			}
		}

		&__ancestry-unavailable {
			display: inline-block;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-light-text-color);
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

		&__legend-badge {
			display: inline-block;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xxs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			border-radius: 3px;

			&--disadvantage {
				background: hsla(0, 70%, 50%, 0.15);
				color: var(--nimble-roll-failure-color);
			}

			&--normal {
				background: hsla(0, 0%, 50%, 0.15);
				color: var(--nimble-medium-text-color);
			}

			&--advantage {
				background: hsla(139, 48%, 36%, 0.15);
				color: hsl(139, 48%, 36%);
			}
		}
	}
</style>

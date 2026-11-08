<script>
	import localize from '#utils/localize.js';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';
	import { calculateDefaultRollModes } from './ActorSavingThrowConfigDialog.utils.js';

	/**
	 * The compact label for a roll mode level: "Adv ×2", "Dis ×1", "Normal".
	 *
	 * A level is a number of extra d20s, not a numeric bonus: `1` rolls `2d20khn` (one extra
	 * die, keep the highest).
	 */
	function formatRollModeLabel(value) {
		if (value > 0) {
			return localize('NIMBLE.rollMode.advantage', { count: String(value) });
		}

		if (value < 0) {
			return localize('NIMBLE.rollMode.disadvantage', { count: String(Math.abs(value)) });
		}

		return localize('NIMBLE.rollMode.normal');
	}

	function formatModifier(value) {
		return replaceHyphenWithMinusSign(
			new Intl.NumberFormat('en-US', {
				signDisplay: 'always',
			}).format(value),
		);
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

	/** The class defaults the calculated roll modes build on, or null for a classless actor. */
	function primaryClassSavingThrows() {
		const primaryClass = Object.values(document.classes ?? {})[0];
		return primaryClass?.system?.savingThrows ?? null;
	}

	async function resetSavingThrowRollModes() {
		const classSavingThrows = primaryClassSavingThrows();
		if (!classSavingThrows) return;

		const rollModes = calculateDefaultRollModes(document.items, classSavingThrows, savingThrowKeys);

		const updates = {};
		for (const saveKey of savingThrowKeys) {
			updates[`system.savingThrows.${saveKey}.defaultRollMode`] = rollModes[saveKey];
		}

		await document.update(updates);
	}

	const { savingThrows, saveConfig } = CONFIG.NIMBLE;
	const savingThrowKeys = Object.keys(savingThrows);
	const rollModes = [-3, -2, -1, 0, 1, 2, 3];

	let { document } = $props();

	// Check if this is a character (has classes) vs NPC/monster
	let isCharacter = $derived(document.type === 'character');
	let hasClasses = $derived(isCharacter && Object.keys(document.classes ?? {}).length > 0);

	let characterSavingThrows = $derived(document.reactive?.system?.savingThrows ?? {});
	let characterAbilities = $derived(document.reactive?.system?.abilities ?? {});

	// Fix any corrupted rules arrays by restoring from compendium
	async function fixCorruptedRulesArrays() {
		for (const item of document.items) {
			// The neutral-save rules this dialog repairs moved onto the ancestry bonus when
			// ancestries and their traits were split, so both types have to be covered.
			if (item.type !== 'ancestry' && item.type !== 'ancestryBonus') continue;

			const rulesArray = item.system?.rules;
			if (!Array.isArray(rulesArray)) continue;

			// Check if any rules are undefined/null or missing type
			const hasCorruption = rulesArray.some((r) => !r || !r.type);
			if (!hasCorruption) continue;

			// Try to restore from compendium. `sourceId` reads `_stats.compendiumSource` —
			// nothing in the system ever writes `flags.core.sourceId`, so looking there
			// always missed and dropped straight through to the destructive strip below.
			const { sourceId } = item;
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
			const classes = document.classes ?? {};
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
		// NPCs don't have classes, so we can't check class defaults
		if (!hasClasses) return false;

		const classSavingThrows = primaryClassSavingThrows();
		if (!classSavingThrows) return false;

		const expectedRollModes = calculateDefaultRollModes(
			document.items,
			classSavingThrows,
			savingThrowKeys,
		);

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
				<!-- Ability Modifier Section (Characters only - NPCs don't have abilities) -->
				{#if isCharacter}
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
				{/if}

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
								data-look="plain"
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

				<!-- Ancestry Choices Section (only shown for characters with choice-based rules) -->
				{#if isCharacter && choiceBasedRules.length > 0}
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
	:global(.nimble-window) .nimble-sheet__body.nimble-sheet__body--save-config {
		padding: 12px;
	}

	.nimble-save-config {
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);

		&__table {
			width: 100%;
			margin: 0;
			border: 0;
			border-collapse: collapse;
			border-spacing: 0;
			border-radius: 0;
			background: none;
			box-shadow: none;
			overflow: visible;

			thead,
			tbody,
			tfoot,
			tr,
			tr:nth-child(even),
			tr:nth-child(odd) {
				border: 0;
				background: none;
				color: var(--nimble-ui-ink);
				text-shadow: none;
			}

			th,
			td {
				padding: 0 4px;
				background: none;
				vertical-align: middle;
			}
		}

		&__header-row th {
			height: 26px;
			padding-bottom: 5px;
			border-bottom: 1px solid var(--nimble-ui-soft);
		}

		&__save-header {
			text-align: center;
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__save-name {
			display: block;
			line-height: 1.3;
		}

		&__section-header th {
			padding: 12px 4px 0;
			border-bottom: 1px solid var(--nimble-ui-soft);
		}

		&__section-title {
			display: flex;
			align-items: center;
			gap: 8px;
			min-height: 26px;
			padding-bottom: 5px;
		}

		&__section-title-text {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--nimble-ui-ink-dim);
		}

		&__section-subtitle {
			font-size: 0.688rem;
			font-weight: 600;
			letter-spacing: 0;
			text-transform: none;
			color: var(--nimble-ui-ink-muted);
		}

		&__reset-btn {
			display: inline-flex;
			flex: none;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			min-height: 0;
			margin: 0 0 0 auto;
			padding: 0;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-size: 0.75rem;
			line-height: 1;
			color: var(--nimble-ui-ink-dim);
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}

		&__row-label {
			text-align: left;
			font-size: 0.813rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
			white-space: nowrap;

			i {
				width: 1.1em;
				margin-right: 6px;
				text-align: center;
				color: var(--nimble-ui-ink-dim);
			}

			&--total {
				font-size: 0.688rem;
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: 0.1em;
				color: var(--nimble-ui-ink-dim);
			}
		}

		&__data-row {
			> th,
			> td {
				height: 30px;
				border-bottom: 1px solid var(--nimble-ui-soft);
			}

			&:has(+ .nimble-save-config__section-header, + .nimble-save-config__spacer-row) > th,
			&:has(+ .nimble-save-config__section-header, + .nimble-save-config__spacer-row) > td,
			&:last-child > th,
			&:last-child > td {
				border-bottom: 0;
			}
		}

		&__value-cell,
		&__input-cell,
		&__ancestry-cell {
			text-align: center;
		}

		&__ability-value {
			font-size: 0.813rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
		}

		&__bonus-input {
			display: block;
			flex: none;
			width: 3rem;
			min-width: 0;
			height: 26px;
			margin: 0 auto;
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

		&__data-row--roll-mode > th,
		&__data-row--roll-mode > td {
			padding-block: 6px;
		}

		&__roll-mode-cell {
			text-align: center;
		}

		&__roll-mode-selector {
			display: flex;
			justify-content: center;
			gap: 1px;
			margin-bottom: 4px;
		}

		&__roll-mode-btn {
			display: inline-flex;
			flex: none;
			align-items: center;
			justify-content: center;
			width: 0.875rem;
			height: 1.125rem;
			min-height: 0;
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: none;
			box-shadow: none;
			font-size: 0.5rem;
			line-height: 1;
			color: var(--nimble-ui-ink-dim);
			cursor: pointer;
			transition: color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 0;
			}

			&--active,
			&--active:hover {
				color: var(--nimble-ui-highlight);
			}

			&--disadvantage,
			&--disadvantage:hover {
				color: var(--nimble-ui-vital);
			}

			&--advantage,
			&--advantage:hover {
				color: var(--nimble-ui-action);
			}
		}

		&__roll-mode-label {
			display: block;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__ancestry-btn {
			display: inline-flex;
			flex: none;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			min-height: 0;
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: none;
			box-shadow: none;
			font-size: 0.813rem;
			line-height: 1;
			color: var(--nimble-ui-ink-dim);
			cursor: pointer;
			transition: color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 0;
			}

			&--selected,
			&--selected:hover {
				color: var(--nimble-ui-highlight);
			}
		}

		&__ancestry-unavailable {
			display: inline-block;
			font-size: 0.813rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__spacer-row td {
			height: 4px;
			padding: 0;
			border: 0;
		}

		&__total-row > th,
		&__total-row > td {
			padding-top: 8px;
			border: 0;
		}

		&__total-cell {
			text-align: center;
		}

		&__total-value {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 2.75rem;
			height: 30px;
			padding: 0 8px;
			border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
			border-radius: 4px;
			background: none;
			font-size: 1rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}

		&__legend {
			display: flex;
			flex-wrap: wrap;
			gap: 6px 14px;
			margin: 0;
			padding: 0 4px;
			border: 0;
			background: none;
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
		}

		&__legend-item {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		&__legend-badge {
			display: inline-block;
			padding: 0 5px;
			border-radius: 3px;
			background: none;
			box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
			font-size: 0.656rem;
			font-weight: 800;
			line-height: 16px;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-ui-ink-muted);

			&--disadvantage {
				color: var(--nimble-ui-vital);
			}

			&--advantage {
				color: var(--nimble-ui-action);
			}
		}
	}
</style>

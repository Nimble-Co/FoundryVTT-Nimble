<script>
	import arraysAreEqual from '../../utils/arraysAreEqual.js';
	import generateBlankAttributeSet from '../../utils/generateBlankAttributeSet.js';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function checkBaseStatsMatchCoreArray(characterAbilityScores) {
		const baseScores = Object.values(characterAbilityScores).map(({ baseValue }) => baseValue);

		return Object.values(statArrayModifiers).some((standardArrayOption) =>
			arraysAreEqual(standardArrayOption, baseScores),
		);
	}

	/**
	 * Detects which standard array (if any) matches the current base values,
	 * and builds the assignment map (which ability has which array index).
	 */
	function detectCurrentArrayAndAssignment(characterAbilityScores) {
		const abilityKeys = Object.keys(abilityScores);
		const baseScores = abilityKeys.map((key) => characterAbilityScores[key]?.baseValue ?? 0);

		for (const [arrayKey, arrayValues] of Object.entries(statArrayModifiers)) {
			// Check if sorted values match (arrays can be assigned in any order)
			const sortedBase = [...baseScores].sort((a, b) => b - a);
			const sortedArray = [...arrayValues].sort((a, b) => b - a);

			if (arraysAreEqual(sortedBase, sortedArray)) {
				// Build assignment: for each ability, find which array index it uses
				const assignment = {};
				const usedIndices = new Set();

				for (let i = 0; i < abilityKeys.length; i++) {
					const abilityKey = abilityKeys[i];
					const baseValue = baseScores[i];

					// Find first unused index with matching value
					const matchingIndex = arrayValues.findIndex(
						(val, idx) => val === baseValue && !usedIndices.has(idx),
					);

					if (matchingIndex !== -1) {
						assignment[abilityKey] = matchingIndex;
						usedIndices.add(matchingIndex);
					} else {
						assignment[abilityKey] = null;
					}
				}

				return {
					arrayKey,
					arrayOption: statArrayOptions.find((opt) => opt.key === arrayKey),
					assignment,
				};
			}
		}

		return null;
	}

	/**
	 * Prepares stat array options in the same format as character creation
	 */
	function prepareStatArrayOptions() {
		return Object.entries(statArrayModifiers).reduce((arrays, [key, array]) => {
			arrays.push({
				key,
				array,
				name: statArrays[key],
			});
			return arrays;
		}, []);
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
	 * Prepares the stat increase data from class levels
	 */
	function prepareStatIncreases(statIncreaseData, currentClassLevel) {
		if (!statIncreaseData || currentClassLevel === 0) return [];

		const increases = [];

		Object.entries(statIncreaseData).forEach(([level, data]) => {
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
			primary: '+1 to one of your Key Stats',
			secondary: '+1 to one of your Secondary Stats',
			capstone: '+1 to any 2 of your stats',
		};
		return tooltips[type] ?? '';
	}

	const { abilityScores, abilityScoreTooltips, statArrayModifiers, statArrays } = CONFIG.NIMBLE;
	const abilityScoreKeys = Object.keys(abilityScores);
	const abilityScoreLabels = Object.values(abilityScores);
	const abilityScoreCount = abilityScoreLabels.length;
	const statArrayOptions = prepareStatArrayOptions();

	let { document } = $props();

	// State for editing base scores
	let isEditing = $state(false);
	let selectedArray = $state(null);
	let tempSelectedAbilityScores = $state(generateBlankAttributeSet());

	/**
	 * Handle drag-and-drop of ability modifiers between abilities (swap logic)
	 */
	function handleAbilityModifierDrop(event, abilityKey) {
		const modifierIndex = Number.parseInt(event.dataTransfer.getData('modifier'), 10);

		const existingModifier = Object.entries(tempSelectedAbilityScores).find(
			([, value]) => value === modifierIndex,
		);

		if (existingModifier) {
			const [previousKey] = existingModifier;
			tempSelectedAbilityScores[previousKey] = tempSelectedAbilityScores[abilityKey];
		}

		tempSelectedAbilityScores[abilityKey] = modifierIndex;
	}

	/**
	 * Select a new array and reset assignments
	 */
	function selectArray(arrayOption) {
		selectedArray = arrayOption;
		tempSelectedAbilityScores = generateBlankAttributeSet();
	}

	/**
	 * Apply the base score changes to the document
	 */
	function applyBaseScoreChanges() {
		if (!selectedArray) return;

		const updates = {};
		for (const [abilityKey, arrayIndex] of Object.entries(tempSelectedAbilityScores)) {
			if (arrayIndex !== null) {
				updates[`system.abilities.${abilityKey}.baseValue`] = selectedArray.array[arrayIndex];
			}
		}

		document.update(updates);
		isEditing = false;
	}

	/**
	 * Cancel editing and revert to detected values
	 */
	function cancelEditing() {
		const detected = detectCurrentArrayAndAssignment(characterAbilityScores);
		if (detected) {
			selectedArray = detected.arrayOption;
			tempSelectedAbilityScores = { ...detected.assignment };
		} else {
			selectedArray = null;
			tempSelectedAbilityScores = generateBlankAttributeSet();
		}
		isEditing = false;
	}

	/**
	 * Start editing mode
	 */
	function startEditing() {
		const detected = detectCurrentArrayAndAssignment(characterAbilityScores);
		if (detected) {
			selectedArray = detected.arrayOption;
			tempSelectedAbilityScores = { ...detected.assignment };
		} else {
			selectedArray = null;
			tempSelectedAbilityScores = generateBlankAttributeSet();
		}
		isEditing = true;
	}

	// Get class data directly from reactive document each time to ensure proper reactivity
	let characterClass = $derived(document.reactive.items.find((item) => item.type === 'class'));

	let characterAbilityScores = $derived(document.reactive.system.abilities);
	let keyAbilityScores = $derived(characterClass?.system?.keyAbilityScores ?? []);

	// Saving throw advantage/disadvantage from class
	let savingThrowAdvantage = $derived(characterClass?.system?.savingThrows?.advantage ?? null);
	let savingThrowDisadvantage = $derived(
		characterClass?.system?.savingThrows?.disadvantage ?? null,
	);

	function isKeyAbility(abilityKey) {
		return keyAbilityScores.includes(abilityKey);
	}

	function getSavingThrowStatus(abilityKey) {
		if (abilityKey === savingThrowAdvantage) return 'advantage';
		if (abilityKey === savingThrowDisadvantage) return 'disadvantage';
		return null;
	}

	// Detect current array on initial load
	let detectedArrayInfo = $derived(detectCurrentArrayAndAssignment(characterAbilityScores));

	// Check if all stats in temp are selected
	let allStatsSelected = $derived(
		Object.values(tempSelectedAbilityScores).every((value) => value !== null),
	);

	let baseStatsMatchCoreArray = $derived(checkBaseStatsMatchCoreArray(characterAbilityScores));

	let abilityBonusSources = $derived(getAbilityBonusSources(document.reactive));

	// Use $derived.by to ensure reactive tracking of nested class properties
	let abilityScoreIncreases = $derived.by(() => {
		const classItem = document.reactive.items.find((item) => item.type === 'class');
		if (!classItem) return [];

		const classLevel = classItem.system?.classLevel ?? 0;
		const abilityScoreData = classItem.system?.abilityScoreData ?? {};

		return prepareStatIncreases(abilityScoreData, classLevel);
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

<section
	class="nimble-sheet__body nimble-sheet__body--ability-score-config"
	style="--abilityScoreCount: {abilityScoreCount};"
>
	{#if !baseStatsMatchCoreArray && !isEditing}
		<aside class="nimble-stat-config__warning">
			<i class="nimble-stat-config__warning-icon fa-solid fa-circle-exclamation"></i>
			<span>Your base scores do not match any of the standard Nimble stat arrays.</span>
		</aside>
	{/if}

	<div class="nimble-stat-config">
		<!-- Base Stats Section with Drag-and-Drop -->
		<div class="nimble-stat-config__base-section">
			<header class="nimble-stat-config__base-header">
				<div class="nimble-stat-config__base-title">
					<span class="nimble-stat-config__section-title-text">Base Stats</span>
					<span class="nimble-stat-config__section-subtitle"
						>Starting stats from character creation</span
					>
				</div>
				{#if !isEditing}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label="Edit Base Stats"
						data-tooltip="Edit Base Stats"
						onclick={startEditing}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</header>

			{#if isEditing}
				<!-- Array Selection -->
				<div class="nimble-stat-config__array-selection">
					<span class="nimble-stat-config__array-label">Select Array:</span>
					<ul class="nimble-stat-config__stat-arrays">
						{#each statArrayOptions as arrayOption}
							<li class="nimble-stat-config__stat-arrays-option">
								<button
									class="nimble-stat-config__stat-array"
									class:nimble-stat-config__stat-array--selected={selectedArray?.key ===
										arrayOption.key}
									onclick={() => selectArray(arrayOption)}
								>
									<span class="nimble-stat-config__stat-array-name">{arrayOption.name}</span>
									<ul class="nimble-stat-config__array-terms">
										{#each arrayOption.array as modifier}
											<li class="nimble-stat-config__array-terms-value">
												{formatModifier(modifier)}
											</li>
										{/each}
									</ul>
								</button>
							</li>
						{/each}
					</ul>
				</div>

				{#if selectedArray}
					<!-- Legend -->
					<aside class="nimble-cc-legend">
						<div class="nimble-cc-legend__item">
							<i class="fa-solid fa-star nimble-cc-legend__icon--key"></i>
							<span>Key Stat</span>
						</div>
						<div class="nimble-cc-legend__item">
							<i class="fa-solid fa-circle-plus nimble-cc-legend__icon--advantage"></i>
							<span>Adv. on Saves</span>
						</div>
						<div class="nimble-cc-legend__item">
							<i class="fa-solid fa-circle-minus nimble-cc-legend__icon--disadvantage"></i>
							<span>Dis. on Saves</span>
						</div>
					</aside>

					<!-- Stat Cards (Drop Zones) -->
					<ul class="nimble-ability-score-list" role="list">
						{#each Object.entries(tempSelectedAbilityScores) as [abilityKey, arrayIndex]}
							{@const savingThrowStatus = getSavingThrowStatus(abilityKey)}
							{@const isKey = isKeyAbility(abilityKey)}
							<li
								class="nimble-cc-ability-score"
								ondrop={(event) => {
									event.currentTarget.classList.remove('nimble-cc-ability-score--drag-over');
									handleAbilityModifierDrop(event, abilityKey);
								}}
								ondragover={(event) => {
									event.preventDefault();
									event.currentTarget.classList.add('nimble-cc-ability-score--drag-over');
								}}
								ondragleave={(event) => {
									event.currentTarget.classList.remove('nimble-cc-ability-score--drag-over');
								}}
							>
								<header class="nimble-cc-ability-score__header">
									<h4 class="nimble-heading" data-heading-variant="section">
										{#if isKey}<span
												data-tooltip={abilityScoreTooltips.keyStat}
												data-tooltip-direction="UP"
												>{abilityScores[abilityKey]}<sup class="nimble-cc-ability-score__key-star"
													><i class="fa-solid fa-star"></i></sup
												></span
											>{:else}{abilityScores[abilityKey]}{/if}
									</h4>
								</header>

								{#if arrayIndex !== null}
									<div
										class="nimble-cc-ability-score__value"
										role="listitem"
										draggable="true"
										ondragstart={(e) => {
											e.dataTransfer.dropEffect = 'move';
											e.dataTransfer.setData('modifier', arrayIndex);
										}}
									>
										<i class="fa-solid fa-grip-vertical drag-icon"></i>
										<span>{formatModifier(selectedArray?.array?.[arrayIndex])}</span>
									</div>
								{:else}
									<div class="nimble-cc-ability-score__drop-zone">
										<i class="fa-solid fa-arrow-down drop-icon"></i>
										<span class="drop-text">Drop here</span>
									</div>
								{/if}

								<div class="nimble-cc-ability-score__indicators">
									{#if savingThrowStatus === 'advantage'}
										<i
											class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--advantage fa-solid fa-circle-plus"
											data-tooltip={abilityScoreTooltips.advantageOnSave}
											data-tooltip-direction="UP"
										></i>
									{:else if savingThrowStatus === 'disadvantage'}
										<i
											class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--disadvantage fa-solid fa-circle-minus"
											data-tooltip={abilityScoreTooltips.disadvantageOnSave}
											data-tooltip-direction="UP"
										></i>
									{/if}
								</div>
							</li>
						{/each}
					</ul>

					<!-- Unassigned Values Pool -->
					{#if !allStatsSelected}
						<ul class="nimble-array-value-list">
							{#each selectedArray?.array ?? [] as modifier, modifierIndex (modifierIndex)}
								{#if !Object.values(tempSelectedAbilityScores).includes(modifierIndex)}
									<li
										class="nimble-array-value-list__option"
										draggable="true"
										ondragstart={(e) => {
											e.dataTransfer.dropEffect = 'move';
											e.dataTransfer.setData('modifier', modifierIndex);
										}}
									>
										<i class="fa-solid fa-grip-vertical drag-icon"></i>
										<span class="modifier-value">{formatModifier(modifier)}</span>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}

					<!-- Apply/Cancel Buttons -->
					<div class="nimble-stat-config__actions">
						<button
							class="nimble-button nimble-stat-config__cancel-btn"
							data-button-variant="basic"
							type="button"
							onclick={cancelEditing}
						>
							Cancel
						</button>
						<button
							class="nimble-button nimble-stat-config__apply-btn"
							data-button-variant="basic"
							type="button"
							disabled={!allStatsSelected}
							onclick={applyBaseScoreChanges}
						>
							Apply Changes
						</button>
					</div>
				{/if}
			{:else}
				<!-- Display Mode: Show current base scores as cards -->
				<ul class="nimble-ability-score-list" role="list">
					{#each abilityScoreKeys as abilityKey}
						{@const savingThrowStatus = getSavingThrowStatus(abilityKey)}
						{@const isKey = isKeyAbility(abilityKey)}
						<li class="nimble-cc-ability-score">
							<header class="nimble-cc-ability-score__header">
								<h4 class="nimble-heading" data-heading-variant="section">
									{#if isKey}<span
											data-tooltip={abilityScoreTooltips.keyStat}
											data-tooltip-direction="UP"
											>{abilityScores[abilityKey]}<sup class="nimble-cc-ability-score__key-star"
												><i class="fa-solid fa-star"></i></sup
											></span
										>{:else}{abilityScores[abilityKey]}{/if}
								</h4>
							</header>

							<div class="nimble-cc-ability-score__value nimble-cc-ability-score__value--no-drag">
								{formatModifier(characterAbilityScores[abilityKey]?.baseValue ?? 0)}
							</div>

							<div class="nimble-cc-ability-score__indicators">
								{#if savingThrowStatus === 'advantage'}
									<i
										class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--advantage fa-solid fa-circle-plus"
										data-tooltip={abilityScoreTooltips.advantageOnSave}
										data-tooltip-direction="UP"
									></i>
								{:else if savingThrowStatus === 'disadvantage'}
									<i
										class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--disadvantage fa-solid fa-circle-minus"
										data-tooltip={abilityScoreTooltips.disadvantageOnSave}
										data-tooltip-direction="UP"
									></i>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				{#if detectedArrayInfo}
					<div class="nimble-stat-config__current-array">
						<span class="nimble-stat-config__current-array-label">Current Array:</span>
						<span class="nimble-stat-config__current-array-name"
							>{detectedArrayInfo.arrayOption?.name ?? 'Unknown'}</span
						>
					</div>
				{/if}
			{/if}
		</div>

		<table class="nimble-stat-config__table">
			<!-- Header Row -->
			<thead>
				<tr class="nimble-stat-config__header-row">
					<th class="nimble-stat-config__row-label"></th>
					{#each abilityScoreKeys as abilityKey, i}
						{@const isKeyAbilityHeader = keyAbilityScores.includes(abilityKey)}
						<th
							class="nimble-stat-config__ability-header"
							class:nimble-stat-config__ability-header--key={isKeyAbilityHeader}
							data-tooltip={isKeyAbilityHeader ? abilityScoreTooltips.keyStat : null}
						>
							{#if isKeyAbilityHeader}
								<span class="nimble-stat-config__key-indicator">
									<i class="fa-solid fa-star"></i>
								</span>
							{/if}
							<span class="nimble-stat-config__ability-name">{abilityScoreLabels[i]}</span>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
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
				{@render sectionHeader('Stat Increases', 'Improvements gained at certain class levels')}

				{#if abilityScoreIncreases.length === 0}
					<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--empty">
						<td colspan={abilityScoreCount + 1} class="nimble-stat-config__empty-state">
							<div class="nimble-stat-config__empty-state-content">
								<i class="fa-regular fa-hourglass-half nimble-stat-config__empty-state-icon"></i>
								<span class="nimble-stat-config__empty-state-text"
									>No stat increases available yet</span
								>
								<span class="nimble-stat-config__empty-state-hint"
									>Stat increases are gained at levels 4, 5, 8, 9, 12, 13, 16, 17, and 20</span
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
			<div class="nimble-stat-config__legend-row">
				<div class="nimble-stat-config__legend-item">
					<i class="fa-solid fa-star nimble-stat-config__legend-icon--key"></i>
					<span>Key Stat</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<i class="fa-solid fa-circle-plus nimble-stat-config__legend-icon--advantage"></i>
					<span>Adv. on Saves</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<i class="fa-solid fa-circle-minus nimble-stat-config__legend-icon--disadvantage"></i>
					<span>Dis. on Saves</span>
				</div>
			</div>
			<div class="nimble-stat-config__legend-row">
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--primary"
						>Primary</span
					>
					<span>+1 Key Stat</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--secondary"
						>Secondary</span
					>
					<span>+1 Secondary Stat</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--capstone"
						>Capstone</span
					>
					<span>+1 to any 2 Stats</span>
				</div>
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
			flex-direction: column;
			align-items: center;
			gap: 0.5rem;
			padding: 0.75rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			background: hsla(0, 0%, 0%, 0.03);
			border-radius: 4px;
		}

		&__legend-row {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 1rem;
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

		&__legend-icon--advantage {
			font-size: var(--nimble-sm-text);
			color: hsl(139, 48%, 36%);
		}

		&__legend-icon--disadvantage {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-roll-failure-color, hsl(355, 55%, 52%));
		}

		&__base-section {
			padding: 0.75rem;
			background: var(--nimble-box-background-color);
			border-radius: 6px;
			box-shadow: var(--nimble-box-shadow);
		}

		&__base-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 0.75rem;
		}

		&__base-title {
			display: flex;
			align-items: baseline;
			gap: 0.75rem;
		}

		&__array-selection {
			margin-bottom: 0.75rem;
		}

		&__array-label {
			display: block;
			margin-bottom: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__stat-arrays {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__stat-arrays-option {
			display: contents;
		}

		&__stat-array {
			--button-size: fit-content;

			display: flex;
			flex-direction: column;
			padding: 0.5rem 0.75rem;
			margin: 0;
			overflow: hidden;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-card-background-color, unset);
			border: 2px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
			box-shadow: var(--nimble-box-shadow);
			transition: var(--nimble-standard-transition);
			gap: 0.5rem;

			&:hover {
				color: var(--nimble-dark-text-color);
				background: var(--nimble-card-background-color, unset);
				border-color: var(--nimble-accent-color);
				transform: translateY(-2px);
			}

			&--selected {
				border-color: var(--nimble-accent-color);
				background: color-mix(
					in srgb,
					var(--nimble-accent-color) 10%,
					var(--nimble-card-background-color, transparent)
				);
				box-shadow:
					var(--nimble-box-shadow),
					0 0 6px color-mix(in srgb, var(--nimble-accent-color) 40%, transparent);

				&:hover {
					transform: none;
				}
			}
		}

		&__stat-array-name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
		}

		&__array-terms {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(1rem, 1fr));
			gap: 0.375rem;
			width: 100%;
			margin: 0;
			padding: 0;
			list-style: none;
			line-height: 1;
		}

		&__array-terms-value {
			padding: 0.125rem 0.25rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-align: center;
			border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
			border-radius: 4px;
			box-shadow: var(--nimble-box-shadow);
		}

		&__actions {
			display: flex;
			justify-content: flex-end;
			gap: 0.5rem;
			margin-top: 0.75rem;
		}

		&__cancel-btn {
			--nimble-button-padding: 0.5rem 1rem;
		}

		&__apply-btn {
			--nimble-button-padding: 0.5rem 1rem;
			--nimble-button-background-color: hsl(145, 50%, 40%);
			--nimble-button-border-color: hsl(145, 50%, 35%);
			--nimble-button-text-color: white;

			&:hover:not(:disabled) {
				--nimble-button-background-color: hsl(145, 50%, 45%);
				--nimble-button-border-color: hsl(145, 50%, 40%);
			}

			&:disabled {
				--nimble-button-background-color: hsl(0, 0%, 70%);
				--nimble-button-border-color: hsl(0, 0%, 60%);
				--nimble-button-text-color: hsl(0, 0%, 95%);
				cursor: not-allowed;
				opacity: 0.7;
			}
		}

		&__current-array {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-top: 0.5rem;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			background: hsla(0, 0%, 0%, 0.03);
			border-radius: 4px;
		}

		&__current-array-label {
			font-weight: 500;
		}

		&__current-array-name {
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}
	}

	.nimble-cc-legend {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
		padding: 0.375rem 0.5rem;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		background: hsla(0, 0%, 0%, 0.03);
		border-radius: 4px;

		&__item {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__icon--key {
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
		}

		&__icon--advantage {
			font-size: var(--nimble-sm-text);
			color: hsl(139, 48%, 36%);
		}

		&__icon--disadvantage {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-roll-failure-color, hsl(355, 55%, 52%));
		}
	}

	.nimble-array-value-list,
	.nimble-ability-score-list {
		display: grid;
		grid-template-columns: repeat(var(--abilityScoreCount, 4), 1fr);
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-array-value-list {
		margin-block-start: 0.5rem;
	}

	.nimble-array-value-list__option {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		position: relative;
		margin: 0;
		padding: 0.5rem;
		background-color: var(--nimble-box-background-color, var(--nimble-card-background-color));
		border: 2px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		cursor: grab;
		font-size: var(--nimble-md-text);
		font-weight: 600;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-accent-color);
			box-shadow:
				var(--nimble-box-shadow),
				0 0 6px color-mix(in srgb, var(--nimble-accent-color) 50%, transparent);
			transform: scale(1.05);

			.drag-icon {
				opacity: 1;
			}
		}

		&:active {
			cursor: grabbing;
		}

		.drag-icon {
			position: absolute;
			left: 0.5rem;
			font-size: 0.75rem;
			opacity: 0.6;
			transition: opacity 0.2s ease;
		}

		.modifier-value {
			font-weight: 600;
		}
	}

	.nimble-cc-ability-score {
		padding: 0.5rem;
		margin: 0;
		gap: 0.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--nimble-card-background-color, unset);
		border: 2px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		font-size: var(--nimble-md-text);
		cursor: auto;
		position: relative;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease,
			box-shadow 0.2s ease;

		&__key-star {
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
			margin-left: 0.125rem;
		}

		&:hover {
			text-shadow: none;
		}

		&:global(.nimble-cc-ability-score--drag-over) {
			border-color: var(--nimble-card-border-color);
			background: color-mix(
				in srgb,
				var(--nimble-card-border-color) 15%,
				var(--nimble-card-background-color, transparent)
			);
			box-shadow:
				var(--nimble-box-shadow),
				0 0 8px color-mix(in srgb, var(--nimble-card-border-color) 40%, transparent);
		}

		&__header {
			text-align: center;
		}

		&__indicators {
			display: flex;
			gap: 0.25rem;
			align-items: center;
			justify-content: center;
			min-height: 1rem;
		}

		&__indicator {
			font-size: var(--nimble-sm-text);
			transition: color 0.2s ease;

			&--advantage {
				color: hsl(139, 48%, 36%);
			}

			&--disadvantage {
				color: var(--nimble-roll-failure-color, hsl(355, 55%, 52%));
			}
		}

		&__drop-zone {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.125rem;
			width: 100%;
			padding: 0.25rem;
			border: 2px dashed var(--nimble-card-border-color, hsl(41, 18%, 54%));
			border-radius: 4px;
			opacity: 0.4;
			transition: var(--nimble-standard-transition);

			.drop-icon {
				font-size: 0.75rem;
			}

			.drop-text {
				font-size: 0.625rem;
				text-transform: uppercase;
				letter-spacing: 0.05em;
			}
		}

		&:global(.nimble-cc-ability-score--drag-over) &__drop-zone {
			opacity: 1;
			border-color: var(--nimble-card-border-color);
			background-color: color-mix(in srgb, var(--nimble-card-border-color) 20%, transparent);
			animation: pulse 1s ease-in-out infinite;
		}

		@keyframes pulse {
			0%,
			100% {
				transform: scale(1);
			}
			50% {
				transform: scale(1.05);
			}
		}

		&__value {
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;
			width: 100%;
			padding: 0.25rem;
			text-align: center;
			cursor: grab;
			font-weight: 600;
			background-color: var(--nimble-box-background-color, var(--nimble-card-background-color));
			border-radius: 4px;

			.drag-icon {
				position: absolute;
				left: 0.25rem;
				font-size: 0.625rem;
				opacity: 0.5;
				transition: opacity 0.2s ease;
			}

			&:hover {
				background-color: color-mix(
					in srgb,
					var(--nimble-card-border-color) 20%,
					var(--nimble-box-background-color, transparent)
				);

				.drag-icon {
					opacity: 1;
				}
			}

			&--no-drag {
				cursor: auto;
				background-color: transparent;

				&:hover {
					background-color: transparent;
				}
			}
		}
	}
</style>

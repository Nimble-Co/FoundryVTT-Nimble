<script lang="ts">
	import type { CharacterStatConfigDialogProps } from '#types/components/CharacterStatConfigDialog.d.ts';
	import localize from '#utils/localize.ts';
	import {
		createCharacterStatConfigDialogState,
		formatModifier,
	} from './CharacterStatConfigDialogState.svelte.ts';

	let { document }: CharacterStatConfigDialogProps = $props();

	const state = createCharacterStatConfigDialogState(() => document);
	const {
		abilityScores,
		abilityScoreTooltips,
		abilityScoreKeys,
		abilityScoreLabels,
		abilityScoreCount,
		statArrayOptions,
		handleAbilityModifierDrop,
		selectArray,
		applyBaseScoreChanges,
		cancelEditing,
		startEditing,
		isKeyAbility,
		getSavingThrowStatus,
		toggleStatIncreaseOption,
		getStatIncreaseTypeLabel,
		getStatIncreaseTypeTooltip,
	} = state;
	const isEditing = $derived(state.isEditing);
	const selectedArray = $derived(state.selectedArray);
	const tempSelectedAbilityScores = $derived(state.tempSelectedAbilityScores);
	const characterAbilityScores = $derived(state.characterAbilityScores);
	const keyAbilityScores = $derived(state.keyAbilityScores);
	const detectedArrayInfo = $derived(state.detectedArrayInfo);
	const allStatsSelected = $derived(state.allStatsSelected);
	const baseStatsMatchCoreArray = $derived(state.baseStatsMatchCoreArray);
	const abilityBonusSources = $derived(state.abilityBonusSources);
	const abilityScoreIncreases = $derived(state.abilityScoreIncreases);
	const allAssignedASI = $derived(state.allAssignedASI);
	const bonusTotals = $derived(state.bonusTotals);
	const asiTotals = $derived(state.asiTotals);
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
	{@const isAtMax =
		!active && (characterAbilityScores[key]?.baseValue ?? 0) + (allAssignedASI[key] ?? 0) >= 5}

	<td class="nimble-stat-config__toggle-cell">
		{#if validityTest}
			<button
				class="nimble-stat-config__toggle"
				class:nimble-stat-config__toggle--active={active}
				aria-label={isAtMax
					? localize('NIMBLE.statConfig.statAtMax')
					: localize('NIMBLE.statConfig.toggleStatIncrease')}
				data-tooltip={isAtMax
					? 'NIMBLE.statConfig.statAtMax'
					: 'NIMBLE.statConfig.toggleStatIncrease'}
				data-tooltip-direction="UP"
				disabled={isAtMax}
				onclick={() => toggleStatIncreaseOption(level, key)}
			>
				{#if active}
					<span class="nimble-stat-config__toggle-value">+1</span>
				{:else if isAtMax}
					<i class="fa-solid fa-lock"></i>
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
			<span>{localize('NIMBLE.statConfig.baseScoresWarning')}</span>
		</aside>
	{/if}

	<div class="nimble-stat-config">
		<!-- Base Stats Section with Drag-and-Drop -->
		<div class="nimble-stat-config__base-section">
			<header class="nimble-stat-config__base-header">
				<div class="nimble-stat-config__base-title">
					<span class="nimble-stat-config__section-title-text"
						>{localize('NIMBLE.statConfig.baseStats')}</span
					>
					<span class="nimble-stat-config__section-subtitle"
						>{localize('NIMBLE.statConfig.baseStatsSubtitle')}</span
					>
				</div>
				{#if !isEditing}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.statConfig.editBaseStats')}
						data-tooltip="NIMBLE.statConfig.editBaseStats"
						onclick={startEditing}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</header>

			{#if isEditing}
				<!-- Array Selection -->
				<div class="nimble-stat-config__array-selection">
					<span class="nimble-stat-config__array-label"
						>{localize('NIMBLE.statConfig.selectArray')}:</span
					>
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
							<span>{localize('NIMBLE.statConfig.keyStat')}</span>
						</div>
						<div class="nimble-cc-legend__item">
							<i class="fa-solid fa-circle-plus nimble-cc-legend__icon--advantage"></i>
							<span>{localize('NIMBLE.statConfig.advOnSaves')}</span>
						</div>
						<div class="nimble-cc-legend__item">
							<i class="fa-solid fa-circle-minus nimble-cc-legend__icon--disadvantage"></i>
							<span>{localize('NIMBLE.statConfig.disOnSaves')}</span>
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
										<span class="drop-text">{localize('NIMBLE.statConfig.dropHere')}</span>
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
							{localize('NIMBLE.statConfig.cancel')}
						</button>
						<button
							class="nimble-button nimble-stat-config__apply-btn"
							data-button-variant="basic"
							type="button"
							disabled={!allStatsSelected}
							onclick={applyBaseScoreChanges}
						>
							{localize('NIMBLE.statConfig.applyChanges')}
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
						<span class="nimble-stat-config__current-array-label"
							>{localize('NIMBLE.statConfig.currentArray')}:</span
						>
						<span class="nimble-stat-config__current-array-name"
							>{detectedArrayInfo.arrayOption?.name ??
								localize('NIMBLE.classSelection.unknown')}</span
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
				{@render sectionHeader(
					localize('NIMBLE.statConfig.bonuses'),
					localize('NIMBLE.statConfig.bonusesSubtitle'),
				)}

				{#if Object.values(abilityBonusSources).every((sources) => sources.length === 0)}
					<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--empty">
						<td colspan={abilityScoreCount + 1} class="nimble-stat-config__empty-message">
							<i class="fa-regular fa-circle-info"></i>
							{localize('NIMBLE.statConfig.noBonuses')}
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
						<th class="nimble-stat-config__row-label">{localize('NIMBLE.statConfig.bonusTotal')}</th
						>
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
					localize('NIMBLE.statConfig.statIncreases'),
					localize('NIMBLE.statConfig.statIncreasesSubtitle'),
				)}

				{#if abilityScoreIncreases.length === 0}
					<tr class="nimble-stat-config__data-row nimble-stat-config__data-row--empty">
						<td colspan={abilityScoreCount + 1} class="nimble-stat-config__empty-state">
							<div class="nimble-stat-config__empty-state-content">
								<i class="fa-regular fa-hourglass-half nimble-stat-config__empty-state-icon"></i>
								<span class="nimble-stat-config__empty-state-text"
									>{localize('NIMBLE.statConfig.noStatIncreasesYet')}</span
								>
								<span class="nimble-stat-config__empty-state-hint"
									>{localize('NIMBLE.statConfig.statIncreaseHint')}</span
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
										{localize('NIMBLE.statConfig.boon')}
									</span>
								</th>
								<td colspan={abilityScoreCount} class="nimble-stat-config__boon-cell">
									<i class="fa-solid fa-gift"></i>
									{localize('NIMBLE.statConfig.specialBoonAvailable')}
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
						<th class="nimble-stat-config__row-label">{localize('NIMBLE.statConfig.asiTotal')}</th>
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
						{localize('NIMBLE.statConfig.finalModifier')}
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
					<span>{localize('NIMBLE.statConfig.keyStat')}</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<i class="fa-solid fa-circle-plus nimble-stat-config__legend-icon--advantage"></i>
					<span>{localize('NIMBLE.statConfig.advOnSaves')}</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<i class="fa-solid fa-circle-minus nimble-stat-config__legend-icon--disadvantage"></i>
					<span>{localize('NIMBLE.statConfig.disOnSaves')}</span>
				</div>
			</div>
			<div class="nimble-stat-config__legend-row">
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--primary"
						>{localize('NIMBLE.statConfig.primary')}</span
					>
					<span>{localize('NIMBLE.statConfig.primaryTooltip')}</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--secondary"
						>{localize('NIMBLE.statConfig.secondary')}</span
					>
					<span>{localize('NIMBLE.statConfig.secondaryTooltip')}</span>
				</div>
				<div class="nimble-stat-config__legend-item">
					<span class="nimble-stat-config__type-badge nimble-stat-config__type-badge--capstone"
						>{localize('NIMBLE.statConfig.capstone')}</span
					>
					<span>{localize('NIMBLE.statConfig.capstoneTooltip')}</span>
				</div>
			</div>
		</aside>
	</div>
</section>

<style lang="scss">
	// Typed numbers in this window are text with a dashed line (SettingLine).
	%nimble-stat-config-plain-number {
		width: 3rem;
		height: 26px;
		margin: 0 auto;
		padding: 0 3px;
		border: 0;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		border-radius: 0;
		background: none;
		box-shadow: none;
		outline: none;
		font-size: 0.875rem;
		font-weight: 700;
		text-align: center;
		color: var(--nimble-ui-ink);

		&:focus {
			border-bottom: 1px solid var(--nimble-ui-highlight);
		}
	}

	// GroupHeading
	%nimble-stat-config-group-heading {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 8px 0 4px;
		padding: 0 0 5px;
		border: 0;
		border-bottom: 1px solid var(--nimble-ui-soft);
		background: none;
		font-family: var(--nimble-primary-font);
		font-size: 0.688rem;
		font-weight: 900;
		line-height: 1.2;
		letter-spacing: 0.1em;
		text-align: left;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}

	// StatBox tile
	%nimble-stat-config-stat-box {
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		background: none;
		box-shadow: none;
		font-family: var(--nimble-primary-font);
	}

	// Outlined tag
	%nimble-stat-config-tag {
		display: inline-block;
		padding: 0 5px;
		border-radius: 3px;
		background: none;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		font-size: 0.656rem;
		font-weight: 800;
		line-height: 16px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-muted);
	}

	:global(.nimble-window) .nimble-sheet__body.nimble-sheet__body--ability-score-config {
		padding: 4px 12px 12px;
		gap: 10px;
	}

	.nimble-stat-config {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);

		&__warning {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 10px;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
			background: none;
			border: 1px solid color-mix(in srgb, var(--nimble-ui-warn) 50%, transparent);
			border-radius: 4px;
		}

		&__warning-icon {
			color: var(--nimble-ui-warn);
		}

		&__warning-indicator {
			margin-left: 4px;
			color: var(--nimble-ui-warn);
		}

		// The table is laid out as rows of the four stat columns, as the tiles above.
		// The rules are nested here so that they win over the core table rules of the sheet.
		& &__table {
			display: flex;
			flex-direction: column;
			gap: 2px;
			width: 100%;
			margin: 0;
			border: 0;
			border-radius: 0;
			background: none;
			box-shadow: none;
			font-size: 0.813rem;

			thead,
			tbody,
			tfoot {
				display: flex;
				flex-direction: column;
				gap: 2px;
				border: 0;
				background: none;
				color: var(--nimble-ui-ink);
				font-weight: 600;
				text-transform: none;
			}

			tr {
				display: grid;
				grid-template-columns: repeat(var(--abilityScoreCount, 4), minmax(0, 1fr));
				align-items: center;
				column-gap: 6px;
			}

			tr:nth-child(even) {
				background: none;
			}

			// Column labels; the star marks a key stat.
			.nimble-stat-config__header-row .nimble-stat-config__row-label {
				display: none;
			}

			.nimble-stat-config__ability-header {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 4px;
				height: 22px;
				padding: 0 8px;
				font-size: 0.75rem;
				font-weight: 700;
				line-height: 1;
				letter-spacing: 0.05em;
				text-transform: uppercase;
				white-space: nowrap;
				color: var(--nimble-ui-ink-muted);
			}

			.nimble-stat-config__ability-header--key {
				color: var(--nimble-ui-ink);
			}

			.nimble-stat-config__ability-name {
				display: block;
				line-height: 1;
			}

			.nimble-stat-config__key-indicator {
				font-size: 0.5rem;
				line-height: 1;
				color: var(--nimble-ui-highlight);
			}

			.nimble-stat-config__section-header th {
				grid-column: 1 / -1;
				padding: 0;
			}

			.nimble-stat-config__row-label {
				grid-column: 1 / -1;
				padding: 4px 4px 0;
				text-align: left;
				font-size: 0.75rem;
				font-weight: 700;
				white-space: nowrap;
				color: var(--nimble-ui-ink);
			}

			.nimble-stat-config__row-label--item {
				font-weight: 600;

				i {
					margin-right: 6px;
					color: var(--nimble-ui-ink-dim);
				}
			}

			.nimble-stat-config__row-label.nimble-stat-config__row-label--total {
				@extend %nimble-stat-config-group-heading;
			}

			.nimble-stat-config__data-row--bonus,
			.nimble-stat-config__data-row--asi,
			.nimble-stat-config__data-row--boon {
				padding-bottom: 4px;
				border-bottom: 1px solid var(--nimble-ui-soft);
			}

			.nimble-stat-config__subtotal-row .nimble-stat-config__row-label {
				font-weight: 600;
				color: var(--nimble-ui-ink-muted);
			}

			.nimble-stat-config__empty-message {
				grid-column: 1 / -1;
				padding: 10px 8px;
				text-align: center;
				font-size: 0.75rem;
				font-weight: 600;
				color: var(--nimble-ui-ink-muted);

				i {
					margin-right: 6px;
					color: var(--nimble-ui-ink-dim);
				}
			}

			.nimble-stat-config__empty-state {
				grid-column: 1 / -1;
				padding: 0;
			}

			.nimble-stat-config__spacer-row {
				display: none;
			}

			.nimble-stat-config__input-cell,
			.nimble-stat-config__value-cell,
			.nimble-stat-config__toggle-cell {
				padding: 2px;
				text-align: center;
			}

			.nimble-stat-config__boon-cell {
				grid-column: 1 / -1;
				padding: 2px 4px;
				text-align: center;
				font-size: 0.75rem;
				font-weight: 600;
				color: var(--nimble-ui-ink-muted);

				i {
					margin-right: 6px;
					color: var(--nimble-ui-ink-dim);
				}
			}

			.nimble-stat-config__total-cell {
				@extend %nimble-stat-config-stat-box;

				padding: 5px 8px;
				text-align: center;
			}

			// A stat increase choice is a secondary Button that stays pressed.
			.nimble-stat-config__toggle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 26px;
				height: 26px;
				min-height: 0;
				margin: 0;
				padding: 0;
				border: 1px solid var(--nimble-ui-ring);
				border-radius: 4px;
				background: none;
				box-shadow: none;
				font-family: var(--nimble-primary-font);
				font-size: 0.75rem;
				font-weight: 700;
				line-height: 1;
				color: var(--nimble-ui-ink);
				cursor: pointer;
				transition:
					border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
					background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

				&:hover:not(:disabled) {
					border-color: var(--nimble-ui-highlight);
					background: var(--nimble-ui-hover);
					box-shadow: none;
				}

				&:focus-visible {
					outline: 2px solid var(--nimble-ui-focus);
					outline-offset: 1px;
				}

				&:disabled {
					border-style: dashed;
					background: none;
					color: var(--nimble-ui-ink-muted);
					cursor: default;
				}
			}

			.nimble-stat-config__toggle--active,
			.nimble-stat-config__toggle--active:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
				box-shadow: inset 0 0 0 1px var(--nimble-ui-highlight);
				color: var(--nimble-ui-highlight);
			}
		}

		&__section-title {
			@extend %nimble-stat-config-group-heading;
		}

		&__section-title-text {
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.1em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);
		}

		&__section-subtitle {
			font-size: 0.688rem;
			font-weight: 700;
			letter-spacing: 0;
			text-transform: none;
			color: var(--nimble-ui-ink-muted);
		}

		&__empty-state-content {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
			padding: 10px 8px;
			border: 0;
			background: none;
		}

		&__empty-state-icon {
			margin-bottom: 2px;
			font-size: 0.875rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__empty-state-text {
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__empty-state-hint {
			font-size: 0.688rem;
			font-weight: 600;
			text-align: center;
			color: var(--nimble-ui-ink-muted);
		}

		&__base-input {
			@extend %nimble-stat-config-plain-number;
		}

		&__bonus-value {
			font-size: 0.813rem;
			font-weight: 700;
			color: var(--nimble-ui-action);
		}

		&__empty-value {
			font-size: 0.813rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__subtotal-value {
			font-size: 0.813rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}

		&__type-badge {
			@extend %nimble-stat-config-tag;

			margin-left: 6px;
			vertical-align: middle;
		}

		&__toggle-value {
			line-height: 1;
		}

		&__toggle-unavailable {
			color: var(--nimble-ui-ink-dim);
		}

		&__total-value {
			font-size: 1rem;
			font-weight: 900;
			line-height: 1.2;
			color: var(--nimble-ui-ink);
		}

		&__legend {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 6px;
			padding: 4px 0 0;
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
			background: none;
		}

		&__legend-row {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 6px 14px;
		}

		&__legend-item {
			display: flex;
			align-items: center;
			gap: 6px;

			.nimble-stat-config__type-badge {
				margin-left: 0;
			}
		}

		&__legend-icon--key {
			font-size: 0.5rem;
			color: var(--nimble-ui-highlight);
		}

		&__legend-icon--advantage {
			font-size: 0.75rem;
			color: var(--nimble-ui-action);
		}

		&__legend-icon--disadvantage {
			font-size: 0.75rem;
			color: var(--nimble-ui-vital);
		}

		&__base-section {
			display: flex;
			flex-direction: column;
			gap: 6px;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
		}

		&__base-header {
			@extend %nimble-stat-config-group-heading;

			align-items: center;
			margin-bottom: 0;
		}

		&__base-title {
			display: flex;
			align-items: baseline;
			gap: 8px;
		}

		& &__base-header .nimble-button[data-button-variant='icon'] {
			display: grid;
			place-items: center;
			width: 26px;
			height: 26px;
			margin: -6px 0 -6px auto;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: none;
			opacity: 1;
			transform: none;
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-dim);
			transition:
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				background: var(--nimble-ui-hover);
				color: var(--nimble-ui-ink);
				transform: none;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}

		&__array-selection {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		&__array-label {
			display: block;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__stat-arrays {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 6px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__stat-arrays-option {
			display: contents;
		}

		// An array choice is a secondary Button that stays pressed.
		&__stat-arrays &__stat-array {
			--button-size: fit-content;

			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
			height: auto;
			min-height: 0;
			margin: 0;
			padding: 6px 8px;
			overflow: hidden;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			line-height: 1.2;
			color: var(--nimble-ui-ink);
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
				box-shadow: none;
				color: var(--nimble-ui-ink);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}

		&__stat-arrays &__stat-array--selected,
		&__stat-arrays &__stat-array--selected:hover {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
			box-shadow: inset 0 0 0 1px var(--nimble-ui-highlight);

			.nimble-stat-config__stat-array-name {
				color: var(--nimble-ui-highlight);
			}
		}

		&__stat-array-name {
			font-size: 0.75rem;
			font-weight: 700;
			text-align: left;
		}

		&__array-terms {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(1rem, 1fr));
			gap: 4px;
			width: 100%;
			margin: 0;
			padding: 0;
			list-style: none;
			line-height: 1;
		}

		&__array-terms-value {
			padding: 0 2px;
			border-radius: 3px;
			box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
			font-size: 0.75rem;
			font-weight: 700;
			line-height: 18px;
			text-align: center;
			color: var(--nimble-ui-ink);
		}

		&__actions {
			display: flex;
			justify-content: flex-end;
			gap: 6px;
		}

		& &__actions &__apply-btn:disabled,
		& &__actions &__apply-btn:disabled:hover {
			border-style: dashed;
			border-color: var(--nimble-ui-ring);
			background: none;
			color: var(--nimble-ui-ink-muted);
			cursor: default;
		}

		&__current-array {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 0 2px;
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
			background: none;
		}

		&__current-array-label {
			font-weight: 600;
		}

		&__current-array-name {
			font-weight: 700;
			color: var(--nimble-ui-ink);
		}
	}

	.nimble-cc-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px 14px;
		padding: 0;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
		background: none;

		&__item {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		&__icon--key {
			font-size: 0.5rem;
			color: var(--nimble-ui-highlight);
		}

		&__icon--advantage {
			font-size: 0.75rem;
			color: var(--nimble-ui-action);
		}

		&__icon--disadvantage {
			font-size: 0.75rem;
			color: var(--nimble-ui-vital);
		}
	}

	.nimble-array-value-list,
	.nimble-ability-score-list {
		display: grid;
		grid-template-columns: repeat(var(--abilityScoreCount, 4), minmax(0, 1fr));
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-array-value-list__option {
		@extend %nimble-stat-config-stat-box;

		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		position: relative;
		margin: 0;
		padding: 5px 8px;
		font-size: 1rem;
		font-weight: 900;
		color: var(--nimble-ui-ink);
		cursor: grab;
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

		&:hover {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);

			.drag-icon {
				color: var(--nimble-ui-ink);
			}
		}

		&:active {
			cursor: grabbing;
		}

		.drag-icon {
			position: absolute;
			left: 8px;
			font-size: 0.688rem;
			color: var(--nimble-ui-ink-dim);
		}

		.modifier-value {
			font-weight: 900;
		}
	}

	.nimble-cc-ability-score {
		@extend %nimble-stat-config-stat-box;

		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		position: relative;
		margin: 0;
		padding: 6px 8px 4px;
		cursor: auto;
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

		&:global(.nimble-cc-ability-score--drag-over) {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
		}

		&__header {
			text-align: center;
		}

		.nimble-ability-score-list &__header .nimble-heading[data-heading-variant='section'] {
			--nimble-heading-size: 0.688rem;
			--nimble-heading-weight: 900;
			--nimble-heading-color: var(--nimble-ui-ink-dim);
			--nimble-heading-line-height: 1.2;

			margin: 0;
			padding: 0;
			border: 0;
			font-family: var(--nimble-primary-font);
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		&__key-star {
			margin-left: 2px;
			font-size: 0.5rem;
			color: var(--nimble-ui-highlight);
		}

		&__indicators {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			min-height: 0.875rem;
		}

		&__indicator {
			font-size: 0.75rem;

			&--advantage {
				color: var(--nimble-ui-action);
			}

			&--disadvantage {
				color: var(--nimble-ui-vital);
			}
		}

		&__drop-zone {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 2px;
			width: 100%;
			padding: 4px;
			border: 1px dashed var(--nimble-ui-ring);
			border-radius: 4px;
			color: var(--nimble-ui-ink-muted);
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			.drop-icon {
				font-size: 0.688rem;
				color: var(--nimble-ui-ink-dim);
			}

			.drop-text {
				font-size: 0.625rem;
				font-weight: 800;
				letter-spacing: 0.05em;
				text-transform: uppercase;
			}
		}

		&:global(.nimble-cc-ability-score--drag-over) &__drop-zone {
			border-color: var(--nimble-ui-highlight);
			color: var(--nimble-ui-highlight);

			.drop-icon {
				color: var(--nimble-ui-highlight);
			}
		}

		&__value {
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;
			width: 100%;
			padding: 0 4px;
			border-radius: 2px;
			background: none;
			font-size: 1rem;
			font-weight: 900;
			line-height: 1.4;
			text-align: center;
			color: var(--nimble-ui-ink);
			cursor: grab;
			transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			.drag-icon {
				position: absolute;
				left: 4px;
				font-size: 0.625rem;
				color: var(--nimble-ui-ink-dim);
			}

			&:hover {
				background: var(--nimble-ui-hover);

				.drag-icon {
					color: var(--nimble-ui-ink);
				}
			}

			&--no-drag,
			&--no-drag:hover {
				background: none;
				cursor: auto;
			}
		}
	}
</style>

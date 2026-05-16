<script lang="ts">
	import { onMount } from 'svelte';

	import localize from '#utils/localize.js';
	import type { PredicateBuilderProps } from '#view/rulesBuilder/types.js';

	import {
		createPredicateBuilderState,
		OPERATORS,
		operatorHint,
		operatorLabel,
		type Operator,
	} from './PredicateBuilderState.svelte.js';
	import { loadCompendiumKeys } from './predicateKeyCache.svelte.js';

	let { value, onChange, previewDomain }: PredicateBuilderProps = $props();

	const state = createPredicateBuilderState(
		() => value,
		() => onChange,
		() => previewDomain,
	);

	state.setupSyncEffect();

	onMount(() => {
		void loadCompendiumKeys();
	});
</script>

<div class="nimble-predicate-builder">
	<p class="nimble-predicate-builder__intro">
		{localize('NIMBLE.rulesBuilder.predicateIntro')}
	</p>

	{#each state.rows as row, index (index)}
		<div class="nimble-predicate-builder__row">
			<input
				class="nimble-predicate-builder__key"
				type="text"
				placeholder={state.suggestionKeys.length
					? localize('NIMBLE.rulesBuilder.predicateKeyPlaceholder')
					: localize('NIMBLE.rulesBuilder.predicateKeyPlaceholderEmpty')}
				list={state.suggestionKeys.length ? state.datalistId : undefined}
				value={row.key}
				oninput={(e) => state.updateRow(index, { key: (e.target as HTMLInputElement).value })}
				onchange={state.emit}
			/>

			<select
				class="nimble-predicate-builder__operator"
				value={row.operator}
				onchange={(e) =>
					state.updateOperator(index, (e.target as HTMLSelectElement).value as Operator)}
			>
				{#each OPERATORS as op (op)}
					<option value={op}>{operatorLabel(op)}</option>
				{/each}
			</select>

			<div class="nimble-predicate-builder__value">
				{#if row.operator === 'is'}
					<input
						type="text"
						placeholder={localize('NIMBLE.rulesBuilder.predicateValuePlaceholder')}
						value={row.valueText}
						oninput={(e) =>
							state.updateRow(index, { valueText: (e.target as HTMLInputElement).value })}
						onchange={state.emit}
					/>
				{:else if row.operator === 'isOneOf'}
					<div class="nimble-predicate-builder__array">
						{#each row.valueArray as item, arrayIndex (arrayIndex)}
							<div class="nimble-predicate-builder__array-row">
								<input
									type="text"
									placeholder={localize('NIMBLE.rulesBuilder.predicateValuePlaceholder')}
									value={item}
									oninput={(e) =>
										state.updateArrayValue(index, arrayIndex, (e.target as HTMLInputElement).value)}
									onchange={state.emit}
								/>
								<button
									type="button"
									class="nimble-button"
									data-button-variant="icon"
									aria-label={localize('NIMBLE.rulesBuilder.predicateRemoveValue')}
									onclick={() => state.removeArrayValue(index, arrayIndex)}
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/each}
						<button
							type="button"
							class="nimble-button"
							data-button-variant="basic"
							onclick={() => state.addArrayValue(index)}
						>
							<i class="fa-solid fa-plus"></i>
							{localize('NIMBLE.rulesBuilder.addValue')}
						</button>
					</div>
				{:else if row.operator === 'isBetween'}
					<div class="nimble-predicate-builder__range">
						<input
							type="number"
							placeholder={localize('NIMBLE.rulesBuilder.predicateMinPlaceholder')}
							value={row.valueRangeMin}
							oninput={(e) =>
								state.updateRow(index, { valueRangeMin: (e.target as HTMLInputElement).value })}
							onchange={state.emit}
						/>
						<span class="nimble-predicate-builder__range-sep"
							>{localize('NIMBLE.rulesBuilder.predicateRangeAnd')}</span
						>
						<input
							type="number"
							placeholder={localize('NIMBLE.rulesBuilder.predicateMaxPlaceholder')}
							value={row.valueRangeMax}
							oninput={(e) =>
								state.updateRow(index, { valueRangeMax: (e.target as HTMLInputElement).value })}
							onchange={state.emit}
						/>
					</div>
				{:else}
					<input
						type="number"
						placeholder={localize('NIMBLE.rulesBuilder.predicateValuePlaceholder')}
						value={row.valueNumber}
						oninput={(e) =>
							state.updateRow(index, { valueNumber: (e.target as HTMLInputElement).value })}
						onchange={state.emit}
					/>
				{/if}

				<small class="nimble-predicate-builder__hint">{operatorHint(row.operator)}</small>
			</div>

			<button
				type="button"
				class="nimble-button nimble-predicate-builder__delete"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.rulesBuilder.predicateDeleteCondition')}
				onclick={() => state.deleteRow(index)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	{/each}

	<button type="button" class="nimble-button" data-button-variant="basic" onclick={state.addRow}>
		<i class="fa-solid fa-plus"></i>
		{localize('NIMBLE.rulesBuilder.predicateAddCondition')}
	</button>

	{#if state.preview}
		<div
			class="nimble-predicate-builder__preview"
			class:nimble-predicate-builder__preview--match={state.preview.matches}
			class:nimble-predicate-builder__preview--no-match={!state.preview.matches}
		>
			<i
				class="fa-solid {state.preview.matches ? 'fa-circle-check' : 'fa-circle-xmark'}"
				aria-hidden="true"
			></i>
			<span>
				{state.preview.matches
					? localize('NIMBLE.rulesBuilder.predicatePreviewMatches')
					: (state.preview.reason ?? localize('NIMBLE.rulesBuilder.predicatePreviewNoMatch'))}
			</span>
		</div>
	{/if}

	{#if state.suggestionKeys.length}
		<datalist id={state.datalistId}>
			{#each state.suggestionKeys as key (key)}
				<option value={key}></option>
			{/each}
		</datalist>
	{/if}
</div>

<style lang="scss">
	.nimble-predicate-builder {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;

		&__intro {
			margin: 0 0 0.25rem 0;
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(7rem, 1fr) minmax(6rem, auto) minmax(10rem, 2fr) auto;
			gap: 0.375rem;
			align-items: start;
			padding: 0.375rem;
			background: var(--nimble-sheet-background, transparent);
			border-radius: 4px;
		}

		&__operator {
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-sm-text);
		}

		&__value {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array-row {
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}

		&__range {
			display: flex;
			gap: 0.375rem;
			align-items: center;
		}

		&__range-sep {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
		}

		&__hint {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			font-style: italic;
		}

		&__preview {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			border-radius: 4px;

			&--match {
				background: var(--nimble-roll-success-background-color);
				color: var(--nimble-roll-success-color);
			}

			&--no-match {
				background: var(--nimble-roll-failure-background-color);
				color: var(--nimble-roll-failure-color);
			}
		}
	}
</style>

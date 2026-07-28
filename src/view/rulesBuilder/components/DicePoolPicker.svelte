<script lang="ts">
	import localize from '#utils/localize.js';
	import { createDicePoolPickerState } from './DicePoolPicker.svelte.js';

	type DicePoolPickerProps = {
		value: string;
		onChange: (next: string) => void;
		disabled?: boolean;
		document: unknown;
		required?: boolean;
	};

	let {
		value,
		onChange,
		disabled = false,
		document,
		required = false,
	}: DicePoolPickerProps = $props();

	const state = createDicePoolPickerState(() => document);

	const options = $derived(state.options);
	const hasPools = $derived(options.length > 0);
	const hasActor = $derived(state.hasActor);
	const isStaleValue = $derived(
		value.length > 0 && !options.some((option) => option.identifier === value),
	);

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement | HTMLInputElement;
		onChange(target.value);
	}
</script>

{#if !hasPools}
	<!-- Nothing to list: either the item is unowned (compendium or world
	     directory) or its actor has no pools yet. Fall back to free text so
	     pack authors can still write an identifier by hand. -->
	<input
		class="nimble-field-input nimble-pool-picker nimble-pool-picker--dice"
		type="text"
		{value}
		{disabled}
		placeholder={localize('NIMBLE.rulesBuilder.poolIdentifierPlaceholder')}
		onchange={handleChange}
	/>
	<small class="nimble-field-hint">
		{hasActor
			? localize('NIMBLE.rulesBuilder.dicePoolPicker.empty')
			: localize('NIMBLE.rulesBuilder.poolPickerNoActor')}
	</small>
{:else}
	<select
		class="nimble-field-input nimble-pool-picker nimble-pool-picker--dice"
		{value}
		{disabled}
		onchange={handleChange}
	>
		{#if isStaleValue}
			<option {value}
				>{localize('NIMBLE.rulesBuilder.dicePoolPicker.notFound', { identifier: value })}</option
			>
		{/if}
		{#if !required}
			<option value=""></option>
		{/if}
		{#each options as option (option.identifier)}
			<option value={option.identifier}>{option.label}</option>
		{/each}
	</select>
{/if}

<style lang="scss">
	.nimble-field-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}

	.nimble-field-hint {
		display: block;
		margin-top: 0.125rem;
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-xs-text);
	}
</style>

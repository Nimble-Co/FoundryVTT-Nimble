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
	const isStaleValue = $derived(
		value.length > 0 && !options.some((option) => option.identifier === value),
	);

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onChange(target.value);
	}
</script>

{#if !hasPools}
	<select class="nimble-field-input" {value} disabled>
		{#if isStaleValue}
			<option {value}
				>{localize('NIMBLE.rulesBuilder.dicePoolPicker.notFound', { identifier: value })}</option
			>
		{:else}
			<option value="">{localize('NIMBLE.rulesBuilder.dicePoolPicker.empty')}</option>
		{/if}
	</select>
{:else}
	<select class="nimble-field-input" {value} {disabled} onchange={handleChange}>
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
</style>

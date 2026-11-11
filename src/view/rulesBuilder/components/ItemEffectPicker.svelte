<script lang="ts">
	import localize from '#utils/localize.js';
	import { createItemEffectPickerState } from './ItemEffectPicker.svelte.js';

	type ItemEffectPickerProps = {
		value: string;
		onChange: (next: string) => void;
		disabled?: boolean;
		document: unknown;
		/** The field label, the accessible name of the select. */
		label: string;
	};

	let { value, onChange, disabled = false, document, label }: ItemEffectPickerProps = $props();

	const pickerState = createItemEffectPickerState(
		() => document,
		() => value,
	);
	const hasItem = $derived(pickerState.hasItem);
	const options = $derived(pickerState.options);
	const isMissing = $derived(pickerState.isMissing);

	function handleChange(event: Event) {
		onChange((event.target as HTMLSelectElement).value);
	}
</script>

<select
	class="nimble-field-input nimble-item-effect-picker"
	aria-label={label}
	{value}
	{disabled}
	onchange={handleChange}
>
	<option value="">{localize('NIMBLE.rulesBuilder.itemEffectPicker.none')}</option>
	{#if isMissing}
		<option {value}
			>{localize('NIMBLE.rulesBuilder.itemEffectPicker.missing', { id: value })}</option
		>
	{/if}
	{#each options as option (option.id)}
		<option value={option.id}>{option.name}</option>
	{/each}
</select>
{#if !hasItem}
	<small class="nimble-field-hint">{localize('NIMBLE.rulesBuilder.itemEffectPicker.noItem')}</small>
{:else if options.length === 0}
	<small class="nimble-field-hint">{localize('NIMBLE.rulesBuilder.itemEffectPicker.empty')}</small>
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
		color: var(--nimble-ui-ink-muted);
		font-size: var(--nimble-xs-text);
	}
</style>

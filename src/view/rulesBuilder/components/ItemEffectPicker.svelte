<script lang="ts">
	import localize from '#utils/localize.js';
	import { createItemEffectPickerState } from './ItemEffectPicker.svelte.js';

	type ItemEffectPickerProps = {
		value: string;
		onChange: (next: string) => void;
		disabled?: boolean;
		document: unknown;
	};

	let { value, onChange, disabled = false, document }: ItemEffectPickerProps = $props();

	const pickerState = createItemEffectPickerState(
		() => document,
		() => value,
	);

	function handleChange(event: Event) {
		onChange((event.target as HTMLSelectElement).value);
	}
</script>

<select
	class="nimble-field-input nimble-item-effect-picker"
	{value}
	{disabled}
	onchange={handleChange}
>
	<option value="">{localize('NIMBLE.rulesBuilder.itemEffectPicker.none')}</option>
	{#if pickerState.isMissing}
		<option {value}
			>{localize('NIMBLE.rulesBuilder.itemEffectPicker.missing', { id: value })}</option
		>
	{/if}
	{#each pickerState.options as option (option.id)}
		<option value={option.id}>{option.name}</option>
	{/each}
</select>
{#if !pickerState.hasItem}
	<small class="nimble-field-hint">{localize('NIMBLE.rulesBuilder.itemEffectPicker.noItem')}</small>
{:else if pickerState.options.length === 0}
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

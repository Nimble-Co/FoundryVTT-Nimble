<script lang="ts">
	import type { FormulaInputProps } from '#view/rulesBuilder/types.js';

	let {
		value,
		onChange,
		placeholder,
		disabled = false,
		dice = false,
	}: FormulaInputProps = $props();

	const resolvedPlaceholder = $derived(
		placeholder ?? (dice ? 'e.g. 1d6 + @level' : 'e.g. 2 or 1d6 or @level'),
	);

	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		onChange(target.value);
	}
</script>

<input
	class="nimble-formula-input"
	class:nimble-formula-input--dice={dice}
	type="text"
	{value}
	placeholder={resolvedPlaceholder}
	{disabled}
	autocapitalize="off"
	autocomplete="off"
	spellcheck="false"
	onchange={handleChange}
/>

<style lang="scss">
	.nimble-formula-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-family: var(--nimble-font-monospace, monospace);
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}
</style>

<script lang="ts">
	import localize from '#utils/localize.js';
	import { createDocumentPickerState } from '#view/rulesBuilder/components/DocumentPicker.svelte.js';
	import type { DocumentPickerProps } from '#view/rulesBuilder/types.js';

	let {
		value,
		onChange,
		disabled = false,
		documentTypes,
		placeholder,
	}: DocumentPickerProps = $props();

	const resolvedPlaceholder = $derived(
		placeholder ?? localize('NIMBLE.rulesBuilder.dragDocumentHere'),
	);

	const state = createDocumentPickerState(
		() => value,
		() => documentTypes,
		() => onChange,
		() => disabled,
	);

	state.setupResolveEffect();
</script>

<div
	class="nimble-document-picker"
	class:nimble-document-picker--drag-over={state.dragOver}
	class:nimble-document-picker--filled={Boolean(value)}
	class:nimble-document-picker--error={Boolean(state.resolveError)}
	class:nimble-document-picker--disabled={disabled}
	role="region"
	ondragover={state.handleDragOver}
	ondragleave={state.handleDragLeave}
	ondrop={state.handleDrop}
>
	{#if value}
		<div class="nimble-document-picker__filled">
			<i class="nimble-document-picker__icon fa-solid fa-file-lines"></i>

			<div class="nimble-document-picker__label">
				{#if state.resolveError}
					<span class="nimble-document-picker__error">{state.resolveError}</span>
					<small class="nimble-document-picker__uuid">{value}</small>
				{:else}
					<span class="nimble-document-picker__name">{state.resolvedName ?? value}</span>
					<small class="nimble-document-picker__uuid">{value}</small>
				{/if}
			</div>

			<button
				class="nimble-button"
				type="button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.rulesBuilder.clearDocument')}
				data-tooltip={localize('NIMBLE.rulesBuilder.clear')}
				{disabled}
				onclick={state.handleClear}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	{:else}
		<div class="nimble-document-picker__empty">
			<i class="nimble-document-picker__icon fa-solid fa-arrow-down-to-bracket"></i>
			<span>{resolvedPlaceholder}</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-document-picker {
		display: flex;
		min-height: 2.25rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px dashed var(--nimble-accent-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

		&--drag-over {
			border-style: solid;
			background: var(--nimble-selected-tag-background-color);
		}

		&--filled {
			border-style: solid;
		}

		&--error {
			border-color: var(--color-level-error, crimson);
		}

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}

		&__filled {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			width: 100%;
		}

		&__empty {
			display: flex;
			gap: 0.5rem;
			justify-content: center;
			align-items: center;
			width: 100%;
			color: var(--color-text-dark-secondary, inherit);
			font-size: var(--nimble-sm-text);
		}

		&__label {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			min-width: 0;
		}

		&__name {
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__uuid {
			font-family: var(--nimble-font-monospace, monospace);
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__error {
			color: var(--color-level-error, crimson);
			font-weight: 600;
		}

		&__icon {
			color: var(--nimble-accent-color);
		}
	}
</style>

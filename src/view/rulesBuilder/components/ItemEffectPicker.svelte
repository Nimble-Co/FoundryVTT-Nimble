<script lang="ts">
	import type { ItemEffectPickerProps } from '#types/components/ItemEffectPicker.d.ts';
	import type { ItemEffectSelectItem } from '#types/components/ItemEffectSelect.d.ts';
	import localize from '#utils/localize.js';
	import ItemEffectSelect from '#view/components/ItemEffectSelect.svelte';

	let {
		value,
		onChange,
		disabled = false,
		document,
		label,
		recipient = 'targets',
	}: ItemEffectPickerProps = $props();

	/** The item that holds the rule: the document itself, or the item of a rule-holding effect. */
	const item = $derived.by((): ItemEffectSelectItem | null => {
		const doc = document as { documentName?: string; parent?: { documentName?: string } } | null;
		if (doc?.documentName === 'Item') return doc as ItemEffectSelectItem;
		if (doc?.documentName === 'ActiveEffect' && doc.parent?.documentName === 'Item') {
			return doc.parent as ItemEffectSelectItem;
		}
		return null;
	});
</script>

<div class="nimble-item-effect-picker">
	<ItemEffectSelect
		{item}
		{value}
		onchange={(next) => onChange(next ?? '')}
		{recipient}
		{label}
		{disabled}
	/>
</div>
{#if !item}
	<small class="nimble-field-hint">{localize('NIMBLE.rulesBuilder.itemEffectPicker.noItem')}</small>
{/if}

<style lang="scss">
	.nimble-item-effect-picker :global(select) {
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

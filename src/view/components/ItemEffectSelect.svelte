<!--
@component
Picks an effect of an item, as an Apply Effect node and the `itemEffectPicker` rule fields do: the
select ends with "New effect", a pencil opens the picked effect, and its Lasts Until line is under it.
-->
<script lang="ts">
	import type { ItemEffectSelectProps } from '#types/components/ItemEffectSelect.d.ts';
	import localize from '#utils/localize.js';
	import { itemEffectLastsUntil } from '../dataPreparationHelpers/itemEffectLastsUntil.js';
	import { createItemEffectSelectState, NEW_EFFECT } from './ItemEffectSelect.svelte.js';

	const WORDS = 'NIMBLE.activationEffects.applyEffectNode';

	let {
		item,
		value,
		onchange,
		recipient,
		label,
		labelledby,
		disabled = false,
	}: ItemEffectSelectProps = $props();

	const selectState = createItemEffectSelectState(
		() => item,
		() => value,
	);
	const lasts = $derived(itemEffectLastsUntil(selectState.picked, recipient));

	async function handleChange(select: HTMLSelectElement) {
		let stored = false;
		try {
			stored = await selectState.choose(select.value, onchange);
		} finally {
			// A pick that is not stored must not stay on show.
			if (!stored || select.value === NEW_EFFECT) select.value = value ?? '';
		}
	}
</script>

<div class="nimble-item-effect-select">
	<div class="nimble-item-effect-select__row">
		<select
			class="nimble-item-effect-select__select"
			aria-label={labelledby ? undefined : label}
			aria-labelledby={labelledby}
			disabled={disabled || !item}
			onchange={({ currentTarget }) => handleChange(currentTarget)}
		>
			<option value="" selected={!value}>{localize(`${WORDS}.noEffect`)}</option>
			{#if selectState.isMissing}
				<option {value} selected>
					{localize('NIMBLE.rulesBuilder.itemEffectPicker.missing', { id: value ?? '' })}
				</option>
			{/if}
			{#each selectState.options as option (option.id)}
				<option value={option.id} selected={option.id === value}>{option.name}</option>
			{/each}
			<option value={NEW_EFFECT}>{localize(`${WORDS}.newEffect`)}</option>
		</select>

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			aria-label={localize(`${WORDS}.edit`)}
			data-tooltip={localize(`${WORDS}.edit`)}
			disabled={!selectState.picked}
			onclick={selectState.openPicked}
		>
			<i class="fa-solid fa-pen" aria-hidden="true"></i>
		</button>
	</div>

	{#if lasts}
		<p class="nimble-item-effect-select__lasts">
			<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
			<span>{lasts}</span>
		</p>
	{/if}
</div>

<style lang="scss">
	.nimble-item-effect-select {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		min-width: 0;

		&__row {
			display: flex;
			align-items: center;
			gap: 0.25rem;

			.nimble-button {
				--nimble-button-min-width: var(--input-height);
				--nimble-button-height: var(--input-height);
			}
		}

		&__select {
			flex: 1 1 auto;
			min-width: 0;
		}

		&__lasts {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
			color: var(--nimble-ui-ink-muted);

			i {
				margin-top: 0.125rem;
			}
		}
	}
</style>

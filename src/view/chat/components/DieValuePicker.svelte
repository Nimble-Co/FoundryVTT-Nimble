<script lang="ts">
	import type { DieValuePickerProps } from '#types/components/DieValuePicker.d.ts';

	import { onMount } from 'svelte';
	import localize from '#utils/localize.js';
	import DieBonusBadge from '../../components/DieBonusBadge.svelte';
	import DieFace from '../../components/DieFace.svelte';
	import { createDieValuePickerState } from './DieValuePicker.svelte.ts';
	import { primaryDieBonusText } from './primaryDieBonusText.ts';

	let {
		die,
		feature,
		primaryOutcome = null,
		bonusLines = [],
		sending = false,
		onpick,
		oncancel,
	}: DieValuePickerProps = $props();

	const titleId = $props.id();
	const picker = createDieValuePickerState(() => ({ die, feature, sending, onpick, oncancel }));
	const { elements, set, confirm, onInputKeydown, onKeydown, onInputBlur, focusInput } = picker;

	const bonus = $derived(primaryDieBonusText(die.bonus ?? 0, bonusLines));

	onMount(focusInput);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="nimble-value-picker" role="group" aria-labelledby={titleId} onkeydown={onKeydown}>
	<div class="nimble-value-picker__head">
		<i class="nimble-value-picker__icon fa-solid fa-pen" aria-hidden="true"></i>
		<span id={titleId} class="nimble-value-picker__title" aria-live="polite">{picker.title}</span>
		{#if !sending}
			<button
				class="nimble-value-picker__cancel nimble-u-unstyled-button"
				type="button"
				onclick={oncancel}
			>
				{localize('NIMBLE.chat.incomingReactions.pickDie.cancel')}
			</button>
		{/if}
	</div>

	<div class="nimble-value-picker__row">
		<DieFace
			faces={die.faces}
			value={die.value}
			outcome={die.role === 'primary' ? primaryOutcome : null}
			discarded
		/>
		<i class="nimble-value-picker__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
		<div class="nimble-value-picker__stepper">
			<button
				class="nimble-button nimble-value-picker__step"
				type="button"
				aria-label={localize('NIMBLE.chat.incomingReactions.pickValue.lower')}
				disabled={sending || picker.shown <= 1}
				onclick={() => set(picker.shown - 1)}
			>
				<i class="fa-solid fa-minus" aria-hidden="true"></i>
			</button>
			<span class="nimble-value-picker__new">
				<span class="nimble-value-picker__new-face" aria-hidden="true">
					<DieFace faces={die.faces} />
				</span>
				{#if bonus}
					<DieBonusBadge {bonus} />
				{/if}
				<input
					bind:this={elements.input}
					bind:value={picker.typed}
					class="nimble-value-picker__input"
					type="number"
					min="1"
					max={die.faces}
					step="1"
					aria-label={localize('NIMBLE.chat.incomingReactions.pickValue.input', {
						max: String(die.faces),
					})}
					disabled={sending}
					onkeydown={onInputKeydown}
					onblur={onInputBlur}
				/>
			</span>
			<button
				class="nimble-button nimble-value-picker__step"
				type="button"
				aria-label={localize('NIMBLE.chat.incomingReactions.pickValue.higher')}
				disabled={sending || picker.shown >= die.faces}
				onclick={() => set(picker.shown + 1)}
			>
				<i class="fa-solid fa-plus" aria-hidden="true"></i>
			</button>
		</div>
	</div>

	<div class="nimble-value-picker__chips">
		<button
			class="nimble-button nimble-value-picker__chip"
			type="button"
			disabled={sending}
			onclick={() => set(1)}
		>
			<i class="fa-solid fa-angles-down" aria-hidden="true"></i>
			{localize('NIMBLE.chat.incomingReactions.pickValue.lowest', { value: '1' })}
		</button>
		<button
			class="nimble-button nimble-value-picker__chip"
			type="button"
			disabled={sending}
			onclick={() => set(die.faces)}
		>
			<i class="fa-solid fa-angles-up" aria-hidden="true"></i>
			{localize('NIMBLE.chat.incomingReactions.pickValue.highest', {
				value: String(die.faces),
			})}
		</button>
	</div>

	<button
		class="nimble-button nimble-value-picker__confirm"
		type="button"
		disabled={!picker.canSet}
		onclick={confirm}
	>
		{localize('NIMBLE.chat.incomingReactions.pickValue.confirm', {
			value: String(picker.shown),
		})}
	</button>
</div>

<style lang="scss">
	.nimble-value-picker {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
		// Clears the chat log's bottom fade and its jump-to-bottom button.
		scroll-margin-block-end: 3rem;

		&__head {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);
		}

		&__icon {
			font-size: 0.8em;
		}

		&__title {
			flex: 1;
			min-width: 0;
			font-weight: 600;
		}

		&__cancel {
			flex: none;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			text-decoration: underline;
			text-underline-offset: 2px;
			cursor: pointer;

			&:focus-visible {
				outline: 2px solid var(--nimble-input-border-color);
				outline-offset: 1px;
			}
		}

		&__row {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		&__arrow {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__stepper {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}

		&__step {
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			font-size: var(--nimble-xs-text);
		}

		&__new {
			position: relative;
			display: grid;
			place-items: center;
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 4px;

			&:focus-within {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}
		}

		&__new-face {
			--nimble-die-face-size: 2.75rem;

			position: absolute;
			inset: 0;
			pointer-events: none;
		}

		&__input {
			position: relative;
			width: 2rem;
			height: 1.5rem;
			margin: 0;
			padding: 0;
			font-size: var(--nimble-md-text);
			font-weight: 700;
			font-variant-numeric: tabular-nums;
			text-align: center;
			color: var(--nimble-die-face-number-color);
			background: transparent;
			border: 0;
			box-shadow: none;
			outline: 0;
			appearance: textfield;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				margin: 0;
				appearance: none;
			}
		}

		&__chips {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		&__chip {
			gap: 0.375rem;
			padding: 0.1875rem 0.5rem;
			font-size: var(--nimble-xs-text);

			i {
				font-size: 0.85em;
				color: var(--nimble-medium-text-color);
			}
		}

		&__confirm {
			width: 100%;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
		}

		&__step,
		&__chip,
		&__confirm {
			&:focus-visible {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.5;
			}
		}
	}
</style>

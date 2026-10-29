<script lang="ts">
	import type { DieValuePickerProps } from '#types/components/DieValuePicker.d.ts';

	import { onMount, untrack } from 'svelte';
	import localize from '#utils/localize.js';
	import DieFace from '../../components/DieFace.svelte';

	let {
		die,
		feature,
		primaryOutcome = null,
		sending = false,
		onpick,
		oncancel,
	}: DieValuePickerProps = $props();

	const titleId = $props.id();
	let input = $state<HTMLInputElement>();
	// Starts at the die's own value, so the player always picks one.
	let typed = $state<number | null>(untrack(() => die.value));

	const clamp = (next: number) => Math.min(die.faces, Math.max(1, Math.trunc(next)));
	let value = $derived(typed === null || Number.isNaN(typed) ? null : clamp(typed));
	let canSet = $derived(!sending && value !== null && value !== die.value);
	let title = $derived(
		sending
			? localize('NIMBLE.chat.incomingReactions.pickValue.sending', { feature })
			: localize('NIMBLE.chat.incomingReactions.pickValue.title'),
	);

	function set(next: number) {
		typed = clamp(next);
	}

	function confirm() {
		if (canSet && value !== null) onpick(value);
	}

	function onInputKeydown(event: KeyboardEvent) {
		const current = value ?? die.value;
		const next = { ArrowUp: current + 1, ArrowDown: current - 1, Home: 1, End: die.faces }[
			event.key
		];
		if (next !== undefined) {
			event.preventDefault();
			set(next);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			confirm();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || sending) return;
		// Foundry opens its main menu on an Escape that reaches the window.
		event.preventDefault();
		event.stopPropagation();
		oncancel();
	}

	onMount(() => {
		input?.scrollIntoView?.({ block: 'nearest' });
		input?.focus({ preventScroll: true });
		input?.select();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="nimble-value-picker" role="group" aria-labelledby={titleId} onkeydown={onKeydown}>
	<div class="nimble-value-picker__head">
		<i class="nimble-value-picker__icon fa-solid fa-pen" aria-hidden="true"></i>
		<span id={titleId} class="nimble-value-picker__title">{title}</span>
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
				disabled={sending || (value ?? die.value) <= 1}
				onclick={() => set((value ?? die.value) - 1)}
			>
				<i class="fa-solid fa-minus" aria-hidden="true"></i>
			</button>
			<span class="nimble-value-picker__new">
				<span class="nimble-value-picker__new-face" aria-hidden="true">
					<DieFace faces={die.faces} />
				</span>
				<input
					bind:this={input}
					bind:value={typed}
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
					onblur={() => (typed = value ?? die.value)}
				/>
			</span>
			<button
				class="nimble-button nimble-value-picker__step"
				type="button"
				aria-label={localize('NIMBLE.chat.incomingReactions.pickValue.higher')}
				disabled={sending || (value ?? die.value) >= die.faces}
				onclick={() => set((value ?? die.value) + 1)}
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
		disabled={!canSet}
		onclick={confirm}
	>
		{localize('NIMBLE.chat.incomingReactions.pickValue.confirm', {
			value: String(value ?? die.value),
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

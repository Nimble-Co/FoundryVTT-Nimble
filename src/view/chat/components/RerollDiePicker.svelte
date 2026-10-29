<script lang="ts">
	import type { RerollDiePickerProps } from '#types/components/RerollDiePicker.d.ts';

	import { onMount } from 'svelte';
	import localize from '#utils/localize.js';
	import DieFace from '../../components/DieFace.svelte';
	import {
		createRerollDiePickerState,
		dieCaption,
		dieLabel,
		pickDieWords,
	} from './RerollDiePicker.svelte.ts';

	let {
		dice,
		feature,
		primaryOutcome = null,
		use = 'reroll',
		rolling = null,
		onpick,
		oncancel,
	}: RerollDiePickerProps = $props();

	const titleId = $props.id();
	const picker = createRerollDiePickerState(() => ({ dice, oncancel, rolling }));
	const { elements, focusFirst, onKeydown } = picker;

	let title = $derived(
		rolling
			? localize(`${pickDieWords(use)}.rolling`, { feature })
			: localize(`${pickDieWords(use)}.title`),
	);

	const isRolling = (die: (typeof dice)[number]) =>
		rolling?.term === die.term && rolling.result === die.result;

	onMount(() => {
		if (!rolling) void focusFirst();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="nimble-reroll-picker" role="group" aria-labelledby={titleId} onkeydown={onKeydown}>
	<div class="nimble-reroll-picker__head">
		<i
			class="nimble-reroll-picker__icon fa-solid {use === 'change' ? 'fa-pen' : 'fa-rotate-left'}"
			aria-hidden="true"
		></i>
		<span id={titleId} class="nimble-reroll-picker__title">{title}</span>
		{#if !rolling}
			<button
				class="nimble-reroll-picker__cancel nimble-u-unstyled-button"
				type="button"
				onclick={oncancel}
			>
				{localize('NIMBLE.chat.incomingReactions.pickDie.cancel')}
			</button>
		{/if}
	</div>

	<ul class="nimble-reroll-picker__dice">
		{#each dice as die, index (`${die.term}-${die.result}`)}
			{@const caption = dieCaption(die, dice)}
			<li>
				<button
					bind:this={elements.dice[index]}
					class="nimble-reroll-picker__die nimble-u-unstyled-button"
					type="button"
					aria-label={dieLabel(die, dice, use)}
					disabled={!!rolling}
					onclick={() => onpick(die)}
				>
					<DieFace
						faces={die.faces}
						value={die.value}
						outcome={die.role === 'primary' ? primaryOutcome : null}
						discarded={die.role === 'dropped'}
						rolling={isRolling(die)}
					/>
					<span class="nimble-reroll-picker__caption" aria-hidden="true">{caption}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style lang="scss">
	.nimble-reroll-picker {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
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

		&__dice {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__die {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 1px;
			min-width: 2.5rem;
			padding: 0.25rem 0.25rem 0.125rem;
			color: inherit;
			border: 1px solid transparent;
			border-radius: 6px;
			cursor: pointer;

			:global(.nimble-die-face) {
				width: 2.125rem;
				height: 2.125rem;
			}

			&:hover:not(:disabled),
			&:focus-visible {
				background: var(--nimble-card-background-color);
				border-color: var(--nimble-input-border-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-border-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
			}
		}

		&__caption {
			min-height: 1.2em;
			font-size: 0.625rem;
			line-height: 1.2;
			color: var(--nimble-medium-text-color);
		}
	}
</style>

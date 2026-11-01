<script lang="ts">
	import type { RerollStatPickerProps } from '#types/components/RerollStatPicker.d.ts';

	import { onMount } from 'svelte';
	import localize from '#utils/localize.js';
	import { statChoiceLabel } from './resultChangeLines.ts';

	let { stats, feature, sending = false, onpick }: RerollStatPickerProps = $props();

	let buttons = $state<HTMLButtonElement[]>([]);

	function onKeydown(event: KeyboardEvent): void {
		const current = buttons.indexOf(event.target as HTMLButtonElement);
		if (current === -1) return;
		const last = buttons.length - 1;
		const next = {
			ArrowRight: current >= last ? 0 : current + 1,
			ArrowLeft: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		buttons[next]?.focus();
	}

	onMount(() => {
		if (!sending) buttons[0]?.focus();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="nimble-reroll-stats"
	role="group"
	aria-label={localize('NIMBLE.chat.incomingReactions.pickStat.title', { feature })}
	onkeydown={onKeydown}
>
	{#each stats as choice, index (choice.stat)}
		<button
			bind:this={buttons[index]}
			class="nimble-reroll-stats__stat"
			type="button"
			disabled={sending}
			onclick={() => onpick(choice.stat)}
		>
			{statChoiceLabel(choice)}
		</button>
	{/each}
</div>

<style lang="scss">
	.nimble-reroll-stats {
		display: flex;
		gap: 0.1875rem;
		padding: 0.125rem 0.5rem 0.25rem;
		scroll-margin-block-end: var(--nimble-chat-scroll-clearance);

		&__stat {
			flex: 1;
			width: auto;
			height: auto;
			min-height: 28px;
			margin: 0;
			padding: 0.1875rem 0.25rem;
			font-family: var(--nimble-primary-font);
			font-size: var(--nimble-sm-text);
			font-weight: 800;
			font-variant-numeric: tabular-nums;
			line-height: 1.2;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 3px;
			box-shadow: none;
			cursor: pointer;

			&:hover:not(:disabled) {
				color: inherit;
				background: var(--nimble-card-border-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}
	}
</style>

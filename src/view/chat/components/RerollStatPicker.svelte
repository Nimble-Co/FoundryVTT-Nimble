<script lang="ts">
	import type { RerollStatPickerProps } from '#types/components/RerollStatPicker.d.ts';

	import { onMount } from 'svelte';
	import localize from '#utils/localize.js';
	import { REACTION_VERB_ICONS } from './reactionVerbs.ts';
	import { claimEscape } from './claimEscape.ts';
	import { rovingFocusIndex } from './rovingFocusIndex.ts';
	import { statChoiceLabel } from './resultChangeLines.ts';

	let { stats, feature, sending = false, onpick, oncancel }: RerollStatPickerProps = $props();

	const titleId = $props.id();
	let root = $state<HTMLElement>();
	let buttons = $state<HTMLButtonElement[]>([]);

	function onKeydown(event: KeyboardEvent): void {
		if (sending) return;
		if (claimEscape(event)) {
			oncancel();
			return;
		}
		const current = buttons.indexOf(event.target as HTMLButtonElement);
		if (current === -1) return;
		const last = buttons.length - 1;
		const next = rovingFocusIndex(event.key, current, last, 'horizontal');
		if (next === undefined) return;
		event.preventDefault();
		buttons[next]?.focus();
	}

	onMount(() => {
		if (sending) return;
		root?.scrollIntoView?.({ block: 'nearest' });
		buttons[0]?.focus({ preventScroll: true });
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={root}
	class="nimble-reroll-stats"
	role="group"
	aria-labelledby={titleId}
	onkeydown={onKeydown}
>
	<div class="nimble-reroll-stats__head">
		<i class="nimble-reroll-stats__icon {REACTION_VERB_ICONS.reroll}" aria-hidden="true"></i>
		<span id={titleId} class="nimble-reroll-stats__title">
			{localize('NIMBLE.chat.incomingReactions.pickStat.title', { feature })}
		</span>
		{#if !sending}
			<button
				class="nimble-reroll-stats__cancel nimble-u-unstyled-button"
				type="button"
				onclick={oncancel}
			>
				{localize('NIMBLE.chat.incomingReactions.pickDie.cancel')}
			</button>
		{/if}
	</div>

	<div class="nimble-reroll-stats__stats">
		{#each stats as choice, index (choice.stat)}
			<button
				bind:this={buttons[index]}
				class="nimble-roll-control nimble-reroll-stats__stat"
				type="button"
				disabled={sending}
				onclick={() => onpick(choice.stat)}
			>
				{statChoiceLabel(choice)}
			</button>
		{/each}
	</div>
</div>

<style lang="scss">
	.nimble-reroll-stats {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
		scroll-margin-block-end: var(--nimble-chat-scroll-clearance);

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

		&__stats {
			display: flex;
			gap: 0.1875rem;
		}

		&__stat {
			flex: 1;
			width: auto;
			min-height: 28px;
			padding: 0.1875rem 0.25rem;
			font-size: var(--nimble-sm-text);
			font-weight: 800;
			font-variant-numeric: tabular-nums;
		}
	}
</style>

<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { LeftOutRerollsProps } from '#types/components/LeftOutRerolls.d.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import { createLeftOutRerollsState } from './LeftOutRerolls.svelte.ts';

	let { entries }: LeftOutRerollsProps = $props();

	const list = createLeftOutRerollsState(getContext<NimbleChatMessage>('messageDocument'));

	let summary = $derived(
		entries.length === 1
			? localize('NIMBLE.chat.incomingReactions.leftOut.one')
			: localize('NIMBLE.chat.incomingReactions.leftOut.many', { count: String(entries.length) }),
	);
</script>

<details class="nimble-left-out" open={list.open} ontoggle={list.onToggle}>
	<summary class="nimble-left-out__summary">
		<i class="nimble-left-out__chevron fa-solid fa-chevron-right" aria-hidden="true"></i>
		<i class="fa-solid fa-user-slash" aria-hidden="true"></i>
		{summary}
	</summary>

	<ul class="nimble-left-out__list">
		{#each entries as entry (entry.id)}
			<li class="nimble-left-out__row">
				<div class="nimble-left-out__text">
					<span>{list.featureText(entry)}</span>
					<small>{list.reason(entry)}</small>
				</div>
				<button
					class="nimble-button nimble-left-out__add"
					type="button"
					aria-label={list.addLabel(entry)}
					disabled={list.adding}
					onclick={() => list.add(entry)}
				>
					{localize('NIMBLE.chat.incomingReactions.leftOut.add')}
				</button>
			</li>
		{/each}
	</ul>
</details>

<style lang="scss">
	.nimble-left-out {
		margin-top: 0.25rem;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);

		&__summary {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			list-style: none;
			cursor: pointer;

			&::-webkit-details-marker {
				display: none;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-border-color);
				outline-offset: 1px;
			}
		}

		&__chevron {
			font-size: 0.6rem;
			transition: rotate 0.15s ease-out;
		}

		&[open] &__chevron {
			rotate: 90deg;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			margin: 0.375rem 0 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__text {
			display: flex;
			flex: 1;
			flex-direction: column;
			min-width: 0;
			font-size: var(--nimble-sm-text);

			small {
				font-size: var(--nimble-xs-text);
				color: var(--nimble-medium-text-color);
			}
		}

		&__add {
			flex: none;
			width: auto;
			height: auto;
			min-height: 1.75rem;
			padding: 0.125rem 0.875rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
		}
	}
</style>

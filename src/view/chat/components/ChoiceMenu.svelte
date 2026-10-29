<script lang="ts">
	import type { ChoiceMenuProps } from '#types/components/ChoiceMenu.d.ts';

	import { onMount } from 'svelte';
	import { createChoiceMenuState } from './ChoiceMenu.svelte.ts';

	let {
		id,
		label,
		sections,
		disabled = false,
		trigger,
		class: className = '',
		onchoose,
		onclose,
	}: ChoiceMenuProps = $props();

	const menuState = createChoiceMenuState(() => ({ sections, trigger, onclose }));
	const { elements, onKeydown, onWindowPointerDown, focusFirst } = menuState;

	onMount(focusFirst);
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div
	bind:this={elements.menu}
	{id}
	class="nimble-choice-menu {className}"
	role="menu"
	aria-label={label}
	tabindex="-1"
	onkeydown={onKeydown}
>
	{#each sections as section, sectionIndex (section.id)}
		<div class="nimble-choice-menu__section" role="group" aria-label={section.heading || undefined}>
			{#if section.heading}
				<p class="nimble-choice-menu__heading" aria-hidden="true">{section.heading}</p>
			{/if}
			{#each section.items as item, index (item.id)}
				<button
					bind:this={elements.items[menuState.starts[sectionIndex] + index]}
					class="nimble-choice-menu__item"
					type="button"
					role="menuitem"
					tabindex="-1"
					aria-label={item.text}
					data-tooltip={item.text}
					{disabled}
					onclick={() => onchoose(item.id)}
				>
					{#if item.icon}
						<i class="nimble-choice-menu__icon {item.icon}" aria-hidden="true"></i>
					{/if}
					<span class="nimble-choice-menu__label">
						{item.label}
						{#if item.note}
							<span class="nimble-choice-menu__note">{item.note}</span>
						{/if}
					</span>
					{#if item.cost}
						<span class="nimble-choice-menu__cost">{item.cost}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/each}
</div>

<style lang="scss">
	.nimble-choice-menu {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.25rem 0 0;
		padding: 0.25rem;
		background: var(--nimble-card-background-color, transparent);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
		// Clears the chat log's bottom fade and its jump-to-bottom button.
		scroll-margin-block-end: 3rem;

		&:focus-visible {
			outline: none;
		}

		&__section {
			display: flex;
			flex-direction: column;
		}

		&__heading {
			margin: 0.125rem 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__item {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			height: auto;
			min-height: 0;
			margin: 0;
			padding: 0.3125rem 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			line-height: 1.2;
			text-align: left;
			color: inherit;
			background: transparent;
			border: 0;
			border-radius: 3px;
			box-shadow: none;
			cursor: pointer;

			&:hover:not(:disabled) {
				background: color-mix(in srgb, currentColor 8%, transparent);
			}

			&:focus-visible {
				background: color-mix(in srgb, currentColor 8%, transparent);
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: -2px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}

		&__icon {
			flex: none;
			width: 1em;
			font-size: 0.875em;
			text-align: center;
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__note {
			display: block;
			margin-top: 0.125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__cost {
			flex: none;
			margin-left: auto;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			font-variant-numeric: tabular-nums;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}
	}
</style>

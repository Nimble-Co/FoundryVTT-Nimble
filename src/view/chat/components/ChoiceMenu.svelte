<script lang="ts">
	import type { ChoiceMenuProps } from '#types/components/ChoiceMenu.d.ts';

	import { onMount } from 'svelte';

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

	let menu = $state<HTMLDivElement>();
	const items = $state<HTMLButtonElement[]>([]);

	/** Where each section's items start in the one list the arrow keys move through. */
	const starts = $derived(
		sections.reduce<number[]>((list, section, index) => {
			list.push(index === 0 ? 0 : list[index - 1] + sections[index - 1].items.length);
			return list;
		}, []),
	);
	const itemCount = $derived(sections.reduce((count, section) => count + section.items.length, 0));

	function onKeydown(event: KeyboardEvent) {
		const current = items.indexOf(event.target as HTMLButtonElement);
		const last = itemCount - 1;
		const next = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		}[event.key];

		if (next !== undefined) {
			event.preventDefault();
			items[next]?.focus();
		} else if (event.key === 'Escape') {
			// Foundry opens its main menu on an Escape that reaches the window.
			event.preventDefault();
			event.stopPropagation();
			onclose(true);
		} else if (event.key === 'Tab') {
			onclose(false);
		}
	}

	function onWindowPointerDown(event: PointerEvent) {
		const target = event.target as Node | null;
		if (trigger?.contains(target) || menu?.contains(target)) return;
		onclose(false);
	}

	onMount(() => {
		menu?.scrollIntoView?.({ block: 'nearest' });
		items[0]?.focus({ preventScroll: true });
	});
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div
	bind:this={menu}
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
					bind:this={items[starts[sectionIndex] + index]}
					class="nimble-choice-menu__item"
					type="button"
					role="menuitem"
					tabindex="-1"
					aria-label={item.text}
					data-tooltip={item.text}
					{disabled}
					onclick={() => onchoose(item.id)}
				>
					<span class="nimble-choice-menu__label">{item.label}</span>
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

		&__label {
			flex: 1;
			min-width: 0;
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

<script lang="ts" generics="Item">
	import type { MigrationPickListProps } from './MigrationPickList.types.ts';

	let {
		items,
		selectedIndex,
		label,
		itemKey,
		itemLabel,
		onSelect,
		pick,
	}: MigrationPickListProps<Item> = $props();

	const optionElements: (HTMLElement | null)[] = [];

	/** A listbox: one tab stop, and the arrow keys, Home and End move the pick. */
	function onKeydown(event: KeyboardEvent): void {
		const last = items.length - 1;
		const targets: Record<string, number> = {
			ArrowDown: Math.min(selectedIndex + 1, last),
			ArrowUp: Math.max(selectedIndex - 1, 0),
			Home: 0,
			End: last,
		};
		const target = targets[event.key];
		if (target === undefined) return;
		event.preventDefault();
		onSelect(target);
		optionElements[target]?.focus();
	}
</script>

<div class="nimble-world-migration__picks" role="listbox" aria-label={label}>
	{#each items as item, index (itemKey(item))}
		<div
			bind:this={optionElements[index]}
			class="nimble-world-migration__pick"
			role="option"
			aria-selected={index === selectedIndex}
			aria-label={itemLabel?.(item)}
			tabindex={index === selectedIndex ? 0 : -1}
			onclick={() => onSelect(index)}
			onkeydown={onKeydown}
		>
			{@render pick(item)}
		</div>
	{/each}
</div>

<style lang="scss">
	.nimble-world-migration {
		&__picks {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			gap: 0.125rem;
			min-height: 0;
			padding: 2px;
			margin: -2px;
			overflow-y: auto;
		}

		&__pick {
			flex: none;
		}

		&__pick {
			display: grid;
			grid-template-columns: 1.75rem minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.3rem 0.375rem;
			cursor: pointer;
			border-radius: 4px;

			&:hover {
				background: color-mix(
					in srgb,
					var(--nimble-selected-tag-background-color) 15%,
					transparent
				);
			}

			&[aria-selected='true'] {
				background: var(--nimble-selected-tag-background-color);
				color: var(--nimble-selected-tag-text-color);

				:global(.nimble-world-migration__count),
				:global(.nimble-world-migration__state) {
					color: inherit;
				}
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-focus-border-color);
				outline-offset: 1px;
			}
		}
	}
</style>

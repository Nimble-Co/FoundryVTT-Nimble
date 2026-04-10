<script lang="ts">
	import type { ExpandableDocumentListProps } from '#types/components/ExpandableDocumentList.d.ts';

	import SelectionIndicator from '#view/components/SelectionIndicator.svelte';
	import localize from '#utils/localize.js';
	import { createExpandableDocumentListState } from './ExpandableDocumentList.svelte.ts';

	let {
		items,
		selectedItem = $bindable(),
		selectTooltip,
		deselectTooltip,
		selectAriaLabel,
		deselectAriaLabel,
	}: ExpandableDocumentListProps = $props();

	const state = createExpandableDocumentListState(
		() => items,
		() => selectedItem,
		(item) => {
			selectedItem = item;
		},
	);

	const { handleSelectClick, handleRowClick, handleKeydown } = state;
	const displayedItems = $derived(state.displayedItems);
	const expandedUuids = $derived(state.expandedUuids);
	const expandedDataMap = $derived(state.expandedDataMap);
</script>

<ul class="nimble-document-list">
	{#each displayedItems as item (item.uuid)}
		<li class="u-semantic-only expandable-item">
			<div
				class="expandable-row"
				class:selected={item.uuid === selectedItem?.uuid}
				class:expanded={expandedUuids.has(item.uuid)}
				onclick={() => handleRowClick(item.uuid)}
				role="button"
				tabindex="0"
				onkeydown={(e) => handleKeydown(e, item.uuid)}
			>
				<i class="fa-solid fa-chevron-down expand-arrow"></i>

				<img
					class="expandable-row__img"
					src={item.img || 'icons/svg/item-bag.svg'}
					alt={item.name}
				/>

				<h4 class="expandable-row__name nimble-heading" data-heading-variant="item">
					{item.name}
				</h4>

				<div class="expandable-row__actions">
					<SelectionIndicator
						selected={item.uuid === selectedItem?.uuid}
						onclick={(e) => handleSelectClick(item.uuid, e)}
						tooltip={item.uuid === selectedItem?.uuid ? deselectTooltip : selectTooltip}
						ariaLabel={item.uuid === selectedItem?.uuid
							? deselectAriaLabel(item.name)
							: selectAriaLabel(item.name)}
					/>
				</div>
			</div>

			{#if expandedUuids.has(item.uuid)}
				<div class="accordion-content">
					<div class="description">
						{@html expandedDataMap.get(item.uuid)?.system?.description ||
							localize('NIMBLE.ui.loading')}
					</div>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style lang="scss">
	.expandable-item {
		margin-bottom: 0.5rem;
	}

	.expandable-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 50px;
		padding: 0.5rem;
		position: relative;
		cursor: pointer;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: all 0.3s ease;

		&:hover {
			border-color: var(--nimble-accent-color);
		}

		&.selected {
			border-color: var(--nimble-accent-color);
			background: color-mix(
				in srgb,
				var(--nimble-accent-color) 10%,
				var(--nimble-box-background-color)
			);
		}

		&.expanded {
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;

			.expand-arrow {
				transform: rotate(180deg);
			}
		}

		.expand-arrow {
			font-size: 0.875rem;
			transition: transform 0.3s ease;
			color: var(--nimble-medium-text-color);
		}

		.expandable-row__img {
			width: 36px;
			height: 36px;
			margin: 0;
			padding: 0;
			display: block;
			border-radius: 4px;
		}

		.expandable-row__name {
			flex: 1;
			margin: 0;
			padding: 0;
			line-height: 1;
		}

		.expandable-row__actions {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-left: auto;
		}
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 0.5rem 0.75rem;
		animation: slideDown 0.3s ease;

		.description {
			margin-bottom: 0;
			max-height: 300px;
			overflow-y: auto;
			line-height: 1.5;

			:global(h3) {
				margin-top: 0.25rem;
				margin-bottom: 0.25rem;
				font-size: 0.95rem;
				font-weight: 600;
			}

			:global(p) {
				margin-bottom: 0.25rem;
			}
		}
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
		}
		to {
			opacity: 1;
			max-height: 400px;
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
	}
</style>

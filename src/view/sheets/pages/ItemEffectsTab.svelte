<!--
@component
The Effects tab of an item window: the item's effects in two lists, those given when something
uses them and those always on while the creature has the item, each with what uses it.
-->
<script lang="ts">
	import type { ItemEffectRow, ItemEffectsTabItem } from '#types/components/ItemEffectsTab.d.ts';
	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import { createItemEffectsTabState } from './ItemEffectsTab.svelte.js';

	const WORDS = 'NIMBLE.itemEffectsTab';

	const uid = $props.id();
	const item = getContext<ItemEffectsTabItem>('document');
	const tabState = createItemEffectsTabState(() => item);

	const lists = $derived([
		{ id: 'given', transfer: false, heading: `${WORDS}.given`, rows: tabState.given },
		{ id: 'always-on', transfer: true, heading: `${WORDS}.alwaysOn`, rows: tabState.alwaysOn },
	]);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item nimble-item-effects-tab">
	{#each lists as list (list.id)}
		<section class="nimble-item-effects-tab__list" aria-labelledby={`${uid}-${list.id}`}>
			<header class="nimble-section-header nimble-item-effects-tab__header">
				<h3 class="nimble-heading" data-heading-variant="section" id={`${uid}-${list.id}`}>
					{localize(list.heading)}
				</h3>

				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					aria-describedby={`${uid}-${list.id}`}
					onclick={() => tabState.create(list.transfer)}
				>
					<i class="fa-solid fa-plus" aria-hidden="true"></i>
					{localize(`${WORDS}.newEffect`)}
				</button>
			</header>

			{#if list.rows.length === 0}
				<p class="nimble-item-effects-tab__empty">{localize(`${WORDS}.empty`)}</p>
			{:else}
				<ul class="nimble-item-effects-tab__rows">
					{#each list.rows as row (row.id)}
						{@render effectRow(row)}
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</section>

{#snippet effectRow(row: ItemEffectRow)}
	<li class="nimble-item-effects-tab__row">
		<img class="nimble-item-effects-tab__img" src={row.img} alt="" />

		<div class="nimble-item-effects-tab__text">
			<span class="nimble-item-effects-tab__name">{row.name}</span>

			{#if row.lasts}
				<span class="nimble-item-effects-tab__line">
					<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
					<span>{row.lasts}</span>
				</span>
			{/if}

			<span
				class="nimble-item-effects-tab__line"
				class:nimble-item-effects-tab__line--unused={row.users.length === 0}
			>
				<i class="fa-solid fa-link" aria-hidden="true"></i>
				<span>{row.usedByLine}</span>
			</span>
		</div>

		<div class="nimble-item-effects-tab__actions">
			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize(`${WORDS}.edit`, { name: row.name })}
				data-tooltip={localize(`${WORDS}.edit`, { name: row.name })}
				onclick={() => tabState.edit(row.id)}
			>
				<i class="fa-solid fa-pen" aria-hidden="true"></i>
			</button>

			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize(`${WORDS}.delete`, { name: row.name })}
				data-tooltip={localize(`${WORDS}.delete`, { name: row.name })}
				onclick={() => tabState.remove(row.id)}
			>
				<i class="fa-solid fa-trash" aria-hidden="true"></i>
			</button>
		</div>
	</li>
{/snippet}

<style lang="scss">
	.nimble-item-effects-tab {
		display: flex;
		flex-direction: column;
		gap: 1rem;

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		// The heading takes two lines, or the button goes under it when there is no room.
		&__header {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.375rem 0.5rem;

			.nimble-heading {
				--nimble-heading-line-height: 1.25;

				flex: 1 1 10rem;
				min-width: 0;
				white-space: normal;
				overflow-wrap: break-word;
			}

			.nimble-button {
				flex: 0 0 auto;
				white-space: nowrap;
			}
		}

		&__empty {
			margin: 0;
			padding: 0.5rem 0.375rem;
			color: var(--nimble-ui-ink-muted);
			font-size: var(--nimble-sm-text);
		}

		&__rows {
			display: flex;
			flex-direction: column;
			gap: 0;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			min-height: 44px;
			padding: 0.25rem 0.25rem 0.25rem 0.375rem;
			border-radius: 4px;
			color: var(--nimble-ui-ink);
			transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover,
			&:focus-within {
				background: var(--nimble-ui-hover);
			}
		}

		&__img {
			flex: 0 0 auto;
			width: 2rem;
			height: 2rem;
			border: 0;
			border-radius: 4px;
			background-color: var(--nimble-artwork-backdrop);
			object-fit: cover;
		}

		&__text {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			line-height: 1.2;
			overflow-wrap: anywhere;
		}

		&__line {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
			color: var(--nimble-ui-ink-muted);

			i {
				width: 0.75rem;
				margin-top: 0.125rem;
				text-align: center;
			}

			&--unused {
				font-style: italic;
			}
		}

		&__actions {
			display: flex;
			flex: 0 0 auto;
			align-items: center;
			gap: 0.25rem;
		}
	}
</style>

<script lang="ts">
	import localize from '#utils/localize.js';

	import { effectiveSizes, toggleAllSizes, toggleSize } from './sizeSelection.js';

	interface Props {
		selectedSizes: string[] | undefined;
		onChange: (nextSizes: string[]) => unknown;
	}

	let { selectedSizes, onChange }: Props = $props();

	const sizeCategories: Record<string, string> = CONFIG.NIMBLE.sizeCategories;
	const sizeCategoryDescriptions: Record<string, string> = CONFIG.NIMBLE.sizeCategoryDescriptions;
	const sizeOrder = Object.keys(sizeCategories);

	let expanded = $state(false);
	/** Label of the size a removal bounced back to, shown until the next interaction. */
	let revertedTo = $state('');

	// Legacy ancestries can still store an empty array; those present as the default size.
	let currentSizes = $derived(effectiveSizes(selectedSizes, sizeOrder));
	let allSelected = $derived(sizeOrder.every((size) => currentSizes.includes(size)));

	function sizeLabel(size: string): string {
		return sizeCategories[size] ?? size;
	}

	function handleToggleSize(size: string) {
		const removedTheLastSize = currentSizes.length === 1 && currentSizes.includes(size);
		const nextSizes = toggleSize(currentSizes, size, sizeOrder);

		revertedTo = removedTheLastSize ? sizeLabel(nextSizes[0]) : '';

		onChange(nextSizes);
	}

	function handleToggleAll() {
		revertedTo = '';

		onChange(toggleAllSizes(currentSizes, sizeOrder));
	}

	/** What the GM's selection means for character creation. */
	let summary = $derived.by(() => {
		if (allSelected) {
			return localize('NIMBLE.ancestrySheet.sizeSummaryAll', {
				first: sizeLabel(sizeOrder[0]),
				last: sizeLabel(sizeOrder[sizeOrder.length - 1]),
			});
		}

		if (currentSizes.length === 1) {
			return localize('NIMBLE.ancestrySheet.sizeSummaryFixed', {
				size: sizeLabel(currentSizes[0]),
			});
		}

		const formatter = new Intl.ListFormat(game.i18n?.lang ?? 'en', {
			style: 'long',
			type: 'disjunction',
		});

		return localize('NIMBLE.ancestrySheet.sizeSummaryChoice', {
			sizes: formatter.format(currentSizes.map(sizeLabel)),
		});
	});
</script>

<div
	class="nimble-size-options"
	role="group"
	aria-label={localize('NIMBLE.ancestrySheet.sizeOptions')}
>
	<button
		class="nimble-size-options__trigger"
		class:nimble-size-options__trigger--expanded={expanded}
		type="button"
		aria-expanded={expanded}
		aria-label={expanded
			? localize('NIMBLE.ancestrySheet.sizeOptionsCollapse')
			: localize('NIMBLE.ancestrySheet.sizeOptionsExpand')}
		onclick={() => (expanded = !expanded)}
	>
		<span class="nimble-size-options__trigger-label">
			{allSelected
				? localize('NIMBLE.ancestrySheet.sizeOptionsEdit')
				: localize('NIMBLE.ancestrySheet.sizeOptionsAdd')}
		</span>

		<span class="nimble-size-options__count">
			{localize('NIMBLE.ancestrySheet.sizeOptionsCount', {
				selected: `${currentSizes.length}`,
				total: `${sizeOrder.length}`,
			})}
		</span>

		<i class="fa-solid {expanded ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
	</button>

	{#if expanded}
		<ul class="nimble-size-options__panel">
			<li>
				<button
					class="nimble-size-options__option nimble-size-options__option--all"
					type="button"
					aria-pressed={allSelected}
					onclick={handleToggleAll}
				>
					<span>{localize('NIMBLE.ancestrySheet.sizeOptionsAll')}</span>

					{#if allSelected}
						<i class="fa-solid fa-check" aria-hidden="true"></i>
					{/if}
				</button>
			</li>

			{#each sizeOrder as size (size)}
				{@const selected = currentSizes.includes(size)}

				<li>
					<button
						class="nimble-size-options__option"
						class:nimble-size-options__option--selected={selected}
						type="button"
						aria-pressed={selected}
						onclick={() => handleToggleSize(size)}
					>
						<span>{sizeLabel(size)}</span>

						<span class="nimble-size-options__description">
							{sizeCategoryDescriptions[size] ?? ''}
						</span>

						{#if selected}
							<i class="fa-solid fa-check" aria-hidden="true"></i>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<ul class="nimble-size-options__badges">
		{#if allSelected}
			<li>
				<span class="nimble-size-options__badge nimble-size-options__badge--all">
					{localize('NIMBLE.ancestrySheet.sizeOptionsAll')}

					<button
						class="nimble-size-options__badge-remove"
						type="button"
						aria-label={localize('NIMBLE.ancestrySheet.sizeOptionsRemove', {
							size: localize('NIMBLE.ancestrySheet.sizeOptionsAll'),
						})}
						onclick={handleToggleAll}
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</span>
			</li>
		{:else}
			{#each currentSizes as size (size)}
				<li>
					<span class="nimble-size-options__badge">
						{sizeLabel(size)}

						<button
							class="nimble-size-options__badge-remove"
							type="button"
							aria-label={localize('NIMBLE.ancestrySheet.sizeOptionsRemove', {
								size: sizeLabel(size),
							})}
							onclick={() => handleToggleSize(size)}
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					</span>
				</li>
			{/each}
		{/if}
	</ul>

	{#if revertedTo}
		<p class="nimble-size-options__notice" role="status">
			{localize('NIMBLE.ancestrySheet.sizeOptionsReverted', { size: revertedTo })}
		</p>
	{/if}

	<p class="nimble-size-options__summary">{summary}</p>
</div>

<style lang="scss">
	.nimble-size-options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		&__trigger {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			margin: 0;
			padding: 0.25rem 0.375rem;
			font-family: inherit;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 2px;
			transition: var(--nimble-standard-transition);

			&--expanded {
				border-end-start-radius: 0;
				border-end-end-radius: 0;
			}

			&:active,
			&:focus,
			&:hover {
				border-color: var(--nimble-input-border-color);
				box-shadow: none;
				outline: none;
			}

			&:focus-visible {
				border-color: var(--nimble-accent-color);
			}
		}

		&__trigger-label {
			color: var(--nimble-medium-text-color);
		}

		&__count {
			margin-inline-start: auto;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__panel {
			display: flex;
			flex-direction: column;
			gap: 1px;
			margin: -0.375rem 0 0;
			padding: 0.125rem;
			list-style: none;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 0 0 2px 2px;
		}

		&__option {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			margin: 0;
			padding: 0.25rem 0.375rem;
			font-family: inherit;
			font-size: var(--nimble-sm-text);
			line-height: 1.2;
			text-align: start;
			color: var(--nimble-dark-text-color);
			background: transparent;
			border: 1px solid transparent;
			border-radius: 3px;
			transition: var(--nimble-standard-transition);

			&--all {
				border-block-end: 1px solid var(--nimble-card-border-color);
				border-end-start-radius: 0;
				border-end-end-radius: 0;
			}

			&--selected {
				color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
				background: var(--nimble-selected-tag-background-color);
			}

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&:focus-visible {
				border-color: var(--nimble-accent-color);
			}
		}

		&__description {
			margin-inline-start: auto;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			.nimble-size-options__option--selected & {
				color: inherit;
				opacity: 0.75;
			}
		}

		&__badges {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__badge {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.25rem 0.25rem 0.25rem 0.5rem;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
			background: var(--nimble-selected-tag-background-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 99px;

			&--all {
				color: var(--nimble-dark-text-color);
				background: transparent;
			}
		}

		&__badge-remove {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 0.875rem;
			height: 0.875rem;
			margin: 0;
			padding: 0;
			font-size: var(--nimble-xxs-text);
			color: inherit;
			background: rgba(255, 255, 255, 0.18);
			border: none;
			border-radius: 50%;
			transition: var(--nimble-standard-transition);

			.nimble-size-options__badge--all & {
				background: rgba(0, 0, 0, 0.12);
			}

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				background: rgba(255, 255, 255, 0.32);
			}
		}

		&__notice,
		&__summary {
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
			text-wrap: pretty;
		}

		&__notice {
			color: var(--nimble-dark-text-color);
		}
	}
</style>

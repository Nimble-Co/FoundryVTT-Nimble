<script lang="ts">
	import localize from '#utils/localize.js';
	import { effectiveSizes, toggleAllSizes, toggleSize } from '#utils/sizeSelection.js';

	interface Props {
		selectedSizes: string[] | undefined;
		/** Sizes the published ancestry this was copied from shipped with, if any. */
		publishedSizes?: string[];
		onChange: (nextSizes: string[]) => unknown;
	}

	let { selectedSizes, publishedSizes, onChange }: Props = $props();

	const sizeCategories: Record<string, string> = CONFIG.NIMBLE.sizeCategories;
	const sizeCategoryDescriptions: Record<string, string> = CONFIG.NIMBLE.sizeCategoryDescriptions;
	const sizeOrder = Object.keys(sizeCategories);
	// Two ancestry sheets can be open at once, so the panel needs an id unique to this instance.
	const instanceId = $props.id();
	const panelId = `nimble-size-options-panel-${instanceId}`;

	let expanded = $state(false);
	/** Sizes a removal bounced back to, shown until the next interaction. */
	let restoredSizes = $state<string[]>([]);

	// Imported ancestries can still store an empty array or duplicates; reads normalize both.
	let currentSizes = $derived(effectiveSizes(selectedSizes, sizeOrder));
	let allSelected = $derived(sizeOrder.every((size) => currentSizes.includes(size)));
	// A world copy of a published ancestry reverts to the size it shipped with rather than to the
	// system default, so removing the last size can't quietly turn a Half-Giant Medium.
	let fallbackSizes = $derived(effectiveSizes(publishedSizes, sizeOrder));

	function sizeLabel(size: string): string {
		return sizeCategories[size] ?? size;
	}

	function formatSizes(sizes: string[], type: 'conjunction' | 'disjunction'): string {
		const formatter = new Intl.ListFormat(game.i18n?.lang ?? 'en', { style: 'long', type });

		return formatter.format(sizes.map(sizeLabel));
	}

	/**
	 * Write the new selection, noting any of the removed sizes it handed back — an ancestry needs one
	 * size, so emptying the selection restores instead of clearing, and that has to be explained.
	 */
	function applyChange(nextSizes: string[], removedSizes: string[]) {
		restoredSizes = removedSizes.filter((size) => nextSizes.includes(size));

		onChange(nextSizes);
	}

	function handleToggleSize(size: string) {
		const removedSizes = currentSizes.includes(size) ? [size] : [];

		applyChange(toggleSize(currentSizes, size, sizeOrder, fallbackSizes), removedSizes);
	}

	function handleToggleAll() {
		const removedSizes = allSelected ? currentSizes : [];

		applyChange(toggleAllSizes(currentSizes, sizeOrder, fallbackSizes), removedSizes);
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

		return localize('NIMBLE.ancestrySheet.sizeSummaryChoice', {
			sizes: formatSizes(currentSizes, 'disjunction'),
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
		aria-controls={panelId}
		onclick={() => (expanded = !expanded)}
	>
		<span class="nimble-size-options__trigger-label">
			{currentSizes.length > 1
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

	<!-- Always rendered so the trigger's `aria-controls` has something to point at; `hidden` keeps a
	collapsed panel out of both the layout and the accessibility tree. -->
	<ul class="nimble-size-options__panel" id={panelId} hidden={!expanded}>
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

	{#if restoredSizes.length}
		<p class="nimble-size-options__notice" role="status">
			{localize('NIMBLE.ancestrySheet.sizeOptionsRestored', {
				sizes: formatSizes(restoredSizes, 'conjunction'),
			})}
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

			// The class sets `display`, so it would otherwise win against the UA rule for `hidden`.
			&[hidden] {
				display: none;
			}
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
			// Tinted from the badge's own text color, so the light badge and the dark one both get a
			// legible chip without either hardcoding a color.
			background: color-mix(in srgb, currentColor 18%, transparent);
			border: none;
			border-radius: 50%;
			transition: var(--nimble-standard-transition);

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				background: color-mix(in srgb, currentColor 32%, transparent);
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

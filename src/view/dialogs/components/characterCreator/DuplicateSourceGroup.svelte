<script lang="ts">
	import type { DuplicateSourceGroupProps } from '#types/components/DuplicateSourceGroup.d.ts';

	import { createDuplicateSourceGroupState } from './DuplicateSourceGroup.svelte.ts';
	import SourceTag from '#view/components/SourceTag.svelte';
	import localize from '#utils/localize.js';

	let { groupName, group, selectedFeatures, onSetSelection }: DuplicateSourceGroupProps = $props();

	const groupState = createDuplicateSourceGroupState(() => ({ group, selectedFeatures }));

	// The synthetic key carries a uuid, so strip anything that can't sit in an id attribute.
	const headingId = $derived(`duplicate-${groupName.replace(/[^a-zA-Z0-9]+/g, '-')}`);

	let expanded = $state<Set<string>>(new Set());

	const allExpanded = $derived(
		groupState.candidates.length > 0 && expanded.size === groupState.candidates.length,
	);

	function toggleExpanded(uuid: string) {
		const next = new Set(expanded);
		if (!next.delete(uuid)) next.add(uuid);
		expanded = next;
	}

	function toggleAllExpanded() {
		expanded = allExpanded ? new Set() : new Set(groupState.candidates.map((c) => c.feature.uuid));
	}
</script>

<div class="duplicate-group">
	<header class="duplicate-group__header">
		<h4 class="nimble-heading" data-heading-variant="section" id={headingId}>
			{localize('NIMBLE.classFeatureSelection.duplicateHeading')}
		</h4>
		<span class="duplicate-group__hint">
			{localize('NIMBLE.classFeatureSelection.duplicateFoundIn', {
				name: groupState.heading,
				count: String(groupState.candidates.length),
			})}
		</span>
	</header>

	<div class="duplicate-group__compare">
		<span class="duplicate-group__rule"></span>
		<button
			type="button"
			class="nimble-button"
			data-button-variant="basic"
			aria-pressed={allExpanded}
			onclick={toggleAllExpanded}
		>
			{allExpanded
				? localize('NIMBLE.classFeatureSelection.duplicateCollapseAll')
				: localize('NIMBLE.classFeatureSelection.duplicateCompareAll')}
		</button>
	</div>

	<ul class="duplicate-group__list" role="radiogroup" aria-labelledby={headingId}>
		{#each groupState.candidates as candidate (candidate.feature.uuid)}
			{@const isOpen = expanded.has(candidate.feature.uuid)}
			{@const selected = groupState.isSelected(candidate.feature)}
			<li class="duplicate-row" class:expanded={isOpen}>
				<!-- The row is an expander; selecting is the radio's job alone. -->
				<div
					class="duplicate-row__main"
					class:selected
					class:owned={candidate.isOwned}
					role="button"
					tabindex="0"
					aria-expanded={isOpen}
					onclick={() => toggleExpanded(candidate.feature.uuid)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							toggleExpanded(candidate.feature.uuid);
						}
					}}
				>
					<i class="fa-solid fa-chevron-down duplicate-row__chevron"></i>

					<img
						class="duplicate-row__img"
						src={candidate.feature.img || 'icons/svg/item-bag.svg'}
						alt=""
					/>

					<div class="duplicate-row__identity">
						<span class="duplicate-row__origin">{candidate.origin}</span>
						<span class="duplicate-row__meta">
							{candidate.lineage}
							{#if candidate.note}
								<span class="duplicate-row__sep">·</span>
								<span class="duplicate-row__note" class:same={candidate.isIdentical}>
									{candidate.note}
								</span>
							{/if}
						</span>
					</div>

					{#if candidate.isOwned}
						<span class="duplicate-row__owned">
							{localize('NIMBLE.classFeatureSelection.duplicateAlreadyOwned')}
						</span>
					{:else if candidate.isRecommended}
						<span class="duplicate-row__recommended">
							{localize('NIMBLE.classFeatureSelection.duplicateRecommended')}
						</span>
					{/if}

					<SourceTag source={candidate.source} />

					{#if !candidate.isOwned}
						<button
							type="button"
							class="duplicate-row__pick"
							class:selected
							role="radio"
							aria-checked={selected}
							aria-label={localize('NIMBLE.classFeatureSelection.duplicateUseCopy', {
								name: candidate.origin,
							})}
							onclick={(e) => {
								e.stopPropagation();
								onSetSelection([candidate.feature]);
							}}
						>
							{#if selected}<i class="fa-solid fa-check"></i>{/if}
						</button>
					{/if}
				</div>

				<div class="duplicate-row__body">
					<p class="duplicate-row__description">
						{#each candidate.segments as segment}
							{#if segment.changed}
								<mark class="duplicate-row__delta">{segment.text}</mark>
							{:else}{segment.text}{/if}
						{/each}
					</p>
				</div>
			</li>
		{/each}
	</ul>

	{#if groupState.offerable.length > 1}
		<div class="duplicate-group__keep-all">
			<span class="duplicate-group__rule"></span>
			<button
				type="button"
				class="nimble-button"
				data-button-variant="basic"
				aria-pressed={groupState.allSelected}
				onclick={() => onSetSelection(groupState.offerable)}
			>
				{localize('NIMBLE.classFeatureSelection.duplicateKeepAll', {
					count: String(groupState.offerable.length),
				})}
			</button>
		</div>
	{/if}

	<p class="duplicate-group__outcome">{groupState.outcomeText}</p>
</div>

<style lang="scss">
	.duplicate-group {
		margin-top: 1rem;

		&__header {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
			flex-wrap: wrap;
		}

		&__hint {
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
		}

		&__compare,
		&__keep-all {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}

		&__keep-all {
			margin-top: 0.5rem;
			margin-bottom: 0;
		}

		&__rule {
			flex: 1;
			height: 1px;
			background: var(--nimble-card-border-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__outcome {
			margin: 0.6rem 0 0;
			font-size: 0.75rem;
			color: var(--nimble-medium-text-color);
		}
	}

	.duplicate-row {
		display: grid;
		grid-template-rows: auto 0fr;
		transition: grid-template-rows 0.3s ease;
		overflow: hidden;

		&.expanded {
			grid-template-rows: auto 1fr;

			.duplicate-row__main {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}

			.duplicate-row__chevron {
				transform: rotate(180deg);
				color: var(--nimble-dark-text-color);
			}

			.duplicate-row__body {
				opacity: 1;
			}
		}

		&__main {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			min-height: 54px;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition:
				border-color 0.2s ease,
				background 0.2s ease;

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-accent-color);
				outline-offset: 2px;
			}

			&.selected {
				border-color: var(--nimble-accent-color);
				background: color-mix(
					in srgb,
					var(--nimble-accent-color) 10%,
					var(--nimble-box-background-color)
				);
			}

			// An owned copy is context, not a choice — keep it present but visually quieter.
			&.owned {
				background: transparent;
				border-style: dashed;
			}
		}

		&__chevron {
			width: 1rem;
			flex-shrink: 0;
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
			transition:
				transform 0.3s ease,
				color 0.15s ease;
		}

		&__img {
			width: 36px;
			height: 36px;
			flex-shrink: 0;
			margin: 0;
			padding: 0;
			border-radius: 4px;
			object-fit: cover;
		}

		&__identity {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 0.15rem;
		}

		&__origin {
			font-size: 0.833rem;
			font-weight: 600;
			line-height: 1.1;
			color: var(--nimble-dark-text-color);
		}

		&__meta {
			font-size: 0.694rem;
			line-height: 1.25;
			color: var(--nimble-medium-text-color);
		}

		&__sep {
			opacity: 0.5;
			margin: 0 0.25rem;
		}

		&__note {
			font-weight: 700;
			color: var(--nimble-action-info-text-color);

			&.same {
				font-weight: 400;
				opacity: 0.8;
				color: var(--nimble-medium-text-color);
			}
		}

		&__owned,
		&__recommended {
			flex-shrink: 0;
			padding: 0.05rem 0.3rem;
			border: 1px solid currentcolor;
			border-radius: 3px;
			font-size: var(--nimble-xxs-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			white-space: nowrap;
		}

		&__recommended {
			color: var(--nimble-accent-color);
		}

		&__owned {
			color: var(--nimble-medium-text-color);
		}

		&__pick {
			width: 1.25rem;
			min-width: 1.25rem;
			height: 1.25rem;
			padding: 0;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: color-mix(in srgb, var(--nimble-medium-text-color) 15%, transparent);
			border: 2px solid color-mix(in srgb, var(--nimble-medium-text-color) 60%, transparent);
			border-radius: 50%;
			box-sizing: border-box;
			color: transparent;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover {
				border-color: color-mix(in srgb, var(--nimble-medium-text-color) 80%, transparent);
			}

			&.selected {
				background: var(--nimble-accent-color);
				border-color: var(--nimble-accent-color);
				color: #fff;
			}

			i {
				font-size: 0.625rem;
			}
		}

		&__body {
			overflow: hidden;
			opacity: 0;
			padding: 0 0.75rem;
			border: 1px solid var(--nimble-card-border-color);
			border-top: none;
			border-radius: 0 0 4px 4px;
			transition: opacity 0.3s ease;
		}

		&__description {
			margin: 0.5rem 0;
			font-size: 0.78rem;
			line-height: 1.5;
			color: var(--nimble-dark-text-color);
		}

		&__delta {
			padding: 0 0.15rem;
			border-radius: 2px;
			font-weight: 700;
			color: inherit;
			background: color-mix(in srgb, var(--nimble-badge-world-bg) 28%, transparent);
		}
	}
</style>

<script lang="ts">
	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type { DuplicateSourceGroupProps } from '#types/components/DuplicateSourceGroup.d.ts';

	import {
		createDuplicateSourceGroupState,
		tooltipWhenClipped,
	} from './DuplicateSourceGroup.svelte.ts';
	import SelectionIndicator from '#view/components/SelectionIndicator.svelte';
	import SourceTag from '#view/components/SourceTag.svelte';
	import localize from '#utils/localize.js';

	let { groupName, group, selectedFeatures, onSetSelection }: DuplicateSourceGroupProps = $props();

	const groupState = createDuplicateSourceGroupState(
		() => group,
		() => selectedFeatures,
	);

	// The synthetic key carries a uuid, so strip anything that can't sit in an id attribute.
	const headingId = $derived(`duplicate-${groupName.replace(/[^a-zA-Z0-9]+/g, '-')}`);

	let expanded = $state<Set<string>>(new Set());
	let list = $state<HTMLElement | null>(null);

	const allExpanded = $derived(
		groupState.candidates.length > 0 && expanded.size === groupState.candidates.length,
	);

	/**
	 * The radio that holds the group's single tab stop. A radiogroup is one stop in the tab order,
	 * so focus lands on the chosen copy — or on the first choosable one when nothing is chosen yet.
	 */
	const focusedUuid = $derived(
		(
			groupState.offerable.find((feature) => groupState.isSelected(feature)) ??
			groupState.offerable[0]
		)?.uuid,
	);

	function toggleExpanded(uuid: string) {
		const next = new Set(expanded);
		if (!next.delete(uuid)) next.add(uuid);
		expanded = next;
	}

	function toggleAllExpanded() {
		expanded = allExpanded ? new Set() : new Set(groupState.candidates.map((c) => c.feature.uuid));
	}

	/**
	 * Choosing a copy replaces the selection. When the group allows keeping nothing, clicking the
	 * chosen copy again gives the selection back — otherwise there is no route to that outcome,
	 * since "Keep all" is hidden whenever only one copy is on offer.
	 */
	function chooseCopy(feature: NimbleFeatureItem) {
		if (groupState.canKeepNone && groupState.isSelected(feature)) {
			onSetSelection([]);
			return;
		}

		onSetSelection([feature]);
	}

	const ARROW_STEPS: Record<string, number> = {
		ArrowDown: 1,
		ArrowRight: 1,
		ArrowUp: -1,
		ArrowLeft: -1,
	};

	/** Arrow keys move the choice between the radios of a radiogroup, wrapping at both ends. */
	function handleRadioKeydown(event: KeyboardEvent, index: number) {
		const step = ARROW_STEPS[event.key];
		if (step === undefined) return;

		const offerable = groupState.offerable;
		if (offerable.length < 2) return;

		event.preventDefault();
		const next = (index + step + offerable.length) % offerable.length;
		// In a radiogroup the arrows carry the selection with them, not just the focus.
		onSetSelection([offerable[next]]);
		list?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
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

	<!-- A radiogroup takes the radios as its own children, so the rows cannot be list items. -->
	<div class="duplicate-group__list" role="radiogroup" aria-labelledby={headingId} bind:this={list}>
		{#each groupState.candidates as candidate (candidate.feature.uuid)}
			{@const isOpen = expanded.has(candidate.feature.uuid)}
			{@const selected = groupState.isSelected(candidate.feature)}
			{@const bodyId = `${headingId}-body-${candidate.feature.uuid.replace(/[^a-zA-Z0-9]+/g, '-')}`}
			<div class="duplicate-row" class:expanded={isOpen}>
				<div class="duplicate-row__main" class:selected class:owned={candidate.isOwned}>
					<!--
						The expander and the radio are siblings, not nested: a control inside another
						control is unreachable for assistive technology, and the row's only job is to
						open the comparison.
					-->
					<button
						type="button"
						class="duplicate-row__expander"
						aria-expanded={isOpen}
						aria-controls={bodyId}
						onclick={() => toggleExpanded(candidate.feature.uuid)}
					>
						<i class="fa-solid fa-chevron-down duplicate-row__chevron"></i>

						<img
							class="duplicate-row__img"
							src={candidate.feature.img || 'icons/svg/item-bag.svg'}
							alt=""
						/>

						<span class="duplicate-row__identity">
							<span class="duplicate-row__origin" use:tooltipWhenClipped>{candidate.origin}</span>
							<span class="duplicate-row__meta" use:tooltipWhenClipped>
								{candidate.lineage}
								{#if candidate.note}
									<span class="duplicate-row__sep">·</span>
									<span class="duplicate-row__note" class:same={candidate.isIdentical}>
										{candidate.note}
									</span>
								{/if}
							</span>
						</span>

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
					</button>

					{#if !candidate.isOwned}
						{@const useLabel = localize('NIMBLE.classFeatureSelection.duplicateUseCopy', {
							name: candidate.origin,
						})}
						{@const radioIndex = groupState.offerable.findIndex(
							(feature) => feature.uuid === candidate.feature.uuid,
						)}
						<SelectionIndicator
							{selected}
							role="radio"
							ariaChecked={selected}
							tabIndex={candidate.feature.uuid === focusedUuid ? 0 : -1}
							tooltip={useLabel}
							ariaLabel={useLabel}
							onclick={() => chooseCopy(candidate.feature)}
							onkeydown={(event) => handleRadioKeydown(event, radioIndex)}
						/>
					{/if}
				</div>

				<!-- A collapsed row is laid out at zero height but still rendered, so it has to be
				made inert as well, or `aria-expanded="false"` would lie about what is reachable. -->
				<div class="duplicate-row__body" id={bodyId} inert={!isOpen} aria-hidden={!isOpen}>
					<p class="duplicate-row__description">
						{#each candidate.segments as segment}
							{#if segment.changed}
								<mark class="duplicate-row__delta">{segment.text}</mark>
							{:else}{segment.text}{/if}
						{/each}
					</p>
				</div>
			</div>
		{/each}
	</div>

	{#if groupState.offerable.length > 1}
		<div class="duplicate-group__keep-all">
			<span class="duplicate-group__rule"></span>
			<!-- One button, two states: take every copy, then step back to just the recommended one. -->
			<button
				type="button"
				class="nimble-button"
				data-button-variant="basic"
				aria-pressed={groupState.allSelected}
				onclick={() =>
					onSetSelection(groupState.allSelected ? [groupState.recommended] : groupState.offerable)}
			>
				{groupState.allSelected
					? localize('NIMBLE.classFeatureSelection.duplicateKeepRecommended')
					: localize('NIMBLE.classFeatureSelection.duplicateKeepAll', {
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
			gap: 0.5rem;
			min-height: 54px;
			padding-right: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			transition:
				border-color 0.2s ease,
				background 0.2s ease;

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

			// An owned copy is context, not a choice — keep it present but visually quieter.
			&.owned {
				background: transparent;
				border-style: dashed;
			}
		}

		// The expander fills the row so clicking anywhere but the radio opens the comparison. It is
		// stripped back to nothing visually: Foundry's core button styles would otherwise give the
		// row a second border and background of its own.
		&__expander {
			display: flex;
			flex: 1;
			align-items: center;
			gap: 0.75rem;
			min-width: 0;
			min-height: unset;
			margin: 0;
			padding: 0.5rem;
			appearance: none;
			background: none;
			border: none;
			border-radius: 4px 0 0 4px;
			box-shadow: none;
			color: inherit;
			font: inherit;
			line-height: inherit;
			text-align: left;
			cursor: pointer;

			&:hover {
				background: none;
				box-shadow: none;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-accent-color);
				outline-offset: -2px;
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

		// Both identity lines clip rather than wrap: a duplicate row must stay one row tall so
		// the copies line up for comparison. `tooltipWhenClipped` restores the full text on
		// hover, but only for the lines that actually lost something.
		&__origin,
		&__meta {
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
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

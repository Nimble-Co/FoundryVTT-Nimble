<script lang="ts">
	import { tick } from 'svelte';

	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type { OptionSwapSectionProps } from '#types/components/OptionSwapSection.d.ts';

	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import Hint from '#view/components/Hint.svelte';
	import localize from '#utils/localize.js';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';
	import {
		createOptionSwapSectionState,
		type OptionSwapPoolView,
		type OptionSwapSelectedEntry,
	} from './OptionSwapSection.state.svelte.ts';

	let { document: actor, offer, onChange, onToggle }: OptionSwapSectionProps = $props();

	const poolElements: Record<string, HTMLElement | undefined> = {};

	function toggle() {
		state.toggleExpanded();
		onToggle?.(state.isExpanded);
	}

	const state = createOptionSwapSectionState(() => ({
		offer,
		skills: actor.reactive.system.skills,
		onChange,
	}));

	/** A control the player just used may leave the row, so focus is moved to a named one. */
	async function focusControl(poolKey: string, ariaLabel: string) {
		await tick();
		const controls = poolElements[poolKey]?.querySelectorAll<HTMLElement>('[aria-label]') ?? [];
		[...controls].find((control) => control.getAttribute('aria-label') === ariaLabel)?.focus();
	}

	function release(view: OptionSwapPoolView, feature: NimbleFeatureItem) {
		void focusControl(view.pool.poolKey, state.releaseLastPick(view.pool.poolKey, feature));
	}

	function takeAnother(
		event: MouseEvent,
		view: OptionSwapPoolView,
		entry: OptionSwapSelectedEntry,
	) {
		event.stopPropagation();
		state.takeAnother(view.pool.poolKey, entry.feature);
	}

	function giveUpOne(event: MouseEvent, view: OptionSwapPoolView, entry: OptionSwapSelectedEntry) {
		event.stopPropagation();
		const target = state.giveUpOne(view.pool.poolKey, entry.feature);
		if (target) void focusControl(view.pool.poolKey, target);
	}
</script>

{#if state.hasOffer}
	<section class="nimble-option-swap">
		<button
			class="nimble-option-swap__toggle"
			type="button"
			aria-expanded={state.isExpanded}
			onclick={toggle}
		>
			<span class="nimble-option-swap__icon">
				<i class="fa-solid fa-arrow-right-arrow-left"></i>
			</span>
			<span class="nimble-option-swap__toggle-text">
				<span class="nimble-option-swap__toggle-label">
					{localize('NIMBLE.optionSwap.toggleLabel')}
				</span>
				<span class="nimble-option-swap__toggle-hint">
					{localize('NIMBLE.optionSwap.toggleHint')}
				</span>
			</span>
			<i
				class="nimble-option-swap__chevron fa-solid fa-chevron-down"
				class:nimble-option-swap__chevron--expanded={state.isExpanded}
			></i>
		</button>

		{#if state.isExpanded}
			<div class="nimble-option-swap__body">
				{#if state.poolViews.length > 0 || state.hasNoPicks}
					<h4 class="nimble-heading" data-heading-variant="section">
						{localize('NIMBLE.optionSwap.swapHeading')}
					</h4>
				{/if}

				{#each state.sources as source, index (index)}
					<Hint hintText={source} hintIcon="fa-solid fa-book-open" hintType="flavor" />
				{/each}

				{#if state.hasNoPicks}
					<Hint hintText={localize('NIMBLE.optionSwap.noPicksRecorded')} />
				{/if}

				{#each state.poolViews as view (view.pool.poolKey)}
					<section class="nimble-option-swap__pool" bind:this={poolElements[view.pool.poolKey]}>
						<header class="nimble-option-swap__pool-header">
							<h4 class="nimble-heading" data-heading-variant="section">{view.heading}</h4>
							<span class="nimble-option-swap__pool-hint">{view.pickHint}</span>
							<span
								class="nimble-option-swap__pool-progress"
								class:nimble-option-swap__pool-progress--complete={view.isFull}
							>
								{view.progressText}
							</span>
						</header>

						<span class="nimble-option-swap__list-label">
							{localize('NIMBLE.optionSwap.currentPicks')}
						</span>
						<ul class="nimble-option-swap__cards">
							{#each view.selected as entry (entry.feature.uuid)}
								{#snippet countControls()}
									<span class="nimble-option-swap__count-controls">
										{#if entry.canGiveUpOne}
											<button
												class="nimble-button"
												type="button"
												data-button-variant="basic"
												aria-label={localize('NIMBLE.optionSwap.giveUpOne', {
													featureName: entry.feature.name ?? '',
												})}
												onclick={(event) => giveUpOne(event, view, entry)}
											>
												−
											</button>
										{/if}

										{#if entry.count > 1}
											<span class="nimble-option-swap__count">
												{localize('NIMBLE.optionSwap.pickCount', { count: String(entry.count) })}
											</span>
										{/if}

										{#if entry.offersAnother}
											<!-- aria-disabled rather than disabled, so the tooltip explaining why
											     still reaches the player: a disabled button gets no pointer events. -->
											<button
												class="nimble-button"
												type="button"
												data-button-variant="basic"
												aria-disabled={!entry.canTakeAnother}
												aria-label={localize('NIMBLE.optionSwap.takeAnother', {
													featureName: entry.feature.name ?? '',
												})}
												data-tooltip={entry.takeAnotherTooltip || undefined}
												onclick={(event) => takeAnother(event, view, entry)}
											>
												+
											</button>
										{/if}
									</span>
								{/snippet}

								<!-- Above one pick the card carries the count controls and no deselect: a
								     deselect there would drop every copy at once. -->
								<FeatureCard
									feature={entry.feature}
									isSelected
									onSelect={entry.count > 1 ? undefined : () => release(view, entry.feature)}
									trailing={entry.count > 1 || entry.offersAnother ? countControls : undefined}
								/>
							{/each}
						</ul>

						{#if view.available.length > 0}
							<button
								class="nimble-option-swap__unfold"
								type="button"
								aria-expanded={view.showsAvailable}
								onclick={() => state.toggleAvailable(view.pool.poolKey)}
							>
								<i
									class="nimble-option-swap__chevron fa-solid fa-chevron-down"
									class:nimble-option-swap__chevron--expanded={view.showsAvailable}
								></i>
								{view.availableToggleLabel}
							</button>

							{#if view.showsAvailable}
								<ul
									class="nimble-option-swap__cards"
									data-tooltip={view.isFull && view.pool.pickCount > 1 ? view.fullHint : undefined}
								>
									{#each view.available as feature (feature.uuid)}
										<FeatureCard
											{feature}
											isDisabled={view.isFull && view.pool.pickCount > 1}
											onSelect={() => state.toggleFeature(view.pool.poolKey, feature)}
										/>
									{/each}
								</ul>
							{/if}
						{/if}
					</section>
				{/each}

				{#if state.skillBudget > 0}
					<section class="nimble-option-swap__skills">
						<header class="nimble-option-swap__skills-header">
							<h4 class="nimble-heading" data-heading-variant="section">
								{localize('NIMBLE.optionSwap.skillsHeading')}
							</h4>
							<span class="nimble-option-swap__skills-budget">
								{localize('NIMBLE.optionSwap.skillPointsMoved', {
									moved: String(state.pointsPlaced),
									total: String(state.skillBudget),
								})}
							</span>
						</header>

						<Hint hintText={localize('NIMBLE.optionSwap.skillsHint')} />

						{#if state.hasUnplacedPoint}
							<Hint
								hintText={localize('NIMBLE.optionSwap.unplacedPointWarning')}
								hintIcon="fa-solid fa-triangle-exclamation"
								hintType="warning"
							/>
						{/if}

						<table class="nimble-skill-config-table nimble-option-swap__skills-table">
							<thead>
								<tr>
									<th>{localize('NIMBLE.optionSwap.skill')}</th>
									<th>{localize('NIMBLE.optionSwap.skillPoints')}</th>
									<th>{localize('NIMBLE.optionSwap.skillTotal')}</th>
								</tr>
							</thead>

							<tbody>
								{#each state.skillRows as row (row.key)}
									<tr>
										<th class="nimble-skill-config-table__skill-name">{row.name}</th>

										<td class="nimble-skill-config-table__skill-points">
											<button
												class="nimble-button"
												type="button"
												data-button-variant="basic"
												disabled={!row.canSubtract}
												aria-label={localize('NIMBLE.optionSwap.takePointFrom', {
													skill: row.name,
												})}
												data-tooltip={row.subtractTooltip}
												onclick={() => state.adjustSkill(row.key, -1)}
											>
												−
											</button>

											<span class="nimble-skill-config__value">
												{replaceHyphenWithMinusSign(row.points)}
											</span>

											<button
												class="nimble-button"
												type="button"
												data-button-variant="basic"
												disabled={!row.canAdd}
												aria-label={localize('NIMBLE.optionSwap.givePointTo', {
													skill: row.name,
												})}
												data-tooltip={row.addTooltip}
												onclick={() => state.adjustSkill(row.key, 1)}
											>
												+
											</button>
										</td>

										<td>
											{replaceHyphenWithMinusSign(row.mod)}

											{#if row.change !== 0}
												<span class="nimble-option-swap__delta">
													({replaceHyphenWithMinusSign(
														new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
															row.change,
														),
													)})
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</section>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	.nimble-option-swap {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		// Matches the recovery cards above it. Foundry's button reset is undone here: its fixed
		// height would clip the two lines of text and its hover colours would not fit the cards.
		&__toggle {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
			height: auto;
			min-height: 0;
			padding: 0.625rem 0.875rem;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			text-align: left;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
			box-shadow: none;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover,
			&:focus-visible {
				color: var(--nimble-dark-text-color);
				background: var(--nimble-box-background-color);
				border-color: var(--nimble-accent-color);
				box-shadow: none;
			}
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			width: 2rem;
			height: 2rem;
			border-radius: 6px;
			font-size: 0.875rem;
			background: hsla(200, 60%, 50%, 0.15);
			color: hsl(200, 60%, 40%);
		}

		&__toggle-text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__toggle-label {
			font-weight: 600;
		}

		&__toggle-hint {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__chevron {
			flex-shrink: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			transition: transform 0.2s ease;

			&--expanded {
				transform: rotate(180deg);
			}
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0.25rem 0 0;
		}

		&__unfold {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 0.5rem;
			width: 100%;
			height: auto;
			min-height: 0;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 4px;
			box-shadow: none;
			cursor: pointer;

			&:hover,
			&:focus-visible {
				color: var(--nimble-dark-text-color);
				background: transparent;
				border-color: var(--nimble-accent-color);
				box-shadow: none;
			}
		}

		&__pool {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__pool-header {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		&__pool-hint,
		&__pool-progress {
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
		}

		&__pool-progress {
			margin-left: auto;

			&--complete {
				font-weight: 600;
				color: var(--nimble-accent-color);
			}
		}

		&__list-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
		}

		&__cards {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__count-controls {
			--nimble-button-min-width: 3ch;

			display: flex;
			align-items: center;
			gap: 0.375rem;

			.nimble-button[aria-disabled='true'] {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}

		&__count {
			min-width: 2.5ch;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}

		&__skills-header {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		&__skills-budget {
			margin-left: auto;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		// Nested rather than written flat so the table's own class carries the specificity: the
		// vendor rule `.system-nimble .nimble-sheet table th` sets `font-weight: inherit`, which
		// a one-class scoped selector loses to.
		&__skills-table {
			--nimble-button-min-width: 4ch;

			text-align: center;
			vertical-align: middle;

			.nimble-button[disabled] {
				opacity: 0.5;
				cursor: not-allowed;
			}

			th {
				padding-inline: 0;
			}

			.nimble-skill-config-table__skill-name {
				font-weight: 900;
				text-transform: uppercase;
			}

			.nimble-skill-config-table__skill-points {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
			}

			.nimble-skill-config__value {
				width: 3ch;
			}
		}

		&__delta {
			color: var(--nimble-medium-text-color);
		}
	}

	// The recovery cards above hard-code these dark colours, and the row is one of them.
	:global(.theme-dark) {
		.nimble-option-swap__toggle {
			background: hsl(220, 15%, 18%);
			border-color: hsl(220, 10%, 30%);
		}

		.nimble-option-swap__toggle:hover,
		.nimble-option-swap__toggle:focus-visible {
			background: hsl(220, 15%, 18%);
			border-color: var(--nimble-accent-color);
		}

		.nimble-option-swap__icon {
			background: hsla(200, 60%, 50%, 0.2);
			color: hsl(200, 60%, 60%);
		}
	}
</style>

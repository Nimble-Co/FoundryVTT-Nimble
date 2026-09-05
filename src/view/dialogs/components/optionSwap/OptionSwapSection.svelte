<script lang="ts">
	import type { OptionSwapSectionProps } from '#types/components/OptionSwapSection.d.ts';

	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import Hint from '#view/components/Hint.svelte';
	import localize from '#utils/localize.js';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';
	import { createOptionSwapSectionState } from './OptionSwapSection.state.svelte.ts';

	let {
		document: actor,
		offer,
		selections = $bindable(new Map()),
		skillPoints = $bindable(new Map()),
		onToggle,
	}: OptionSwapSectionProps = $props();

	function toggle() {
		state.toggleExpanded();
		onToggle?.(state.isExpanded);
	}

	const state = createOptionSwapSectionState(() => ({
		offer,
		skills: actor.reactive.system.skills,
	}));

	$effect(() => {
		selections = state.selectionUuids;
	});

	$effect(() => {
		skillPoints = state.skillTotals;
	});
</script>

{#if state.hasOffer}
	<section class="nimble-option-swap">
		<button
			class="nimble-option-swap__toggle"
			class:nimble-option-swap__toggle--expanded={state.isExpanded}
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
				{#if state.requiredActs.length > 0}
					<div class="nimble-option-swap__acts">
						<h4 class="nimble-heading" data-heading-variant="section">
							{localize('NIMBLE.optionSwap.requiredActsHeading')}
						</h4>

						<ul class="nimble-option-swap__acts-list">
							{#each state.requiredActs as act, index (index)}
								<li class="nimble-option-swap__act">{act}</li>
							{/each}
						</ul>

						<Hint
							hintText={localize('NIMBLE.optionSwap.requiredActsNote')}
							hintIcon="fa-solid fa-comments"
							hintType="reminder"
						/>
					</div>
				{/if}

				{#each state.groups as { pool, group } (pool.poolKey)}
					<section class="nimble-option-swap__pool">
						<FeatureGroupSelection
							groupName={pool.poolKey}
							{group}
							selectedFeatures={state.getSelectedFeatures(pool.poolKey)}
							onSelect={(feature) => state.toggleFeature(pool.poolKey, feature)}
						/>
					</section>
				{/each}

				{#if state.groups.length > 0}
					<Hint hintText={localize('NIMBLE.optionSwap.deselectToBrowseHint')} />
				{/if}

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

			&--expanded {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
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
			margin-top: -0.5rem;
			padding: 0.75rem 0.875rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-top: 0;
			border-radius: 0 0 6px 6px;
		}

		&__acts-list {
			margin: 0.25rem 0;
			padding-left: 1.25rem;
		}

		&__act {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
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
		}

		&__delta {
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-skill-config-table__skill-name {
		font-weight: 900 !important;
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

	:global(.theme-dark) {
		.nimble-option-swap__toggle,
		.nimble-option-swap__body {
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

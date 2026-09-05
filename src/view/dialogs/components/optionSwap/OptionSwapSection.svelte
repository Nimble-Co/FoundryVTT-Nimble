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
	}: OptionSwapSectionProps = $props();

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
			type="button"
			aria-expanded={state.isExpanded}
			onclick={state.toggleExpanded}
		>
			<i
				class="nimble-option-swap__chevron fa-solid fa-chevron-right"
				class:nimble-option-swap__chevron--expanded={state.isExpanded}
			></i>
			<span class="nimble-option-swap__toggle-label">
				{localize('NIMBLE.optionSwap.toggleLabel')}
			</span>
			<span class="nimble-option-swap__toggle-hint">
				{localize('NIMBLE.optionSwap.toggleHint')}
			</span>
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
						{#if pool.optionLabel}
							<span class="nimble-option-swap__pool-label">{pool.optionLabel}</span>
						{/if}

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

		&__toggle {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
			width: 100%;
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			text-align: left;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				border-color: var(--nimble-accent-color);
			}
		}

		&__chevron {
			flex-shrink: 0;
			font-size: var(--nimble-xs-text);
			transition: transform 0.2s ease;

			&--expanded {
				transform: rotate(90deg);
			}
		}

		&__toggle-label {
			font-weight: 600;
		}

		&__toggle-hint {
			margin-left: auto;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0 0.75rem 0.75rem;
		}

		&__acts-list {
			margin: 0.25rem 0;
			padding-left: 1.25rem;
		}

		&__act {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__pool-label {
			font-size: 0.875rem;
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
</style>

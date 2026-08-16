<script lang="ts">
	import type { SpellScrollCandidateRowProps } from '#types/components/SpellScrollDialog.d.ts';

	import localize from '#utils/localize.js';
	import SpellSchoolIcon from '#view/components/SpellSchoolIcon.svelte';

	let {
		candidate,
		schoolLabel,
		isSelected,
		isExpanded,
		description,
		onSelect,
		onToggleDetails,
	}: SpellScrollCandidateRowProps = $props();

	const { spellSchoolIcons } = CONFIG.NIMBLE;

	// A school the GM has since deleted leaves no icon; fall back rather than
	// rendering `class=" undefined"`, as SchoolSelection does.
	const schoolIcon = $derived(spellSchoolIcons[candidate.school] ?? 'fa-solid fa-sparkles');
</script>

<li class="nimble-spell-scroll-candidate">
	<div
		class="nimble-spell-scroll-candidate__row"
		class:nimble-spell-scroll-candidate__row--selected={isSelected}
	>
		<button
			type="button"
			class="nimble-spell-scroll-candidate__expand"
			aria-expanded={isExpanded}
			aria-label={localize('NIMBLE.spellScroll.dialog.toggleDetails', { spell: candidate.name })}
			onclick={onToggleDetails}
		>
			<i class="fa-solid" class:fa-caret-right={!isExpanded} class:fa-caret-down={isExpanded}></i>
		</button>

		<!--
			aria-pressed rather than role="radio": a radiogroup owns its arrow-key
			traversal through a roving tabindex, which this list cannot offer while each
			row also carries an expand button. This announces the selection without
			promising keyboard behaviour that is not there.
		-->
		<button
			type="button"
			class="nimble-spell-scroll-candidate__select"
			aria-pressed={isSelected}
			onclick={onSelect}
		>
			<img src={candidate.img} alt="" class="nimble-spell-scroll-candidate__thumb" />

			<span class="nimble-spell-scroll-candidate__names">
				<span class="nimble-spell-scroll-candidate__name">
					{candidate.name}
					<SpellSchoolIcon
						icon={schoolIcon}
						alt={schoolLabel}
						class="nimble-spell-scroll-candidate__school-icon"
					/>
				</span>
				<span class="nimble-spell-scroll-candidate__activation">
					{candidate.activationSummary}
				</span>
			</span>

			{#if candidate.isSecret}
				<span class="nimble-spell-scroll-candidate__secret">
					{localize('NIMBLE.spellScroll.dialog.secretBadge')}
				</span>
			{/if}
		</button>
	</div>

	{#if isExpanded}
		<!-- The description is fetched when the row opens, so the first frame has none. -->
		<div class="nimble-spell-scroll-candidate__detail">
			{#if description === null}
				<i class="fa-solid fa-spinner fa-spin-pulse"></i>
			{:else}
				{@html description}
			{/if}
		</div>
	{/if}
</li>

<style lang="scss">
	.nimble-spell-scroll-candidate {
		&__row {
			display: flex;
			align-items: stretch;
			background: var(--nimble-card-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;

			&--selected {
				background: var(--nimble-choice-card-selected-background);
				border-color: var(--nimble-choice-card-selected-border-color);
				box-shadow: inset 0 0 0 1px var(--nimble-choice-card-selected-border-color);
			}
		}

		&__expand {
			width: 1.5rem;
			padding: 0;
			background: none;
			border: 0;
			color: var(--nimble-medium-text-color);
			cursor: pointer;
		}

		&__select {
			display: flex;
			flex: 1;
			gap: 0.5rem;
			align-items: center;
			// Buttons centre their flex content by default, which left rows without a
			// secret badge floating in the middle while badged rows were pulled left
			// by the badge's auto margin.
			justify-content: flex-start;
			padding: 0.375rem 0.5rem 0.375rem 0;
			background: none;
			border: 0;
			text-align: start;
			cursor: pointer;
		}

		&__thumb {
			flex: none;
			width: 2rem;
			height: 2rem;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 2px;
		}

		&__names {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		&__name {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);

			// SpellSchoolIcon renders the element, so the class it is handed carries
			// the parent's scoping hash on no element and has to be matched globally.
			:global(.nimble-spell-scroll-candidate__school-icon) {
				color: var(--nimble-medium-text-color);
				font-size: var(--nimble-xs-text);
			}
		}

		&__activation {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__secret {
			margin-inline-start: auto;
			padding: 0.0625rem 0.3125rem;
			font-size: var(--nimble-xxs-text);
			letter-spacing: 0.06em;
			text-transform: uppercase;
			background: var(--nimble-secret-badge-background);
			border-radius: 2px;
			color: var(--nimble-badge-text-color);
		}

		&__detail {
			padding: 0.5rem 0.625rem;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-block-start: 0;
			border-radius: 0 0 3px 3px;
		}
	}
</style>

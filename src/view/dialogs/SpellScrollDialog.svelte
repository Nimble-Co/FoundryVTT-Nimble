<script lang="ts">
	import type { SpellScrollDialogProps } from '#types/components/SpellScrollDialog.d.ts';

	import localize from '#utils/localize.js';
	import { getSpellSchoolLabel } from '#utils/spellLabels.js';
	import Hint from '#view/components/Hint.svelte';
	import SecondaryNavigation from '#view/components/SecondaryNavigation.svelte';

	import SpellScrollCandidateRow from './components/spellScroll/SpellScrollCandidateRow.svelte';
	import SpellScrollChoiceCard from './components/spellScroll/SpellScrollChoiceCard.svelte';
	import { createSpellScrollDialogState } from './SpellScrollDialog.state.svelte.js';

	let props: SpellScrollDialogProps = $props();
	let {
		mode,
		actorName,
		tier = 0,
		school = '',
		activationSummary = '',
		scrollPrice = 0,
		hasMana = false,
		candidates = [],
		tierLabel = '',
	} = $derived(props);

	const state = createSpellScrollDialogState(() => props);

	// Radio groups are keyed by a document-global `name`, so scope it to this
	// dialog instance or two open copies would share one group.
	const instanceId = $props.id();
	const groupName = `${instanceId}-spell-scroll-destination`;

	const goldLabel = localize('NIMBLE.currencyAbbreviations.gp');
</script>

<article class="nimble-sheet__body nimble-spell-scroll-dialog">
	{#if mode === 'chooser'}
		<SpellScrollChoiceCard
			name={groupName}
			value="spellList"
			bind:group={state.destination}
			icon="fa-wand-sparkles"
			title={localize('NIMBLE.spellScroll.dialog.addToSpellList')}
			hint={state.manaCostLabel}
		>
			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelUpcasting')}</dt>
				<dd>{state.upcastLabel}</dd>
			</dl>

			{#if !hasMana && tier > 0}
				<Hint
					hintType="warning"
					hintIcon="fa-solid fa-circle-exclamation"
					hintText={localize('NIMBLE.spellScroll.dialog.noManaWarning', { name: actorName })}
				/>
			{/if}
		</SpellScrollChoiceCard>

		<SpellScrollChoiceCard
			name={groupName}
			value="scroll"
			bind:group={state.destination}
			icon="fa-scroll"
			title={localize('NIMBLE.spellScroll.dialog.addAsScroll')}
			hint={localize('NIMBLE.spellScroll.dialog.addAsScrollHint')}
		>
			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelTier')}</dt>
				<dd>
					{tierLabel}
					{#if school}
						· {getSpellSchoolLabel(school)}
					{/if}
				</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelValue')}</dt>
				<dd>{scrollPrice} {goldLabel}</dd>

				{#if activationSummary}
					<dt>{localize('NIMBLE.spellScroll.dialog.labelCasting')}</dt>
					<dd>{activationSummary}</dd>
				{/if}

				<dt>{localize('NIMBLE.spellScroll.dialog.labelArcana')}</dt>
				<dd>{state.arcanaLabel}</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelUpcasting')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.upcastFixed', { tier: tierLabel })}</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelInventory')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.sharesSlot')}</dd>
			</dl>
		</SpellScrollChoiceCard>
	{:else}
		<p class="nimble-spell-scroll-dialog__prompt">
			{localize('NIMBLE.spellScroll.dialog.pickerPrompt', { tier: tierLabel })}
		</p>

		{#if candidates.length < 1}
			<p class="nimble-spell-scroll-dialog__empty">
				{localize('NIMBLE.spellScroll.dialog.noCandidates', { tier: tierLabel })}
			</p>
		{:else}
			{#if state.subNavigation.length > 2}
				<SecondaryNavigation
					bind:currentTab={state.currentTab}
					subNavigation={state.subNavigation}
				/>
			{/if}

			<input
				type="search"
				class="nimble-spell-scroll-dialog__search"
				placeholder={localize('NIMBLE.spellScroll.dialog.searchPlaceholder', {
					count: String(candidates.length),
				})}
				bind:value={state.searchTerm}
			/>

			<ul class="nimble-spell-scroll-dialog__list">
				{#each state.visibleCandidates as candidate (candidate.uuid)}
					<SpellScrollCandidateRow
						{candidate}
						schoolLabel={getSpellSchoolLabel(candidate.school)}
						isSelected={state.selectedVisibleUuid === candidate.uuid}
						isExpanded={state.expandedUuid === candidate.uuid}
						description={state.descriptionFor(candidate.uuid)}
						onSelect={() => state.selectSpell(candidate.uuid)}
						onToggleDetails={() => void state.toggleExpanded(candidate.uuid)}
					/>
				{/each}
			</ul>

			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelValue')}</dt>
				<dd>{scrollPrice} {goldLabel}</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelInventory')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.sharesSlot')}</dd>
			</dl>
		{/if}
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={state.isSubmitDisabled}
		onclick={() => state.submit()}
	>
		<i class="fa-solid {state.submitIcon}"></i>
		{state.submitLabel}
	</button>
</footer>

<style lang="scss">
	.nimble-spell-scroll-dialog {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;

		&__prompt,
		&__empty {
			margin: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__facts {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.125rem 0.75rem;
			margin: 0;
			padding-block-start: 0.5rem;
			border-block-start: 1px solid var(--nimble-card-border-color);
			font-size: var(--nimble-sm-text);

			dt {
				color: var(--nimble-medium-text-color);
				// Foundry core sets `text-shadow: 1px 1px 0 #000` on dt, which smears
				// these small condensed labels into what reads as a strikethrough.
				text-shadow: none;
			}

			dd {
				margin: 0;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
				color: var(--nimble-dark-text-color);
			}
		}

		&__search {
			font-size: var(--nimble-sm-text);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			max-height: 18rem;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			list-style: none;
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;

		.nimble-button {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			justify-content: center;

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}
	}
</style>

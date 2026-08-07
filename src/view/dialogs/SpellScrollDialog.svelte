<script lang="ts">
	import type { SpellScrollDialogProps } from '#types/components/SpellScrollDialog.d.ts';

	import localize from '#utils/localize.js';
	import nextDialogId from '#utils/nextDialogId.js';

	let {
		dialog,
		mode,
		actorName,
		tier = 0,
		school = '',
		activationSummary = '',
		scrollPrice = 0,
		highestUnlockedSpellTier = 0,
		hasMana = false,
		knowsSchool = false,
		batchCount = 0,
		candidates = [],
		tierLabel = '',
	}: SpellScrollDialogProps = $props();

	const { spellSchools, spellSchoolIcons } = CONFIG.NIMBLE;

	// Radio groups need a name unique to this dialog instance, so two open copies
	// cannot steal each other's selection.
	const dialogId = `spell-scroll-${nextDialogId()}`;

	// ── Chooser state ────────────────────────────────────────────────────────
	// Defaults to the spell list so Enter reproduces the behaviour the sheet had
	// before this dialog existed.
	let destination = $state<'spellList' | 'scroll'>('spellList');

	// ── Picker state ─────────────────────────────────────────────────────────
	let searchTerm = $state('');
	let schoolFilter = $state('all');
	let selectedUuid = $state<string | null>(null);
	let expandedUuid = $state<string | null>(null);

	function schoolLabel(schoolId: string): string {
		const label = spellSchools[schoolId];
		return label ? localize(label) : schoolId;
	}

	/**
	 * Only the schools actually present among the candidates get a filter tab.
	 * The Spells tab filters by the schools the *actor* knows, which would leave
	 * a non-caster with no tabs at all here.
	 */
	let availableSchools = $derived.by(() => {
		const present = new Set(candidates.map((candidate) => candidate.school));
		return Object.keys(spellSchools).filter((schoolId) => present.has(schoolId));
	});

	let visibleCandidates = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		return candidates.filter((candidate) => {
			if (schoolFilter !== 'all' && candidate.school !== schoolFilter) return false;
			if (term && !candidate.name.toLowerCase().includes(term)) return false;
			return true;
		});
	});

	// A filter or search that hides the selected row must clear the selection,
	// otherwise Inscribe would commit a spell the player can no longer see.
	$effect(() => {
		if (!selectedUuid) return;
		if (visibleCandidates.some((candidate) => candidate.uuid === selectedUuid)) return;
		selectedUuid = null;
	});

	let manaCostLabel = $derived(
		tier > 0
			? localize('NIMBLE.spellScroll.dialog.addToSpellListHint', { mana: String(tier) })
			: localize('NIMBLE.spellScroll.dialog.addToSpellListHintCantrip'),
	);

	let canUpcast = $derived(highestUnlockedSpellTier > tier);

	let upcastLabel = $derived(
		canUpcast
			? localize('NIMBLE.spellScroll.dialog.upcastUpToTier', {
					tier: String(highestUnlockedSpellTier),
				})
			: localize('NIMBLE.spellScroll.dialog.upcastNone'),
	);

	let arcanaLabel = $derived(
		knowsSchool
			? localize('NIMBLE.spellScroll.dialog.arcanaNotNeeded', { school: schoolLabel(school) })
			: localize('NIMBLE.spellScroll.dialog.arcanaRequired', {
					actor: actorName,
					school: schoolLabel(school),
				}),
	);

	let isSubmitDisabled = $derived(mode === 'picker' && !selectedUuid);

	// The action names its own outcome and follows the selection, so the button
	// always says where the spell is about to land.
	let submitLabel = $derived.by(() => {
		if (mode === 'picker') return localize('NIMBLE.spellScroll.dialog.inscribe');

		return destination === 'scroll'
			? localize('NIMBLE.spellScroll.dialog.submitAddToInventory')
			: localize('NIMBLE.spellScroll.dialog.submitAddToSpellList');
	});

	let submitIcon = $derived(
		mode === 'picker' || destination === 'scroll' ? 'fa-scroll' : 'fa-wand-sparkles',
	);

	function toggleExpanded(uuid: string) {
		expandedUuid = expandedUuid === uuid ? null : uuid;
	}

	function onSubmit() {
		if (isSubmitDisabled) return;

		if (mode === 'picker') {
			void dialog.submit({ destination: 'scroll', spellUuid: selectedUuid ?? undefined });
			return;
		}

		void dialog.submit({ destination });
	}
</script>

<article class="nimble-sheet__body nimble-spell-scroll-dialog">
	{#if mode === 'chooser'}
		{#if batchCount > 1}
			<p class="nimble-spell-scroll-dialog__prompt">
				{localize('NIMBLE.spellScroll.dialog.batchChooserTitle', {
					actor: actorName,
					count: String(batchCount),
				})}
			</p>
		{/if}

		<label
			class="nimble-spell-scroll-dialog__choice"
			class:nimble-spell-scroll-dialog__choice--selected={destination === 'spellList'}
		>
			<input
				class="nimble-spell-scroll-dialog__input"
				type="radio"
				name="{dialogId}-spell-scroll-destination"
				value="spellList"
				bind:group={destination}
			/>

			<span class="nimble-spell-scroll-dialog__choice-header">
				<i class="nimble-spell-scroll-dialog__choice-icon fa-solid fa-wand-sparkles"></i>
				<span class="nimble-spell-scroll-dialog__choice-title">
					{localize('NIMBLE.spellScroll.dialog.addToSpellList')}
				</span>
			</span>

			<span class="nimble-spell-scroll-dialog__choice-hint">{manaCostLabel}</span>

			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelUpcasting')}</dt>
				<dd>{upcastLabel}</dd>
			</dl>

			{#if !hasMana && tier > 0}
				<span class="nimble-spell-scroll-dialog__warning">
					<i class="fa-solid fa-triangle-exclamation"></i>
					{localize('NIMBLE.spellScroll.dialog.noManaWarning', { actor: actorName })}
				</span>
			{/if}

			<span class="nimble-spell-scroll-dialog__indicator"></span>
		</label>

		<label
			class="nimble-spell-scroll-dialog__choice"
			class:nimble-spell-scroll-dialog__choice--selected={destination === 'scroll'}
		>
			<input
				class="nimble-spell-scroll-dialog__input"
				type="radio"
				name="{dialogId}-spell-scroll-destination"
				value="scroll"
				bind:group={destination}
			/>

			<span class="nimble-spell-scroll-dialog__choice-header">
				<i class="nimble-spell-scroll-dialog__choice-icon fa-solid fa-scroll"></i>
				<span class="nimble-spell-scroll-dialog__choice-title">
					{localize('NIMBLE.spellScroll.dialog.addAsScroll')}
				</span>
			</span>

			<span class="nimble-spell-scroll-dialog__choice-hint">
				{localize('NIMBLE.spellScroll.dialog.addAsScrollHint')}
			</span>

			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelTier')}</dt>
				<dd>
					{tierLabel}
					{#if school}
						· {schoolLabel(school)}
					{/if}
				</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelValue')}</dt>
				<dd>{scrollPrice} gp</dd>

				{#if activationSummary}
					<dt>{localize('NIMBLE.spellScroll.dialog.labelCasting')}</dt>
					<dd>{activationSummary}</dd>
				{/if}

				<dt>{localize('NIMBLE.spellScroll.dialog.labelArcana')}</dt>
				<dd>{arcanaLabel}</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelUpcasting')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.upcastFixed', { tier: String(tier) })}</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelInventory')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.sharesSlot')}</dd>
			</dl>

			<span class="nimble-spell-scroll-dialog__indicator"></span>
		</label>
	{:else}
		<p class="nimble-spell-scroll-dialog__prompt">
			{localize('NIMBLE.spellScroll.dialog.pickerPrompt', { tier: tierLabel })}
		</p>

		{#if candidates.length < 1}
			<p class="nimble-spell-scroll-dialog__empty">
				{localize('NIMBLE.spellScroll.dialog.noCandidates', { tier: tierLabel })}
			</p>
		{:else}
			{#if availableSchools.length > 1}
				<nav class="nimble-spell-scroll-dialog__schools">
					<button
						type="button"
						class="nimble-spell-scroll-dialog__school"
						class:is-active={schoolFilter === 'all'}
						aria-pressed={schoolFilter === 'all'}
						aria-label={localize('NIMBLE.spellScroll.dialog.filterAll')}
						data-tooltip={localize('NIMBLE.spellScroll.dialog.filterAll')}
						onclick={() => {
							schoolFilter = 'all';
						}}
					>
						<i class="fa-solid fa-grip"></i>
					</button>

					{#each availableSchools as schoolId (schoolId)}
						<button
							type="button"
							class="nimble-spell-scroll-dialog__school"
							class:is-active={schoolFilter === schoolId}
							aria-pressed={schoolFilter === schoolId}
							aria-label={schoolLabel(schoolId)}
							data-tooltip={schoolLabel(schoolId)}
							onclick={() => {
								schoolFilter = schoolId;
							}}
						>
							<i class={spellSchoolIcons[schoolId]}></i>
						</button>
					{/each}
				</nav>
			{/if}

			<input
				type="search"
				class="nimble-spell-scroll-dialog__search"
				placeholder={localize('NIMBLE.spellScroll.dialog.searchPlaceholder', {
					count: String(candidates.length),
				})}
				bind:value={searchTerm}
			/>

			<ul class="nimble-spell-scroll-dialog__list">
				{#each visibleCandidates as candidate (candidate.uuid)}
					<li class="nimble-spell-scroll-dialog__item">
						<div
							class="nimble-spell-scroll-dialog__row"
							class:is-selected={selectedUuid === candidate.uuid}
						>
							<button
								type="button"
								class="nimble-spell-scroll-dialog__expand"
								aria-expanded={expandedUuid === candidate.uuid}
								aria-label={candidate.name}
								onclick={() => toggleExpanded(candidate.uuid)}
							>
								<i
									class="fa-solid"
									class:fa-caret-right={expandedUuid !== candidate.uuid}
									class:fa-caret-down={expandedUuid === candidate.uuid}
								></i>
							</button>

							<button
								type="button"
								class="nimble-spell-scroll-dialog__select"
								onclick={() => {
									selectedUuid = candidate.uuid;
								}}
							>
								<img src={candidate.img} alt="" class="nimble-spell-scroll-dialog__thumb" />

								<span class="nimble-spell-scroll-dialog__names">
									<span class="nimble-spell-scroll-dialog__name">
										{candidate.name}
										<i class={spellSchoolIcons[candidate.school]}></i>
									</span>
									<span class="nimble-spell-scroll-dialog__activation">
										{candidate.activationSummary}
									</span>
								</span>

								{#if candidate.isSecret}
									<span class="nimble-spell-scroll-dialog__secret">
										{localize('NIMBLE.spellScroll.dialog.secretBadge')}
									</span>
								{/if}
							</button>
						</div>

						{#if expandedUuid === candidate.uuid}
							<div class="nimble-spell-scroll-dialog__detail">
								{@html candidate.description}
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<dl class="nimble-spell-scroll-dialog__facts">
				<dt>{localize('NIMBLE.spellScroll.dialog.labelValue')}</dt>
				<dd>{scrollPrice} gp</dd>

				<dt>{localize('NIMBLE.spellScroll.dialog.labelInventory')}</dt>
				<dd>{localize('NIMBLE.spellScroll.dialog.sharesSlot')}</dd>
			</dl>
		{/if}
	{/if}
</article>

<!--
	One full-width action, as Level Up, Field Rest and Safe Rest do. Closing the
	window cancels: GenericDialog#close resolves the promise with null, and
	_onDropItem already treats null as "create nothing".
-->
<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={isSubmitDisabled}
		onclick={onSubmit}
	>
		<i class="fa-solid {submitIcon}"></i>
		{submitLabel}
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

		// Mirrors .rest-type-card in FieldRestDialog.svelte, the house pattern for a
		// binary choice in a dialog: the native radio is hidden, the whole label is
		// the control, and a corner dot marks the selection.
		//
		// The accent comes from the --nimble-action-info-* tokens rather than the
		// literal amber FieldRestDialog hardcodes, because those tokens carry proper
		// .theme-dark values and the hardcoded ones do not.
		&__choice {
			position: relative;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			min-width: 0;
			padding: 0.75rem;
			background: var(--nimble-box-background-color);
			border: 2px solid var(--nimble-card-border-color);
			border-radius: 6px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover:not(&--selected) {
				border-color: var(--nimble-accent-color);
			}

			&--selected {
				background: var(--nimble-action-info-background);
				border-color: var(--nimble-action-info-border-color);
				box-shadow: inset 0 0 0 1px var(--nimble-action-info-border-color);
			}
		}

		// Hidden, not removed: the label still needs a real radio behind it for
		// keyboard traversal, arrow-key group navigation and form semantics.
		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__indicator {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: 0.625rem;
			height: 0.625rem;
			background: transparent;
			border: 2px solid transparent;
			border-radius: 50%;
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-dialog__choice--selected & {
				background: var(--nimble-action-info-icon-color);
				border-color: var(--nimble-action-info-border-color);
			}
		}

		&__choice-header {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			// Leave room for the indicator dot.
			padding-inline-end: 1rem;
		}

		&__choice-icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-dialog__choice--selected & {
				color: var(--nimble-action-info-icon-color);
			}
		}

		&__choice-title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-dialog__choice--selected & {
				color: var(--nimble-action-info-text-color);
			}
		}

		&__choice-hint {
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.45;
			color: var(--nimble-dark-text-color);
		}

		&__warning {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0 0.5rem;
			margin-block-start: 0.375rem;
			padding: 0.5rem 0.625rem;
			font-size: var(--nimble-sm-text);
			background: var(--nimble-warning-background-color);
			border: 1px solid var(--nimble-warning-border-color);
			border-radius: 3px;

			i {
				color: var(--nimble-warning-icon-color);
			}
		}

		&__facts {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.125rem 0.75rem;
			// The choice card supplies vertical rhythm through its own flex gap.
			margin: 0;
			padding-block-start: 0.5rem;
			border-block-start: 1px solid var(--nimble-card-border-color);
			font-size: var(--nimble-sm-text);

			dt {
				// Foundry core sets `text-shadow: 1px 1px 0 #000` on dt for its dark
				// chrome. On small condensed text over this light card it smears into
				// what reads as a strikethrough.
				text-shadow: none;
				color: var(--nimble-medium-text-color);
			}

			dd {
				margin: 0;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
			}
		}

		&__schools {
			display: flex;
			background: var(--nimble-secondary-navigation-background);
			border-radius: 3px;
		}

		&__school {
			flex: 1;
			padding: 0.4375rem 0;
			background: none;
			border: 0;
			// The shipped secondary nav hardcodes a warm tan divider with no dark
			// variant; the card border token adapts to both themes.
			border-inline-end: 1px solid var(--nimble-card-border-color);
			border-radius: 0;
			color: var(--nimble-secondary-navigation-text-color);
			cursor: pointer;

			&:last-child {
				border-inline-end: 0;
			}

			&.is-active {
				color: var(--nimble-secondary-navigation-active-text-color);
				box-shadow: inset 0 -2px 0 var(--nimble-secondary-navigation-active-text-color);
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

		&__row {
			display: flex;
			align-items: stretch;
			background: var(--nimble-card-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;

			&.is-selected {
				background: var(--nimble-action-info-background);
				border-color: var(--nimble-action-info-border-color);
				box-shadow: inset 0 0 0 1px var(--nimble-action-info-border-color);
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

			i {
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
			background: var(--nimble-badge-subclass-bg);
			border-radius: 2px;
			color: var(--nimble-badge-text-color);
		}

		&__detail {
			padding: 0.5rem 0.625rem;
			font-size: var(--nimble-sm-text);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-block-start: 0;
			border-radius: 0 0 3px 3px;
		}
	}

	// Matches the single-action footer used by Level Up, Field Rest, Safe Rest,
	// Roll Hit Dice and Edit Mana: one button spanning the dialog.
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

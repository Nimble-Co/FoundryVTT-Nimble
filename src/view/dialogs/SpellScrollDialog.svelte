<script lang="ts">
	import type { SpellScrollDialogProps } from '#types/components/SpellScrollDialog.d.ts';

	import localize from '#utils/localize.js';

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
			class:is-selected={destination === 'spellList'}
		>
			<input type="radio" name="destination" value="spellList" bind:group={destination} />

			<span class="nimble-spell-scroll-dialog__choice-body">
				<span class="nimble-spell-scroll-dialog__choice-title">
					{localize('NIMBLE.spellScroll.dialog.addToSpellList')}
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
			</span>
		</label>

		<label class="nimble-spell-scroll-dialog__choice" class:is-selected={destination === 'scroll'}>
			<input type="radio" name="destination" value="scroll" bind:group={destination} />

			<span class="nimble-spell-scroll-dialog__choice-body">
				<span class="nimble-spell-scroll-dialog__choice-title">
					{localize('NIMBLE.spellScroll.dialog.addAsScroll')}
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
			</span>
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

	<footer class="nimble-spell-scroll-dialog__footer">
		<button
			class="nimble-button"
			data-button-variant="basic"
			type="button"
			onclick={() => dialog.close()}
		>
			{localize('NIMBLE.spellScroll.dialog.cancel')}
		</button>

		<button class="nimble-button" type="button" disabled={isSubmitDisabled} onclick={onSubmit}>
			{mode === 'picker'
				? localize('NIMBLE.spellScroll.dialog.inscribe')
				: localize('NIMBLE.spellScroll.dialog.add')}
		</button>
	</footer>
</article>

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

		&__choice {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0 0.625rem;
			align-items: start;
			padding: 0.625rem 0.75rem;
			background: var(--nimble-card-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
			cursor: pointer;

			&.is-selected {
				border-color: var(--nimble-secondary-navigation-active-text-color);
				box-shadow: 0 0 0 1px var(--nimble-secondary-navigation-active-text-color);
			}
		}

		&__choice-body {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}

		&__choice-title {
			font-size: var(--nimble-md-text);
			font-weight: 700;
		}

		&__choice-hint {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
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
			margin: 0.375rem 0 0;
			padding-block-start: 0.5rem;
			border-block-start: 1px solid var(--nimble-card-border-color);
			font-size: var(--nimble-sm-text);

			dt {
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
			border-inline-end: var(
				--nimble-secondary-navigation-item-border,
				1px solid rgba(120, 100, 82, 0.5)
			);
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
				border-color: var(--nimble-secondary-navigation-active-text-color);
				box-shadow: 0 0 0 1px var(--nimble-secondary-navigation-active-text-color);
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

		&__footer {
			display: flex;
			gap: 0.375rem;
			justify-content: flex-end;
		}
	}
</style>

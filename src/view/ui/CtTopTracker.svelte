<script lang="ts">
	import { fade } from 'svelte/transition';
	import { createCtTopTrackerState } from './CtTopTracker.state.svelte.js';
	import { CT_SHELL_EXTRA_WIDTH_REM } from './ctTopTracker/constants.js';
	import {
		canCurrentUserAdjustCombatantActions,
		canCurrentUserRollInitiativeForCombatant,
		getCombatantId,
		isPlayerCombatant,
		localizeWithFallback,
		shouldShowInitiativePromptForCombatant,
	} from './ctTopTracker/combat.utils.js';
	import {
		getActionState,
		getCombatantCardResourceChips,
		getCombatantDisplayName,
		getCombatantImageForDisplay,
		getCombatantOutlineClass,
		getPortraitFallbackForCombatant,
		getNonPlayerCombatantHpBarData,
		getPlayerCombatantDrawerData,
		shouldRenderCombatantActions,
	} from './ctTopTracker/resources.utils.js';
	const trackerViewState = createCtTopTrackerState();
	const ctShellExtraWidth = `${CT_SHELL_EXTRA_WIDTH_REM}rem`;

	let trackElement: HTMLOListElement | null = $state(null);
	let trackScrollbarElement: HTMLDivElement | null = $state(null);
	let trackScrollLeft = $derived(trackerViewState.trackScrollLeft);
	let currentCombat = $derived(trackerViewState.currentCombat);
	let playerHpBarTextMode = $derived(trackerViewState.playerHpBarTextMode);
	let nonPlayerHpBarEnabled = $derived(trackerViewState.nonPlayerHpBarEnabled);
	let nonPlayerHpBarTextMode = $derived(trackerViewState.nonPlayerHpBarTextMode);
	let resourceDrawerHoverEnabled = $derived(trackerViewState.resourceDrawerHoverEnabled);
	let ctEnabled = $derived(trackerViewState.ctEnabled);
	let activeDragSourceKey = $derived(trackerViewState.activeDragSourceKey);
	let activeDragSourceCombatantIds = $derived(trackerViewState.activeDragSourceCombatantIds);
	let dragPreview = $derived(trackerViewState.dragPreview);
	let hasMonsterCombatants = $derived(trackerViewState.hasMonsterCombatants);
	let canCurrentUserToggleMonsterCards = $derived(
		trackerViewState.canCurrentUserToggleMonsterCards,
	);
	let renderedDeadCombatants = $derived(trackerViewState.renderedDeadCombatants);
	let monsterCardsExpanded = $derived(trackerViewState.monsterCardsExpanded);
	let orderedAliveEntries = $derived(trackerViewState.orderedAliveEntries);
	let activeEntryKey = $derived(trackerViewState.activeEntryKey);
	let canCurrentUserEndTurn = $derived(trackerViewState.canCurrentUserEndTurn);
	let virtualizedAliveEntries = $derived(trackerViewState.virtualizedAliveEntries);
	let expandedMonsterGroupBars = $derived(trackerViewState.expandedMonsterGroupBars);
	let roundSeparatorIndex = $derived(trackerViewState.roundSeparatorIndex);
	let combatStarted = $derived(trackerViewState.combatStarted);
	let currentRoundLabel = $derived(trackerViewState.currentRoundLabel);
	let ctTrackMaxWidth = $derived(trackerViewState.ctTrackMaxWidth);
	let ctWidthPreviewVisible = $derived(trackerViewState.ctWidthPreviewVisible);
	let ctWidthPreviewMaxWidth = $derived(trackerViewState.ctWidthPreviewMaxWidth);
	let ctCardSizePreviewActive = $derived(trackerViewState.ctCardSizePreviewActive);
	let ctCardScale = $derived(trackerViewState.ctCardScale);
	let trackScrollbarMetrics = $derived(trackerViewState.trackScrollbarMetrics);
	let showTrackScrollbar = $derived(trackerViewState.showTrackScrollbar);

	$effect(() => {
		trackerViewState.trackElement = trackElement;
	});

	$effect(() => {
		trackerViewState.trackScrollbarElement = trackScrollbarElement;
	});

	const handleCombatantInitiativeRoll = trackerViewState.handleCombatantInitiativeRoll;
	const handleEndTurnFromCard = trackerViewState.handleEndTurnFromCard;
	const toggleMonsterCardExpansion = trackerViewState.toggleMonsterCardExpansion;
	const handleActionDeltaClick = trackerViewState.handleActionDeltaClick;
	const canToggleHeroicReactionFromDrawer = trackerViewState.canToggleHeroicReactionFromDrawer;
	const handleHeroicReactionToggle = trackerViewState.handleHeroicReactionToggle;
	const handleCombatantCardClick = trackerViewState.handleCombatantCardClick;
	const handleCombatantCardContextMenu = trackerViewState.handleCombatantCardContextMenu;
	const handleCombatantCardKeyDown = trackerViewState.handleCombatantCardKeyDown;
	const canRemoveCombatant = trackerViewState.canRemoveCombatant;
	const handleRemoveCombatant = trackerViewState.handleRemoveCombatant;
	const handleMonsterStackClick = trackerViewState.handleMonsterStackClick;
	const handleMonsterStackContextMenu = trackerViewState.handleMonsterStackContextMenu;
	const handleMonsterStackKeyDown = trackerViewState.handleMonsterStackKeyDown;
	const handleTrackDragOver = trackerViewState.handleTrackDragOver;
	const handleTrackDrop = trackerViewState.handleTrackDrop;
	const handleTrackScroll = trackerViewState.handleTrackScroll;
	const handleTrackEntryPointerDown = trackerViewState.handleTrackEntryPointerDown;
	const handleTrackEntryDragStart = trackerViewState.handleTrackEntryDragStart;
	const handleTrackEntryDragEnd = trackerViewState.handleTrackEntryDragEnd;
	const handleControlAction = trackerViewState.handleControlAction;
	const handleTrackScrollbarKeyDown = trackerViewState.handleTrackScrollbarKeyDown;
	const handleTrackScrollbarPointerDown = trackerViewState.handleTrackScrollbarPointerDown;
	const handleTrackScrollbarPointerMove = trackerViewState.handleTrackScrollbarPointerMove;
	const handleTrackScrollbarPointerRelease = trackerViewState.handleTrackScrollbarPointerRelease;
	const canDragCombatant = trackerViewState.canDragCombatant;
	const canDragTrackEntry = trackerViewState.canDragTrackEntry;
	const localize = game.i18n.localize.bind(game.i18n);

	function handleCombatantPortraitImageError(event: Event) {
		const img = event.currentTarget;
		if (!(img instanceof HTMLImageElement)) return;
		const fallback = img.dataset.portraitFallback;
		if (!fallback) return;
		if (img.src.includes(fallback)) return;
		img.src = fallback;
	}
</script>

{#snippet renderNameDrawer(cardName)}
	<div class="nimble-ct__player-name-drawer">
		<span class="nimble-ct__player-name-drawer-text">{cardName}</span>
	</div>
{/snippet}

{#snippet renderNonPlayerHpBar(hpBarData)}
	<div
		class={`nimble-ct__non-player-hp-bar ${hpBarData.toneClass}`}
		style={`--nimble-ct-non-player-hp-bar-fill: ${hpBarData.fillPercent}%;`}
		data-tooltip={hpBarData.tooltip}
	>
		{#if hpBarData.centerText}
			<span class="nimble-ct__non-player-hp-bar-text">{hpBarData.centerText}</span>
		{/if}
	</div>
{/snippet}

{#snippet renderNonPlayerFooter(cardName, hpBarData)}
	<div class="nimble-ct__non-player-footer-stack">
		{#if hpBarData?.visible}
			<div class="nimble-ct__non-player-hp-bar-wrap">
				{@render renderNonPlayerHpBar(hpBarData)}
			</div>
		{/if}
		<div class="nimble-ct__non-player-name-drawer-stack">
			{@render renderNameDrawer(cardName)}
		</div>
	</div>
{/snippet}

{#snippet renderResourceReactionButton(combatant, reactionKey, reactionCell)}
	<button
		type="button"
		class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
		class:nimble-ct__drawer-cell--inactive={reactionCell.active === false}
		class:nimble-ct__drawer-cell--hidden={!reactionCell.visible}
		data-tooltip={reactionCell.title}
		data-tooltip-direction={reactionKey === 'defend' || reactionKey === 'interpose'
			? 'LEFT'
			: 'RIGHT'}
		disabled={!canToggleHeroicReactionFromDrawer(combatant, reactionKey, reactionCell.active)}
		onclick={(event) => handleHeroicReactionToggle(event, combatant, reactionKey)}
	>
		{#if reactionCell.visible}
			<i class={reactionCell.iconClass}></i>
		{/if}
	</button>
{/snippet}

{#snippet renderPlayerResourceBar(barData)}
	<div
		class={`nimble-ct__player-resource-bar ${barData.toneClass}`}
		style={`--nimble-ct-player-resource-bar-fill: ${barData.fillPercent}%;`}
		data-tooltip={barData.title}
		data-tooltip-direction="LEFT"
	>
		{#if barData.iconClass || barData.centerText}
			<span class="nimble-ct__player-resource-bar-text">
				{#if barData.iconClass}
					<i class={barData.iconClass}></i>
				{/if}
				{#if barData.centerText}
					<span>{barData.centerText}</span>
				{/if}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet renderResourceDrawer(combatant, resourceDrawerData, cardName)}
	<div class="nimble-ct__resource-drawer-stack">
		<div class="nimble-ct__resource-drawer">
			<div class="nimble-ct__resource-row nimble-ct__resource-row--reactions">
				{@render renderResourceReactionButton(combatant, 'defend', resourceDrawerData.defend)}
				{@render renderResourceReactionButton(combatant, 'interpose', resourceDrawerData.interpose)}
				{@render renderResourceReactionButton(
					combatant,
					'opportunityAttack',
					resourceDrawerData.opportunityAttack,
				)}
				{@render renderResourceReactionButton(combatant, 'help', resourceDrawerData.help)}
			</div>
			{#if resourceDrawerData.hpBar.visible}
				<div class="nimble-ct__resource-row nimble-ct__resource-row--bar">
					{@render renderPlayerResourceBar(resourceDrawerData.hpBar)}
				</div>
			{/if}
			{#if resourceDrawerData.woundsBar.visible}
				<div class="nimble-ct__resource-row nimble-ct__resource-row--bar">
					{@render renderPlayerResourceBar(resourceDrawerData.woundsBar)}
				</div>
			{/if}
		</div>
		{@render renderNameDrawer(cardName)}
	</div>
{/snippet}

{#if ctEnabled && currentCombat}
	<section
		class="nimble-ct-shell"
		class:nimble-ct-shell--card-size-preview-active={ctCardSizePreviewActive}
		class:nimble-ct-shell--resource-drawer-pinned={!resourceDrawerHoverEnabled}
		style={`--nimble-ct-track-max-width: ${ctTrackMaxWidth}; --nimble-ct-shell-extra-width: ${ctShellExtraWidth}; --nimble-ct-card-scale: ${ctCardScale};`}
		in:fade={{ duration: 120 }}
	>
		{#if ctWidthPreviewVisible}
			<div
				class="nimble-ct__width-preview"
				style={`--nimble-ct-width-preview-max: ${ctWidthPreviewMaxWidth};`}
				aria-hidden="true"
			>
				<div class="nimble-ct__width-preview-track">
					<span class="nimble-ct__width-preview-line nimble-ct__width-preview-line--left">
						<svg
							class="nimble-ct__width-preview-svg"
							viewBox="0 0 4 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<line class="nimble-ct__width-preview-stroke" x1="2" y1="0" x2="2" y2="100"></line>
						</svg>
					</span>
					<span class="nimble-ct__width-preview-line nimble-ct__width-preview-line--right">
						<svg
							class="nimble-ct__width-preview-svg"
							viewBox="0 0 4 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<line class="nimble-ct__width-preview-stroke" x1="2" y1="0" x2="2" y2="100"></line>
						</svg>
					</span>
				</div>
			</div>
		{/if}
		<div class="nimble-ct">
			{#if game.user?.isGM}
				<div class="nimble-ct__controls faded-ui" aria-label="Combat controls left">
					{#if hasMonsterCombatants && canCurrentUserToggleMonsterCards}
						<button
							class="nimble-ct__icon-button"
							aria-label={monsterCardsExpanded
								? localizeWithFallback('NIMBLE.ct.stackMonsterGroups', 'Stack Monster Groups')
								: localizeWithFallback('NIMBLE.ct.unstackMonsterGroups', 'Unstack Monster Groups')}
							data-tooltip={monsterCardsExpanded
								? localizeWithFallback('NIMBLE.ct.stackMonsterGroups', 'Stack Monster Groups')
								: localizeWithFallback('NIMBLE.ct.unstackMonsterGroups', 'Unstack Monster Groups')}
							data-tooltip-direction="LEFT"
							onclick={toggleMonsterCardExpansion}
						>
							<i class={`fa-solid ${monsterCardsExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
						</button>
					{/if}
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Roll Initiative"
							data-tooltip="Roll Initiative"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'roll-all')}
							><i class="fa-solid fa-users"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Previous Turn"
							data-tooltip="Previous Turn"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'previous-turn')}
							><i class="fa-solid fa-chevron-left"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Previous Round"
							data-tooltip="Previous Round"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'previous-round')}
							><i class="fa-solid fa-chevrons-left"></i></button
						>
					{/if}
				</div>
			{/if}

			<div class="nimble-ct__viewport">
				<ol
					class="nimble-ct__track"
					bind:this={trackElement}
					id="combatants"
					data-nimble-combat-drop-target="true"
					data-drag-source-key={activeDragSourceKey ?? ''}
					data-drag-source-combatant-ids={activeDragSourceCombatantIds.join(',')}
					data-drop-target-key={dragPreview?.targetKey ?? ''}
					data-drop-target-combatant-ids={dragPreview?.targetCombatantIds.join(',') ?? ''}
					data-drop-before={dragPreview ? String(dragPreview.before) : ''}
					ondragover={handleTrackDragOver}
					ondrop={(event) => {
						void handleTrackDrop(event);
					}}
					onscroll={handleTrackScroll}
				>
					{#if expandedMonsterGroupBars.length > 0}
						{#each expandedMonsterGroupBars as expandedMonsterGroupBar (expandedMonsterGroupBar.key)}
							<li
								class="nimble-ct__expanded-monster-group-bar"
								aria-hidden="true"
								style={`left: ${expandedMonsterGroupBar.leftPx}px; width: ${expandedMonsterGroupBar.widthPx}px;`}
							></li>
						{/each}
					{/if}
					{#if virtualizedAliveEntries.leadingWidthPx > 0}
						<li
							class="nimble-ct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.leadingWidthPx}px;`}
						></li>
					{/if}
					{#each virtualizedAliveEntries.entries as entry, localIndex (entry.key)}
						{@const index = virtualizedAliveEntries.startIndex + localIndex}
						{#if combatStarted && roundSeparatorIndex === index}
							<li class="nimble-ct__round-separator" data-tooltip="Current Round">
								<span class="nimble-ct__round-separator-line"></span>
								<span class="nimble-ct__round-separator-round"
									><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
								>
							</li>
						{/if}
						{#if entry.kind === 'combatant'}
							{@const actionState = getActionState(entry.combatant)}
							{@const combatantId = getCombatantId(entry.combatant)}
							{@const isPlayerEntry = isPlayerCombatant(entry.combatant)}
							{@const cardOutlineClass = getCombatantOutlineClass(entry.combatant)}
							{@const canDragEntry = canDragCombatant(entry.combatant)}
							{@const resourceChips = isPlayerEntry
								? []
								: getCombatantCardResourceChips(entry.combatant)}
							{@const resourceDrawerData = isPlayerEntry
								? getPlayerCombatantDrawerData(entry.combatant, playerHpBarTextMode)
								: null}
							{@const nonPlayerHpBarData = !isPlayerEntry
								? getNonPlayerCombatantHpBarData(
										entry.combatant,
										nonPlayerHpBarEnabled,
										nonPlayerHpBarTextMode,
									)
								: null}
							{@const cardName = getCombatantDisplayName(entry.combatant)}
							{@const canShowActions = shouldRenderCombatantActions()}
							{@const showEndTurnOverlay =
								combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<li
								class={`nimble-ct__portrait ${cardOutlineClass} ${isPlayerEntry ? 'nimble-ct__portrait--resource-drawer' : 'nimble-ct__portrait--name-drawer'}`}
								class:nimble-ct__portrait--non-player-hp-bar={Boolean(nonPlayerHpBarData?.visible)}
								class:nimble-ct__portrait--active={activeEntryKey === entry.key}
								class:nimble-ct__portrait--dead={entry.combatant.defeated}
								class:nimble-ct__portrait--draggable={canDragEntry}
								class:nimble-ct__portrait--preview-gap-before={dragPreview?.targetKey ===
									entry.key && dragPreview.before}
								class:nimble-ct__portrait--preview-gap-after={dragPreview?.targetKey ===
									entry.key && !dragPreview.before}
								data-track-key={entry.key}
								data-combatant-id={combatantId}
								style={isPlayerEntry && resourceDrawerData
									? `--nimble-ct-resource-drawer-row-count: ${resourceDrawerData.rowCount};`
									: undefined}
								onpointerdown={(event) => handleTrackEntryPointerDown(event, entry.key)}
								draggable={canDragEntry}
								ondragstart={(event) => handleTrackEntryDragStart(event, entry)}
								ondragend={handleTrackEntryDragEnd}
							>
								<div
									class={`nimble-ct__portrait-card ${isPlayerEntry ? cardOutlineClass : ''}`}
									role="button"
									tabindex="0"
									onclick={(event) => handleCombatantCardClick(event, entry.combatant)}
									oncontextmenu={(event) => handleCombatantCardContextMenu(event, entry.combatant)}
									onkeydown={(event) => handleCombatantCardKeyDown(event, entry.combatant)}
								>
									<img
										class="nimble-ct__image"
										src={getCombatantImageForDisplay(entry.combatant)}
										alt="Combatant portrait"
										draggable="false"
										data-portrait-fallback={getPortraitFallbackForCombatant()}
										onerror={handleCombatantPortraitImageError}
									/>
									{#if canDragEntry}
										<div
											class="nimble-ct__drag-handle"
											data-ct-drag-handle="true"
											data-track-key={entry.key}
										></div>
									{/if}
									{#if resourceChips.length > 0}
										<div class="nimble-ct__resource-chips">
											{#each resourceChips as resourceChip (resourceChip.key)}
												<span
													class={`nimble-ct__resource-chip nimble-ct__resource-chip--${resourceChip.tone}`}
													class:nimble-ct__resource-chip--inactive={resourceChip.active === false}
													data-tooltip={resourceChip.title}
												>
													<i class={resourceChip.iconClass}></i>
													{#if resourceChip.text}
														<span class="nimble-ct__resource-chip-text">{resourceChip.text}</span>
													{/if}
												</span>
											{/each}
										</div>
									{/if}
									{#if shouldShowInitiativePromptForCombatant(entry.combatant)}
										<button
											class="nimble-ct__initiative-roll"
											type="button"
											aria-label="Roll Initiative"
											data-tooltip="Roll Initiative"
											data-tooltip-direction="UP"
											disabled={!canCurrentUserRollInitiativeForCombatant(entry.combatant)}
											onclick={(event) => {
												void handleCombatantInitiativeRoll(event, entry.combatant);
											}}
										>
											<i class="fa-solid fa-dice-d20"></i>
										</button>
									{/if}
									{#if canShowActions}
										{@const displayCurrentActions = Math.max(0, Math.floor(actionState.current))}
										{@const displayMaxActions = Math.max(0, Math.floor(actionState.max))}
										{@const canAdjustActions = canCurrentUserAdjustCombatantActions(
											entry.combatant,
										)}
										<div class="nimble-ct__pips">
											<div
												class="nimble-ct__action-box-shell"
												class:nimble-ct__action-box-shell--editable={canAdjustActions}
											>
												{#if canAdjustActions}
													<button
														type="button"
														class="nimble-ct__action-adjust nimble-ct__action-adjust--minus"
														aria-label="Decrease available actions"
														data-tooltip="Decrease actions"
														data-tooltip-direction="UP"
														disabled={displayCurrentActions <= 0}
														onclick={(event) => {
															void handleActionDeltaClick(event, entry.combatant, -1);
														}}
													>
														<i class="fa-solid fa-minus"></i>
													</button>
												{/if}
												<span
													class="nimble-ct__action-box"
													data-tooltip={`Available actions: ${displayCurrentActions} / ${displayMaxActions}`}
													data-tooltip-direction="UP"
												>
													{displayCurrentActions}/{displayMaxActions}
												</span>
												{#if canAdjustActions}
													<button
														type="button"
														class="nimble-ct__action-adjust nimble-ct__action-adjust--plus"
														aria-label="Increase available actions"
														data-tooltip="Increase actions"
														data-tooltip-direction="UP"
														disabled={!game.user?.isGM &&
															displayCurrentActions >= displayMaxActions}
														onclick={(event) => {
															void handleActionDeltaClick(event, entry.combatant, 1);
														}}
													>
														<i class="fa-solid fa-plus"></i>
													</button>
												{/if}
											</div>
										</div>
									{/if}
									{#if showEndTurnOverlay}
										<button
											class="nimble-ct__end-turn-overlay"
											type="button"
											aria-label="End Turn"
											onclick={handleEndTurnFromCard}
										>
											End Turn
										</button>
									{/if}
								</div>
								{#if canRemoveCombatant()}
									<button
										type="button"
										class="nimble-ct__remove-combatant"
										aria-label={localize('NIMBLE.ui.combatTracker.removeFromCombat')}
										data-tooltip={localize('NIMBLE.ui.combatTracker.removeFromCombat')}
										data-tooltip-direction="LEFT"
										onclick={(event) => {
											void handleRemoveCombatant(event, entry.combatant);
										}}
									>
										<i class="fa-solid fa-trash"></i>
									</button>
								{/if}
								{#if isPlayerEntry && resourceDrawerData && cardName}
									{@render renderResourceDrawer(entry.combatant, resourceDrawerData, cardName)}
								{:else if cardName}
									{@render renderNonPlayerFooter(cardName, nonPlayerHpBarData)}
								{/if}
							</li>
						{:else if entry.kind === 'monster-stack'}
							{@const canDragEntry = canDragTrackEntry(entry)}
							<li
								class="nimble-ct__portrait nimble-ct__portrait--monster nimble-ct__portrait--name-drawer nimble-ct__portrait--outline-monster"
								class:nimble-ct__portrait--active={activeEntryKey === entry.key}
								class:nimble-ct__portrait--draggable={canDragEntry}
								class:nimble-ct__portrait--preview-gap-before={dragPreview?.targetKey ===
									entry.key && dragPreview.before}
								class:nimble-ct__portrait--preview-gap-after={dragPreview?.targetKey ===
									entry.key && !dragPreview.before}
								data-track-key={entry.key}
								onpointerdown={(event) => handleTrackEntryPointerDown(event, entry.key)}
								draggable={canDragEntry}
								ondragstart={(event) => handleTrackEntryDragStart(event, entry)}
								ondragend={handleTrackEntryDragEnd}
							>
								<div
									class="nimble-ct__portrait-card"
									role="button"
									tabindex="0"
									onclick={(event) => handleMonsterStackClick(event, entry)}
									oncontextmenu={(event) => handleMonsterStackContextMenu(event, entry)}
									onkeydown={(event) => handleMonsterStackKeyDown(event, entry)}
								>
									{#if canDragEntry}
										<div
											class="nimble-ct__drag-handle"
											data-ct-drag-handle="true"
											data-track-key={entry.key}
										></div>
									{/if}
									<span class="nimble-ct__monster-stack-icon" aria-hidden="true">
										<i class="fa-solid fa-dragon"></i>
									</span>
									<span class="nimble-ct__badge">x{entry.combatants.length}</span>
									{#if combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
										<button
											class="nimble-ct__end-turn-overlay"
											type="button"
											aria-label="End Turn"
											onclick={handleEndTurnFromCard}
										>
											End Turn
										</button>
									{/if}
								</div>
								<div class="nimble-ct__name-drawer-stack">
									{@render renderNameDrawer('Monsters and Minions')}
								</div>
							</li>
						{/if}
					{/each}
					{#if orderedAliveEntries.length === 0 && renderedDeadCombatants.length === 0}
						<li class="nimble-ct__empty-state">No combatants added</li>
					{/if}
					{#if combatStarted && orderedAliveEntries.length > 0 && roundSeparatorIndex < 0}
						<li class="nimble-ct__round-separator" data-tooltip="Current Round">
							<span class="nimble-ct__round-separator-line"></span>
							<span class="nimble-ct__round-separator-round"
								><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
							>
						</li>
					{/if}
					{#if virtualizedAliveEntries.trailingWidthPx > 0}
						<li
							class="nimble-ct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.trailingWidthPx}px;`}
						></li>
					{/if}

					{#if renderedDeadCombatants.length > 0}
						<li class="nimble-ct__dead">Dead</li>
						{#each renderedDeadCombatants as combatant (combatant._id)}
							{@const actionState = getActionState(combatant)}
							{@const isPlayerEntry = isPlayerCombatant(combatant)}
							{@const cardOutlineClass = getCombatantOutlineClass(combatant)}
							{@const resourceChips = isPlayerEntry ? [] : getCombatantCardResourceChips(combatant)}
							{@const resourceDrawerData = isPlayerEntry
								? getPlayerCombatantDrawerData(combatant, playerHpBarTextMode)
								: null}
							{@const nonPlayerHpBarData = !isPlayerEntry
								? getNonPlayerCombatantHpBarData(
										combatant,
										nonPlayerHpBarEnabled,
										nonPlayerHpBarTextMode,
									)
								: null}
							{@const cardName = getCombatantDisplayName(combatant)}
							{@const canShowActions = shouldRenderCombatantActions()}
							<li
								class={`nimble-ct__portrait nimble-ct__portrait--dead ${cardOutlineClass} ${isPlayerEntry ? 'nimble-ct__portrait--resource-drawer' : 'nimble-ct__portrait--name-drawer'}`}
								class:nimble-ct__portrait--non-player-hp-bar={Boolean(nonPlayerHpBarData?.visible)}
								data-track-key={`dead-${getCombatantId(combatant)}`}
								style={isPlayerEntry && resourceDrawerData
									? `--nimble-ct-resource-drawer-row-count: ${resourceDrawerData.rowCount};`
									: undefined}
							>
								<div
									class={`nimble-ct__portrait-card ${isPlayerEntry ? cardOutlineClass : ''}`}
									role="button"
									tabindex="0"
									onclick={(event) => handleCombatantCardClick(event, combatant)}
									oncontextmenu={(event) => handleCombatantCardContextMenu(event, combatant)}
									onkeydown={(event) => handleCombatantCardKeyDown(event, combatant)}
								>
									<img
										class="nimble-ct__image"
										src={getCombatantImageForDisplay(combatant)}
										alt="Dead combatant portrait"
										draggable="false"
										data-portrait-fallback={getPortraitFallbackForCombatant()}
										onerror={handleCombatantPortraitImageError}
									/>
									{#if resourceChips.length > 0}
										<div class="nimble-ct__resource-chips">
											{#each resourceChips as resourceChip (resourceChip.key)}
												<span
													class={`nimble-ct__resource-chip nimble-ct__resource-chip--${resourceChip.tone}`}
													class:nimble-ct__resource-chip--inactive={resourceChip.active === false}
													data-tooltip={resourceChip.title}
												>
													<i class={resourceChip.iconClass}></i>
													{#if resourceChip.text}
														<span class="nimble-ct__resource-chip-text">{resourceChip.text}</span>
													{/if}
												</span>
											{/each}
										</div>
									{/if}
									{#if canShowActions}
										{@const displayCurrentActions = Math.max(0, Math.floor(actionState.current))}
										{@const displayMaxActions = Math.max(0, Math.floor(actionState.max))}
										{@const canAdjustActions = canCurrentUserAdjustCombatantActions(combatant)}
										<div class="nimble-ct__pips">
											<div
												class="nimble-ct__action-box-shell"
												class:nimble-ct__action-box-shell--editable={canAdjustActions}
											>
												{#if canAdjustActions}
													<button
														type="button"
														class="nimble-ct__action-adjust nimble-ct__action-adjust--minus"
														aria-label="Decrease available actions"
														data-tooltip="Decrease actions"
														data-tooltip-direction="UP"
														disabled={displayCurrentActions <= 0}
														onclick={(event) => {
															void handleActionDeltaClick(event, combatant, -1);
														}}
													>
														<i class="fa-solid fa-minus"></i>
													</button>
												{/if}
												<span
													class="nimble-ct__action-box"
													data-tooltip={`Available actions: ${displayCurrentActions} / ${displayMaxActions}`}
													data-tooltip-direction="UP"
												>
													{displayCurrentActions}/{displayMaxActions}
												</span>
												{#if canAdjustActions}
													<button
														type="button"
														class="nimble-ct__action-adjust nimble-ct__action-adjust--plus"
														aria-label="Increase available actions"
														data-tooltip="Increase actions"
														data-tooltip-direction="UP"
														disabled={!game.user?.isGM &&
															displayCurrentActions >= displayMaxActions}
														onclick={(event) => {
															void handleActionDeltaClick(event, combatant, 1);
														}}
													>
														<i class="fa-solid fa-plus"></i>
													</button>
												{/if}
											</div>
										</div>
									{/if}
								</div>
								{#if canRemoveCombatant()}
									<button
										type="button"
										class="nimble-ct__remove-combatant"
										aria-label={localize('NIMBLE.ui.combatTracker.removeFromCombat')}
										data-tooltip={localize('NIMBLE.ui.combatTracker.removeFromCombat')}
										data-tooltip-direction="LEFT"
										onclick={(event) => {
											void handleRemoveCombatant(event, combatant);
										}}
									>
										<i class="fa-solid fa-trash"></i>
									</button>
								{/if}
								{#if isPlayerEntry && resourceDrawerData && cardName}
									{@render renderResourceDrawer(combatant, resourceDrawerData, cardName)}
								{:else if cardName}
									{@render renderNonPlayerFooter(cardName, nonPlayerHpBarData)}
								{/if}
							</li>
						{/each}
					{/if}
				</ol>
				{#if showTrackScrollbar && trackScrollbarMetrics}
					<div
						class="nimble-ct__scrollbar"
						bind:this={trackScrollbarElement}
						role="scrollbar"
						tabindex="0"
						aria-label={localizeWithFallback(
							'NIMBLE.ui.combatTracker.scrollbar',
							'Combat turn order scrollbar',
						)}
						aria-controls="combatants"
						aria-orientation="horizontal"
						aria-valuemin={0}
						aria-valuemax={trackScrollbarMetrics.maxScrollLeftPx}
						aria-valuenow={Math.round(trackScrollLeft)}
						onpointerdown={handleTrackScrollbarPointerDown}
						onpointermove={handleTrackScrollbarPointerMove}
						onpointerup={handleTrackScrollbarPointerRelease}
						onpointercancel={handleTrackScrollbarPointerRelease}
						onkeydown={handleTrackScrollbarKeyDown}
						onlostpointercapture={(event) => {
							handleTrackScrollbarPointerRelease(event);
						}}
					>
						<div
							class="nimble-ct__scrollbar-thumb"
							style={`width: ${trackScrollbarMetrics.thumbWidthPx}px; --nimble-ct-scrollbar-thumb-left: ${trackScrollbarMetrics.thumbLeftPx}px;`}
						></div>
					</div>
				{/if}
			</div>

			{#if game.user}
				<div class="nimble-ct__controls faded-ui" aria-label="Combat controls right">
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Start Combat"
							data-tooltip="Start Combat"
							data-tooltip-direction="RIGHT"
							style={combatStarted ? 'display: none;' : ''}
							onclick={(event) => handleControlAction(event, 'start-combat')}
							><i class="fa-solid fa-play"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="End Combat"
							data-tooltip="End Combat"
							data-tooltip-direction="RIGHT"
							onclick={(event) => handleControlAction(event, 'end-combat')}
							><i class="fa-solid fa-ban"></i></button
						>
					{/if}
					<button
						class="nimble-ct__icon-button"
						aria-label="Combat Settings"
						data-tooltip="Combat Settings"
						data-tooltip-direction="RIGHT"
						onclick={(event) => handleControlAction(event, 'configure')}
						><i class="fa-solid fa-gear"></i></button
					>
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Next Turn"
							data-tooltip="Next Turn"
							data-tooltip-direction="RIGHT"
							onclick={(event) => handleControlAction(event, 'next-turn')}
							><i class="fa-solid fa-chevron-right"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Next Round"
							data-tooltip="Next Round"
							data-tooltip-direction="RIGHT"
							onclick={(event) => handleControlAction(event, 'next-round')}
							><i class="fa-solid fa-chevrons-right"></i></button
						>
					{/if}
				</div>
			{/if}
		</div>
	</section>
{/if}

<style lang="scss">
	:global(body.nimble-ct--track-hover) {
		cursor: grab;
	}
	:global(body.nimble-ct--track-hover canvas) {
		cursor: grab !important;
	}

	.nimble-ct-shell {
		--nimble-ct-action-color: var(--nimble-ct-action-die-color, #ffffff);
		--nimble-ct-action-color-resolved: var(--nimble-ct-action-color);
		--nimble-ct-reaction-color-resolved: var(--nimble-ct-reaction-color, #4fc3f7);
		--nimble-ct-action-box-bg: color-mix(in srgb, hsl(225 27% 9%) 84%, black 16%);
		--nimble-ct-action-box-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 72%,
			white 28%
		);
		--nimble-ct-action-box-glow: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 26%,
			transparent
		);
		--nimble-ct-action-adjust-bg: color-mix(in srgb, hsl(226 26% 10%) 86%, black 14%);
		--nimble-ct-action-adjust-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 74%,
			white 26%
		);
		--nimble-ct-action-text-shadow: 0 0 0.18rem color-mix(in srgb, black 70%, transparent);
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		width: 100vw;
		display: flex;
		justify-content: center;
		z-index: 30;
		pointer-events: none;
		overflow: visible;
	}
	.nimble-ct__width-preview {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 6;
	}
	.nimble-ct__width-preview-track {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: min(100vw, var(--nimble-ct-width-preview-max));
		transform: translateX(-50%);
	}
	.nimble-ct__width-preview-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 4px;
		opacity: 0.9;
	}
	.nimble-ct__width-preview-svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		filter: drop-shadow(0 0 0.26rem color-mix(in srgb, hsl(206 92% 58%) 95%, transparent))
			drop-shadow(0 0 0.6rem color-mix(in srgb, hsl(211 94% 56%) 88%, transparent));
	}
	.nimble-ct__width-preview-stroke {
		stroke: color-mix(in srgb, white 92%, hsl(0 0% 78%) 8%);
		stroke-width: 2.4;
		stroke-dasharray: 6 10;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.nimble-ct__width-preview-line--left {
		left: 0;
	}
	.nimble-ct__width-preview-line--right {
		right: 0;
	}
	:global(.theme-light) .nimble-ct-shell {
		--nimble-ct-action-color-resolved: hsl(220 36% 22%);
		--nimble-ct-action-box-bg: color-mix(in srgb, white 78%, var(--nimble-ct-action-color) 22%);
		--nimble-ct-action-box-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color) 72%,
			hsl(219 28% 42%) 28%
		);
		--nimble-ct-action-box-glow: color-mix(in srgb, var(--nimble-ct-action-color) 32%, transparent);
		--nimble-ct-action-adjust-bg: color-mix(in srgb, white 70%, var(--nimble-ct-action-color) 30%);
		--nimble-ct-action-adjust-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color) 76%,
			hsl(219 28% 42%) 24%
		);
		--nimble-ct-action-text-shadow: 0 0 0 transparent;
	}
	.nimble-ct {
		--nimble-ct-hover-hitbox-inline: 0.45rem;
		--nimble-ct-control-hover-bridge: 0.8rem;
		--nimble-ct-control-hover-bleed: 0.34rem;
		position: relative;
		z-index: 1;
		pointer-events: none;
		display: grid;
		grid-template-columns: auto auto auto;
		gap: 0.2rem;
		align-items: start;
		justify-content: center;
		width: fit-content;
		max-width: calc(var(--nimble-ct-track-max-width) + var(--nimble-ct-shell-extra-width));
		/* Extend hover/focus activation zone slightly past side control bars. */
		padding-inline: var(--nimble-ct-hover-hitbox-inline);
		margin-inline: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
		overflow: visible;
	}
	.nimble-ct__controls {
		position: relative;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		opacity: var(--ui-fade-opacity, 1);
		visibility: visible;
		transition: opacity var(--ui-fade-delay, 0s) var(--ui-fade-duration, 100ms);
	}
	.nimble-ct__controls:hover,
	.nimble-ct__controls:focus-within {
		opacity: 1;
		transition: opacity var(--ui-fade-duration, 100ms);
	}
	.nimble-ct__controls::before,
	.nimble-ct__controls::after {
		content: '';
		position: absolute;
		top: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
		bottom: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
		pointer-events: none;
	}
	.nimble-ct__controls:first-child::before {
		right: calc(var(--nimble-ct-control-hover-bridge) * -1);
		width: var(--nimble-ct-control-hover-bridge);
	}
	.nimble-ct__controls:first-child::after {
		left: calc(var(--nimble-ct-control-hover-bleed) * -1);
		width: var(--nimble-ct-control-hover-bleed);
	}
	.nimble-ct__controls:last-child::before {
		left: calc(var(--nimble-ct-control-hover-bridge) * -1);
		width: var(--nimble-ct-control-hover-bridge);
	}
	.nimble-ct__controls:last-child::after {
		right: calc(var(--nimble-ct-control-hover-bleed) * -1);
		width: var(--nimble-ct-control-hover-bleed);
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls {
		pointer-events: all;
		opacity: 1;
		visibility: visible;
		transition: opacity var(--ui-fade-duration, 100ms);
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls::before,
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls::after {
		pointer-events: auto;
	}
	.nimble-ct__icon-button {
		width: 1.55rem;
		height: 1.55rem;
		margin: 0;
		padding: 0;
		font-size: 0.78rem;
		color: hsl(0 0% 93%);
		background: color-mix(in srgb, hsl(226 17% 16%) 92%, transparent);
		border: 1px solid color-mix(in srgb, hsl(38 24% 58%) 62%, transparent);
		border-radius: 0.2rem;
		cursor: pointer;
	}
	.nimble-ct__controls .nimble-ct__icon-button {
		pointer-events: auto;
		visibility: visible;
	}
	.nimble-ct__icon-button:hover,
	.nimble-ct__icon-button:focus-visible {
		color: hsl(36 92% 86%);
		border-color: color-mix(in srgb, hsl(36 90% 84%) 75%, white);
		background: color-mix(in srgb, hsl(225 16% 23%) 90%, transparent);
	}
	.nimble-ct__icon-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ct__viewport {
		--nimble-ct-non-player-hp-bar-height: calc(1.18rem * var(--nimble-ct-card-scale, 1));
		position: relative;
		width: fit-content;
		max-width: var(--nimble-ct-track-max-width);
		min-width: 0;
		pointer-events: none;
		overflow: visible;
	}
	.nimble-ct__track {
		position: relative;
		pointer-events: none;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 0.28rem;
		margin: 0;
		padding: 0 0.45rem 2rem;
		list-style: none;
		width: fit-content;
		max-width: var(--nimble-ct-track-max-width);
		min-width: 0;
		overflow-x: auto;
		overflow-y: visible;
		scrollbar-width: none;
	}
	.nimble-ct__track[data-drag-source-key]:not([data-drag-source-key='']) {
		pointer-events: auto;
	}
	.nimble-ct__track::-webkit-scrollbar {
		height: 0;
	}
	.nimble-ct__track::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, hsl(0 0% 93%) 38%, transparent);
		border-radius: 999px;
	}
	.nimble-ct__track::-webkit-scrollbar-track {
		background: transparent;
	}
	.nimble-ct__virtual-spacer {
		flex: 0 0 auto;
		height: 0.1rem;
		pointer-events: none;
	}
	.nimble-ct__expanded-monster-group-bar {
		position: absolute;
		top: 0;
		height: 0.3rem;
		box-sizing: border-box;
		background: #8f0f0f;
		border-radius: 0 0 0.18rem 0.18rem;
		pointer-events: none;
		z-index: 4;
	}
	.nimble-ct__round-separator,
	.nimble-ct__dead {
		pointer-events: auto;
	}
	.nimble-ct__portrait-card {
		pointer-events: auto;
	}
	.nimble-ct__scrollbar {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) + 0.34rem);
		height: 0.7rem;
		display: flex;
		align-items: center;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 120ms ease,
			visibility 0s linear 120ms;
		z-index: 0;
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__scrollbar {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transition: opacity 120ms ease;
	}
	.nimble-ct__scrollbar::before {
		content: '';
		display: block;
		width: 100%;
		height: 0.24rem;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(226 18% 14%) 78%, transparent);
		box-shadow: inset 0 0 0.16rem color-mix(in srgb, black 44%, transparent);
	}
	.nimble-ct__scrollbar-thumb {
		position: absolute;
		left: 0;
		top: 50%;
		height: 0.3rem;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(0 0% 93%) 54%, transparent);
		box-shadow:
			0 0 0.18rem color-mix(in srgb, hsl(0 0% 100%) 18%, transparent),
			0 0 0.3rem color-mix(in srgb, black 28%, transparent);
		transform: translate(var(--nimble-ct-scrollbar-thumb-left, 0), -50%);
		will-change: transform;
	}
	.nimble-ct__scrollbar-thumb::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(0 0% 100%) 30%, transparent) 0%,
			color-mix(in srgb, hsl(0 0% 100%) 10%, transparent) 100%
		);
	}
	.nimble-ct__portrait {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(0 0% 96%) 38%, transparent);
		--nimble-ct-outline-glow-color: transparent;
		position: relative;
		flex: 0 0 auto;
		width: calc(6.25rem * var(--nimble-ct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1));
		border: 1px solid color-mix(in srgb, hsl(0 0% 96%) 38%, transparent);
		border-top-width: 0;
		border-radius: 0 0 0.36rem 0.36rem;
		overflow: visible;
		background: color-mix(in srgb, hsl(226 26% 8%) 90%, transparent);
		transition:
			width 140ms ease,
			height 140ms ease,
			margin 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease,
			opacity 140ms ease;
	}
	.nimble-ct__track[data-drag-source-key]:not([data-drag-source-key='']) .nimble-ct__portrait {
		transition:
			width 140ms ease,
			height 140ms ease,
			margin 0ms linear,
			border-color 140ms ease,
			box-shadow 140ms ease,
			opacity 140ms ease;
	}
	.nimble-ct__portrait-card {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 2;
		overflow: hidden;
		border-radius: 0 0 0.36rem 0.36rem;
	}
	.nimble-ct__portrait--outline-player {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(212 92% 72%) 82%, white 18%);
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(212 92% 62%) 26%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: none;
	}
	.nimble-ct__portrait--outline-monster {
		--nimble-ct-outline-border-color: #c81414;
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(355 94% 34%) 36%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: none;
	}
	.nimble-ct__portrait--outline-friendly {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(136 68% 62%) 78%, white 22%);
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(136 68% 48%) 24%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: none;
	}
	.nimble-ct__portrait--resource-drawer {
		--nimble-ct-resource-drawer-row-count: 1;
		--nimble-ct-resource-drawer-body-base-height: calc(2.56rem * var(--nimble-ct-card-scale, 1));
		--nimble-ct-resource-drawer-extra-row-height: calc(1.04rem * var(--nimble-ct-card-scale, 1));
		--nimble-ct-resource-drawer-name-height: calc(2rem * var(--nimble-ct-card-scale, 1));
		--nimble-ct-resource-drawer-height: calc(
			var(--nimble-ct-resource-drawer-body-base-height) +
				(
					(var(--nimble-ct-resource-drawer-row-count) - 1) *
						var(--nimble-ct-resource-drawer-extra-row-height)
				) +
				var(--nimble-ct-resource-drawer-name-height)
		);
		--nimble-ct-resource-row-gap: clamp(
			0.12rem,
			calc(0.18rem * var(--nimble-ct-card-scale, 1)),
			0.22rem
		);
		--nimble-ct-drawer-button-min-height: clamp(
			0.96rem,
			calc(1.02rem * var(--nimble-ct-card-scale, 1)),
			1.4rem
		);
		--nimble-ct-drawer-button-pad-y: clamp(
			0.1rem,
			calc(0.14rem * var(--nimble-ct-card-scale, 1)),
			0.18rem
		);
		--nimble-ct-drawer-button-pad-x: clamp(
			0.14rem,
			calc(0.2rem * var(--nimble-ct-card-scale, 1)),
			0.28rem
		);
		--nimble-ct-drawer-icon-size: clamp(
			0.56rem,
			calc(0.72rem * var(--nimble-ct-card-scale, 1)),
			0.86rem
		);
		--nimble-ct-player-resource-bar-min-height: clamp(
			0.72rem,
			calc(0.82rem * var(--nimble-ct-card-scale, 1)),
			1.14rem
		);
		--nimble-ct-player-resource-bar-font-size: clamp(
			0.5rem,
			calc(0.56rem * var(--nimble-ct-card-scale, 1)),
			0.78rem
		);
		--nimble-ct-player-resource-bar-icon-size: clamp(
			0.54rem,
			calc(0.62rem * var(--nimble-ct-card-scale, 1)),
			0.84rem
		);
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-resource-drawer-height));
		transition: height 180ms ease;
	}
	.nimble-ct__portrait--name-drawer {
		--nimble-ct-name-drawer-height: calc(2.6rem * var(--nimble-ct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-name-drawer-height));
	}
	.nimble-ct__portrait--non-player-hp-bar {
		height: calc(
			9.4rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-non-player-hp-bar-height)
		);
	}
	.nimble-ct__portrait--resource-drawer,
	.nimble-ct__portrait--name-drawer,
	.nimble-ct__portrait--non-player-hp-bar {
		overflow: visible;
		background: transparent;
		border-color: transparent;
		border-radius: 0;
		box-shadow: none;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active {
		height: calc(
			11.2rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-resource-drawer-height)
		);
	}
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active {
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-name-drawer-height));
	}
	.nimble-ct__portrait--non-player-hp-bar.nimble-ct__portrait--active {
		height: calc(
			11.2rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-non-player-hp-bar-height)
		);
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active,
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active,
	.nimble-ct__portrait--non-player-hp-bar.nimble-ct__portrait--active {
		border-color: transparent;
		box-shadow: none;
	}
	.nimble-ct__portrait--resource-drawer .nimble-ct__portrait-card,
	.nimble-ct__portrait--name-drawer .nimble-ct__portrait-card,
	.nimble-ct__portrait--non-player-hp-bar .nimble-ct__portrait-card {
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1));
		overflow: hidden;
		border: 1px solid var(--nimble-ct-outline-border-color);
		border-top-width: 0;
		border-radius: 0 0 0.36rem 0.36rem;
		background: color-mix(in srgb, hsl(226 26% 8%) 90%, transparent);
		transition:
			height 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active .nimble-ct__portrait-card,
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active .nimble-ct__portrait-card,
	.nimble-ct__portrait--non-player-hp-bar.nimble-ct__portrait--active .nimble-ct__portrait-card {
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1));
		border-color: color-mix(in srgb, var(--nimble-ct-outline-border-color) 84%, white 16%);
		box-shadow: none;
	}
	.nimble-ct__portrait--outline-monster.nimble-ct__portrait--active .nimble-ct__portrait-card {
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: none;
	}
	.nimble-ct__portrait--draggable .nimble-ct__drag-handle {
		cursor: grab;
	}
	.nimble-ct__portrait--draggable .nimble-ct__drag-handle:active {
		cursor: grabbing;
	}
	.nimble-ct__portrait--preview-gap-before {
		margin-inline-start: 1.15rem;
	}
	.nimble-ct__portrait--preview-gap-after {
		margin-inline-end: 1.15rem;
	}
	.nimble-ct__portrait--active {
		width: calc(7.5rem * var(--nimble-ct-card-scale, 1));
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1));
		border-color: color-mix(in srgb, hsl(0 0% 96%) 68%, transparent);
		box-shadow: none;
	}
	.nimble-ct__portrait--dead {
		opacity: 0.46;
	}
	.nimble-ct__portrait--dead .nimble-ct__image {
		filter: grayscale(1) contrast(1.1);
	}
	.nimble-ct__resource-drawer-stack {
		position: absolute;
		left: 50%;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) - 0.9rem);
		z-index: 1;
		width: calc(100% - 0.72rem);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: translate(-50%, -0.82rem) scaleY(0.93);
		transform-origin: top center;
		transition:
			top 180ms ease,
			width 180ms ease,
			opacity 150ms ease,
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 200ms;
	}
	.nimble-ct__resource-drawer {
		position: relative;
		width: 100%;
		padding: clamp(1.02rem, calc(1.18rem * var(--nimble-ct-card-scale, 1)), 1.7rem)
			clamp(0.28rem, calc(0.38rem * var(--nimble-ct-card-scale, 1)), 0.54rem)
			clamp(0.26rem, calc(0.34rem * var(--nimble-ct-card-scale, 1)), 0.48rem);
		display: flex;
		flex-direction: column;
		gap: var(--nimble-ct-resource-row-gap);
		border: 1px solid var(--nimble-ct-outline-border-color);
		border-radius: 0 0 0.44rem 0.44rem;
		pointer-events: none;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(224 38% 14%) 94%, black 6%) 0%,
			color-mix(in srgb, hsl(227 28% 10%) 96%, black 4%) 100%
		);
		box-shadow:
			0 0 0.78rem color-mix(in srgb, hsl(42 96% 72%) 34%, transparent),
			0 0.28rem 0.9rem color-mix(in srgb, hsl(228 40% 4%) 48%, transparent),
			inset 0 0 0.48rem color-mix(in srgb, hsl(41 82% 64%) 12%, transparent);
		transition:
			padding 180ms ease,
			gap 180ms ease,
			border-radius 180ms ease,
			box-shadow 180ms ease;
	}
	.nimble-ct-shell--card-size-preview-active .nimble-ct__portrait,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__portrait-card,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__resource-drawer-stack,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__resource-drawer,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__resource-row--reactions,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__player-resource-bar,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__player-resource-bar-text,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__player-resource-bar-text i,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__player-name-drawer,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__drawer-cell,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__drawer-cell i,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__non-player-footer-stack,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__non-player-hp-bar,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__non-player-hp-bar-text,
	.nimble-ct-shell--card-size-preview-active .nimble-ct__name-drawer-stack {
		transition: none !important;
	}
	.nimble-ct__resource-row {
		width: 100%;
	}
	.nimble-ct__resource-row--reactions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nimble-ct-resource-row-gap);
		transition: gap 180ms ease;
	}
	.nimble-ct__resource-row--bar {
		display: flex;
	}
	.nimble-ct__player-resource-bar {
		position: relative;
		width: 100%;
		min-height: var(--nimble-ct-player-resource-bar-min-height);
		padding-inline: clamp(0.26rem, calc(0.34rem * var(--nimble-ct-card-scale, 1)), 0.46rem);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background-color: var(--nimble-hp-bar-background, hsl(226 26% 8% / 0.88));
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41 18% 54%);
		border-radius: 0.28rem;
		box-shadow: 0 0.12rem 0.32rem color-mix(in srgb, black 24%, transparent);
		transition:
			min-height 180ms ease,
			padding 180ms ease,
			border-radius 180ms ease,
			box-shadow 180ms ease;
	}
	.nimble-ct__player-resource-bar::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--nimble-ct-player-resource-bar-fill);
		box-shadow: 0 0 0.34rem color-mix(in srgb, black 28%, transparent);
		transition: width 0.2s ease-in-out;
	}
	.nimble-ct__player-resource-bar--green::before {
		background: linear-gradient(to right, hsl(138 47% 20%) 0%, hsl(139 47% 44%) 100%);
	}
	.nimble-ct__player-resource-bar--yellow::before {
		background: linear-gradient(to right, hsl(42 84% 24%) 0%, hsl(45 86% 54%) 100%);
	}
	.nimble-ct__player-resource-bar--red::before,
	.nimble-ct__player-resource-bar--wounds::before {
		background: linear-gradient(to right, hsl(0 47% 20%) 0%, hsl(0 47% 44%) 100%);
	}
	.nimble-ct__player-resource-bar--unknown::before {
		background: linear-gradient(to right, hsl(218 18% 20%) 0%, hsl(220 16% 38%) 100%);
	}
	.nimble-ct__player-resource-bar-text {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.14rem, calc(0.22rem * var(--nimble-ct-card-scale, 1)), 0.28rem);
		font-size: var(--nimble-ct-player-resource-bar-font-size);
		font-weight: 700;
		line-height: 1;
		color: #fff;
		text-shadow: 0 0 0.18rem color-mix(in srgb, black 70%, transparent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		transition:
			gap 180ms ease,
			font-size 180ms ease;
	}
	.nimble-ct__player-resource-bar-text i {
		font-size: var(--nimble-ct-player-resource-bar-icon-size);
		line-height: 1;
		transition: font-size 180ms ease;
	}
	.nimble-ct__player-name-drawer {
		width: calc(100% - 0.5rem);
		max-width: calc(100% - 0.5rem);
		padding: clamp(0.28rem, calc(0.35rem * var(--nimble-ct-card-scale, 1)), 0.48rem)
			clamp(0.48rem, calc(0.7rem * var(--nimble-ct-card-scale, 1)), 0.86rem);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: clamp(0.62rem, calc(0.74rem * var(--nimble-ct-card-scale, 1)), 1rem);
		font-weight: 700;
		line-height: 1.05;
		color: hsl(0 0% 95%);
		text-shadow: 0 0 0.32rem color-mix(in srgb, black 75%, transparent);
		background: color-mix(in srgb, hsl(228 22% 10%) 94%, transparent);
		border: 1px solid color-mix(in srgb, hsl(38 26% 59%) 55%, transparent);
		border-radius: 0.44rem;
		box-shadow:
			0 0 0.48rem color-mix(in srgb, hsl(42 90% 66%) 20%, transparent),
			0 0.18rem 0.45rem color-mix(in srgb, black 42%, transparent);
		pointer-events: none;
		transition:
			width 180ms ease,
			max-width 180ms ease,
			padding 180ms ease,
			font-size 180ms ease,
			border-radius 180ms ease;
	}
	.nimble-ct__player-name-drawer-text {
		display: block;
		max-width: 100%;
		overflow: visible;
		text-overflow: clip;
		white-space: normal;
		overflow-wrap: anywhere;
		text-align: center;
		line-height: 1.12;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active
		.nimble-ct__resource-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) - 0.98rem);
	}
	.nimble-ct__non-player-footer-stack {
		position: absolute;
		left: 50%;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) + 0.04rem);
		z-index: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		transform: translateX(-50%);
	}
	.nimble-ct__portrait--active .nimble-ct__non-player-footer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) + 0.04rem);
	}
	.nimble-ct__non-player-hp-bar-wrap {
		width: 100%;
		display: flex;
		justify-content: center;
	}
	.nimble-ct__non-player-hp-bar {
		position: relative;
		width: calc(100% - 0.5rem);
		min-height: calc(0.62rem * var(--nimble-ct-card-scale, 1));
		padding-inline: 0.34rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background-color: var(--nimble-hp-bar-background, hsl(226 26% 8% / 0.88));
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41 18% 54%);
		border-radius: 0.28rem;
		box-shadow: 0 0.12rem 0.32rem color-mix(in srgb, black 24%, transparent);
	}
	.nimble-ct__non-player-hp-bar::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--nimble-ct-non-player-hp-bar-fill);
		box-shadow: 0 0 0.34rem color-mix(in srgb, black 28%, transparent);
		transition: width 0.2s ease-in-out;
	}
	.nimble-ct__non-player-hp-bar--green::before {
		background: linear-gradient(to right, hsl(138 47% 20%) 0%, hsl(139 47% 44%) 100%);
	}
	.nimble-ct__non-player-hp-bar--yellow::before {
		background: linear-gradient(to right, hsl(42 84% 24%) 0%, hsl(45 86% 54%) 100%);
	}
	.nimble-ct__non-player-hp-bar--red::before {
		background: linear-gradient(to right, hsl(0 47% 20%) 0%, hsl(0 47% 44%) 100%);
	}
	.nimble-ct__non-player-hp-bar--unknown::before {
		background: linear-gradient(to right, hsl(218 18% 20%) 0%, hsl(220 16% 38%) 100%);
	}
	.nimble-ct__non-player-hp-bar-text {
		position: relative;
		z-index: 1;
		font-size: calc(0.5rem * var(--nimble-ct-card-scale, 1));
		font-weight: 700;
		line-height: 1;
		color: #fff;
		text-shadow: 0 0 0.18rem color-mix(in srgb, black 70%, transparent);
		white-space: nowrap;
	}
	.nimble-ct__non-player-name-drawer-stack {
		width: 100%;
		display: flex;
		justify-content: center;
		margin-top: -0.04rem;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: translateY(-0.36rem) scaleY(0.95);
		transform-origin: top center;
		transition:
			opacity 150ms ease,
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 200ms;
	}
	.nimble-ct__name-drawer-stack {
		position: absolute;
		left: 50%;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) - 0.18rem);
		z-index: 1;
		width: 100%;
		display: flex;
		justify-content: center;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: translate(-50%, -0.46rem) scaleY(0.95);
		transform-origin: top center;
		transition:
			opacity 150ms ease,
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 200ms;
	}
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active .nimble-ct__name-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) - 0.22rem);
	}
	.nimble-ct__portrait--monster:not(.nimble-ct__portrait--non-player-hp-bar)
		.nimble-ct__name-drawer-stack {
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) + 0.08rem);
	}
	.nimble-ct__portrait--monster.nimble-ct__portrait--active:not(
			.nimble-ct__portrait--non-player-hp-bar
		)
		.nimble-ct__name-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) + 0.08rem);
	}
	.nimble-ct__portrait--resource-drawer:has(
			.nimble-ct__portrait-card:hover,
			.nimble-ct__portrait-card:focus-within,
			.nimble-ct__resource-drawer:hover,
			.nimble-ct__resource-drawer:focus-within
		)
		.nimble-ct__resource-drawer-stack {
		opacity: 1;
		visibility: visible;
		transform: translate(-50%, 0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct__portrait--resource-drawer:has(
			.nimble-ct__portrait-card:hover,
			.nimble-ct__portrait-card:focus-within,
			.nimble-ct__resource-drawer:hover,
			.nimble-ct__resource-drawer:focus-within
		)
		.nimble-ct__resource-drawer {
		pointer-events: auto;
	}
	.nimble-ct-shell--resource-drawer-pinned
		.nimble-ct__portrait--resource-drawer
		.nimble-ct__resource-drawer-stack {
		opacity: 1;
		visibility: visible;
		transform: translate(-50%, 0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct-shell--resource-drawer-pinned
		.nimble-ct__portrait--resource-drawer
		.nimble-ct__resource-drawer {
		pointer-events: auto;
	}
	.nimble-ct-shell--resource-drawer-pinned
		.nimble-ct__portrait--resource-drawer
		.nimble-ct__player-name-drawer {
		display: none;
	}
	.nimble-ct-shell--resource-drawer-pinned
		.nimble-ct__portrait--resource-drawer:has(
			.nimble-ct__portrait-card:hover,
			.nimble-ct__portrait-card:focus-within,
			.nimble-ct__resource-drawer:hover,
			.nimble-ct__resource-drawer:focus-within
		)
		.nimble-ct__player-name-drawer {
		display: inline-flex;
	}
	.nimble-ct__portrait--name-drawer:has(
			.nimble-ct__portrait-card:hover,
			.nimble-ct__portrait-card:focus-within,
			.nimble-ct__name-drawer-stack:hover,
			.nimble-ct__name-drawer-stack:focus-within
		)
		.nimble-ct__name-drawer-stack {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translate(-50%, 0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct__portrait--name-drawer:has(
			.nimble-ct__portrait-card:hover,
			.nimble-ct__portrait-card:focus-within,
			.nimble-ct__non-player-name-drawer-stack:hover,
			.nimble-ct__non-player-name-drawer-stack:focus-within
		)
		.nimble-ct__non-player-name-drawer-stack {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translateY(0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct__drawer-cell {
		min-height: var(--nimble-ct-drawer-button-min-height);
		padding: var(--nimble-ct-drawer-button-pad-y) var(--nimble-ct-drawer-button-pad-x);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.12rem, calc(0.2rem * var(--nimble-ct-card-scale, 1)), 0.24rem);
		font-size: clamp(0.5rem, calc(0.56rem * var(--nimble-ct-card-scale, 1)), 0.72rem);
		font-weight: 700;
		line-height: 1;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.24rem color-mix(in srgb, black 82%, transparent);
		border: 1px solid color-mix(in srgb, hsl(40 72% 72%) 34%, transparent);
		border-radius: 0.28rem;
		background: color-mix(in srgb, hsl(224 30% 17%) 88%, black 12%);
		font-variant-numeric: tabular-nums;
		box-sizing: border-box;
		transition:
			min-height 180ms ease,
			padding 180ms ease,
			gap 180ms ease,
			font-size 180ms ease,
			border-radius 180ms ease;
	}
	.nimble-ct__drawer-reaction-button {
		all: unset;
		width: 100%;
		min-height: var(--nimble-ct-drawer-button-min-height);
		padding: var(--nimble-ct-drawer-button-pad-y) var(--nimble-ct-drawer-button-pad-x);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.12rem, calc(0.18rem * var(--nimble-ct-card-scale, 1)), 0.22rem);
		border: 1px solid;
		border-radius: 0.28rem;
		font-variant-numeric: tabular-nums;
		box-sizing: border-box;
		cursor: pointer;
		transition:
			min-height 180ms ease,
			padding 180ms ease,
			gap 180ms ease,
			filter 120ms ease,
			transform 120ms ease,
			opacity 120ms ease,
			border-radius 180ms ease;
	}
	.nimble-ct__drawer-reaction-button:hover,
	.nimble-ct__drawer-reaction-button:focus-visible {
		filter: brightness(1.08);
		transform: translateY(-0.01rem);
	}
	.nimble-ct__drawer-reaction-button:disabled {
		cursor: default;
		filter: none;
		transform: none;
	}
	.nimble-ct__drawer-cell i {
		font-size: var(--nimble-ct-drawer-icon-size);
		line-height: 1;
		transition: font-size 180ms ease;
	}
	.nimble-ct__drawer-cell--left {
		justify-content: flex-start;
		padding-inline: 0.28rem 0.34rem;
		border-right-color: color-mix(in srgb, hsl(42 94% 72%) 58%, transparent);
	}
	.nimble-ct__drawer-cell--hp {
		justify-content: center;
		padding-inline: 0.34rem;
	}
	.nimble-ct__drawer-cell--wounds {
		justify-content: center;
		padding-inline: 0.34rem;
		border-color: hsl(2 92% 70%);
		background: hsl(0 78% 36%);
		box-shadow:
			0 0 0.42rem color-mix(in srgb, hsl(0 92% 56%) 34%, transparent),
			inset 0 0 0.36rem color-mix(in srgb, hsl(0 100% 92%) 8%, transparent);
	}
	.nimble-ct__drawer-cell--utility {
		color: color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 68%, white 32%);
		border-color: color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 78%, white 22%);
		background: color-mix(
			in srgb,
			var(--nimble-ct-reaction-color-resolved) 24%,
			hsl(214 58% 18%) 76%
		);
		box-shadow:
			0 0 0.34rem color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 22%, transparent),
			inset 0 0 0.28rem
				color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 10%, transparent);
	}
	.nimble-ct__drawer-cell--inactive {
		opacity: 0.48;
	}
	.nimble-ct__drawer-cell--hidden {
		visibility: hidden;
	}
	.nimble-ct__drawer-text {
		white-space: nowrap;
	}
	.nimble-ct__drawer-cell--hp .nimble-ct__drawer-text,
	.nimble-ct__drawer-cell--wounds .nimble-ct__drawer-text {
		font-size: 0.64rem;
		line-height: 1;
	}
	.nimble-ct__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
		pointer-events: none;
	}
	.nimble-ct__drag-handle {
		position: absolute;
		inset: 0 0 2.5rem;
		z-index: 2;
	}
	.nimble-ct__portrait--monster {
		display: block;
	}
	.nimble-ct__portrait--monster .nimble-ct__portrait-card {
		display: flex;
		align-items: center;
		justify-content: center;
		background:
			radial-gradient(
				circle at 50% 34%,
				color-mix(in srgb, hsl(48 92% 66%) 30%, transparent) 0%,
				transparent 62%
			),
			linear-gradient(
				165deg,
				color-mix(in srgb, hsl(228 45% 10%) 92%, black 8%) 0%,
				color-mix(in srgb, hsl(222 36% 8%) 92%, black 8%) 100%
			);
	}
	.nimble-ct__monster-stack-icon {
		position: relative;
		z-index: 1;
		width: 3.85rem;
		height: 3.85rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: hsl(44 96% 86%);
		background: color-mix(in srgb, hsl(224 44% 11%) 88%, black 12%);
		border: 1px solid color-mix(in srgb, hsl(44 82% 74%) 68%, white 12%);
		border-radius: 50%;
		box-shadow:
			0 0 0.9rem color-mix(in srgb, hsl(42 92% 66%) 34%, transparent),
			inset 0 0 0.7rem color-mix(in srgb, hsl(226 64% 6%) 78%, transparent);
		pointer-events: none;
	}
	.nimble-ct__monster-stack-icon i {
		font-size: 2rem;
		line-height: 1;
	}
	.nimble-ct__portrait--active .nimble-ct__monster-stack-icon {
		width: 4.35rem;
		height: 4.35rem;
	}
	.nimble-ct__portrait--active .nimble-ct__monster-stack-icon i {
		font-size: 2.25rem;
	}
	.nimble-ct__badge {
		position: absolute;
		top: 0.14rem;
		left: 0.16rem;
		min-width: 1.32rem;
		height: 0.92rem;
		padding-inline: 0.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.28rem color-mix(in srgb, black 80%, transparent);
		background: color-mix(in srgb, hsl(220 54% 16%) 75%, transparent);
		border-radius: 0.24rem;
		transition:
			box-shadow 140ms ease,
			border-color 140ms ease;
	}
	.nimble-ct__resource-chips {
		position: absolute;
		top: 0.16rem;
		right: 0.18rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.18rem;
		z-index: 3;
	}
	.nimble-ct__resource-chip {
		min-height: 0.86rem;
		padding: 0.08rem 0.24rem;
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		font-size: 0.53rem;
		font-weight: 700;
		line-height: 1;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.24rem color-mix(in srgb, black 82%, transparent);
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, hsl(216 34% 66%) 60%, white 12%);
		background: color-mix(in srgb, hsl(221 46% 15%) 90%, black 10%);
		white-space: nowrap;
	}
	.nimble-ct__resource-chip i {
		font-size: 0.52rem;
		line-height: 1;
	}
	.nimble-ct__resource-chip-text {
		font-variant-numeric: tabular-nums;
	}
	.nimble-ct__resource-chip--mana {
		border-color: color-mix(in srgb, hsl(205 90% 76%) 64%, white 12%);
		background: color-mix(in srgb, hsl(208 74% 24%) 88%, black 12%);
	}
	.nimble-ct__resource-chip--wounds {
		border-color: color-mix(in srgb, hsl(2 84% 74%) 64%, white 12%);
		background: color-mix(in srgb, hsl(0 66% 24%) 88%, black 12%);
	}
	.nimble-ct__resource-chip--utility {
		border-color: color-mix(in srgb, hsl(42 84% 76%) 60%, white 16%);
		background: color-mix(in srgb, hsl(44 42% 22%) 86%, black 14%);
	}
	.nimble-ct__resource-chip--inactive {
		opacity: 0.52;
	}
	.nimble-ct__initiative-roll {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 3.8rem;
		height: 3.8rem;
		margin: 0;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: hsl(36 94% 86%);
		background: color-mix(in srgb, hsl(230 24% 12%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(42 78% 72%) 75%, white 10%);
		border-radius: 50%;
		box-shadow: 0 0 0.55rem color-mix(in srgb, hsl(41 84% 66%) 46%, transparent);
		cursor: pointer;
		z-index: 4;
		transition:
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}
	.nimble-ct__initiative-roll:hover,
	.nimble-ct__initiative-roll:focus-visible {
		color: hsl(42 97% 91%);
		filter: brightness(1.08);
	}
	.nimble-ct__initiative-roll:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ct__remove-combatant {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.55rem;
		height: 1.55rem;
		margin: 0;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.78rem;
		color: hsl(0 0% 93%);
		background: color-mix(in srgb, hsl(226 17% 16%) 92%, transparent);
		border: 1px solid color-mix(in srgb, hsl(38 24% 58%) 62%, transparent);
		border-radius: 0.2rem;
		cursor: pointer;
		z-index: 5;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 120ms ease,
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease;
	}
	.nimble-ct__portrait:hover .nimble-ct__remove-combatant,
	.nimble-ct__portrait:focus-within .nimble-ct__remove-combatant {
		opacity: 1;
		pointer-events: all;
	}
	.nimble-ct__remove-combatant:hover,
	.nimble-ct__remove-combatant:focus-visible {
		color: hsl(36 92% 86%);
		border-color: color-mix(in srgb, hsl(36 90% 84%) 75%, white);
		background: color-mix(in srgb, hsl(225 16% 23%) 90%, transparent);
	}
	.nimble-ct__pips {
		position: absolute;
		inset-inline: clamp(0.12rem, calc(0.24rem * var(--nimble-ct-card-scale, 1)), 0.24rem);
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.1rem, calc(0.16rem * var(--nimble-ct-card-scale, 1)), 0.16rem);
		min-height: clamp(0.74rem, calc(0.9rem * var(--nimble-ct-card-scale, 1)), 0.9rem);
		padding: clamp(0.08rem, calc(0.14rem * var(--nimble-ct-card-scale, 1)), 0.14rem)
			clamp(0.12rem, calc(0.18rem * var(--nimble-ct-card-scale, 1)), 0.18rem)
			clamp(0.1rem, calc(0.18rem * var(--nimble-ct-card-scale, 1)), 0.18rem);
		font-size: clamp(0.48rem, calc(0.58rem * var(--nimble-ct-card-scale, 1)), 0.58rem);
		color: hsl(36 87% 84%);
		background: linear-gradient(
			to top,
			color-mix(in srgb, hsl(226 26% 8%) 88%, transparent) 0%,
			transparent 100%
		);
		z-index: 3;
		cursor: default;
	}
	.nimble-ct__pips i {
		font-size: 1.74rem;
		line-height: 1;
		filter: drop-shadow(0 0 0.12rem color-mix(in srgb, black 70%, transparent));
	}
	.nimble-ct__action-box-shell {
		--nimble-ct-action-control-scale: clamp(0.8, calc(var(--nimble-ct-card-scale, 1) / 1.08), 1);
		width: max-content;
		max-width: 100%;
		display: inline-flex;
		flex: 0 1 auto;
		align-items: center;
		justify-content: center;
		gap: clamp(0.08rem, calc(0.24rem * var(--nimble-ct-card-scale, 1)), 0.24rem);
		transform: scale(var(--nimble-ct-action-control-scale));
		transform-origin: center bottom;
	}
	.nimble-ct__action-box {
		flex: 1 1 auto;
		min-width: clamp(2.1rem, calc(3.1rem * var(--nimble-ct-card-scale, 1)), 3.1rem);
		max-width: 100%;
		height: clamp(1.08rem, calc(1.45rem * var(--nimble-ct-card-scale, 1)), 1.45rem);
		padding-inline: clamp(0.18rem, calc(0.42rem * var(--nimble-ct-card-scale, 1)), 0.42rem);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: clamp(0.18rem, calc(0.28rem * var(--nimble-ct-card-scale, 1)), 0.28rem);
		border: 1px solid var(--nimble-ct-action-box-border);
		background: var(--nimble-ct-action-box-bg);
		color: var(--nimble-ct-action-color-resolved);
		font-size: clamp(0.7rem, calc(0.88rem * var(--nimble-ct-card-scale, 1)), 0.88rem);
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		text-shadow: var(--nimble-ct-action-text-shadow);
		box-shadow: 0 0 0.36rem var(--nimble-ct-action-box-glow);
	}
	.nimble-ct__action-adjust {
		all: unset;
		flex: 0 0 auto;
		width: clamp(0.78rem, calc(1.18rem * var(--nimble-ct-card-scale, 1)), 1.18rem);
		height: clamp(0.84rem, calc(1.1rem * var(--nimble-ct-card-scale, 1)), 1.1rem);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: clamp(0.16rem, calc(0.22rem * var(--nimble-ct-card-scale, 1)), 0.22rem);
		border: 1px solid var(--nimble-ct-action-adjust-border);
		background: var(--nimble-ct-action-adjust-bg);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--nimble-ct-action-adjust-border) 58%, transparent),
			inset 0 0 0 1px color-mix(in srgb, white 10%, transparent);
		color: var(--nimble-ct-action-color-resolved);
		font-size: clamp(0.24rem, calc(0.28rem * var(--nimble-ct-card-scale, 1)), 0.28rem);
		line-height: 1;
		cursor: pointer;
		transition:
			opacity 110ms ease,
			transform 110ms ease,
			filter 110ms ease;
	}
	.nimble-ct__action-adjust:hover,
	.nimble-ct__action-adjust:focus-visible {
		filter: brightness(1.12);
	}
	.nimble-ct__action-adjust i {
		font-size: clamp(0.48rem, calc(0.6rem * var(--nimble-ct-card-scale, 1)), 0.6rem);
		line-height: 1;
	}
	.nimble-ct__action-adjust:disabled {
		cursor: default;
		opacity: 0.42;
	}
	:global(.theme-light) .nimble-ct__controls {
		background: transparent;
		box-shadow: none;
	}
	:global(.theme-light) .nimble-ct__icon-button {
		color: hsl(220 36% 22%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(40 22% 92%) 70%, hsl(219 18% 88%) 30%) 100%
		);
		border-color: color-mix(in srgb, hsl(38 36% 56%) 46%, hsl(216 24% 58%) 54%);
		box-shadow:
			0 0 0.18rem color-mix(in srgb, white 58%, transparent),
			inset 0 0 0.18rem color-mix(in srgb, hsl(42 50% 72%) 12%, transparent);
	}
	:global(.theme-light) .nimble-ct__icon-button:hover,
	:global(.theme-light) .nimble-ct__icon-button:focus-visible {
		color: hsl(34 84% 24%);
		border-color: color-mix(in srgb, hsl(38 76% 56%) 58%, hsl(217 26% 54%) 42%);
		background: color-mix(in srgb, white 92%, hsl(42 26% 88%) 8%);
	}
	:global(.theme-light) .nimble-ct__initiative-roll {
		color: hsl(36 82% 28%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(42 30% 90%) 72%, hsl(218 18% 86%) 28%) 100%
		);
		border-color: color-mix(in srgb, hsl(41 70% 58%) 62%, hsl(216 24% 58%) 38%);
		box-shadow:
			0 0 0.48rem color-mix(in srgb, hsl(41 82% 58%) 20%, transparent),
			inset 0 0 0.3rem color-mix(in srgb, hsl(42 70% 72%) 10%, transparent);
		filter: none;
		transition:
			color 120ms ease,
			box-shadow 120ms ease;
	}
	:global(.theme-light) .nimble-ct__initiative-roll:hover,
	:global(.theme-light) .nimble-ct__initiative-roll:focus-visible {
		color: hsl(34 88% 22%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(42 30% 90%) 72%, hsl(218 18% 86%) 28%) 100%
		);
		border-color: color-mix(in srgb, hsl(41 70% 58%) 62%, hsl(216 24% 58%) 38%);
		box-shadow:
			0 0 0.58rem color-mix(in srgb, hsl(41 82% 58%) 24%, transparent),
			inset 0 0 0.34rem color-mix(in srgb, hsl(42 70% 72%) 12%, transparent);
		filter: none !important;
	}
	:global(.theme-light) .nimble-ct__resource-drawer {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 92%, hsl(42 44% 84%) 8%) 0%,
			color-mix(in srgb, hsl(42 30% 91%) 72%, hsl(214 26% 87%) 28%) 100%
		);
		box-shadow:
			0 0 0.72rem color-mix(in srgb, hsl(42 84% 56%) 18%, transparent),
			0 0.2rem 0.7rem color-mix(in srgb, hsl(220 22% 48%) 16%, transparent),
			inset 0 0 0.36rem color-mix(in srgb, hsl(41 76% 60%) 10%, transparent);
	}
	:global(.theme-light) .nimble-ct__player-name-drawer {
		color: hsl(220 30% 20%);
		text-shadow: none;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 92%, hsl(44 40% 84%) 8%) 0%,
			color-mix(in srgb, hsl(42 32% 90%) 78%, hsl(217 24% 86%) 22%) 100%
		);
		border-color: color-mix(in srgb, hsl(39 40% 54%) 55%, hsl(216 26% 64%) 45%);
		box-shadow:
			0 0 0.4rem color-mix(in srgb, hsl(42 80% 58%) 14%, transparent),
			0 0.16rem 0.32rem color-mix(in srgb, hsl(220 22% 46%) 14%, transparent);
	}
	:global(.theme-light) .nimble-ct__player-name-drawer-text,
	:global(.theme-light) .nimble-ct__player-resource-bar-text,
	:global(.theme-light) .nimble-ct__drawer-cell {
		color: hsl(220 30% 20%);
		text-shadow: none;
	}
	:global(.theme-light) .nimble-ct__player-resource-bar {
		background-color: white;
		border-color: color-mix(in srgb, hsl(39 40% 54%) 55%, hsl(216 26% 64%) 45%);
		box-shadow:
			0 0 0.22rem color-mix(in srgb, hsl(42 80% 58%) 10%, transparent),
			0 0.1rem 0.24rem color-mix(in srgb, hsl(220 22% 46%) 12%, transparent);
	}
	:global(.theme-light) .nimble-ct__player-resource-bar--green::before {
		background: linear-gradient(to right, hsl(126 52% 66%) 0%, hsl(132 46% 52%) 100%);
	}
	:global(.theme-light) .nimble-ct__player-resource-bar--yellow::before {
		background: linear-gradient(to right, hsl(45 86% 68%) 0%, hsl(43 88% 56%) 100%);
	}
	:global(.theme-light) .nimble-ct__player-resource-bar--red::before,
	:global(.theme-light) .nimble-ct__player-resource-bar--wounds::before {
		background: linear-gradient(to right, hsl(0 72% 58%) 0%, hsl(0 70% 48%) 100%);
	}
	:global(.theme-light) .nimble-ct__player-resource-bar--unknown::before {
		background: linear-gradient(to right, hsl(218 18% 72%) 0%, hsl(220 16% 58%) 100%);
	}
	:global(.theme-light) .nimble-ct__drawer-cell {
		border-color: color-mix(in srgb, hsl(42 46% 58%) 40%, hsl(217 18% 60%) 60%);
		background: color-mix(in srgb, white 78%, hsl(218 18% 86%) 22%);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--utility {
		color: color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 68%, hsl(214 42% 16%) 32%);
		border-color: color-mix(
			in srgb,
			var(--nimble-ct-reaction-color-resolved) 72%,
			hsl(214 20% 56%) 28%
		);
		background: color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 28%, white 72%);
		box-shadow:
			0 0 0.24rem color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 18%, transparent),
			inset 0 0 0.18rem
				color-mix(in srgb, var(--nimble-ct-reaction-color-resolved) 12%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--wounds {
		color: hsl(0 0% 98%);
		border-color: hsl(2 70% 56%);
		background: hsl(0 68% 50%);
		box-shadow:
			0 0 0.32rem color-mix(in srgb, hsl(0 78% 50%) 26%, transparent),
			inset 0 0 0.24rem color-mix(in srgb, hsl(0 100% 98%) 10%, transparent);
	}
	.nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
		opacity: 0;
		pointer-events: none;
		transform: translateY(0.08rem);
	}
	.nimble-ct__portrait:hover .nimble-ct__action-box-shell--editable .nimble-ct__action-adjust,
	.nimble-ct__portrait:focus-within
		.nimble-ct__action-box-shell--editable
		.nimble-ct__action-adjust,
	.nimble-ct__pips:hover .nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
		opacity: 1;
		pointer-events: all;
		transform: translateY(0);
	}
	.nimble-ct__end-turn-overlay {
		position: absolute;
		left: 50%;
		bottom: 2.2rem;
		min-width: 4.2rem;
		height: 1.3rem;
		padding: 0 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
		color: hsl(0 0% 96%);
		background: color-mix(in srgb, hsl(138 48% 28%) 92%, black 14%);
		border: 1px solid color-mix(in srgb, hsl(124 56% 66%) 78%, white 12%);
		border-radius: 0.24rem;
		box-shadow: 0 0 0.4rem color-mix(in srgb, hsl(124 56% 52%) 40%, transparent);
		opacity: 0;
		transform: translate(-50%, 0.2rem);
		transition:
			opacity 120ms ease,
			transform 120ms ease,
			filter 120ms ease;
		pointer-events: none;
		cursor: pointer;
		z-index: 4;
	}
	.nimble-ct__portrait--active:hover .nimble-ct__end-turn-overlay,
	.nimble-ct__portrait--active:focus-within .nimble-ct__end-turn-overlay {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: all;
	}
	.nimble-ct__end-turn-overlay:hover,
	.nimble-ct__end-turn-overlay:focus-visible {
		filter: brightness(1.12);
	}
	.nimble-ct__dead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: calc(9rem * var(--nimble-ct-card-scale, 1));
		padding-inline: 0.26rem;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(0 0% 79%);
	}
	.nimble-ct__empty-state {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(7.5rem * var(--nimble-ct-card-scale, 1));
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1));
		padding-inline: 0.5rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 0.36rem;
		background: var(--nimble-combat-tracker-background);
		font-size: calc(0.7rem * var(--nimble-ct-card-scale, 1));
		font-weight: 500;
		letter-spacing: 0.02em;
		text-align: center;
		color: var(--nimble-medium-text-color);
	}
	.nimble-ct__round-separator {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		height: 100%;
		opacity: 0.8;
		margin-inline: 0.1rem;
	}
	.nimble-ct__round-separator-line {
		width: 0;
		height: calc(8.4rem * var(--nimble-ct-card-scale, 1));
		border-left: 2px solid color-mix(in srgb, hsl(0 0% 100%) 75%, transparent);
		border-bottom-right-radius: 999px;
		border-bottom-left-radius: 999px;
		transition:
			height 140ms ease,
			border-color 140ms ease;
	}
	.nimble-ct__round-separator-round {
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		font-size: 1.04rem;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.32rem color-mix(in srgb, black 75%, transparent);
		backface-visibility: hidden;
		transform: translateZ(0);
		transition:
			font-size 140ms ease,
			gap 140ms ease;
	}
	@media (max-width: 900px) {
		.nimble-ct__icon-button {
			width: 1.36rem;
			height: 1.36rem;
			font-size: 0.7rem;
		}
		.nimble-ct__portrait {
			width: calc(4.5rem * var(--nimble-ct-card-scale, 1));
			height: calc(6.7rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__portrait--active {
			width: calc(5.35rem * var(--nimble-ct-card-scale, 1));
			height: calc(8.05rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__round-separator-line {
			height: calc(6.1rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__round-separator-round {
			font-size: 0.84rem;
		}
	}
	@media (hover: none), (pointer: coarse) {
		.nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
			opacity: 1;
			pointer-events: all;
			transform: none;
		}
		.nimble-ct__controls {
			pointer-events: all;
			opacity: 1;
			visibility: visible;
			transition: none;
		}
		.nimble-ct__controls .nimble-ct__icon-button {
			pointer-events: all;
			visibility: visible;
		}
		.nimble-ct__track {
			scrollbar-width: thin;
		}
		.nimble-ct__track::-webkit-scrollbar {
			height: 0.44rem;
		}
	}
</style>

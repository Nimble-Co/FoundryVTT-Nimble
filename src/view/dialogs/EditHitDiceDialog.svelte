<script lang="ts">
	import { untrack } from 'svelte';
	import localize from '#utils/localize.js';
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type { NimbleClassItem } from '../../documents/item/class.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import { incrementDieSize } from '../../managers/HitDiceManager.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	interface BonusDieEntry {
		size: number;
		value: number;
		name: string;
	}

	const allDieSizes = [4, 6, 8, 10, 12, 20];

	function submit() {
		dialog.submit({ bonusDice: [...bonusDice] });
	}

	function getOrderedDieSizes(): number[] {
		// Class die first if available (use raw size for ordering)
		const ordered: number[] = [];
		if (rawClassDieSize) {
			ordered.push(rawClassDieSize);
		}

		// Then all other sizes lowest to highest, excluding class die
		allDieSizes
			.filter((s) => s !== rawClassDieSize)
			.sort((a, b) => a - b)
			.forEach((s) => ordered.push(s));

		return ordered;
	}

	function addBonusDie(rawSize: number) {
		// Store the RAW size; display will be incremented when shown
		const displaySize = incrementDieSize(rawSize, hitDiceSizeBonus);
		bonusDice = [...bonusDice, { size: rawSize, value: 1, name: `d${displaySize}` }];
	}

	function updateBonusDieValue(index: number, delta: number) {
		const newValue = bonusDice[index].value + delta;
		if (newValue <= 0) {
			// Remove the entry
			bonusDice = bonusDice.filter((_, i) => i !== index);
		} else {
			bonusDice[index].value = newValue;
		}
	}

	function updateBonusDieName(index: number, name: string) {
		bonusDice[index].name = name;
	}

	let { document: actor, dialog }: Props = $props();

	const classes = $derived(
		actor.items.filter((i: Item) => i.type === 'class') as NimbleClassItem[],
	);
	// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
	const hitDiceSizeBonus = $derived(
		(actor.system.attributes as { hitDiceSizeBonus?: number }).hitDiceSizeBonus ?? 0,
	);
	// Get contributions that make up the hit dice size bonus
	const hitDiceSizeBonusContributions = $derived(
		((
			actor.system.attributes as {
				hitDiceSizeBonusContributions?: Array<{ label: string; value: number }>;
			}
		).hitDiceSizeBonusContributions ?? []) as Array<{ label: string; value: number }>,
	);
	// Raw class die size (for storage and data operations)
	const rawClassDieSize = $derived(classes.length > 0 ? classes[0].system.hitDieSize : null);

	// Initialize bonus dice from existing data
	let bonusDice = $state<BonusDieEntry[]>(
		untrack(
			() => actor.system.attributes.bonusHitDice?.map((d: BonusDieEntry) => ({ ...d })) ?? [],
		),
	);

	let dropdownRef: HTMLElement | null = $state(null);

	function positionDropdown(event: ToggleEvent) {
		if (event.newState === 'open' && dropdownRef) {
			const button = document.querySelector(`[popovertarget="${dropdownRef.id}"]`) as HTMLElement;
			if (button) {
				const rect = button.getBoundingClientRect();
				dropdownRef.style.position = 'fixed';
				dropdownRef.style.top = `${rect.bottom + 4}px`;
				dropdownRef.style.left = `${rect.left + rect.width / 2}px`;
				dropdownRef.style.transform = 'translateX(-50%)';
				dropdownRef.style.margin = '0';
			}
		}
	}

	function selectDieSize(rawSize: number) {
		addBonusDie(rawSize);
		dropdownRef?.hidePopover();
	}

	// Also close popover on scroll to prevent misalignment
	$effect(() => {
		const handleScroll = () => dropdownRef?.hidePopover();
		const body = document.querySelector('.nimble-sheet__body');
		body?.addEventListener('scroll', handleScroll);
		return () => body?.removeEventListener('scroll', handleScroll);
	});

	// Build current hit dice display with source info
	let currentHitDice = $derived.by(() => {
		const dice: {
			size: number;
			current: number;
			total: number;
			source: string;
			sourceType: 'class' | 'bonus' | 'rule';
		}[] = [];

		// Add from classes - show class's own contribution (classLevel/classLevel)
		// Apply hitDiceSizeBonus to get effective die size
		for (const cls of classes) {
			const size = incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus);
			const classLevel = cls.system.classLevel;
			dice.push({
				size,
				current: classLevel,
				total: classLevel,
				source: cls.name,
				sourceType: 'class',
			});
		}

		// Add bonus dice from user-added bonusHitDice array
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const entry of bonusDice) {
			dice.push({
				size: incrementDieSize(entry.size, hitDiceSizeBonus),
				current: entry.value,
				total: entry.value,
				source: entry.name,
				sourceType: 'bonus',
			});
		}

		// Add bonus dice from rules (hitDice[size].contributions)
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const [sizeStr, hitDieData] of Object.entries(actor.system.attributes.hitDice ?? {})) {
			const data = hitDieData as { contributions?: Array<{ label: string; value: number }> };
			const contributions = data.contributions ?? [];
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			for (const contribution of contributions) {
				dice.push({
					size,
					current: contribution.value,
					total: contribution.value,
					source: contribution.label,
					sourceType: 'rule',
				});
			}
		}

		return dice;
	});

	// let availableDieSizes = $derived(getOrderedDieSizes());

	// Get rule-based bonus dice for display in Bonus Hit Dice section
	// Apply hitDiceSizeBonus to increment these dice as well
	let ruleContributions = $derived.by(() => {
		const contributions: Array<{ size: number; value: number; label: string }> = [];
		for (const [sizeStr, hitDieData] of Object.entries(actor.system.attributes.hitDice ?? {})) {
			const data = hitDieData as { contributions?: Array<{ label: string; value: number }> };
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			for (const contribution of data.contributions ?? []) {
				contributions.push({
					size,
					value: contribution.value,
					label: contribution.label,
				});
			}
		}
		return contributions;
	});

	let totals = $derived.by(() => {
		let fromClasses = 0;
		let bonus = 0;
		let fromRules = 0;

		for (const cls of classes) {
			fromClasses += cls.system.classLevel ?? 0;
		}

		for (const entry of bonusDice) {
			bonus += entry.value;
		}

		// Include rule-based bonuses
		for (const [_sizeStr, hitDieData] of Object.entries(actor.system.attributes.hitDice ?? {})) {
			const data = hitDieData as { bonus?: number };
			fromRules += data.bonus ?? 0;
		}

		return { fromClasses, bonus, fromRules, max: fromClasses + bonus + fromRules };
	});
</script>

<div class="nimble-sheet__body" role="presentation">
	<!-- Hit Dice Size Increment Info -->
	{#if hitDiceSizeBonus > 0}
		<div class="hd-info-banner">
			<i class="hd-info-banner__icon fa-solid fa-arrow-up"></i>
			<div class="hd-info-banner__content">
				<span class="hd-info-banner__text">
					{game.i18n.format(CONFIG.NIMBLE.hitDice.hitDiceSizeIncreased, {
						steps: hitDiceSizeBonus.toString(),
					})}
				</span>
				{#if hitDiceSizeBonusContributions.length > 0}
					<span class="hd-info-banner__sources">
						{#each hitDiceSizeBonusContributions as contribution, i}
							{#if i > 0},
							{/if}
							{game.i18n.format(CONFIG.NIMBLE.hitDice.fromSource, { source: contribution.label })}
						{/each}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Current Hit Dice Overview -->
	<section class="hd-section">
		<header class="hd-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-dice-d20"></i>
				{CONFIG.NIMBLE.hitDice.currentHitDice}
			</h3>
		</header>

		<div class="hd-overview-grid">
			{#each currentHitDice as entry}
				<div class="hd-overview-card hd-overview-card--{entry.sourceType}">
					<div class="hd-overview-card__main">
						<span class="hd-overview-card__die">d{entry.size}</span>
						<span class="hd-overview-card__value">{entry.current}/{entry.total}</span>
					</div>
					<span class="hd-overview-card__source">{entry.source}</span>
				</div>
			{:else}
				<p class="hd-empty">{CONFIG.NIMBLE.hitDice.noHitDiceYet}</p>
			{/each}
		</div>
	</section>

	<!-- Bonus Hit Dice -->
	<section class="hd-section hd-section--bonus">
		<header class="hd-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-plus-circle"></i>
				{CONFIG.NIMBLE.hitDice.bonusHitDice}
			</h3>
			<span class="hd-subtitle">{CONFIG.NIMBLE.hitDice.bonusHitDiceHint}</span>
		</header>

		{#if ruleContributions.length === 0 && bonusDice.length === 0}
			<div class="hd-empty-state">
				<span class="hd-empty-state__text">{CONFIG.NIMBLE.hitDice.noBonusDice}</span>
				<button class="hd-add-btn" type="button" popovertarget="hd-die-dropdown">
					<i class="fa-solid fa-plus"></i>
					{CONFIG.NIMBLE.hitDice.addBonusDie}
				</button>
			</div>
		{:else}
			<div class="hd-dice-list">
				<!-- Rule-based bonus dice (non-editable) -->
				{#each ruleContributions as contribution}
					<div class="hd-die-card hd-die-card--readonly">
						<div class="hd-die-card__name-row">
							<span class="hd-die-card__name-label">{CONFIG.NIMBLE.hitDice.bonusDieName}</span>
							<span class="hd-die-card__name hd-die-card__name--readonly">{contribution.label}</span
							>
						</div>
						<div class="hd-die-card__bottom-row">
							<span class="hd-die-card__die">d{contribution.size}</span>
							<span class="hd-die-card__value">{contribution.value}</span>
						</div>
					</div>
				{/each}

				<!-- User-added bonus dice (editable) -->
				{#each bonusDice as entry, index}
					{@const displaySize = incrementDieSize(entry.size, hitDiceSizeBonus)}
					<div class="hd-die-card">
						<label class="hd-die-card__name-row">
							<span class="hd-die-card__name-label">{CONFIG.NIMBLE.hitDice.bonusDieName}</span>
							<input
								class="hd-die-card__name"
								type="text"
								value={entry.name}
								placeholder="d{displaySize}"
								onchange={(e) =>
									updateBonusDieName(index, e.currentTarget.value || `d${displaySize}`)}
							/>
						</label>
						<div class="hd-die-card__bottom-row">
							<span class="hd-die-card__die">d{displaySize}</span>
							<div class="hd-die-card__controls">
								<button
									class="hd-btn hd-btn--minus"
									type="button"
									onclick={() => updateBonusDieValue(index, -1)}
									aria-label={game.i18n.format('NIMBLE.hitDice.decreaseBonusDie', {
										size: displaySize.toString(),
									})}
								>
									<i class="fa-solid fa-minus"></i>
								</button>
								<span class="hd-die-card__value">{entry.value}</span>
								<button
									class="hd-btn hd-btn--plus"
									type="button"
									onclick={() => updateBonusDieValue(index, 1)}
									aria-label={game.i18n.format('NIMBLE.hitDice.increaseBonusDie', {
										size: displaySize.toString(),
									})}
								>
									<i class="fa-solid fa-plus"></i>
								</button>
							</div>
						</div>
					</div>
				{/each}

				<button
					class="hd-add-btn hd-add-btn--small"
					type="button"
					popovertarget="hd-die-dropdown"
					aria-label={CONFIG.NIMBLE.hitDice.addBonusDie}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</div>
		{/if}
	</section>

	<!-- Total -->
	<section class="hd-total">
		<span class="hd-total__label">{CONFIG.NIMBLE.hitDice.totalHitDice}</span>
		<span class="hd-total__value">{totals.max}</span>
	</section>

	<!-- Popover dropdown for die size selection -->
	<div
		id="hd-die-dropdown"
		popover
		class="hd-dropdown"
		bind:this={dropdownRef}
		ontoggle={positionDropdown}
	>
		{#each getOrderedDieSizes() as rawSize}
			{@const displaySize = incrementDieSize(rawSize, hitDiceSizeBonus)}
			<button
				class="hd-dropdown__item"
				class:hd-dropdown__item--class={rawSize === rawClassDieSize}
				type="button"
				onclick={() => selectDieSize(rawSize)}
			>
				d{displaySize}
				{#if rawSize === rawClassDieSize}
					<span class="hd-dropdown__badge">{localize('TYPES.Item.class')}</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}
		>{CONFIG.NIMBLE.hitDice.saveChanges}</button
	>
</footer>

<style lang="scss">
	.nimble-sheet__body {
		display: flex;
		flex-direction: column;
	}

	:global(.system-nimble .nimble-window) .nimble-sheet__body {
		gap: 10px;
		padding: 4px 12px 12px;
	}

	.hd-header {
		--nimble-heading-size: 0.688rem;
		--nimble-heading-weight: 900;
		--nimble-heading-color: var(--nimble-ui-ink-dim);
		--nimble-heading-gap: 8px;

		margin: 0 0 4px;

		.nimble-heading {
			padding-bottom: 5px;
			border-bottom: 1px solid var(--nimble-ui-soft);
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.1em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);

			i {
				display: none;
			}
		}
	}

	.hd-subtitle {
		display: block;
		margin-top: 4px;
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink-muted);
	}

	.hd-overview-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.hd-overview-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 4.5rem;
		padding: 5px 8px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		font-family: var(--nimble-primary-font);

		&--rule {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
		}

		&__main {
			display: flex;
			align-items: baseline;
			gap: 8px;
		}

		&__die {
			font-size: 0.875rem;
			font-weight: 900;
			color: color-mix(in srgb, var(--nimble-hit-dice-color) var(--nimble-ui-tone-mix), #000);
		}

		&__value {
			font-size: 1rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}

		&__source {
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);
		}
	}

	.hd-empty {
		margin: 0;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
	}

	.hd-empty-state {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		min-height: 34px;
		padding: 4px;

		&__text {
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
		}
	}

	.hd-add-btn,
	.hd-btn {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		margin: 0;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		background: none;
		box-shadow: none;
		font-family: var(--nimble-primary-font);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
		color: var(--nimble-ui-ink);
		cursor: pointer;
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

		&:hover:not(:disabled) {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
		}

		&:focus-visible {
			outline: 2px solid var(--nimble-ui-focus);
			outline-offset: 1px;
		}

		&:disabled {
			border-style: dashed;
			color: var(--nimble-ui-ink-muted);
			cursor: default;
		}

		i {
			font-size: 0.688rem;
		}
	}

	.hd-add-btn {
		gap: 7px;
		width: auto;
		height: 28px;
		padding: 0 10px;
		white-space: nowrap;

		&--small {
			width: 28px;
			padding: 0;
		}
	}

	.hd-btn {
		width: 26px;
		height: 26px;
		padding: 0;
	}

	.hd-dropdown {
		min-width: 5rem;
		padding: 2px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		background: var(--nimble-ui-raised);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--nimble-ui-ink) 25%, transparent);
		color: var(--nimble-ui-ink);
		overflow: hidden;
	}

	.hd-dropdown__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		height: 28px;
		margin: 0;
		padding: 0 8px;
		border: 0;
		border-radius: 2px;
		background: none;
		box-shadow: none;
		font-family: var(--nimble-primary-font);
		font-size: 0.75rem;
		font-weight: 700;
		text-align: left;
		color: var(--nimble-ui-ink);
		cursor: pointer;
		transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

		&:hover {
			background: var(--nimble-ui-hover);
		}

		&:focus-visible {
			outline: 2px solid var(--nimble-ui-focus);
			outline-offset: -2px;
		}
	}

	.hd-dropdown__badge {
		padding: 0 5px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		font: 800 0.656rem/16px var(--nimble-primary-font);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--nimble-ui-ink-muted);
	}

	.hd-dice-list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.hd-die-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 5px 8px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		font-family: var(--nimble-primary-font);

		&--readonly {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
		}

		&__name-row {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: text;
		}

		&__name-label {
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			white-space: nowrap;
			color: var(--nimble-ui-ink-dim);
		}

		&__name {
			flex: 1;
			min-width: 0;
			font-size: 0.813rem;
			color: var(--nimble-ui-ink);

			&--readonly {
				font-weight: 700;
			}
		}

		&__bottom-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}

		&__die {
			font-size: 0.875rem;
			font-weight: 900;
			white-space: nowrap;
			color: color-mix(in srgb, var(--nimble-hit-dice-color) var(--nimble-ui-tone-mix), #000);
		}

		&__controls {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		&__value {
			min-width: 1.25rem;
			font-size: 1rem;
			font-weight: 900;
			text-align: center;
			color: var(--nimble-ui-ink);
		}
	}

	.hd-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 6px;
		border-top: 1px solid var(--nimble-ui-soft);

		&__label {
			font-size: 0.75rem;
			font-weight: 900;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);
		}

		&__value {
			font-size: 1.15rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}
	}

	.hd-info-banner {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px;
		border-radius: 4px;
		background: var(--nimble-ui-soft);
		font-size: 0.75rem;
		color: var(--nimble-ui-ink);

		&__icon {
			flex-shrink: 0;
			margin-top: 2px;
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		&__text {
			font-weight: 600;
			color: var(--nimble-ui-ink);
		}

		&__sources {
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>

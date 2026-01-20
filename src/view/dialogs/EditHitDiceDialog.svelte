<script lang="ts">
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

	const classes = actor.items.filter((i: Item) => i.type === 'class') as NimbleClassItem[];
	// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
	const hitDiceSizeBonus =
		(actor.system.attributes as { hitDiceSizeBonus?: number }).hitDiceSizeBonus ?? 0;
	// Get contributions that make up the hit dice size bonus
	const hitDiceSizeBonusContributions = ((
		actor.system.attributes as {
			hitDiceSizeBonusContributions?: Array<{ label: string; value: number }>;
		}
	).hitDiceSizeBonusContributions ?? []) as Array<{ label: string; value: number }>;
	// Raw class die size (for storage and data operations)
	const rawClassDieSize = classes.length > 0 ? classes[0].system.hitDieSize : null;

	// Initialize bonus dice from existing data
	let bonusDice = $state<BonusDieEntry[]>(
		actor.system.attributes.bonusHitDice?.map((d: BonusDieEntry) => ({ ...d })) ?? [],
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
					<span class="hd-dropdown__badge">Class</span>
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
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.hd-section {
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
	}

	.hd-header {
		margin-bottom: 0.5rem;
	}

	.hd-subtitle {
		display: block;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		margin-top: 0.125rem;
		padding-left: 1.125rem;
	}

	.hd-overview-grid {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.hd-overview-card {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
		min-width: 4.5rem;

		&--rule {
			background: var(--nimble-rule-background-color);
			border-color: var(--nimble-rule-border-color);
		}

		&__main {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__die {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__value {
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__source {
			font-size: 0.625rem;
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.03em;
			margin-top: 0.125rem;
		}
	}

	.hd-empty {
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		font-style: italic;
		margin: 0;
	}

	.hd-empty-state {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-input-background-color);
		border: 1px dashed var(--nimble-card-border-color);
		border-radius: 6px;

		&__text {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}
	}

	.hd-add-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;

		&:hover:not(:disabled) {
			background: hsl(45, 50%, 85%);
			border-color: hsl(45, 50%, 50%);
			color: hsl(45, 50%, 20%);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&--small {
			padding: 0.375rem;
			width: 2rem;
			height: 2rem;
			justify-content: center;
		}
	}

	.hd-dropdown {
		min-width: 5rem;
		padding: 0;
		background: var(--nimble-box-background-color, hsl(48, 17%, 97%));
		border: 1px solid var(--nimble-card-border-color, hsla(41, 18%, 54%, 25%));
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
	}

	.hd-dropdown__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: var(--nimble-sm-text, 0.833rem);
		font-weight: 600;
		color: var(--nimble-dark-text-color, hsl(50, 14%, 9%));
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;

		&:hover {
			background: var(--nimble-input-background-color, hsla(0, 0%, 100%, 0.5));
		}

		&--class {
			background: var(--nimble-input-background-color, hsla(0, 0%, 100%, 0.5));

			&:hover {
				background: var(--nimble-box-background-color, hsl(48, 17%, 97%));
			}
		}
	}

	.hd-dropdown__badge {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.125rem 0.375rem;
		background: hsl(45, 50%, 55%);
		color: #fff;
		border-radius: 3px;
	}

	.hd-dice-list {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.hd-die-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&--readonly {
			background: var(--nimble-rule-background-color);
			border-color: var(--nimble-rule-border-color);
		}

		&__name-row {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			cursor: text;
		}

		&__name-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__name {
			flex: 1;
			min-width: 0;
			padding: 0.125rem 0.25rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;

			&::placeholder {
				color: var(--nimble-medium-text-color);
				font-style: italic;
			}

			&:focus {
				outline: none;
				border-color: hsl(45, 50%, 50%);
			}

			&--readonly {
				background: transparent;
				border: none;
				padding: 0;
			}
		}

		&__bottom-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__die {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__controls {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__value {
			min-width: 1.25rem;
			text-align: center;
			font-size: var(--nimble-base-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}
	}

	.hd-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.375rem;
		height: 1.375rem;
		padding: 0;
		font-size: 0.5rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		background: var(--nimble-input-background-color);
		color: var(--nimble-dark-text-color);
		cursor: pointer;
		transition: all 0.15s ease;

		&:hover:not(:disabled) {
			background: var(--nimble-box-background-color);
		}

		&:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		&--plus:hover:not(:disabled) {
			background: hsl(139, 35%, 88%);
			border-color: hsl(139, 35%, 55%);
			color: hsl(139, 40%, 30%);
		}

		&--minus:hover:not(:disabled) {
			background: hsl(0, 35%, 92%);
			border-color: hsl(0, 35%, 65%);
			color: hsl(0, 40%, 35%);
		}
	}

	.hd-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: linear-gradient(to right, hsl(45, 45%, 40%), hsl(45, 50%, 50%));
		border-radius: 6px;

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: hsl(45, 30%, 95%);
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		&__value {
			font-size: var(--nimble-xl-text);
			font-weight: 700;
			color: #fff;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		}
	}

	.hd-info-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		background: linear-gradient(to right, hsla(45, 60%, 50%, 0.15), hsla(45, 60%, 50%, 0.08));
		border: 1px solid hsla(45, 60%, 50%, 0.4);
		border-radius: 6px;
		margin-bottom: 0.25rem;

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: hsl(45, 60%, 40%);
			margin-top: 0.125rem;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__text {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__sources {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}
	}

	:global(.theme-dark) .hd-info-banner {
		background: linear-gradient(to right, hsla(45, 60%, 50%, 0.2), hsla(45, 60%, 50%, 0.1));
		border-color: hsla(45, 60%, 50%, 0.5);

		.hd-info-banner__icon {
			color: hsl(45, 60%, 60%);
		}
	}

	/* Dark mode overrides for rule-based hit dice */
	:global(.theme-dark) {
		.hd-overview-card--rule {
			background: hsl(210, 30%, 25%);
			border-color: hsl(210, 30%, 40%);
		}

		.hd-overview-card--rule .hd-overview-card__die,
		.hd-overview-card--rule .hd-overview-card__value {
			color: hsl(36, 53%, 80%);
		}

		.hd-overview-card--rule .hd-overview-card__source {
			color: hsl(0, 0%, 84%);
		}

		.hd-die-card--readonly {
			background: hsl(210, 30%, 25%);
			border-color: hsl(210, 30%, 40%);
		}

		.hd-die-card--readonly .hd-die-card__name-label,
		.hd-die-card--readonly .hd-die-card__die {
			color: hsl(0, 0%, 84%);
		}

		.hd-die-card--readonly .hd-die-card__name,
		.hd-die-card--readonly .hd-die-card__value {
			color: hsl(36, 53%, 80%);
		}
	}
</style>

<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type { NimbleClassItem } from '../../documents/item/class.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	interface BonusDieEntry {
		size: number;
		value: number;
	}

	const allDieSizes = [4, 6, 8, 10, 12, 20];

	function submit() {
		const bonusUpdates: Record<string, { bonus: number }> = {};
		const tempUpdates: Record<string, { temp: number }> = {};

		// Reset all sizes to 0 first
		for (const size of allDieSizes) {
			bonusUpdates[size] = { bonus: 0 };
			tempUpdates[size] = { temp: 0 };
		}

		// Apply bonus dice
		for (const entry of bonusDice) {
			bonusUpdates[entry.size] = { bonus: entry.value };
		}

		// Apply temp dice
		for (const entry of tempDice) {
			tempUpdates[entry.size] = { temp: entry.value };
		}

		dialog.submit({ bonusUpdates, tempUpdates });
	}

	function getOrderedDieSizes(excludeExisting: number[], type: 'bonus' | 'temp'): number[] {
		const existingDice = type === 'bonus' ? bonusDice : tempDice;
		const usedSizes = new Set(existingDice.map((d) => d.size));
		const available = allDieSizes.filter((s) => !usedSizes.has(s) && !excludeExisting.includes(s));

		// Class die first if available
		const ordered: number[] = [];
		if (classDieSize && available.includes(classDieSize)) {
			ordered.push(classDieSize);
		}

		// Then lowest to highest, excluding class die
		available
			.filter((s) => s !== classDieSize)
			.sort((a, b) => a - b)
			.forEach((s) => ordered.push(s));

		return ordered;
	}

	function addBonusDie(size: number) {
		bonusDice = [...bonusDice, { size, value: 1 }];
		showBonusDropdown = false;
	}

	function addTempDie(size: number) {
		tempDice = [...tempDice, { size, value: 1 }];
		showTempDropdown = false;
	}

	function updateBonusDie(index: number, delta: number) {
		const newValue = bonusDice[index].value + delta;
		if (newValue <= 0) {
			// Remove the entry
			bonusDice = bonusDice.filter((_, i) => i !== index);
		} else {
			bonusDice[index].value = newValue;
		}
	}

	function updateTempDie(index: number, delta: number) {
		const newValue = tempDice[index].value + delta;
		if (newValue <= 0) {
			// Remove the entry
			tempDice = tempDice.filter((_, i) => i !== index);
		} else {
			tempDice[index].value = newValue;
		}
	}

	let { document: actor, dialog }: Props = $props();

	const classes = actor.items.filter((i: Item) => i.type === 'class') as NimbleClassItem[];
	const classDieSize = classes.length > 0 ? classes[0].system.hitDieSize : null;

	// Initialize bonus dice from existing data
	let bonusDice = $state<BonusDieEntry[]>(
		Object.entries(actor.system.attributes.hitDice)
			.filter(([_, data]) => (data.bonus ?? 0) > 0)
			.map(([size, data]) => ({ size: Number(size), value: data.bonus ?? 0 })),
	);

	// Initialize temp dice from existing data
	let tempDice = $state<BonusDieEntry[]>(
		Object.entries(actor.system.attributes.hitDice)
			.filter(([_, data]) => (data.temp ?? 0) > 0)
			.map(([size, data]) => ({ size: Number(size), value: data.temp ?? 0 })),
	);

	let showBonusDropdown = $state(false);
	let showTempDropdown = $state(false);
	let dropdownPosition = $state({ top: 0, left: 0 });

	function openDropdown(event: MouseEvent, type: 'bonus' | 'temp') {
		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();

		dropdownPosition = {
			top: rect.bottom + 4,
			left: rect.right,
		};

		if (type === 'bonus') {
			showBonusDropdown = !showBonusDropdown;
			showTempDropdown = false;
		} else {
			showTempDropdown = !showTempDropdown;
			showBonusDropdown = false;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.hd-add-btn') && !target.closest('.hd-dropdown')) {
			showBonusDropdown = false;
			showTempDropdown = false;
		}
	}

	// Build current hit dice display with source info
	let currentHitDice = $derived.by(() => {
		const dice: {
			size: number;
			current: number;
			total: number;
			source: string;
			sourceType: 'class' | 'bonus' | 'temp';
		}[] = [];

		// Add from classes
		for (const cls of classes) {
			const size = cls.system.hitDieSize;
			const classLevel = cls.system.classLevel;
			const current = actor.system.attributes.hitDice[size]?.current ?? 0;
			dice.push({
				size,
				current,
				total: classLevel,
				source: cls.name,
				sourceType: 'class',
			});
		}

		// Add bonus dice
		for (const entry of bonusDice) {
			dice.push({
				size: entry.size,
				current: entry.value,
				total: entry.value,
				source: 'Bonus',
				sourceType: 'bonus',
			});
		}

		// Add temp dice
		for (const entry of tempDice) {
			dice.push({
				size: entry.size,
				current: entry.value,
				total: entry.value,
				source: 'Temporary',
				sourceType: 'temp',
			});
		}

		return dice;
	});

	let availableBonusSizes = $derived(getOrderedDieSizes([], 'bonus'));
	let availableTempSizes = $derived(getOrderedDieSizes([], 'temp'));

	let totals = $derived.by(() => {
		let fromClasses = 0;
		let bonus = 0;
		let temp = 0;

		for (const cls of classes) {
			fromClasses += cls.system.classLevel ?? 0;
		}

		for (const entry of bonusDice) {
			bonus += entry.value;
		}

		for (const entry of tempDice) {
			temp += entry.value;
		}

		return { fromClasses, bonus, temp, max: fromClasses + bonus + temp };
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<article class="nimble-sheet__body" onclick={handleClickOutside}>
	<!-- Current Hit Dice Overview -->
	<section class="hd-section">
		<header class="hd-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-dice-d20"></i>
				Current Hit Dice
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
				<p class="hd-empty">No hit dice yet.</p>
			{/each}
		</div>
	</section>

	<!-- Bonus Hit Dice -->
	<section class="hd-section hd-section--bonus">
		<header class="hd-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-plus-circle"></i>
				Bonus Hit Dice
			</h3>
			<span class="hd-subtitle">Permanent bonuses from boons, ancestries, or features</span>
		</header>

		{#if bonusDice.length === 0}
			<div class="hd-empty-state">
				<span class="hd-empty-state__text">No bonus dice</span>
				<button
					class="hd-add-btn"
					type="button"
					onclick={(e) => openDropdown(e, 'bonus')}
					disabled={availableBonusSizes.length === 0}
				>
					<i class="fa-solid fa-plus"></i>
					Add Bonus Die
				</button>
			</div>
		{:else}
			<div class="hd-dice-list">
				{#each bonusDice as entry, index}
					<div class="hd-die-card hd-die-card--bonus">
						<span class="hd-die-card__die">d{entry.size}</span>
						<div class="hd-die-card__controls">
							<button
								class="hd-btn hd-btn--minus"
								type="button"
								onclick={() => updateBonusDie(index, -1)}
							>
								<i class="fa-solid fa-minus"></i>
							</button>
							<span class="hd-die-card__value">{entry.value}</span>
							<button
								class="hd-btn hd-btn--plus"
								type="button"
								onclick={() => updateBonusDie(index, 1)}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>
					</div>
				{/each}

				{#if availableBonusSizes.length > 0}
					<button
						class="hd-add-btn hd-add-btn--small"
						type="button"
						onclick={(e) => openDropdown(e, 'bonus')}
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Temporary Hit Dice -->
	<section class="hd-section hd-section--temp">
		<header class="hd-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-hourglass-half"></i>
				Temporary Hit Dice
			</h3>
			<span class="hd-subtitle">Combat-granted HD (Enduring Soul, Temporary Boons)</span>
		</header>

		{#if tempDice.length === 0}
			<div class="hd-empty-state">
				<span class="hd-empty-state__text">No temporary dice</span>
				<button
					class="hd-add-btn"
					type="button"
					onclick={(e) => openDropdown(e, 'temp')}
					disabled={availableTempSizes.length === 0}
				>
					<i class="fa-solid fa-plus"></i>
					Add Temporary Die
				</button>
			</div>
		{:else}
			<div class="hd-dice-list">
				{#each tempDice as entry, index}
					<div class="hd-die-card hd-die-card--temp">
						<span class="hd-die-card__die">d{entry.size}</span>
						<div class="hd-die-card__controls">
							<button
								class="hd-btn hd-btn--minus"
								type="button"
								onclick={() => updateTempDie(index, -1)}
							>
								<i class="fa-solid fa-minus"></i>
							</button>
							<span class="hd-die-card__value">{entry.value}</span>
							<button
								class="hd-btn hd-btn--plus"
								type="button"
								onclick={() => updateTempDie(index, 1)}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>
					</div>
				{/each}

				{#if availableTempSizes.length > 0}
					<button
						class="hd-add-btn hd-add-btn--small"
						type="button"
						onclick={(e) => openDropdown(e, 'temp')}
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Total -->
	<section class="hd-total">
		<span class="hd-total__label">Total Hit Dice</span>
		<span class="hd-total__value">{totals.max}</span>
	</section>
</article>

<!-- Fixed position dropdown portal -->
{#if showBonusDropdown}
	<div
		class="hd-dropdown hd-dropdown--fixed"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
	>
		{#each availableBonusSizes as size}
			<button
				class="hd-dropdown__item"
				class:hd-dropdown__item--class={size === classDieSize}
				type="button"
				onclick={() => addBonusDie(size)}
			>
				d{size}
				{#if size === classDieSize}
					<span class="hd-dropdown__badge">Class</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

{#if showTempDropdown}
	<div
		class="hd-dropdown hd-dropdown--fixed"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
	>
		{#each availableTempSizes as size}
			<button
				class="hd-dropdown__item"
				class:hd-dropdown__item--class={size === classDieSize}
				type="button"
				onclick={() => addTempDie(size)}
			>
				d{size}
				{#if size === classDieSize}
					<span class="hd-dropdown__badge">Class</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>Save Changes</button>
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

		&--bonus {
			background: var(--nimble-box-background-color);
			border-color: var(--nimble-card-border-color);
		}

		&--temp {
			background: var(--nimble-box-background-color);
			border-color: var(--nimble-card-border-color);
		}
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

		&--class {
			background: var(--nimble-input-background-color);
			border-color: var(--nimble-card-border-color);
		}

		&--bonus {
			background: var(--nimble-input-background-color);
			border-color: var(--nimble-card-border-color);
		}

		&--temp {
			background: var(--nimble-input-background-color);
			border-color: var(--nimble-card-border-color);
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
		background: var(--nimble-box-background-color, hsl(48, 17%, 97%));
		border: 1px solid var(--nimble-card-border-color, hsla(41, 18%, 54%, 25%));
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		overflow: hidden;

		&--fixed {
			position: fixed;
			z-index: 99999;
			transform: translateX(-100%);
		}

		&__item {
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

		&__badge {
			font-size: 0.5625rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			padding: 0.125rem 0.375rem;
			background: hsl(45, 50%, 55%);
			color: #fff;
			border-radius: 3px;
		}
	}

	.hd-dice-list {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.hd-die-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&--bonus {
			background: var(--nimble-input-background-color);
			border-color: var(--nimble-card-border-color);
		}

		&--temp {
			background: var(--nimble-input-background-color);
			border-color: var(--nimble-card-border-color);
		}

		&__die {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			min-width: 1.75rem;
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
</style>

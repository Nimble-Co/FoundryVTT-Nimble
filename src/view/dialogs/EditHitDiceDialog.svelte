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
		name: string;
	}

	const allDieSizes = [4, 6, 8, 10, 12, 20];

	function submit() {
		dialog.submit({ bonusDice: [...bonusDice] });
	}

	function getOrderedDieSizes(): number[] {
		// Class die first if available
		const ordered: number[] = [];
		if (classDieSize) {
			ordered.push(classDieSize);
		}

		// Then all other sizes lowest to highest, excluding class die
		allDieSizes
			.filter((s) => s !== classDieSize)
			.sort((a, b) => a - b)
			.forEach((s) => ordered.push(s));

		return ordered;
	}

	function addBonusDie(size: number) {
		bonusDice = [...bonusDice, { size, value: 1, name: `d${size}` }];
		showDropdown = false;
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
	const classDieSize = classes.length > 0 ? classes[0].system.hitDieSize : null;

	// Initialize bonus dice from existing data
	let bonusDice = $state<BonusDieEntry[]>(
		actor.system.attributes.bonusHitDice?.map((d: BonusDieEntry) => ({ ...d })) ?? [],
	);

	let showDropdown = $state(false);
	let dropdownPosition = $state({ top: 0, left: 0 });

	function openDropdown(event: MouseEvent) {
		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();

		dropdownPosition = {
			top: rect.bottom + 4,
			left: rect.right,
		};

		showDropdown = !showDropdown;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.hd-add-btn') && !target.closest('.hd-dropdown')) {
			showDropdown = false;
		}
	}

	// Build current hit dice display with source info
	let currentHitDice = $derived.by(() => {
		const dice: {
			size: number;
			current: number;
			total: number;
			source: string;
			sourceType: 'class' | 'bonus';
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
				source: entry.name,
				sourceType: 'bonus',
			});
		}

		return dice;
	});

	let availableDieSizes = $derived(getOrderedDieSizes());

	let totals = $derived.by(() => {
		let fromClasses = 0;
		let bonus = 0;

		for (const cls of classes) {
			fromClasses += cls.system.classLevel ?? 0;
		}

		for (const entry of bonusDice) {
			bonus += entry.value;
		}

		return { fromClasses, bonus, max: fromClasses + bonus };
	});
</script>

<div class="nimble-sheet__body" role="presentation" onclick={handleClickOutside}>
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

		{#if bonusDice.length === 0}
			<div class="hd-empty-state">
				<span class="hd-empty-state__text">{CONFIG.NIMBLE.hitDice.noBonusDice}</span>
				<button class="hd-add-btn" type="button" onclick={openDropdown}>
					<i class="fa-solid fa-plus"></i>
					{CONFIG.NIMBLE.hitDice.addBonusDie}
				</button>
			</div>
		{:else}
			<div class="hd-dice-list">
				{#each bonusDice as entry, index}
					<div class="hd-die-card">
						<label class="hd-die-card__name-row">
							<span class="hd-die-card__name-label">{CONFIG.NIMBLE.hitDice.bonusDieName}</span>
							<input
								class="hd-die-card__name"
								type="text"
								value={entry.name}
								placeholder="d{entry.size}"
								onchange={(e) =>
									updateBonusDieName(index, e.currentTarget.value || `d${entry.size}`)}
							/>
						</label>
						<div class="hd-die-card__bottom-row">
							<span class="hd-die-card__die">d{entry.size}</span>
							<div class="hd-die-card__controls">
								<button
									class="hd-btn hd-btn--minus"
									type="button"
									onclick={() => updateBonusDieValue(index, -1)}
									aria-label={game.i18n.format('NIMBLE.hitDice.decreaseBonusDie', {
										size: entry.size,
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
										size: entry.size,
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
					onclick={openDropdown}
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
</div>

<!-- Fixed position dropdown portal -->
{#if showDropdown}
	<div
		class="hd-dropdown hd-dropdown--fixed"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
	>
		{#each availableDieSizes as size}
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
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

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
</style>

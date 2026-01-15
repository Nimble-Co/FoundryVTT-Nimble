<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import { incrementDieSize } from '../../managers/HitDiceManager.js';

	interface HitDiceAdvantageRule {
		id: string;
		label: string;
		condition: string;
		sourceId: string;
	}

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	function incrementHitDie(die: string) {
		const current = hitDice[die]?.current ?? 0;
		const currentSelected = selectedHitDice[die] ?? 0;
		selectedHitDice = { ...selectedHitDice, [die]: Math.min(currentSelected + 1, current) };
	}

	function decrementHitDie(die: string) {
		const currentSelected = selectedHitDice[die] ?? 0;
		selectedHitDice = { ...selectedHitDice, [die]: Math.max(currentSelected - 1, 0) };
	}

	function maxHitDie(die: string) {
		const current = hitDice[die]?.current ?? 0;
		selectedHitDice = { ...selectedHitDice, [die]: current };
	}

	function submit() {
		// Collect which advantage rules are active
		const activeAdvantageRuleIds = Object.entries(advantageToggles)
			.filter(([_, active]) => active)
			.map(([id]) => id);

		dialog.submit({
			makeCamp,
			selectedHitDice: { ...selectedHitDice },
			activeAdvantageRuleIds,
		});
	}

	let { document: actor, dialog }: Props = $props();

	// Reactive hit dice computation (mirrors SafeRestDialog pattern)
	let hitDice = $derived.by(() => {
		const hitDiceAttr = actor.reactive.system.attributes.hitDice;
		const bonusHitDice = actor.reactive.system.attributes.bonusHitDice ?? [];
		const classes = actor.reactive.items.filter((i) => i.type === 'class');
		const hitDiceSizeBonus = actor.reactive.system.attributes.hitDiceSizeBonus ?? 0;

		const bySize: Record<number, { current: number; total: number }> = {};

		// Add from classes (apply hitDiceSizeBonus to get effective size)
		for (const cls of classes) {
			const baseSize = cls.system.hitDieSize;
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			bySize[size] ??= { current: 0, total: 0 };
			bySize[size].total += cls.system.classLevel;
			bySize[size].current = hitDiceAttr[size]?.current ?? 0;
		}

		// Get effective class sizes (after applying bonus) for later checks
		const effectiveClassSizes = classes.map((cls) =>
			incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus),
		);

		// Add from bonusHitDice array (apply hitDiceSizeBonus to increment)
		for (const entry of bonusHitDice) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			bySize[size] ??= { current: hitDiceAttr[size]?.current ?? 0, total: 0 };
			bySize[size].total += entry.value;
			if (!effectiveClassSizes.includes(size)) {
				bySize[size].current = hitDiceAttr[size]?.current ?? 0;
			}
		}

		// Get effective bonus array sizes (after increment) for later checks
		const effectiveBonusArraySizes = bonusHitDice.map((entry) =>
			incrementDieSize(entry.size, hitDiceSizeBonus),
		);

		// Add from rule-based bonuses (hitDice[size].bonus)
		for (const [sizeStr, hitDieData] of Object.entries(hitDiceAttr ?? {})) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = hitDieData?.bonus ?? 0;
			if (bonus > 0) {
				bySize[size] ??= { current: 0, total: 0 };
				bySize[size].total += bonus;

				const fromClass = effectiveClassSizes.includes(size);
				const fromBonusArray = effectiveBonusArraySizes.includes(size);
				if (!fromClass && !fromBonusArray) {
					bySize[size].current = hitDiceAttr[size]?.current ?? 0;
				}
			}
		}

		return bySize;
	});

	// Get hit dice advantage rules from the actor
	const advantageRules = ((
		actor.system.attributes as { hitDiceAdvantageRules?: HitDiceAdvantageRule[] }
	).hitDiceAdvantageRules ?? []) as HitDiceAdvantageRule[];

	// Check if hit dice are always maximized (from rules like Oozeling's Odd Constitution)
	const alwaysMaximize =
		(actor.system.attributes as { maximizeHitDice?: boolean }).maximizeHitDice ?? false;

	let makeCamp = $state(false);
	let selectedHitDice = $state<Record<string, number>>({});

	// Clamp selected hit dice when current values decrease
	$effect(() => {
		for (const [die, data] of Object.entries(hitDice)) {
			const selected = selectedHitDice[die] ?? 0;
			if (selected > data.current) {
				selectedHitDice = { ...selectedHitDice, [die]: data.current };
			}
		}
	});

	// Initialize advantage toggles - all off by default since they're conditional
	let advantageToggles = $state(
		Object.fromEntries(advantageRules.map((rule) => [rule.id, false])),
	) as Record<string, boolean>;

	const totalSelected = $derived(
		Object.entries(selectedHitDice).reduce((sum, [die, val]) => {
			// Only count dice that still exist in hitDice
			if (hitDice[die]) {
				return sum + val;
			}
			return sum;
		}, 0),
	);

	// Check if there are any modifiers to display
	// Show modifiers section if: making camp (shows maximize), always maximize rule, or has advantage rules
	const hasModifiers = $derived(makeCamp || alwaysMaximize || advantageRules.length > 0);

	// Whether to show maximize indicator (making camp or has alwaysMaximize rule)
	const showMaximize = $derived(makeCamp || alwaysMaximize);
</script>

<article class="nimble-sheet__body field-rest-dialog">
	<section class="field-rest-dialog__section">
		<h3 class="field-rest-dialog__heading">{CONFIG.NIMBLE.fieldRest.restType}</h3>

		<div class="field-rest-dialog__rest-types">
			<label class="rest-type-card" class:rest-type-card--active={!makeCamp}>
				<input
					class="rest-type-card__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={false}
					bind:group={makeCamp}
				/>
				<div class="rest-type-card__header">
					<i class="rest-type-card__icon fa-solid fa-wind"></i>
					<span class="rest-type-card__title">{CONFIG.NIMBLE.fieldRest.catchBreath}</span>
				</div>
				<p class="rest-type-card__description">{CONFIG.NIMBLE.fieldRest.catchBreathDescription}</p>
				<div class="rest-type-card__indicator"></div>
			</label>

			<label class="rest-type-card" class:rest-type-card--active={makeCamp}>
				<input
					class="rest-type-card__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={true}
					bind:group={makeCamp}
				/>
				<div class="rest-type-card__header">
					<i class="rest-type-card__icon fa-solid fa-campground"></i>
					<span class="rest-type-card__title">{CONFIG.NIMBLE.fieldRest.makeCamp}</span>
				</div>
				<p class="rest-type-card__description">{CONFIG.NIMBLE.fieldRest.makeCampDescription}</p>
				<div class="rest-type-card__indicator"></div>
			</label>
		</div>
	</section>

	<section class="field-rest-dialog__section">
		<h3 class="field-rest-dialog__heading">{CONFIG.NIMBLE.fieldRest.hitDiceToSpend}</h3>

		<div class="hit-dice-grid">
			{#each Object.entries(hitDice) as [die, { current, total }]}
				<div class="hit-die-row">
					<div class="hit-die-row__die-label">
						<span class="hit-die-row__die-size">d{die}</span>
						<span class="hit-die-row__available">{current} / {total}</span>
					</div>

					<div class="hit-die-row__controls">
						<button
							class="hit-die-row__button"
							onclick={() => decrementHitDie(die)}
							disabled={(selectedHitDice[die] ?? 0) <= 0}
							aria-label={game.i18n.format(CONFIG.NIMBLE.fieldRest.decreaseDie, { size: die })}
							data-tooltip={current === 0 ? CONFIG.NIMBLE.fieldRest.noHitDiceAvailable : null}
						>
							<i class="fa-solid fa-minus"></i>
						</button>

						<span class="hit-die-row__value">{selectedHitDice[die] ?? 0}</span>

						<button
							class="hit-die-row__button"
							onclick={() => incrementHitDie(die)}
							disabled={(selectedHitDice[die] ?? 0) >= current}
							aria-label={game.i18n.format(CONFIG.NIMBLE.fieldRest.increaseDie, { size: die })}
							data-tooltip={current === 0 ? CONFIG.NIMBLE.fieldRest.noHitDiceAvailable : null}
						>
							<i class="fa-solid fa-plus"></i>
						</button>

						<button
							class="hit-die-row__button hit-die-row__button--max"
							onclick={() => maxHitDie(die)}
							disabled={(selectedHitDice[die] ?? 0) >= current}
							aria-label={game.i18n.format(CONFIG.NIMBLE.fieldRest.maxDie, { size: die })}
							data-tooltip={current === 0 ? CONFIG.NIMBLE.fieldRest.noHitDiceAvailable : null}
						>
							{CONFIG.NIMBLE.fieldRest.max}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	{#if hasModifiers}
		<section class="field-rest-dialog__section">
			<h3 class="field-rest-dialog__heading">{CONFIG.NIMBLE.fieldRest.modifiers}</h3>

			<div class="modifiers-list">
				{#if showMaximize}
					<div class="modifier-item modifier-item--always-on">
						<i class="modifier-item__icon fa-solid fa-arrow-up"></i>
						<span class="modifier-item__text">{CONFIG.NIMBLE.fieldRest.maximizeHitDice}</span>
					</div>
				{/if}

				{#each advantageRules as rule}
					<label
						class="modifier-item modifier-item--toggleable"
						class:modifier-item--disabled={totalSelected === 0 || makeCamp}
					>
						<input
							type="checkbox"
							class="modifier-item__checkbox"
							bind:checked={advantageToggles[rule.id]}
							disabled={totalSelected === 0 || makeCamp}
						/>
						<i class="modifier-item__icon fa-solid fa-dice-d20"></i>
						<span class="modifier-item__text">
							{game.i18n.format(CONFIG.NIMBLE.fieldRest.advantageWhen, {
								condition: rule.condition,
							})}
						</span>
						<span class="modifier-item__source">({rule.label})</span>
					</label>
				{/each}
			</div>
		</section>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>
		{#if totalSelected > 0}
			{game.i18n.format(
				totalSelected === 1
					? CONFIG.NIMBLE.fieldRest.restAndSpendHitDie
					: CONFIG.NIMBLE.fieldRest.restAndSpendHitDice,
				{ count: totalSelected },
			)}
		{:else}
			{CONFIG.NIMBLE.fieldRest.restWithoutSpending}
		{/if}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.field-rest-dialog {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem;

		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		&__heading {
			margin: 0;
			padding: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
			border: none;
		}

		&__rest-types {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.75rem;
		}
	}

	.rest-type-card {
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
		transition: all 0.2s ease;

		&:hover:not(&--active) {
			border-color: var(--nimble-accent-color);
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
			box-shadow: inset 0 0 0 1px hsla(45, 60%, 50%, 0.2);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;

			.rest-type-card--active & {
				color: hsl(45, 60%, 40%);
			}
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			transition: color 0.2s ease;

			.rest-type-card--active & {
				color: hsl(45, 50%, 30%);
			}
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.45;
			color: var(--nimble-dark-text-color);
		}

		&__indicator {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 50%;
			background: transparent;
			border: 2px solid transparent;
			transition: all 0.2s ease;

			.rest-type-card--active & {
				background: hsl(45, 70%, 50%);
				border-color: hsl(45, 70%, 40%);
				box-shadow: 0 0 8px hsla(45, 70%, 50%, 0.6);
			}
		}
	}

	:global(.theme-dark) .rest-type-card {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(.rest-type-card--active) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}

		&--active {
			border-color: hsl(45, 70%, 55%);
			background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
			box-shadow:
				inset 0 0 0 1px hsla(45, 60%, 60%, 0.3),
				0 0 12px hsla(45, 60%, 50%, 0.15);
		}

		&--active .rest-type-card__icon {
			color: hsl(45, 70%, 65%);
		}

		&--active .rest-type-card__title {
			color: hsl(45, 60%, 75%);
		}

		&--active .rest-type-card__description {
			color: hsl(220, 10%, 80%);
		}

		&--active .rest-type-card__indicator {
			background: hsl(45, 70%, 55%);
			border-color: hsl(45, 70%, 65%);
			box-shadow: 0 0 10px hsla(45, 70%, 55%, 0.7);
		}
	}

	.hit-dice-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.hit-die-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__die-label {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		&__die-size {
			font-size: var(--nimble-md-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__available {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__controls {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover:not(:disabled) {
				background: var(--nimble-box-color);
				color: var(--nimble-light-text-color);
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			&--max {
				width: auto;
				padding: 0 0.5rem;
				font-weight: 600;
			}
		}

		&__value {
			min-width: 1.5rem;
			font-size: var(--nimble-md-text);
			font-weight: 600;
			text-align: center;
			color: var(--nimble-dark-text-color);
		}
	}

	.modifiers-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.modifier-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		font-size: var(--nimble-sm-text);

		&--toggleable {
			cursor: pointer;
			transition: all 0.2s ease;
			border: 2px solid var(--nimble-card-border-color);

			&:hover {
				border-color: hsl(210, 60%, 55%);
				background: hsla(210, 70%, 50%, 0.08);
			}

			&:has(.modifier-item__checkbox:checked) {
				border-color: hsl(210, 70%, 50%);
				background: hsla(210, 70%, 50%, 0.12);
				box-shadow: inset 0 0 0 1px hsla(210, 70%, 50%, 0.2);
			}

			&:has(.modifier-item__checkbox:checked) .modifier-item__icon {
				color: hsl(210, 70%, 45%);
			}

			&:has(.modifier-item__checkbox:checked) .modifier-item__text {
				color: hsl(210, 50%, 30%);
				font-weight: 600;
			}
		}

		&--always-on {
			background: hsla(120, 45%, 50%, 0.1);
			border-color: hsla(120, 45%, 50%, 0.3);
		}

		&--disabled {
			opacity: 0.5;
			cursor: not-allowed;
			pointer-events: none;
		}

		&__checkbox {
			width: 1.25rem;
			height: 1.25rem;
			cursor: pointer;
			accent-color: hsl(210, 70%, 50%);
			flex-shrink: 0;

			&:disabled {
				cursor: not-allowed;
			}
		}

		&__icon {
			flex-shrink: 0;
			width: 1rem;
			text-align: center;
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;

			.modifier-item--always-on & {
				color: hsl(120, 45%, 40%);
			}
		}

		&__text {
			flex: 1;
			color: var(--nimble-dark-text-color);
			transition: all 0.2s ease;
		}

		&__source {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}
	}

	:global(.theme-dark) .modifier-item {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&--always-on {
			background: hsla(120, 45%, 50%, 0.15);
			border-color: hsla(120, 45%, 50%, 0.4);
		}

		&--always-on .modifier-item__icon {
			color: hsl(120, 50%, 60%);
		}

		&--always-on .modifier-item__text {
			color: hsl(120, 40%, 75%);
		}

		&--toggleable {
			border-color: hsl(220, 10%, 35%);
		}

		&--toggleable:hover {
			border-color: hsl(210, 60%, 55%);
			background: hsla(210, 70%, 50%, 0.12);
		}

		&--toggleable:has(.modifier-item__checkbox:checked) {
			border-color: hsl(210, 70%, 55%);
			background: linear-gradient(
				135deg,
				hsla(210, 70%, 50%, 0.2) 0%,
				hsla(210, 60%, 40%, 0.1) 100%
			);
			box-shadow:
				inset 0 0 0 1px hsla(210, 70%, 60%, 0.3),
				0 0 8px hsla(210, 70%, 50%, 0.15);
		}

		&--toggleable:has(.modifier-item__checkbox:checked) .modifier-item__icon {
			color: hsl(210, 70%, 65%);
		}

		&--toggleable:has(.modifier-item__checkbox:checked) .modifier-item__text {
			color: hsl(210, 60%, 75%);
			font-weight: 600;
		}
	}
</style>

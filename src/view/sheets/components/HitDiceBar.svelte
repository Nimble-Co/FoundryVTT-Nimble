<script lang="ts">
	export interface HitDiceBySizeEntry {
		current: number;
		total: number;
	}

	export type HitDiceBySize = Record<string, HitDiceBySizeEntry>;

	interface BaseProps {
		value: number;
		max: number;
		bySize: HitDiceBySize;
		updateCurrentHitDice?: (value: number) => void | Promise<void>;
		editCurrentHitDice?: () => void | Promise<void>;
		rollHitDice?: () => void | Promise<void>;
	}

	interface WithoutControls extends BaseProps {
		disableControls: true;
	}

	interface WithControls extends BaseProps {
		disableControls?: false;
		updateCurrentHitDice: NonNullable<BaseProps['updateCurrentHitDice']>;
		editCurrentHitDice: NonNullable<BaseProps['editCurrentHitDice']>;
	}

	type Props = WithControls | WithoutControls;

	let {
		value,
		max,
		bySize,
		disableControls = false,
		updateCurrentHitDice,
		editCurrentHitDice,
		rollHitDice,
	}: Props = $props();

	// Track pending updates to prevent race conditions
	let isUpdating = $state(false);

	async function handleUpdateCurrentHitDice(newValue: number) {
		isUpdating = true;
		try {
			await updateCurrentHitDice?.(newValue);
		} finally {
			isUpdating = false;
		}
	}

	async function handleRollHitDice() {
		if (isUpdating) return;
		await rollHitDice?.();
	}

	async function handleEditCurrentHitDice() {
		if (isUpdating) return;
		await editCurrentHitDice?.();
	}

	// Show label for all cases - single die shows size (d8), multiple shows d20 icon
	let dieSizes = $derived(Object.keys(bySize).filter((size) => bySize[size].total > 0));
	let hasSingleDieSize = $derived(dieSizes.length === 1);
	let hasMultipleDieSizes = $derived(dieSizes.length > 1);
</script>

<div class="nimble-hit-dice-bar" class:nimble-hit-dice-bar--no-label={dieSizes.length === 0}>
	<div
		class="nimble-hit-dice-bar__fill"
		style="--nimble-hit-dice-percentage: {max > 0
			? Math.clamp(0, Math.round((value / max) * 100), 100)
			: 0}%"
	>
		{#if hasMultipleDieSizes}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<span
				class="nimble-hit-dice-bar__values nimble-hit-dice-bar__values--clickable"
				onclick={handleEditCurrentHitDice}
				data-tooltip="Edit Current Hit Dice"
			>
				{value} / {max}
			</span>
		{:else}
			<span class="nimble-hit-dice-bar__values">
				<input
					class="nimble-hit-dice-bar__input nimble-hit-dice-bar__input--current"
					type="number"
					min="0"
					{max}
					{value}
					disabled={disableControls}
					onchange={(event) =>
						handleUpdateCurrentHitDice(Number((event.currentTarget as HTMLInputElement).value))}
				/>
				/
				<input
					class="nimble-hit-dice-bar__input nimble-hit-dice-bar__input--max"
					type="number"
					value={max}
					disabled
				/>
			</span>
		{/if}
	</div>
	{#if hasSingleDieSize || hasMultipleDieSizes}
		<div
			class="nimble-hit-dice-bar__label"
			role="button"
			tabindex="0"
			data-tooltip="Roll Hit Dice"
			onclick={handleRollHitDice}
			onkeydown={(e) => e.key === 'Enter' && handleRollHitDice()}
		>
			{#if hasSingleDieSize}
				d{dieSizes[0]}
			{:else}
				<i class="fa-solid fa-dice-d20"></i>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-hit-dice-bar {
		grid-area: hitDiceBar;
		--nimble-hit-point-input-text-size: var(--nimble-sm-text);
		--nimble-hit-point-input-font-weight: 600;

		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
		max-width: 7rem;
		background-color: var(--nimble-hp-bar-background);
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41, 18%, 54%);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);
		font-weight: 600;
		text-shadow: 0 0 4px hsl(41, 18%, 54%);

		&--no-label {
			.nimble-hit-dice-bar__fill {
				border-radius: 3px;

				&::before {
					border-radius: 3px;
				}
			}
		}

		&__fill {
			position: relative;
			overflow: hidden;
			flex: 1;
			display: flex;
			align-items: center;

			&::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0;
				display: block;
				height: 100%;
				width: var(--nimble-hit-dice-percentage);
				box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
				background: linear-gradient(to right, hsl(45, 60%, 30%) 0%, hsl(45, 60%, 50%) 100%);
				z-index: 0;
				border-radius: 3px 0 0 3px;
				transition: width 0.2s ease-in-out;
			}
		}

		&__values {
			position: relative;
			display: flex;
			flex-wrap: nowrap;
			width: 100%;
			gap: 0.25rem;
			align-items: center;
			font-size: var(--nimble-hit-point-input-text-size);
			font-weight: var(--nimble-hit-point-input-font-weight);
			color: #fff;
			z-index: 5;

			&--clickable {
				justify-content: center;
				cursor: pointer;

				&:hover {
					text-shadow:
						0 0 4px hsl(41, 18%, 54%),
						0 0 8px rgba(255, 255, 255, 0.4);
				}
			}
		}

		&__input[type] {
			--input-height: 1rem;

			flex: 1;
			width: auto;
			min-width: 0;
			font-size: var(--nimble-hit-point-input-text-size);
			font-weight: var(--nimble-hit-point-input-font-weight);
			text-align: end;
			text-shadow: inherit;
			color: inherit;
			border: 0;
			background: transparent;
			outline: none;
			box-shadow: none;

			&:active,
			&:focus,
			&:hover {
				border: 0;
				outline: none;
				box-shadow: none;
			}
		}

		&__input--max[type] {
			text-align: start;
		}

		&__label {
			display: flex;
			align-items: center;
			border-left: 1px solid hsl(41, 18%, 54%);
			padding-inline: 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: hsl(45, 80%, 75%);
			text-shadow: 0 0 4px hsl(0, 0%, 0%, 0.3);
			background: hsl(45, 30%, 25%);
			border-radius: 0 3px 3px 0;
			white-space: nowrap;
			cursor: pointer;
			transition: background-color 0.15s ease-in-out;

			&:hover {
				background: hsl(45, 35%, 32%);
			}

			&:active {
				background: hsl(45, 40%, 38%);
			}
		}
	}
</style>

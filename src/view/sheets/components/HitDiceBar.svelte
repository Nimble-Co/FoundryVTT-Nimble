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
	}

	interface WithoutControls extends BaseProps {
		disableControls: true;
	}

	interface WithControls extends BaseProps {
		disableControls?: false;
		updateCurrentHitDice: NonNullable<BaseProps['updateCurrentHitDice']>;
	}

	type Props = WithControls | WithoutControls;

	let { value, max, bySize, disableControls = false, updateCurrentHitDice }: Props = $props();

	// Only show label if there's exactly one die size
	let dieSizes = $derived(Object.keys(bySize).filter((size) => bySize[size].total > 0));
	let showLabel = $derived(dieSizes.length === 1);
</script>

<div class="nimble-hit-dice-bar" class:nimble-hit-dice-bar--no-label={!showLabel}>
	<div
		class="nimble-hit-dice-bar__fill"
		style="--nimble-hit-dice-percentage: {max > 0
			? Math.clamp(0, Math.round((value / max) * 100), 100)
			: 0}%"
	>
		<span class="nimble-hit-dice-bar__values">
			<input
				class="nimble-hit-dice-bar__input nimble-hit-dice-bar__input--current"
				type="number"
				min="0"
				{max}
				{value}
				disabled={disableControls}
				onchange={(event) =>
					updateCurrentHitDice?.(Number((event.currentTarget as HTMLInputElement).value))}
			/>
			/
			<input
				class="nimble-hit-dice-bar__input nimble-hit-dice-bar__input--max"
				type="number"
				value={max}
				disabled
			/>
		</span>
	</div>
	{#if showLabel}
		<span class="nimble-hit-dice-bar__label">d{dieSizes[0]}</span>
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
			background-color: var(--nimble-hp-bar-background);
			border-radius: 3px 0 0 3px;

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
		}

		&__input[type] {
			--input-height: 1rem;

			flex: 1;
			width: auto;
			min-width: 0;
			font: inherit;
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
			padding-inline: 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: hsl(45, 80%, 75%);
			text-shadow: 0 0 4px hsl(0, 0%, 0%, 0.3);
			background: hsl(45, 30%, 25%);
			border-left: 1px solid hsl(41, 18%, 54%);
			border-radius: 0 3px 3px 0;
			white-space: nowrap;
		}
	}
</style>

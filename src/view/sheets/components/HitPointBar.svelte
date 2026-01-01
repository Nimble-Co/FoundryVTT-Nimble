<script lang="ts">
	interface BaseProps {
		currentHP: number;
		isBloodied: boolean;
		maxHP: number;
		compact?: boolean;
		tempHP?: number;
		showTempHP?: boolean;
		disableMaxHPEdit?: boolean;
		updateCurrentHP?: (value: number) => void;
		updateMaxHP?: (value: number) => void;
		updateTempHP?: (value: number) => void;
	}

	interface WithoutControls extends BaseProps {
		disableControls: true;
	}

	interface WithControls extends BaseProps {
		disableControls?: false;
		updateCurrentHP: NonNullable<BaseProps['updateCurrentHP']>;
		updateMaxHP: NonNullable<BaseProps['updateMaxHP']>;
		updateTempHP: NonNullable<BaseProps['updateTempHP']>;
	}

	type Props = WithControls | WithoutControls;

	let {
		currentHP,
		isBloodied,
		maxHP,
		tempHP = 0,
		compact = false,
		disableControls = false,
		disableMaxHPEdit = false,
		showTempHP = true,
		updateCurrentHP,
		updateMaxHP,
		updateTempHP,
	}: Props = $props();
</script>

<div
	class="nimble-hit-points"
	class:nimble-hit-points--compact={compact}
	style="--nimble-hp-bar-percentage: {Math.clamp(0, Math.round((currentHP / maxHP) * 100), 100)}%"
>
	<div class="nimble-hit-points__bar" class:nimble-hit-points__bar--bloodied={isBloodied}>
		<div class="nimble-hit-points__values">
			<input
				class="nimble-hit-points__input nimble-hit-points__input--current-hp"
				type="number"
				value={currentHP}
				onchange={({ target }) => updateCurrentHP?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls}
			/>
			/
			<input
				class="nimble-hit-points__input nimble-hit-points__input--max-hp"
				type="number"
				value={maxHP}
				onchange={({ target }) => updateMaxHP?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls || disableMaxHPEdit}
			/>
		</div>
	</div>

	{#if showTempHP}
		<div class="nimble-hit-points__temp" class:nimble-hit-points__temp--has-value={tempHP > 0}>
			<input
				class="nimble-hit-points__input nimble-hit-points__input--temp-hp"
				type="number"
				value={tempHP}
				onchange={({ target }) => updateTempHP?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls}
			/>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-hit-points {
		--nimble-hit-point-input-text-size: var(--nimble-sm-text);
		--nimble-hit-point-input-font-weight: 600;

		grid-area: hpBar;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		background-color: var(--nimble-hp-bar-background);
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41, 18%, 54%);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);
		font-weight: 600;
		text-shadow: 0 0 4px hsl(41, 18%, 54%);

		&--compact {
			--nimble-hit-point-input-text-size: var(--nimble-xs-text);
			--form-field-height: 1rem;
			--nimble-hit-point-input-font-weight: 500;
		}

		&__bar {
			position: relative;
			overflow: hidden;

			&::before {
				content: '';
				position: absolute;
				display: block;
				height: 100%;
				width: var(--nimble-hp-bar-percentage);
				box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
				background: linear-gradient(to right, hsl(138, 47%, 20%) 0%, hsl(139, 47%, 44%) 100%);
				z-index: 0;
				border-radius: 4px 0 0 4px;
				transition: width 0.2s ease-in-out;
			}

			&--bloodied::before {
				background: linear-gradient(to right, hsl(0, 47%, 20%) 0%, hsl(0, 47%, 44%) 100%);
			}
		}

		&__values {
			position: relative;
			display: flex;
			flex-wrap: nowrap;
			gap: 0.25rem;
			align-items: center;
			font-size: var(--nimble-hit-point-input-text-size);
			font-weight: var(--nimble-hit-point-input-font-weight);
			color: #fff;
			z-index: 5;
		}

		&__input[type] {
			--input-height: 1rem;

			font-size: var(--nimble-hit-point-input-text-size);
			text-align: center;
			text-shadow: inherit;
			color: inherit;
			border: 0;
			background: transparent;
			font-weight: var(--nimble-hit-point-input-font-weight);
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

		&__input--current-hp[type] {
			text-align: end;
		}

		&__input--max-hp[type] {
			text-align: start;
		}

		&__input--temp-hp[type] {
			width: var(--nimble-temp-hp-field-width, 6ch);
			color: hsl(219, 90%, 80%);
			text-shadow: 0 0 4px hsl(0, 0%, 100%, 0.2);
		}

		&__temp {
			border-left: 1px dashed hsl(41, 18%, 54%);
		}
	}
</style>

<script lang="ts">
	interface BaseProps {
		current: number;
		max: number;
		compact?: boolean;
		disableControls?: boolean;
		disableMaxEdit?: boolean;
		updateCurrent?: (value: number) => void;
		updateMax?: (value: number) => void;
	}

	interface WithoutControls extends BaseProps {
		disableControls: true;
	}

	interface WithControls extends BaseProps {
		disableControls?: false;
		updateCurrent: NonNullable<BaseProps['updateCurrent']>;
		updateMax: NonNullable<BaseProps['updateMax']>;
	}

	type Props = WithControls | WithoutControls;

	let {
		current,
		max,
		compact = false,
		disableControls = false,
		disableMaxEdit = false,
		updateCurrent,
		updateMax,
	}: Props = $props();
</script>

<div
	class="nimble-resource-bar"
	class:nimble-resource-bar--compact={compact}
	style="--nimble-resource-bar-percentage: {max > 0
		? Math.clamp(0, Math.round((current / max) * 100), 100)
		: 0}%"
>
	<div class="nimble-resource-bar__bar">
		<div class="nimble-resource-bar__values">
			<input
				class="nimble-resource-bar__input nimble-resource-bar__input--current"
				type="number"
				min="0"
				value={current}
				{max}
				onchange={({ target }) => updateCurrent?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls}
			/>
			/
			<input
				class="nimble-resource-bar__input nimble-resource-bar__input--max"
				type="number"
				min="0"
				value={max}
				onchange={({ target }) => updateMax?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls || disableMaxEdit}
			/>
		</div>
	</div>
</div>

<style lang="scss">
	.nimble-resource-bar {
		--nimble-resource-input-text-size: var(--nimble-sm-text);
		--nimble-resource-input-font-weight: 600;
		// Overridden per resource so mana, charges and anything else added later
		// share one bar and differ only in colour.
		--nimble-resource-bar-border-color: hsl(41, 18%, 54%);
		--nimble-resource-bar-fill: linear-gradient(
			to right,
			hsl(207deg 47% 20%) 0%,
			hsl(212deg 47% 44%) 100%
		);

		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		width: 100%;
		background-color: var(--nimble-hp-bar-background);
		border: var(--nimble-hp-bar-border-thickness, 1px) solid var(--nimble-resource-bar-border-color);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);
		font-weight: 600;
		text-shadow: 0 0 4px var(--nimble-resource-bar-border-color);

		&--compact {
			--nimble-resource-input-text-size: var(--nimble-xs-text);
			--form-field-height: 1rem;
			--nimble-resource-input-font-weight: 500;
		}

		&__bar {
			flex: 1;
			position: relative;
			overflow: hidden;
			display: flex;
			align-items: center;

			&::before {
				content: '';
				position: absolute;
				display: block;
				height: 100%;
				width: var(--nimble-resource-bar-percentage);
				box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
				background: var(--nimble-resource-bar-fill);
				z-index: 0;
				border-radius: 4px 0 0 4px;
				transition: width 0.2s ease-in-out;
			}
		}

		&__values {
			position: relative;
			display: flex;
			flex-wrap: nowrap;
			gap: 0.25rem;
			align-items: center;
			justify-content: center;
			width: 100%;
			font-size: var(--nimble-resource-input-text-size);
			font-weight: var(--nimble-resource-input-font-weight);
			color: #fff;
			z-index: 5;
		}

		&__input[type] {
			--input-height: 1rem;

			font-size: var(--nimble-resource-input-text-size);
			text-align: center;
			text-shadow: inherit;
			color: inherit;
			border: 0;
			background: transparent;
			font-weight: var(--nimble-resource-input-font-weight);
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

		&__input--current[type] {
			text-align: end;
		}

		&__input--max[type] {
			text-align: start;
		}
	}
</style>

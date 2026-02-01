<script lang="ts">
	interface BaseProps {
		currentMana: number;
		maxMana: number;
		compact?: boolean;
		disableControls?: boolean;
		disableMaxManaEdit?: boolean;
		updateCurrentMana?: (value: number) => void;
		updateMaxMana?: (value: number) => void;
	}

	interface WithoutControls extends BaseProps {
		disableControls: true;
	}

	interface WithControls extends BaseProps {
		disableControls?: false;
		updateCurrentMana: NonNullable<BaseProps['updateCurrentMana']>;
		updateMaxMana: NonNullable<BaseProps['updateMaxMana']>;
	}

	type Props = WithControls | WithoutControls;

	let {
		currentMana,
		maxMana,
		compact = false,
		disableControls = false,
		disableMaxManaEdit = false,
		updateCurrentMana,
		updateMaxMana,
	}: Props = $props();
</script>

<div
	class="nimble-mana-bar"
	class:nimble-mana-bar--compact={compact}
	style="--nimble-mana-bar-percentage: {maxMana > 0
		? Math.clamp(0, Math.round((currentMana / maxMana) * 100), 100)
		: 0}%"
>
	<div class="nimble-mana-bar__bar">
		<div class="nimble-mana-bar__values">
			<input
				class="nimble-mana-bar__input nimble-mana-bar__input--current"
				type="number"
				min="0"
				value={currentMana}
				max={maxMana}
				onchange={({ target }) => updateCurrentMana?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls}
			/>
			/
			<input
				class="nimble-mana-bar__input nimble-mana-bar__input--max"
				type="number"
				min="0"
				value={maxMana}
				onchange={({ target }) => updateMaxMana?.(Number((target as HTMLInputElement).value))}
				disabled={disableControls || disableMaxManaEdit}
			/>
		</div>
	</div>
</div>

<style lang="scss">
	.nimble-mana-bar {
		--nimble-mana-input-text-size: var(--nimble-sm-text);
		--nimble-mana-input-font-weight: 600;

		grid-area: manaBar;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		width: 100%;
		background-color: var(--nimble-hp-bar-background);
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41, 18%, 54%);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);
		font-weight: 600;
		text-shadow: 0 0 4px hsl(41, 18%, 54%);

		&--compact {
			--nimble-mana-input-text-size: var(--nimble-xs-text);
			--form-field-height: 1rem;
			--nimble-mana-input-font-weight: 500;
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
				width: var(--nimble-mana-bar-percentage);
				box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
				background: linear-gradient(to right, hsl(207deg 47% 20%) 0%, hsl(212deg 47% 44%) 100%);
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
			font-size: var(--nimble-mana-input-text-size);
			font-weight: var(--nimble-mana-input-font-weight);
			color: #fff;
			z-index: 5;
		}

		&__input[type] {
			--input-height: 1rem;

			font-size: var(--nimble-mana-input-text-size);
			text-align: center;
			text-shadow: inherit;
			color: inherit;
			border: 0;
			background: transparent;
			font-weight: var(--nimble-mana-input-font-weight);
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

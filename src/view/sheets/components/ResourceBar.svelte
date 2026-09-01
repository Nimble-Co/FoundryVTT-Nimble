<script lang="ts">
	import type { ResourceBarProps } from '#types/components/ResourceBar.d.ts';

	let {
		current,
		max,
		compact = false,
		disableControls = false,
		disableMaxEdit = false,
		updateCurrent,
		updateMax,
	}: ResourceBarProps = $props();
</script>

<div
	class="nimble-resource-bar"
	class:nimble-resource-bar--compact={compact}
	style="--nimble-resource-bar-percentage: {max > 0
		? Math.clamp(Math.round((current / max) * 100), 0, 100)
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
		// Colours come from the theme so the bar reads correctly in both light
		// and dark mode. A caller may override them per resource, so mana,
		// charges and anything added later share one bar and differ in colour.

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
				box-shadow: 0 0 6px var(--nimble-resource-bar-shadow-color);
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
			color: var(--nimble-resource-bar-text-color);
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

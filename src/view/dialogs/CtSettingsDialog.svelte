<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		COLOR_PRESETS,
		CtSettingsDialogState,
		HP_BAR_TEXT_MODE_OPTIONS,
		MAX_LEVEL,
		MIN_LEVEL,
	} from './ctSettingsDialog/state.svelte.js';

	const state = new CtSettingsDialogState();

	onMount(() => {
		state.mount();
	});

	onDestroy(() => {
		state.destroy();
	});
</script>

<section class="nimble-sheet__body nimble-ct-settings standard-form">
	<fieldset class="nimble-ct-settings__section">
		<legend class="nimble-ct-settings__section-title">Size</legend>
		<div class="nimble-ct-settings__rows">
			<div class="nimble-ct-settings__row nimble-ct-settings__row--slider">
				<label class="nimble-ct-settings__label" for="nimble-ct-width">Width</label>
				<div class="nimble-ct-settings__slider-fields">
					<input
						id="nimble-ct-width"
						type="range"
						class="nimble-ct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={state.widthLevel}
						oninput={state.handleWidthLevelInput}
						onchange={state.handleWidthLevelInput}
						onpointerdown={() => state.setWidthSliderPreviewActive(true)}
						onpointerup={() => state.setWidthSliderPreviewActive(false)}
						onpointercancel={() => state.setWidthSliderPreviewActive(false)}
						onfocus={() => state.setWidthSliderPreviewActive(true)}
						onblur={() => state.setWidthSliderPreviewActive(false)}
					/>
					<span class="nimble-ct-settings__slider-value">{state.widthLevel}</span>
				</div>
			</div>
			<div class="nimble-ct-settings__row nimble-ct-settings__row--slider">
				<label class="nimble-ct-settings__label" for="nimble-ct-card-size">Card Size</label>
				<div class="nimble-ct-settings__slider-fields">
					<input
						id="nimble-ct-card-size"
						type="range"
						class="nimble-ct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={state.cardSizeLevel}
						oninput={state.handleCardSizeLevelInput}
						onchange={state.handleCardSizeLevelInput}
						onpointerdown={() => state.setCardSizeSliderPreviewActive(true)}
						onpointerup={() => state.setCardSizeSliderPreviewActive(false)}
						onpointercancel={() => state.setCardSizeSliderPreviewActive(false)}
						onfocus={() => state.setCardSizeSliderPreviewActive(true)}
						onblur={() => state.setCardSizeSliderPreviewActive(false)}
					/>
					<span class="nimble-ct-settings__slider-value">{state.cardSizeLevel}</span>
				</div>
			</div>
		</div>
	</fieldset>

	<fieldset class="nimble-ct-settings__section">
		<legend class="nimble-ct-settings__section-title">Drawers &amp; Bars</legend>
		<div class="nimble-ct-settings__rows">
			<div class="nimble-ct-settings__row">
				<label class="nimble-ct-settings__label" for="nimble-ct-resource-drawer-hover">
					Resource Drawer Opens On Hover
				</label>
				<input
					id="nimble-ct-resource-drawer-hover"
					type="checkbox"
					checked={state.resourceDrawerHoverEnabled}
					onchange={state.handleResourceDrawerHoverChange}
				/>
			</div>
			<div class="nimble-ct-settings__row">
				<label class="nimble-ct-settings__label" for="nimble-ct-player-hp-bar-text-mode">
					Player HP Bar Text
				</label>
				<select
					id="nimble-ct-player-hp-bar-text-mode"
					class="nimble-ct-settings__select"
					value={state.playerHpBarTextMode}
					onchange={state.handlePlayerHpBarTextModeChange}
				>
					{#each HP_BAR_TEXT_MODE_OPTIONS as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			{#if state.canManageSharedCtSettings}
				<div class="nimble-ct-settings__row">
					<label class="nimble-ct-settings__label" for="nimble-ct-non-player-hp-bar">
						Show Non-player HP Bar
					</label>
					<input
						id="nimble-ct-non-player-hp-bar"
						type="checkbox"
						checked={state.nonPlayerHpBarEnabled}
						onchange={state.handleNonPlayerHpBarEnabledChange}
					/>
				</div>
				<div class="nimble-ct-settings__row">
					<label class="nimble-ct-settings__label" for="nimble-ct-non-player-hp-bar-text-mode">
						Non-player HP Bar Text
					</label>
					<select
						id="nimble-ct-non-player-hp-bar-text-mode"
						class="nimble-ct-settings__select"
						value={state.nonPlayerHpBarTextMode}
						disabled={!state.nonPlayerHpBarEnabled}
						onchange={state.handleNonPlayerHpBarTextModeChange}
					>
						{#each HP_BAR_TEXT_MODE_OPTIONS as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>
	</fieldset>

	<fieldset class="nimble-ct-settings__section">
		<legend class="nimble-ct-settings__section-title">Colors</legend>
		<div class="nimble-ct-settings__rows">
			<div class="nimble-ct-settings__color-row">
				<div class="nimble-ct-settings__color-head">
					<label class="nimble-ct-settings__label" for="nimble-ct-action-color">Action Color</label>
				</div>
				<div class="nimble-ct-settings__color-controls">
					{#each COLOR_PRESETS as preset}
						<button
							type="button"
							class="nimble-ct-settings__color-swatch"
							class:nimble-ct-settings__color-swatch--active={state.actionColor === preset.color}
							style={`--nimble-ct-color: ${preset.color};`}
							aria-label={preset.label}
							data-tooltip={preset.label}
							onclick={() => state.applyActionColor(preset.color)}
						></button>
					{/each}
					<input
						id="nimble-ct-action-color"
						type="color"
						class="nimble-ct-settings__color-picker"
						value={state.actionColor}
						oninput={(event) =>
							state.applyActionColor((event.currentTarget as HTMLInputElement).value)}
						onchange={(event) =>
							state.applyActionColor((event.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			</div>
			<div class="nimble-ct-settings__color-row">
				<div class="nimble-ct-settings__color-head">
					<label class="nimble-ct-settings__label" for="nimble-ct-reaction-color"
						>Reaction Color</label
					>
				</div>
				<div class="nimble-ct-settings__color-controls">
					{#each COLOR_PRESETS as preset}
						<button
							type="button"
							class="nimble-ct-settings__color-swatch"
							class:nimble-ct-settings__color-swatch--active={state.reactionColor === preset.color}
							style={`--nimble-ct-color: ${preset.color};`}
							aria-label={preset.label}
							data-tooltip={preset.label}
							onclick={() => state.applyReactionColor(preset.color)}
						></button>
					{/each}
					<input
						id="nimble-ct-reaction-color"
						type="color"
						class="nimble-ct-settings__color-picker"
						value={state.reactionColor}
						oninput={(event) =>
							state.applyReactionColor((event.currentTarget as HTMLInputElement).value)}
						onchange={(event) =>
							state.applyReactionColor((event.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			</div>
		</div>
	</fieldset>
</section>

<style lang="scss">
	:global(
		.system-nimble
			.nimble-sheet.nimble-dialog:has(.nimble-ct-settings)
			*:not(.fa-classic, .fa-light, .fa-regular, .fa-solid, .fa-thin, .fal, .far, .fas, .fat)
	) {
		font-family: var(--font-primary, sans-serif) !important;
	}

	.nimble-ct-settings,
	.nimble-ct-settings
		:not(.fa-classic, .fa-light, .fa-regular, .fa-solid, .fa-thin, .fal, .far, .fas, .fat) {
		font-family: var(--font-primary, sans-serif);
	}

	.nimble-ct-settings {
		--nimble-ct-text-primary: var(--color-text-primary, var(--nimble-dark-text-color));
		--nimble-ct-text-secondary: var(
			--color-text-secondary,
			color-mix(in srgb, var(--nimble-ct-text-primary) 72%, transparent)
		);
		--nimble-ct-border: var(
			--color-border-light-secondary,
			color-mix(in srgb, hsl(36 58% 64%) 48%, transparent)
		);
		--nimble-ct-panel-bg: color-mix(
			in srgb,
			var(--color-bg-option, hsl(235 20% 22%)) 26%,
			transparent
		);
		--nimble-ct-control-bg: color-mix(
			in srgb,
			var(--color-bg-option, hsl(235 20% 20%)) 72%,
			transparent
		);
		--nimble-ct-control-border: color-mix(in srgb, var(--nimble-ct-border) 75%, transparent);
		--nimble-ct-slider-track: color-mix(in srgb, var(--nimble-ct-text-primary) 18%, transparent);
		--nimble-ct-slider-thumb-border: var(--color-border-highlight, hsl(40 86% 74%));
		--nimble-ct-slider-thumb-bg: color-mix(in srgb, var(--nimble-ct-control-bg) 88%, black 12%);
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.62rem;
		color: var(--nimble-ct-text-primary);
		font-size: var(--font-size-14, 0.875rem);
		line-height: 1.3;
	}

	:global(.theme-light) .nimble-ct-settings {
		--nimble-ct-text-primary: hsl(220 28% 18%);
		--nimble-ct-text-secondary: color-mix(in srgb, var(--nimble-ct-text-primary) 78%, white 22%);
		--nimble-ct-border: color-mix(in srgb, hsl(39 42% 58%) 44%, hsl(216 20% 64%) 56%);
		--nimble-ct-panel-bg: color-mix(in srgb, white 84%, hsl(42 24% 90%) 16%);
		--nimble-ct-control-bg: white;
		--nimble-ct-control-border: color-mix(in srgb, var(--nimble-ct-border) 82%, transparent);
		--nimble-ct-slider-track: color-mix(in srgb, hsl(218 24% 42%) 24%, white 76%);
		--nimble-ct-slider-thumb-border: color-mix(in srgb, hsl(41 70% 56%) 58%, hsl(216 22% 56%) 42%);
		--nimble-ct-slider-thumb-bg: white;
	}

	.nimble-ct-settings__section {
		margin: 0;
		min-width: 0;
		border: 1px solid var(--nimble-ct-border);
		border-radius: 0.38rem;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		background: var(--nimble-ct-panel-bg);
	}

	.nimble-ct-settings__section-title {
		margin-inline-start: 0.3rem;
		padding-inline: 0.3rem;
		font-size: var(--font-size-14, 0.875rem);
		line-height: 1;
		font-weight: 700;
		color: var(--nimble-ct-text-primary);
	}

	.nimble-ct-settings__rows {
		display: flex;
		flex-direction: column;
		gap: 0.36rem;
	}

	.nimble-ct-settings__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
	}

	.nimble-ct-settings__row--slider {
		align-items: start;
	}

	.nimble-ct-settings__label {
		font-weight: 700;
		font-size: var(--font-size-14, 0.875rem);
	}

	.nimble-ct-settings__slider-fields {
		display: grid;
		grid-template-columns: minmax(9rem, 1fr) auto;
		align-items: center;
		gap: 0.6rem;
	}

	.nimble-ct-settings__slider-input {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 0.24rem;
		margin: 0;
		border: 0;
		border-radius: 999px;
		background: var(--nimble-ct-slider-track);
	}

	.nimble-ct-settings__slider-input::-webkit-slider-runnable-track {
		height: 0.24rem;
		border-radius: 999px;
		background: var(--nimble-ct-slider-track);
	}

	.nimble-ct-settings__slider-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 0.76rem;
		height: 0.76rem;
		margin-top: -0.26rem;
		border: 1px solid var(--nimble-ct-slider-thumb-border);
		border-radius: 0.22rem;
		background: var(--nimble-ct-slider-thumb-bg);
		box-shadow: 0 0 0.24rem
			color-mix(in srgb, var(--nimble-ct-slider-thumb-border) 42%, transparent);
		cursor: pointer;
	}

	.nimble-ct-settings__slider-input::-moz-range-track {
		height: 0.24rem;
		border: 0;
		border-radius: 999px;
		background: var(--nimble-ct-slider-track);
	}

	.nimble-ct-settings__slider-input::-moz-range-thumb {
		width: 0.76rem;
		height: 0.76rem;
		border: 1px solid var(--nimble-ct-slider-thumb-border);
		border-radius: 0.22rem;
		background: var(--nimble-ct-slider-thumb-bg);
		box-shadow: 0 0 0.24rem
			color-mix(in srgb, var(--nimble-ct-slider-thumb-border) 42%, transparent);
		cursor: pointer;
	}

	.nimble-ct-settings__slider-value {
		min-width: 2rem;
		height: 1.65rem;
		padding-inline: 0.4rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		border: 1px solid var(--nimble-ct-control-border);
		border-radius: 0.28rem;
		background: var(--nimble-ct-control-bg);
		color: var(--nimble-ct-text-primary);
		font-size: var(--font-size-14, 0.875rem);
	}

	:global(.theme-light) .nimble-ct-settings__slider-value,
	:global(.theme-light) .nimble-ct-settings__select {
		background: white;
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, white 68%, transparent),
			0 0.08rem 0.18rem color-mix(in srgb, hsl(220 18% 46%) 12%, transparent);
	}

	.nimble-ct-settings__select {
		inline-size: 8.5rem;
		min-width: 8.5rem;
		padding: 0.28rem 0.48rem;
		border: 1px solid var(--nimble-ct-control-border);
		border-radius: 0.28rem;
		background: var(--nimble-ct-control-bg);
		color: var(--nimble-ct-text-primary);
		justify-self: end;
	}

	.nimble-ct-settings__color-row {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}

	.nimble-ct-settings__color-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.nimble-ct-settings__color-controls {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.nimble-ct-settings__color-swatch {
		-webkit-appearance: none;
		appearance: none;
		display: inline-block;
		inline-size: 1.28rem;
		block-size: 1.28rem;
		min-width: 0;
		min-height: 0;
		flex: 0 0 1.28rem;
		box-sizing: border-box;
		aspect-ratio: 1 / 1;
		padding: 0;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--nimble-ct-border) 72%, transparent);
		background: var(--nimble-ct-color, #ffffff);
		cursor: pointer;
	}

	.nimble-ct-settings__color-swatch:hover,
	.nimble-ct-settings__color-swatch:focus-visible {
		filter: brightness(1.08);
	}

	.nimble-ct-settings__color-swatch--active {
		box-shadow: 0 0 0 0.1rem color-mix(in srgb, hsl(39 82% 74%) 65%, white 35%);
		border-color: color-mix(in srgb, hsl(41 82% 74%) 72%, white 28%);
	}

	.nimble-ct-settings__color-picker {
		-webkit-appearance: none;
		appearance: none;
		inline-size: 3.45rem;
		block-size: 2.1rem;
		min-width: 0;
		min-height: 0;
		box-sizing: border-box;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--nimble-ct-border) 72%, transparent);
		border-radius: 0.3rem;
		background: var(--nimble-ct-control-bg);
		cursor: pointer;
	}

	.nimble-ct-settings__color-picker::-webkit-color-swatch-wrapper {
		padding: 0.14rem;
	}

	.nimble-ct-settings__color-picker::-webkit-color-swatch {
		border: 0;
		border-radius: 0.18rem;
	}

	.nimble-ct-settings__color-picker::-moz-color-swatch {
		border: 0;
		border-radius: 0.18rem;
	}
</style>

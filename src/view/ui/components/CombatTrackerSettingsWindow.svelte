<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		COMBAT_TRACKER_LOCATION_VALUES,
		CURRENT_TURN_ANIMATION_SETTING_KEYS,
		getCombatTrackerLocation,
		getCurrentTurnAnimationSettings,
		isCombatTrackerLocationSettingKey,
		isCurrentTurnAnimationSettingKey,
		normalizeCurrentTurnAnimationSliderValue,
		setCombatTrackerLocation,
		setCurrentTurnAnimationSetting,
		type CombatTrackerLocation,
		type CurrentTurnAnimationSettings,
	} from '../../../settings/combatTrackerSettings.js';

	interface RoleControlRow {
		label: string;
		gmView: boolean;
		gmModify: boolean;
		playerView: boolean;
		playerModify: boolean;
	}

	let { dialog, isGM } = $props();
	let currentTurnAnimations: CurrentTurnAnimationSettings = $state(
		getCurrentTurnAnimationSettings(),
	);
	let combatTrackerLocation: CombatTrackerLocation = $state(getCombatTrackerLocation());
	let settingUpdateHook: number | undefined;

	const CURRENT_TURN_ANIMATION_SLIDER_MARKERS = [0, 25, 50, 75, 100] as const;
	const CURRENT_TURN_ANIMATION_SLIDER_SNAP_THRESHOLD = 4;

	const roleControlRows: RoleControlRow[] = [
		{
			label: 'Current turn animations',
			gmView: true,
			gmModify: true,
			playerView: true,
			playerModify: false,
		},
		{
			label: 'Combat tracker location',
			gmView: true,
			gmModify: true,
			playerView: true,
			playerModify: false,
		},
		{
			label: 'Players can move other players cards',
			gmView: true,
			gmModify: true,
			playerView: true,
			playerModify: false,
		},
		{
			label: 'Warn on End Turn with actions left',
			gmView: true,
			gmModify: true,
			playerView: true,
			playerModify: false,
		},
	];

	function syncCurrentTurnAnimationSettings() {
		currentTurnAnimations = getCurrentTurnAnimationSettings();
	}

	function syncCombatTrackerLocation() {
		combatTrackerLocation = getCombatTrackerLocation();
	}

	function emitCurrentTurnAnimationSettingsPreview() {
		window.dispatchEvent(
			new CustomEvent('nimble-combat-tracker-animation-settings-preview', {
				detail: {
					settings: currentTurnAnimations,
				},
			}),
		);
	}

	function emitCombatTrackerLocationPreview() {
		window.dispatchEvent(
			new CustomEvent('nimble-combat-tracker-location-preview', {
				detail: {
					location: combatTrackerLocation,
				},
			}),
		);
	}

	function getSoftSnappedSliderValue(value: number): number {
		const normalizedValue = normalizeCurrentTurnAnimationSliderValue(value);

		let bestMarker = normalizedValue;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const marker of CURRENT_TURN_ANIMATION_SLIDER_MARKERS) {
			const distance = Math.abs(normalizedValue - marker);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestMarker = marker;
			}
		}

		return bestDistance <= CURRENT_TURN_ANIMATION_SLIDER_SNAP_THRESHOLD
			? bestMarker
			: normalizedValue;
	}

	function previewCurrentTurnAnimationSetting(
		settingKey: (typeof CURRENT_TURN_ANIMATION_SETTING_KEYS)[keyof typeof CURRENT_TURN_ANIMATION_SETTING_KEYS],
		value: boolean | string | number,
	) {
		currentTurnAnimations = {
			...currentTurnAnimations,
			[settingKey]: value,
		};
		emitCurrentTurnAnimationSettingsPreview();
	}

	async function updateCurrentTurnAnimationSetting(
		settingKey: (typeof CURRENT_TURN_ANIMATION_SETTING_KEYS)[keyof typeof CURRENT_TURN_ANIMATION_SETTING_KEYS],
		value: boolean | string | number,
	) {
		if (!isGM) return;
		previewCurrentTurnAnimationSetting(settingKey, value);

		try {
			await setCurrentTurnAnimationSetting(settingKey, value);
		} catch (_error) {
			ui.notifications?.error('Unable to update combat tracker animation setting.');
		} finally {
			syncCurrentTurnAnimationSettings();
			emitCurrentTurnAnimationSettingsPreview();
		}
	}

	function handleCurrentTurnAnimationSliderInput(
		settingKey:
			| typeof CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed
			| typeof CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize
			| typeof CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize,
		rawValue: string,
		target: EventTarget & HTMLInputElement,
	) {
		const snappedValue = getSoftSnappedSliderValue(Number(rawValue));
		if (target.value !== String(snappedValue)) {
			target.value = String(snappedValue);
		}
		void updateCurrentTurnAnimationSetting(settingKey, snappedValue);
	}

	function isInactiveCombatTrackerLocation(location: CombatTrackerLocation): boolean {
		return location === 'top' || location === 'bottom';
	}

	async function updateCombatTrackerLocation(location: CombatTrackerLocation) {
		if (!isGM) return;
		if (isInactiveCombatTrackerLocation(location)) {
			syncCombatTrackerLocation();
			return;
		}

		combatTrackerLocation = location;
		emitCombatTrackerLocationPreview();

		try {
			await setCombatTrackerLocation(location);
		} catch (_error) {
			ui.notifications?.error('Unable to update combat tracker location.');
		} finally {
			syncCombatTrackerLocation();
			emitCombatTrackerLocationPreview();
		}
	}

	onMount(() => {
		syncCurrentTurnAnimationSettings();
		syncCombatTrackerLocation();

		settingUpdateHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCurrentTurnAnimationSettingKey(settingKey)) {
				syncCurrentTurnAnimationSettings();
			}
			if (isCombatTrackerLocationSettingKey(settingKey)) {
				syncCombatTrackerLocation();
			}
		});
	});

	onDestroy(() => {
		if (settingUpdateHook !== undefined) {
			Hooks.off('updateSetting', settingUpdateHook);
		}
	});
</script>

<article class="nimble-sheet__body nimble-combat-tracker-settings">
	<header class="nimble-combat-tracker-settings__intro">
		<h2 class="nimble-heading" data-heading-variant="section">Combat Tracker Settings</h2>
		<p class="nimble-combat-tracker-settings__intro-text">
			Current Turn Animation controls are live. All other sections remain preview-only.
		</p>
		<p class="nimble-combat-tracker-settings__role">
			Current role preview:
			<span class="nimble-combat-tracker-settings__role-badge">{isGM ? 'GM' : 'Player'}</span>
		</p>
	</header>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Current Turn Animations</h3>
		<div class="nimble-combat-tracker-settings__controls">
			<div class="nimble-combat-tracker-settings__control-group">
				<div class="nimble-combat-tracker-settings__control-row">
					<div class="nimble-combat-tracker-settings__control-main">
						<input
							class="nimble-combat-tracker-settings__control-toggle"
							type="checkbox"
							checked={currentTurnAnimations.pulseAnimation}
							disabled={!isGM}
							onchange={({ target }) =>
								updateCurrentTurnAnimationSetting(
									CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation,
									target.checked,
								)}
						/>
						<span>Pulse animation</span>
					</div>
				</div>
				<div class="nimble-combat-tracker-settings__slider-row">
					<input
						class="nimble-combat-tracker-settings__slider"
						type="range"
						min="0"
						max="100"
						step="1"
						list="nimble-combat-tracker-animation-slider-marks"
						value={currentTurnAnimations.pulseSpeed}
						disabled={!isGM}
						oninput={({ target }) =>
							handleCurrentTurnAnimationSliderInput(
								CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed,
								target.value,
								target,
							)}
					/>
				</div>
			</div>

			<div class="nimble-combat-tracker-settings__control-group">
				<div class="nimble-combat-tracker-settings__control-row">
					<div class="nimble-combat-tracker-settings__control-main">
						<input
							class="nimble-combat-tracker-settings__control-toggle"
							type="checkbox"
							checked={currentTurnAnimations.borderGlow}
							disabled={!isGM}
							onchange={({ target }) =>
								updateCurrentTurnAnimationSetting(
									CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlow,
									target.checked,
								)}
						/>
						<span>Border glow</span>
						<input
							class="nimble-combat-tracker-settings__control-color"
							type="color"
							value={currentTurnAnimations.borderGlowColor}
							disabled={!isGM}
							oninput={({ target }) =>
								updateCurrentTurnAnimationSetting(
									CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor,
									target.value,
								)}
						/>
					</div>
				</div>
				<div class="nimble-combat-tracker-settings__slider-row">
					<input
						class="nimble-combat-tracker-settings__slider"
						type="range"
						min="0"
						max="100"
						step="1"
						list="nimble-combat-tracker-animation-slider-marks"
						value={currentTurnAnimations.borderGlowSize}
						disabled={!isGM}
						oninput={({ target }) =>
							handleCurrentTurnAnimationSliderInput(
								CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize,
								target.value,
								target,
							)}
					/>
				</div>
			</div>

			<div class="nimble-combat-tracker-settings__control-group">
				<div class="nimble-combat-tracker-settings__control-row">
					<div class="nimble-combat-tracker-settings__control-main">
						<input
							class="nimble-combat-tracker-settings__control-toggle"
							type="checkbox"
							checked={currentTurnAnimations.edgeCrawler}
							disabled={!isGM}
							onchange={({ target }) =>
								updateCurrentTurnAnimationSetting(
									CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawler,
									target.checked,
								)}
						/>
						<span>Edge crawler</span>
						<input
							class="nimble-combat-tracker-settings__control-color"
							type="color"
							value={currentTurnAnimations.edgeCrawlerColor}
							disabled={!isGM}
							oninput={({ target }) =>
								updateCurrentTurnAnimationSetting(
									CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor,
									target.value,
								)}
						/>
					</div>
				</div>
				<div class="nimble-combat-tracker-settings__slider-row">
					<input
						class="nimble-combat-tracker-settings__slider"
						type="range"
						min="0"
						max="100"
						step="1"
						list="nimble-combat-tracker-animation-slider-marks"
						value={currentTurnAnimations.edgeCrawlerSize}
						disabled={!isGM}
						oninput={({ target }) =>
							handleCurrentTurnAnimationSliderInput(
								CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize,
								target.value,
								target,
							)}
					/>
				</div>
			</div>
		</div>
		<datalist id="nimble-combat-tracker-animation-slider-marks">
			<option value="0"></option>
			<option value="25"></option>
			<option value="50"></option>
			<option value="75"></option>
			<option value="100"></option>
		</datalist>
	</section>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Combat Tracker Location</h3>
		<label class="nimble-combat-tracker-settings__control-row" for="nimble-combat-tracker-location">
			<span>Layout position</span>
			<select
				id="nimble-combat-tracker-location"
				value={combatTrackerLocation}
				disabled={!isGM}
				onchange={({ target }) =>
					updateCombatTrackerLocation(target.value as CombatTrackerLocation)}
			>
				{#each COMBAT_TRACKER_LOCATION_VALUES as location}
					<option value={location}>{location.charAt(0).toUpperCase() + location.slice(1)}</option>
				{/each}
			</select>
		</label>
		<p class="nimble-combat-tracker-settings__hint">
			Top and Bottom are placeholder options and currently do nothing.
		</p>
	</section>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Player Permissions</h3>
		<label class="nimble-combat-tracker-settings__control-row">
			<span>Allow players to move other players&apos; cards</span>
			<input type="checkbox" disabled />
		</label>
	</section>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Turn Management Safety</h3>
		<label class="nimble-combat-tracker-settings__control-row">
			<span>Warn players when clicking &quot;End Turn&quot; with actions remaining</span>
			<input type="checkbox" checked disabled />
		</label>
	</section>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Role-Based Controls (Preview)</h3>
		<p class="nimble-combat-tracker-settings__hint">
			The GM-facing permission matrix below is UI-only and not yet wired to behavior.
		</p>
		<table class="nimble-combat-tracker-settings__matrix">
			<thead>
				<tr>
					<th>Setting</th>
					<th>GM View</th>
					<th>GM Modify</th>
					<th>Player View</th>
					<th>Player Modify</th>
				</tr>
			</thead>
			<tbody>
				{#each roleControlRows as row}
					<tr>
						<td>{row.label}</td>
						<td><input type="checkbox" checked={row.gmView} disabled /></td>
						<td><input type="checkbox" checked={row.gmModify} disabled /></td>
						<td><input type="checkbox" checked={row.playerView} disabled /></td>
						<td><input type="checkbox" checked={row.playerModify} disabled /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="nimble-combat-tracker-settings__section">
		<h3 class="nimble-heading" data-heading-variant="section">Extensibility</h3>
		<p class="nimble-combat-tracker-settings__hint">
			Additional combat tracker settings can be added to this window over time.
		</p>
	</section>
</article>

<footer class="nimble-sheet__footer nimble-combat-tracker-settings__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={() => dialog.close()}>
		Close
	</button>
</footer>

<style lang="scss">
	.nimble-combat-tracker-settings {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.nimble-combat-tracker-settings__intro {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem;
		border: 1px solid hsla(41, 18%, 54%, 0.25);
		border-radius: 4px;
		background: color-mix(in srgb, var(--nimble-sheet-background, #1b1b22) 75%, transparent);
	}

	.nimble-combat-tracker-settings__intro-text,
	.nimble-combat-tracker-settings__role,
	.nimble-combat-tracker-settings__hint {
		margin: 0;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
	}

	.nimble-combat-tracker-settings__role-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.05rem 0.4rem;
		margin-inline-start: 0.2rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--nimble-light-text-color);
		background: var(--nimble-dark-text-color);
		border-radius: 999px;
	}

	.nimble-combat-tracker-settings__section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem;
		border: 1px solid hsla(41, 18%, 54%, 0.25);
		border-radius: 4px;
		background: color-mix(in srgb, var(--nimble-sheet-background, #1b1b22) 68%, transparent);
	}

	.nimble-combat-tracker-settings__controls {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.nimble-combat-tracker-settings__control-group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-block: 0.1rem;
	}

	.nimble-combat-tracker-settings__control-row {
		display: flex;
		justify-content: flex-start;
		gap: 0.45rem;
		align-items: center;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-dark-text-color);
	}

	.nimble-combat-tracker-settings__control-main {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: 0.55rem;
	}

	.nimble-combat-tracker-settings__control-toggle {
		margin: 0;
	}

	.nimble-combat-tracker-settings__control-color {
		width: 1.8rem;
		height: 1.25rem;
		margin-inline-start: 0.45rem;
		padding: 0.1rem;
		border-radius: 2px;
	}

	.nimble-combat-tracker-settings__slider-row {
		position: relative;
		display: flex;
		align-items: center;
		padding-inline: 1.35rem 0.2rem;

		&::before {
			content: '';
			position: absolute;
			inset-block-start: calc(50% + 0.58rem);
			inset-inline: 1.35rem 0.2rem;
			height: 0.3rem;
			pointer-events: none;
			opacity: 0.8;
			background-image:
				radial-gradient(
					circle,
					color-mix(in srgb, var(--nimble-medium-text-color) 78%, transparent) 35%,
					transparent 36%
				),
				radial-gradient(
					circle,
					color-mix(in srgb, var(--nimble-medium-text-color) 78%, transparent) 35%,
					transparent 36%
				),
				radial-gradient(
					circle,
					color-mix(in srgb, var(--nimble-medium-text-color) 78%, transparent) 35%,
					transparent 36%
				),
				radial-gradient(
					circle,
					color-mix(in srgb, var(--nimble-medium-text-color) 78%, transparent) 35%,
					transparent 36%
				),
				radial-gradient(
					circle,
					color-mix(in srgb, var(--nimble-medium-text-color) 78%, transparent) 35%,
					transparent 36%
				);
			background-repeat: no-repeat;
			background-size:
				0.34rem 0.34rem,
				0.34rem 0.34rem,
				0.34rem 0.34rem,
				0.34rem 0.34rem,
				0.34rem 0.34rem;
			background-position:
				0% 50%,
				25% 50%,
				50% 50%,
				75% 50%,
				100% 50%;
		}
	}

	.nimble-combat-tracker-settings__slider {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		z-index: 1;
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		box-shadow: none;

		&:focus {
			outline: none;
			box-shadow: none;
		}

		&::-webkit-slider-runnable-track {
			height: 0.28rem;
			border: 0;
			border-radius: 999px;
			background: color-mix(in srgb, var(--nimble-medium-text-color) 35%, transparent);
		}

		&::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 0.78rem;
			height: 0.78rem;
			margin-top: -0.25rem;
			border: 1px solid color-mix(in srgb, var(--nimble-dark-text-color) 70%, transparent);
			border-radius: 50%;
			background: color-mix(in srgb, var(--nimble-dark-text-color) 90%, white 10%);
			box-shadow: 0 0 4px color-mix(in srgb, var(--nimble-dark-text-color) 35%, transparent);
		}

		&::-moz-range-track {
			height: 0.28rem;
			border: 0;
			border-radius: 999px;
			background: color-mix(in srgb, var(--nimble-medium-text-color) 35%, transparent);
		}

		&::-moz-range-thumb {
			width: 0.78rem;
			height: 0.78rem;
			border: 1px solid color-mix(in srgb, var(--nimble-dark-text-color) 70%, transparent);
			border-radius: 50%;
			background: color-mix(in srgb, var(--nimble-dark-text-color) 90%, white 10%);
			box-shadow: 0 0 4px color-mix(in srgb, var(--nimble-dark-text-color) 35%, transparent);
		}
	}

	.nimble-combat-tracker-settings__control-row input:disabled,
	.nimble-combat-tracker-settings__control-row select:disabled {
		cursor: not-allowed;
		opacity: 0.85;
	}

	.nimble-combat-tracker-settings__matrix {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--nimble-xs-text);

		th,
		td {
			padding: 0.3rem 0.35rem;
			text-align: center;
			border: 1px solid hsla(41, 18%, 54%, 0.25);
		}

		th:first-child,
		td:first-child {
			text-align: left;
		}
	}

	.nimble-combat-tracker-settings__footer {
		display: flex;
		justify-content: flex-end;
	}

	[data-button-variant='basic'] {
		--nimble-button-width: fit-content;
		--nimble-button-padding: 0.4rem 0.8rem;
	}
</style>

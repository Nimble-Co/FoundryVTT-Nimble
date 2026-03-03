<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		getCombatTrackerActionDiceColor,
		getCombatTrackerCenterActiveCardEnabled,
		getCombatTrackerNcctCardSizeLevel,
		getCombatTrackerNcctWidthLevel,
		getCombatTrackerNonPlayerHitpointPermissionConfig,
		isCombatTrackerActionDiceColorSettingKey,
		isCombatTrackerCardSizeLevelSettingKey,
		isCombatTrackerCenterActiveCardSettingKey,
		isCombatTrackerNonPlayerHitpointPermissionSettingKey,
		isCombatTrackerWidthLevelSettingKey,
		setCombatTrackerActionDiceColor,
		setCombatTrackerCenterActiveCardEnabled,
		setCombatTrackerNcctCardSizeLevel,
		setCombatTrackerNcctWidthLevel,
		setCombatTrackerNonPlayerHitpointPermissionConfig,
		type CombatTrackerRolePermissionConfig,
		type CombatTrackerRolePermissionKey,
	} from '../../settings/combatTrackerSettings.js';

	const MIN_LEVEL = 1;
	const MAX_LEVEL = 6;
	const ACTION_DICE_COLOR_PRESETS = [
		{ label: 'Green', color: '#6ce685' },
		{ label: 'Red', color: '#ef5350' },
		{ label: 'Blue', color: '#4fc3f7' },
		{ label: 'Yellow', color: '#f6d44c' },
		{ label: 'Purple', color: '#b388ff' },
	] as const;
	const ROLE_COLUMNS: ReadonlyArray<{ key: CombatTrackerRolePermissionKey; label: string }> = [
		{ key: 'player', label: 'Player' },
		{ key: 'trusted', label: 'Trusted Player' },
		{ key: 'assistant', label: 'Assistant GM' },
		{ key: 'gamemaster', label: 'Gamemaster' },
	];

	let updateSettingHook: number | undefined;
	let widthLevel = $state(getCombatTrackerNcctWidthLevel());
	let cardSizeLevel = $state(getCombatTrackerNcctCardSizeLevel());
	let centerActiveCardEnabled = $state(getCombatTrackerCenterActiveCardEnabled());
	let actionDiceColor = $state(getCombatTrackerActionDiceColor());
	let nonPlayerHpPermissions = $state(getCombatTrackerNonPlayerHitpointPermissionConfig());
	let canManageWorldNcctSettings = $derived(Boolean(game.user?.isGM));

	function normalizeHexColor(value: string): string {
		const normalized = value.trim().toLowerCase();
		if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
		const shortHexMatch = /^#([0-9a-f]{3})$/.exec(normalized);
		if (shortHexMatch) {
			const [red, green, blue] = shortHexMatch[1].split('');
			return `#${red}${red}${green}${green}${blue}${blue}`;
		}
		return '#6ce685';
	}

	function clampLevel(value: unknown): number {
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return MIN_LEVEL;
		return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(numericValue)));
	}

	function handleWidthLevelInput(event: Event): void {
		if (!canManageWorldNcctSettings) return;
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = clampLevel(input.value);
		widthLevel = nextValue;
		void setCombatTrackerNcctWidthLevel(nextValue);
	}

	function handleCardSizeLevelInput(event: Event): void {
		if (!canManageWorldNcctSettings) return;
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = clampLevel(input.value);
		cardSizeLevel = nextValue;
		void setCombatTrackerNcctCardSizeLevel(nextValue);
	}

	function handleCenterActiveCardChange(event: Event): void {
		if (!canManageWorldNcctSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		centerActiveCardEnabled = checkbox.checked;
		void setCombatTrackerCenterActiveCardEnabled(checkbox.checked);
	}

	function handleNonPlayerHpPermissionChange(
		roleKey: CombatTrackerRolePermissionKey,
		event: Event,
	): void {
		if (!canManageWorldNcctSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		const nextPermissions: CombatTrackerRolePermissionConfig = {
			...nonPlayerHpPermissions,
			[roleKey]: checkbox.checked,
		};
		nonPlayerHpPermissions = nextPermissions;
		void setCombatTrackerNonPlayerHitpointPermissionConfig(nextPermissions);
	}

	function applyActionDiceColor(color: string): void {
		const normalizedColor = normalizeHexColor(color);
		actionDiceColor = normalizedColor;
		void setCombatTrackerActionDiceColor(normalizedColor);
	}

	onMount(() => {
		updateSettingHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCombatTrackerWidthLevelSettingKey(settingKey)) {
				widthLevel = getCombatTrackerNcctWidthLevel();
			}
			if (isCombatTrackerCardSizeLevelSettingKey(settingKey)) {
				cardSizeLevel = getCombatTrackerNcctCardSizeLevel();
			}
			if (isCombatTrackerCenterActiveCardSettingKey(settingKey)) {
				centerActiveCardEnabled = getCombatTrackerCenterActiveCardEnabled();
			}
			if (isCombatTrackerNonPlayerHitpointPermissionSettingKey(settingKey)) {
				nonPlayerHpPermissions = getCombatTrackerNonPlayerHitpointPermissionConfig();
			}
			if (isCombatTrackerActionDiceColorSettingKey(settingKey)) {
				actionDiceColor = getCombatTrackerActionDiceColor();
			}
		});
	});

	onDestroy(() => {
		if (updateSettingHook !== undefined) Hooks.off('updateSetting', updateSettingHook);
	});
</script>

<section class="nimble-sheet__body nimble-ncct-settings">
	{#if canManageWorldNcctSettings}
		<section class="nimble-ncct-settings__panel">
			<h3 class="nimble-ncct-settings__panel-title">Interface Size</h3>

			<div class="nimble-ncct-settings__slider-group">
				<label class="nimble-ncct-settings__label" for="nimble-ncct-width">NCCT Width</label>
				<div class="nimble-ncct-settings__slider-fields">
					<input
						id="nimble-ncct-width"
						type="range"
						class="nimble-ncct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={widthLevel}
						oninput={handleWidthLevelInput}
						onchange={handleWidthLevelInput}
					/>
					<span class="nimble-ncct-settings__slider-value">{widthLevel}</span>
				</div>
				<p class="notes">Adjust the maximum horizontal space used by NCCT.</p>
			</div>

			<div class="nimble-ncct-settings__slider-group">
				<label class="nimble-ncct-settings__label" for="nimble-ncct-card-size">NCCT Card Size</label>
				<div class="nimble-ncct-settings__slider-fields">
					<input
						id="nimble-ncct-card-size"
						type="range"
						class="nimble-ncct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={cardSizeLevel}
						oninput={handleCardSizeLevelInput}
						onchange={handleCardSizeLevelInput}
					/>
					<span class="nimble-ncct-settings__slider-value">{cardSizeLevel}</span>
				</div>
				<p class="notes">Adjust the combatant card size in the tracker.</p>
			</div>

			<div class="nimble-ncct-settings__toggle-group">
				<label class="nimble-ncct-settings__label" for="nimble-ncct-center-active-card"
					>NCCT Center Active Card</label
				>
				<div class="nimble-ncct-settings__toggle-field">
					<input
						id="nimble-ncct-center-active-card"
						type="checkbox"
						checked={centerActiveCardEnabled}
						onchange={handleCenterActiveCardChange}
					/>
				</div>
				<p class="notes">
					When enabled, NCCT keeps the active card centered and wraps the order around it.
				</p>
			</div>
		</section>

		<section class="nimble-ncct-settings__panel">
			<h3 class="nimble-ncct-settings__panel-title">Permissions</h3>
			<p class="notes">
				Configure which user role has permission to view specific NCCT card details.
			</p>
			<table class="nimble-ncct-settings__permissions-table">
				<thead>
					<tr>
						<th scope="col">Permission</th>
						{#each ROLE_COLUMNS as role}
							<th scope="col">{role.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<div class="nimble-ncct-settings__permission-title">
								Display non-player hitpoints on cards
							</div>
							<p class="notes">
								Show HP badges for NPC, Monster, Minion, and Solo Monster cards.
							</p>
						</td>
						{#each ROLE_COLUMNS as role}
							<td>
								<input
									type="checkbox"
									aria-label={`${role.label} can display non-player hitpoints on cards`}
									checked={nonPlayerHpPermissions[role.key]}
									onchange={(event) => handleNonPlayerHpPermissionChange(role.key, event)}
								/>
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</section>
	{/if}

	<section class="nimble-ncct-settings__panel">
		<h3 class="nimble-ncct-settings__panel-title">Appearance</h3>
		<div class="nimble-ncct-settings__color-group">
			<label class="nimble-ncct-settings__label" for="nimble-ncct-action-dice-color"
				>NCCT Action Dice Color</label
			>
			<div class="nimble-ncct-settings__color-controls">
				{#each ACTION_DICE_COLOR_PRESETS as preset}
					<button
						type="button"
						class="nimble-ncct-settings__color-swatch"
						class:nimble-ncct-settings__color-swatch--active={actionDiceColor === preset.color}
						style={`--nimble-ncct-color: ${preset.color};`}
						aria-label={preset.label}
						data-tooltip={preset.label}
						onclick={() => applyActionDiceColor(preset.color)}
					></button>
				{/each}
				<input
					id="nimble-ncct-action-dice-color"
					type="color"
					class="nimble-ncct-settings__color-picker"
					value={actionDiceColor}
					oninput={(event) => applyActionDiceColor((event.currentTarget as HTMLInputElement).value)}
					onchange={(event) => applyActionDiceColor((event.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<p class="notes">Personal setting. Affects only your view.</p>
		</div>
	</section>
</section>

<style lang="scss">
	.nimble-ncct-settings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.6rem;
	}
	.nimble-ncct-settings__panel {
		border: 1px solid color-mix(in srgb, hsl(36 58% 64%) 45%, transparent);
		border-radius: 0.42rem;
		padding: 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.nimble-ncct-settings__panel-title {
		margin: 0;
		font-size: 0.94rem;
		font-weight: 700;
	}
	.nimble-ncct-settings__label {
		font-weight: 700;
	}
	.nimble-ncct-settings .notes {
		margin: 0;
	}
	.nimble-ncct-settings__slider-group,
	.nimble-ncct-settings__toggle-group,
	.nimble-ncct-settings__color-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.nimble-ncct-settings__slider-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
	}
	.nimble-ncct-settings__slider-input {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 0.24rem;
		margin: 0;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(233 20% 36%) 62%, transparent);
	}
	.nimble-ncct-settings__slider-input::-webkit-slider-runnable-track {
		height: 0.24rem;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(233 20% 36%) 62%, transparent);
	}
	.nimble-ncct-settings__slider-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 0.76rem;
		height: 0.76rem;
		margin-top: -0.26rem;
		border: 1px solid color-mix(in srgb, hsl(40 86% 74%) 72%, white 28%);
		border-radius: 0.22rem;
		background: color-mix(in srgb, hsl(221 30% 12%) 92%, black 8%);
		box-shadow: 0 0 0.22rem color-mix(in srgb, hsl(41 94% 67%) 52%, transparent);
		cursor: pointer;
	}
	.nimble-ncct-settings__slider-input::-moz-range-track {
		height: 0.24rem;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(233 20% 36%) 62%, transparent);
	}
	.nimble-ncct-settings__slider-input::-moz-range-thumb {
		width: 0.76rem;
		height: 0.76rem;
		border: 1px solid color-mix(in srgb, hsl(40 86% 74%) 72%, white 28%);
		border-radius: 0.22rem;
		background: color-mix(in srgb, hsl(221 30% 12%) 92%, black 8%);
		box-shadow: 0 0 0.22rem color-mix(in srgb, hsl(41 94% 67%) 52%, transparent);
		cursor: pointer;
	}
	.nimble-ncct-settings__slider-value {
		min-width: 2rem;
		height: 1.85rem;
		padding-inline: 0.4rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		border: 1px solid color-mix(in srgb, hsl(0 0% 84%) 30%, transparent);
		border-radius: 0.28rem;
		background: color-mix(in srgb, hsl(230 23% 17%) 80%, transparent);
	}
	.nimble-ncct-settings__toggle-field {
		display: flex;
		justify-content: flex-end;
	}
	.nimble-ncct-settings__permissions-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.nimble-ncct-settings__permissions-table thead th {
		padding: 0.5rem 0.4rem;
		font-size: 0.79rem;
		text-align: center;
		background: color-mix(in srgb, hsl(229 20% 18%) 72%, transparent);
	}
	.nimble-ncct-settings__permissions-table thead th:first-child {
		text-align: left;
	}
	.nimble-ncct-settings__permissions-table tbody td {
		padding: 0.62rem 0.4rem;
		vertical-align: top;
		border-top: 1px solid color-mix(in srgb, hsl(0 0% 82%) 16%, transparent);
	}
	.nimble-ncct-settings__permissions-table tbody td:not(:first-child) {
		text-align: center;
		vertical-align: middle;
	}
	.nimble-ncct-settings__permission-title {
		font-weight: 700;
	}
	.nimble-ncct-settings__color-controls {
		display: flex;
		align-items: center;
		gap: 0.32rem;
		flex-wrap: wrap;
	}
	.nimble-ncct-settings__color-swatch {
		width: 1.16rem;
		height: 1.16rem;
		padding: 0;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, hsl(0 0% 84%) 58%, transparent);
		background: var(--nimble-ncct-color, #6ce685);
		cursor: pointer;
	}
	.nimble-ncct-settings__color-swatch:hover,
	.nimble-ncct-settings__color-swatch:focus-visible {
		filter: brightness(1.1);
	}
	.nimble-ncct-settings__color-swatch--active {
		box-shadow: 0 0 0 0.1rem color-mix(in srgb, hsl(39 82% 74%) 65%, white 35%);
		border-color: color-mix(in srgb, hsl(41 82% 74%) 72%, white 28%);
	}
	.nimble-ncct-settings__color-picker {
		width: 1.85rem;
		height: 1.2rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, hsl(0 0% 84%) 58%, transparent);
		border-radius: 0.2rem;
		background: transparent;
		cursor: pointer;
	}
</style>

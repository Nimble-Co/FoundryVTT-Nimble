<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		getCombatTrackerActionDiceColor,
		getCombatTrackerCtBadgeSizeLevel,
		getCombatTrackerCenterActiveCardEnabled,
		getCombatTrackerResourceDrawerHoverEnabled,
		getCombatTrackerCtCardSizeLevel,
		getCombatTrackerVisibilityPermissionConfig,
		getCombatTrackerCtWidthLevel,
		getCombatTrackerUseActionDice,
		isCombatTrackerActionDiceColorSettingKey,
		isCombatTrackerBadgeSizeLevelSettingKey,
		isCombatTrackerCardSizeLevelSettingKey,
		isCombatTrackerCenterActiveCardSettingKey,
		isCombatTrackerResourceDrawerHoverSettingKey,
		isCombatTrackerVisibilityPermissionSettingKey,
		isCombatTrackerUseActionDiceSettingKey,
		isCombatTrackerWidthLevelSettingKey,
		normalizeHexColor,
		setCombatTrackerActionDiceColor,
		setCombatTrackerCtBadgeSizeLevel,
		setCombatTrackerCenterActiveCardEnabled,
		setCombatTrackerResourceDrawerHoverEnabled,
		setCombatTrackerCtCardSizeLevel,
		setCombatTrackerCtWidthLevel,
		setCombatTrackerVisibilityPermissionConfig,
		setCombatTrackerUseActionDice,
		type CombatTrackerVisibilityFieldKey,
		type CombatTrackerVisibilityPermissionConfig,
		type CombatTrackerRolePermissionConfig,
		type CombatTrackerRolePermissionKey,
	} from '../../settings/combatTrackerSettings.js';

	const MIN_LEVEL = 1;
	const MAX_LEVEL = 6;
	const CT_WIDTH_PREVIEW_EVENT_NAME = 'nimble:ct-width-preview';
	const ACTION_DICE_COLOR_PRESETS = [
		{ label: 'White', color: '#ffffff' },
		{ label: 'Green', color: '#6ce685' },
		{ label: 'Red', color: '#ef5350' },
		{ label: 'Blue', color: '#4fc3f7' },
		{ label: 'Yellow', color: '#f6d44c' },
		{ label: 'Purple', color: '#b388ff' },
	] as const;
	const ROLE_COLUMNS: ReadonlyArray<{ key: CombatTrackerRolePermissionKey; label: string }> = [
		{ key: 'player', label: 'Player' },
		{ key: 'trusted', label: 'Trusted Player' },
		{ key: 'assistant', label: 'Asst. GM' },
		{ key: 'gamemaster', label: 'GM' },
	];
	const PERMISSION_ROWS: ReadonlyArray<{
		key: CombatTrackerVisibilityFieldKey;
		label: string;
		note?: string;
	}> = [
		{
			key: 'hpValue',
			label: 'HP value',
			note: 'Non-owners still need the token HP bar to be visible to them.',
		},
		{
			key: 'hpState',
			label: 'HP state',
			note: 'Use this without HP value for Normal, Bloodied, or Last Stand only.',
		},
		{
			key: 'mana',
			label: 'Mana',
			note: 'Non-owners still need mana assigned to a visible token bar.',
		},
		{
			key: 'wounds',
			label: 'Wounds',
			note: 'Non-owners still need wounds assigned to a visible token bar.',
		},
		{ key: 'actions', label: 'Actions' },
		{ key: 'defend', label: 'Defend available' },
		{ key: 'interpose', label: 'Interpose available' },
		{ key: 'opportunityAttack', label: 'Opportunity Attack available' },
		{ key: 'help', label: 'Help available' },
		{ key: 'outline', label: 'Card outline' },
	];

	let updateSettingHook: number | undefined;
	let widthPreviewGlobalPointerUpListener: (() => void) | undefined;
	let widthLevel = $state(getCombatTrackerCtWidthLevel());
	let cardSizeLevel = $state(getCombatTrackerCtCardSizeLevel());
	let badgeSizeLevel = $state(getCombatTrackerCtBadgeSizeLevel());
	let centerActiveCardEnabled = $state(getCombatTrackerCenterActiveCardEnabled());
	let resourceDrawerHoverEnabled = $state(getCombatTrackerResourceDrawerHoverEnabled());
	let useActionDice = $state(getCombatTrackerUseActionDice());
	let actionDiceColor = $state(getCombatTrackerActionDiceColor());
	let visibilityPermissions = $state(getCombatTrackerVisibilityPermissionConfig());
	let canManageWorldCtSettings = $derived(Boolean(game.user?.isGM));
	let isWidthSliderPreviewActive = $state(false);

	function dispatchCtWidthPreviewEvent(params: { active: boolean; widthLevel: number }): void {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(
			new CustomEvent(CT_WIDTH_PREVIEW_EVENT_NAME, {
				detail: params,
			}),
		);
	}

	function setWidthSliderPreviewActive(active: boolean, previewLevel = widthLevel): void {
		if (isWidthSliderPreviewActive === active && previewLevel === widthLevel) return;
		isWidthSliderPreviewActive = active;
		dispatchCtWidthPreviewEvent({
			active,
			widthLevel: clampLevel(previewLevel),
		});
	}

	function clampLevel(value: unknown): number {
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return MIN_LEVEL;
		return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(numericValue)));
	}

	function persistCtSetting(action: string, write: Promise<void>): void {
		void write.catch((error) => {
			console.error(`[Nimble][CT Settings] Failed to persist ${action}`, { error });
		});
	}

	function handleWidthLevelInput(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = clampLevel(input.value);
		widthLevel = nextValue;
		if (isWidthSliderPreviewActive) {
			dispatchCtWidthPreviewEvent({
				active: true,
				widthLevel: nextValue,
			});
		}
		persistCtSetting('width level', setCombatTrackerCtWidthLevel(nextValue));
	}

	function handleCardSizeLevelInput(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = clampLevel(input.value);
		cardSizeLevel = nextValue;
		persistCtSetting('card size level', setCombatTrackerCtCardSizeLevel(nextValue));
	}

	function handleBadgeSizeLevelInput(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = clampLevel(input.value);
		badgeSizeLevel = nextValue;
		persistCtSetting('badge size level', setCombatTrackerCtBadgeSizeLevel(nextValue));
	}

	function handleCenterActiveCardChange(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		centerActiveCardEnabled = checkbox.checked;
		persistCtSetting(
			'center active card',
			setCombatTrackerCenterActiveCardEnabled(checkbox.checked),
		);
	}

	function handleResourceDrawerHoverChange(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		resourceDrawerHoverEnabled = checkbox.checked;
		persistCtSetting(
			'resource drawer hover',
			setCombatTrackerResourceDrawerHoverEnabled(checkbox.checked),
		);
	}

	function handleUseActionDiceChange(event: Event): void {
		if (!canManageWorldCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		useActionDice = checkbox.checked;
		persistCtSetting('use action dice', setCombatTrackerUseActionDice(checkbox.checked));
	}

	function handleVisibilityPermissionChange(
		fieldKey: CombatTrackerVisibilityFieldKey,
		roleKey: CombatTrackerRolePermissionKey,
		event: Event,
	): void {
		if (!canManageWorldCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		const nextFieldPermissions: CombatTrackerRolePermissionConfig = {
			...visibilityPermissions[fieldKey],
			[roleKey]: checkbox.checked,
		};
		const nextPermissions: CombatTrackerVisibilityPermissionConfig = {
			...visibilityPermissions,
			[fieldKey]: nextFieldPermissions,
		};
		visibilityPermissions = nextPermissions;
		persistCtSetting(
			'visibility permissions',
			setCombatTrackerVisibilityPermissionConfig(nextPermissions),
		);
	}

	function applyActionDiceColor(color: string): void {
		const normalizedColor = normalizeHexColor(color);
		actionDiceColor = normalizedColor;
		persistCtSetting('action dice color', setCombatTrackerActionDiceColor(normalizedColor));
	}

	onMount(() => {
		widthPreviewGlobalPointerUpListener = () => {
			if (!isWidthSliderPreviewActive) return;
			setWidthSliderPreviewActive(false);
		};
		window.addEventListener('pointerup', widthPreviewGlobalPointerUpListener);

		updateSettingHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCombatTrackerWidthLevelSettingKey(settingKey)) {
				widthLevel = getCombatTrackerCtWidthLevel();
				if (isWidthSliderPreviewActive) {
					dispatchCtWidthPreviewEvent({
						active: true,
						widthLevel,
					});
				}
			}
			if (isCombatTrackerCardSizeLevelSettingKey(settingKey)) {
				cardSizeLevel = getCombatTrackerCtCardSizeLevel();
			}
			if (isCombatTrackerBadgeSizeLevelSettingKey(settingKey)) {
				badgeSizeLevel = getCombatTrackerCtBadgeSizeLevel();
			}
			if (isCombatTrackerCenterActiveCardSettingKey(settingKey)) {
				centerActiveCardEnabled = getCombatTrackerCenterActiveCardEnabled();
			}
			if (isCombatTrackerResourceDrawerHoverSettingKey(settingKey)) {
				resourceDrawerHoverEnabled = getCombatTrackerResourceDrawerHoverEnabled();
			}
			if (isCombatTrackerUseActionDiceSettingKey(settingKey)) {
				useActionDice = getCombatTrackerUseActionDice();
			}
			if (isCombatTrackerVisibilityPermissionSettingKey(settingKey)) {
				visibilityPermissions = getCombatTrackerVisibilityPermissionConfig();
			}
			if (isCombatTrackerActionDiceColorSettingKey(settingKey)) {
				actionDiceColor = getCombatTrackerActionDiceColor();
			}
		});
	});

	onDestroy(() => {
		if (updateSettingHook !== undefined) Hooks.off('updateSetting', updateSettingHook);
		if (widthPreviewGlobalPointerUpListener) {
			window.removeEventListener('pointerup', widthPreviewGlobalPointerUpListener);
		}
		if (isWidthSliderPreviewActive) {
			setWidthSliderPreviewActive(false);
		}
	});
</script>

<section class="nimble-sheet__body nimble-ct-settings standard-form">
	{#if canManageWorldCtSettings}
		<fieldset class="nimble-ct-settings__section">
			<legend class="nimble-ct-settings__section-title">Interface Size</legend>

			<div class="nimble-ct-settings__slider-group">
				<label class="nimble-ct-settings__label" for="nimble-ct-width">Combat Tracker Width</label>
				<div class="nimble-ct-settings__slider-fields">
					<input
						id="nimble-ct-width"
						type="range"
						class="nimble-ct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={widthLevel}
						oninput={handleWidthLevelInput}
						onchange={handleWidthLevelInput}
						onpointerdown={() => setWidthSliderPreviewActive(true)}
						onpointerup={() => setWidthSliderPreviewActive(false)}
						onpointercancel={() => setWidthSliderPreviewActive(false)}
						onfocus={() => setWidthSliderPreviewActive(true)}
						onblur={() => setWidthSliderPreviewActive(false)}
					/>
					<span class="nimble-ct-settings__slider-value">{widthLevel}</span>
				</div>
			</div>

			<div class="nimble-ct-settings__slider-group">
				<label class="nimble-ct-settings__label" for="nimble-ct-card-size"
					>Combat Tracker Card Size</label
				>
				<div class="nimble-ct-settings__slider-fields">
					<input
						id="nimble-ct-card-size"
						type="range"
						class="nimble-ct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={cardSizeLevel}
						oninput={handleCardSizeLevelInput}
						onchange={handleCardSizeLevelInput}
					/>
					<span class="nimble-ct-settings__slider-value">{cardSizeLevel}</span>
				</div>
			</div>

			<div class="nimble-ct-settings__slider-group">
				<label class="nimble-ct-settings__label" for="nimble-ct-badge-size"
					>Combat Tracker Badge Size</label
				>
				<div class="nimble-ct-settings__slider-fields">
					<input
						id="nimble-ct-badge-size"
						type="range"
						class="nimble-ct-settings__slider-input"
						min={MIN_LEVEL}
						max={MAX_LEVEL}
						step="1"
						value={badgeSizeLevel}
						oninput={handleBadgeSizeLevelInput}
						onchange={handleBadgeSizeLevelInput}
					/>
					<span class="nimble-ct-settings__slider-value">{badgeSizeLevel}</span>
				</div>
			</div>

			<div class="nimble-ct-settings__toggle-group">
				<div class="nimble-ct-settings__toggle-row">
					<label class="nimble-ct-settings__label" for="nimble-ct-center-active-card"
						>Combat Tracker Center Active Card</label
					>
					<div class="nimble-ct-settings__toggle-field">
						<input
							id="nimble-ct-center-active-card"
							type="checkbox"
							checked={centerActiveCardEnabled}
							onchange={handleCenterActiveCardChange}
						/>
					</div>
				</div>
				<div class="nimble-ct-settings__toggle-row">
					<label class="nimble-ct-settings__label" for="nimble-ct-resource-drawer-hover"
						>Resource Drawer Opens On Hover</label
					>
					<div class="nimble-ct-settings__toggle-field">
						<input
							id="nimble-ct-resource-drawer-hover"
							type="checkbox"
							checked={resourceDrawerHoverEnabled}
							onchange={handleResourceDrawerHoverChange}
						/>
					</div>
				</div>
			</div>
		</fieldset>

		<fieldset class="nimble-ct-settings__section">
			<legend class="nimble-ct-settings__section-title">Permissions</legend>
			<p class="notes">
				Choose which roles can view each Combat Tracker field. HP, mana, and wounds still respect
				token bar visibility for non-owners.
			</p>
			<table class="nimble-ct-settings__permissions-table">
				<thead>
					<tr>
						<th scope="col">Permission</th>
						{#each ROLE_COLUMNS as role}
							<th scope="col">{role.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each PERMISSION_ROWS as permissionRow}
						<tr>
							<td>
								<div class="nimble-ct-settings__permission-title">{permissionRow.label}</div>
								{#if permissionRow.note}
									<div class="nimble-ct-settings__permission-note">{permissionRow.note}</div>
								{/if}
							</td>
							{#each ROLE_COLUMNS as role}
								<td>
									<input
										type="checkbox"
										aria-label={`${role.label} can view ${permissionRow.label}`}
										checked={visibilityPermissions[permissionRow.key][role.key]}
										onchange={(event) =>
											handleVisibilityPermissionChange(permissionRow.key, role.key, event)}
									/>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</fieldset>
	{/if}

	<fieldset class="nimble-ct-settings__section">
		<legend class="nimble-ct-settings__section-title">Appearance</legend>
		{#if canManageWorldCtSettings}
			<div class="nimble-ct-settings__toggle-group">
				<div class="nimble-ct-settings__toggle-row">
					<label class="nimble-ct-settings__label" for="nimble-ct-use-action-dice"
						>Use Action Dice</label
					>
					<div class="nimble-ct-settings__toggle-field">
						<input
							id="nimble-ct-use-action-dice"
							type="checkbox"
							checked={useActionDice}
							onchange={handleUseActionDiceChange}
						/>
					</div>
				</div>
			</div>
		{/if}
		<div class="nimble-ct-settings__color-group">
			<label class="nimble-ct-settings__label" for="nimble-ct-action-dice-color"
				>Combat Tracker Action Color</label
			>
			<div class="nimble-ct-settings__color-controls">
				{#each ACTION_DICE_COLOR_PRESETS as preset}
					<button
						type="button"
						class="nimble-ct-settings__color-swatch"
						class:nimble-ct-settings__color-swatch--active={actionDiceColor === preset.color}
						style={`--nimble-ct-color: ${preset.color};`}
						aria-label={preset.label}
						data-tooltip={preset.label}
						onclick={() => applyActionDiceColor(preset.color)}
					></button>
				{/each}
				<input
					id="nimble-ct-action-dice-color"
					type="color"
					class="nimble-ct-settings__color-picker"
					value={actionDiceColor}
					oninput={(event) => applyActionDiceColor((event.currentTarget as HTMLInputElement).value)}
					onchange={(event) =>
						applyActionDiceColor((event.currentTarget as HTMLInputElement).value)}
				/>
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
		gap: 0.72rem;
		padding: 0.66rem;
		color: var(--nimble-ct-text-primary);
		font-size: var(--font-size-14, 0.875rem);
		line-height: 1.35;
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
		padding: 0.72rem 0.68rem 0.64rem;
		display: flex;
		flex-direction: column;
		gap: 0.56rem;
		background: var(--nimble-ct-panel-bg);
	}
	.nimble-ct-settings__section-title {
		margin-inline-start: 0.48rem;
		padding-inline: 0.34rem;
		font-size: var(--font-size-14, 0.875rem);
		line-height: 1;
		font-weight: 600;
		color: var(--nimble-ct-text-primary);
	}
	.nimble-ct-settings__label {
		font-weight: 700;
		font-size: var(--font-size-14, 0.875rem);
	}
	.nimble-ct-settings .notes {
		margin: 0;
		color: var(--nimble-ct-text-secondary);
		font-size: var(--font-size-14, 0.875rem);
	}
	.nimble-ct-settings__slider-group,
	.nimble-ct-settings__toggle-group,
	.nimble-ct-settings__color-group {
		display: flex;
		flex-direction: column;
		gap: 0.44rem;
	}
	.nimble-ct-settings__slider-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.72rem;
	}
	.nimble-ct-settings__slider-input {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		max-width: 16rem;
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
		height: 1.82rem;
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
	:global(.theme-light) .nimble-ct-settings__slider-value {
		background: white;
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, white 68%, transparent),
			0 0.08rem 0.18rem color-mix(in srgb, hsl(220 18% 46%) 12%, transparent);
	}
	.nimble-ct-settings__toggle-field {
		display: flex;
		justify-content: flex-end;
	}
	.nimble-ct-settings__toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.nimble-ct-settings__permissions-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		border-radius: 0.28rem;
		overflow: hidden;
	}
	.nimble-ct-settings__permissions-table thead th {
		padding: 0.5rem 0.4rem;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		text-align: center;
		color: var(--nimble-ct-text-secondary);
		background: color-mix(in srgb, var(--nimble-ct-control-bg) 95%, transparent);
	}
	:global(.theme-light) .nimble-ct-settings__permissions-table thead th {
		color: var(--nimble-ct-text-primary);
		background: color-mix(in srgb, white 82%, hsl(42 24% 88%) 18%);
	}
	.nimble-ct-settings__permissions-table thead th:first-child {
		text-align: left;
		width: 28%;
	}
	.nimble-ct-settings__permissions-table tbody td {
		padding: 0.62rem 0.4rem;
		vertical-align: top;
		border-top: 1px solid color-mix(in srgb, var(--nimble-ct-border) 45%, transparent);
	}
	.nimble-ct-settings__permissions-table tbody td:not(:first-child) {
		text-align: center;
		vertical-align: middle;
	}
	.nimble-ct-settings__permission-title {
		font-weight: 700;
		font-size: var(--font-size-12, 0.75rem);
	}
	.nimble-ct-settings__permission-note {
		margin-top: 0.18rem;
		color: var(--nimble-ct-text-secondary);
		font-size: 0.68rem;
		line-height: 1.3;
	}
	.nimble-ct-settings__color-controls {
		display: flex;
		align-items: center;
		gap: 0.52rem;
		flex-wrap: wrap;
	}
	.nimble-ct-settings__color-swatch {
		appearance: none;
		width: 1.34rem;
		height: 1.34rem;
		aspect-ratio: 1 / 1;
		padding: 0;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--nimble-ct-border) 72%, transparent);
		background: var(--nimble-ct-color, #ffffff);
		cursor: pointer;
	}
	.nimble-ct-settings__color-swatch:hover,
	.nimble-ct-settings__color-swatch:focus-visible {
		filter: brightness(1.1);
	}
	.nimble-ct-settings__color-swatch--active {
		box-shadow: 0 0 0 0.1rem color-mix(in srgb, hsl(39 82% 74%) 65%, white 35%);
		border-color: color-mix(in srgb, hsl(41 82% 74%) 72%, white 28%);
	}
	.nimble-ct-settings__color-picker {
		width: 2.45rem;
		height: 1.5rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--nimble-ct-border) 72%, transparent);
		border-radius: 0.3rem;
		background: var(--nimble-ct-control-bg);
		cursor: pointer;
	}
</style>

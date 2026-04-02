import {
	type CombatTrackerNonPlayerHpBarTextMode,
	type CombatTrackerPlayerHpBarTextMode,
	getCombatTrackerActionDiceColor,
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtLeftToRightOrdering,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHpBarEnabled,
	getCombatTrackerNonPlayerHpBarTextMode,
	getCombatTrackerPlayerHpBarTextMode,
	getCombatTrackerReactionColor,
	getCombatTrackerResourceDrawerHoverEnabled,
	isCombatTrackerActionDiceColorSettingKey,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerLeftToRightOrderingSettingKey,
	isCombatTrackerNonPlayerHpBarEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerHpBarTextModeSettingKey,
	isCombatTrackerReactionColorSettingKey,
	isCombatTrackerResourceDrawerHoverSettingKey,
	isCombatTrackerWidthLevelSettingKey,
	normalizeHexColor,
	setCombatTrackerActionDiceColor,
	setCombatTrackerCtCardSizeLevel,
	setCombatTrackerCtLeftToRightOrdering,
	setCombatTrackerCtWidthLevel,
	setCombatTrackerNonPlayerHpBarEnabled,
	setCombatTrackerNonPlayerHpBarTextMode,
	setCombatTrackerPlayerHpBarTextMode,
	setCombatTrackerReactionColor,
	setCombatTrackerResourceDrawerHoverEnabled,
} from '../../../settings/combatTrackerSettings.js';
import { getCombatForCurrentScene } from '../../ui/ctTopTracker/combat.utils.js';
import {
	CT_CARD_SIZE_PREVIEW_EVENT_NAME,
	CT_PLAYERS_CAN_VIEW_EXPANDED_MONSTERS_FLAG_PATH,
	CT_WIDTH_PREVIEW_EVENT_NAME,
} from '../../ui/ctTopTracker/constants.js';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const COLOR_PRESETS = [
	{ labelKey: 'NIMBLE.ui.ctSettings.colorWhite', color: '#ffffff' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorGreen', color: '#6ce685' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorRed', color: '#ef5350' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorOrange', color: '#ff9800' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorYellow', color: '#f6d44c' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorBlue', color: '#4fc3f7' },
	{ labelKey: 'NIMBLE.ui.ctSettings.colorPurple', color: '#b388ff' },
] as const;
export const HP_BAR_TEXT_MODE_OPTIONS: ReadonlyArray<{
	value: CombatTrackerPlayerHpBarTextMode;
	labelKey: string;
}> = [
	{ value: 'none', labelKey: 'NIMBLE.ui.ctSettings.hpBarTextNone' },
	{ value: 'hpState', labelKey: 'NIMBLE.ui.ctSettings.hpBarTextHealthState' },
	{ value: 'percentage', labelKey: 'NIMBLE.ui.ctSettings.hpBarTextPercentage' },
];

function getPlayersCanViewExpandedMonstersForCombat(combat: Combat | null): boolean {
	if (!combat) return false;
	return Boolean(
		foundry.utils.getProperty(combat, CT_PLAYERS_CAN_VIEW_EXPANDED_MONSTERS_FLAG_PATH),
	);
}

export class CtSettingsDialogState {
	updateSettingHook: number | undefined;

	sliderPreviewGlobalPointerUpListener: (() => void) | undefined;

	combatHookIds: Array<{ hook: string; id: number }> = [];

	widthLevel = $state(getCombatTrackerCtWidthLevel());

	cardSizeLevel = $state(getCombatTrackerCtCardSizeLevel());

	resourceDrawerHoverEnabled = $state(getCombatTrackerResourceDrawerHoverEnabled());

	playerHpBarTextMode = $state(getCombatTrackerPlayerHpBarTextMode());

	currentCombat = $state<Combat | null>(getCombatForCurrentScene(null));

	playersCanViewExpandedMonsters = $state(
		getPlayersCanViewExpandedMonstersForCombat(this.currentCombat),
	);

	nonPlayerHpBarEnabled = $state(getCombatTrackerNonPlayerHpBarEnabled());

	nonPlayerHpBarTextMode = $state(getCombatTrackerNonPlayerHpBarTextMode());

	actionColor = $state(getCombatTrackerActionDiceColor());

	reactionColor = $state(getCombatTrackerReactionColor());

	leftToRightOrdering = $state(getCombatTrackerCtLeftToRightOrdering());

	canManageSharedCtSettings = $derived(Boolean(game.user?.isGM));

	canManageMonsterExpansionPermission = $derived(
		Boolean(game.user?.isGM) && Boolean(this.currentCombat),
	);

	isWidthSliderPreviewActive = $state(false);

	isCardSizeSliderPreviewActive = $state(false);

	dispatchCtWidthPreviewEvent(params: { active: boolean; widthLevel: number }): void {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(
			new CustomEvent(CT_WIDTH_PREVIEW_EVENT_NAME, {
				detail: params,
			}),
		);
	}

	setWidthSliderPreviewActive = (active: boolean, previewLevel = this.widthLevel): void => {
		if (this.isWidthSliderPreviewActive === active && previewLevel === this.widthLevel) return;
		this.isWidthSliderPreviewActive = active;
		this.dispatchCtWidthPreviewEvent({
			active,
			widthLevel: this.clampLevel(previewLevel),
		});
	};

	dispatchCtCardSizePreviewEvent(params: { active: boolean; cardSizeLevel: number }): void {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(
			new CustomEvent(CT_CARD_SIZE_PREVIEW_EVENT_NAME, {
				detail: params,
			}),
		);
	}

	setCardSizeSliderPreviewActive = (active: boolean, previewLevel = this.cardSizeLevel): void => {
		if (this.isCardSizeSliderPreviewActive === active && previewLevel === this.cardSizeLevel) {
			return;
		}
		this.isCardSizeSliderPreviewActive = active;
		this.dispatchCtCardSizePreviewEvent({
			active,
			cardSizeLevel: this.clampLevel(previewLevel),
		});
	};

	clampLevel(value: unknown): number {
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return MIN_LEVEL;
		return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(numericValue)));
	}

	persistCtSetting(action: string, write: Promise<void>): void {
		void write.catch((error) => {
			console.error(`[Nimble][CT Settings] Failed to persist ${action}`, { error });
		});
	}

	refreshCombatPermissionState = (): void => {
		this.currentCombat = getCombatForCurrentScene(null);
		this.playersCanViewExpandedMonsters = getPlayersCanViewExpandedMonstersForCombat(
			this.currentCombat,
		);
	};

	handleWidthLevelInput = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = this.clampLevel(input.value);
		this.widthLevel = nextValue;
		if (this.isWidthSliderPreviewActive) {
			this.dispatchCtWidthPreviewEvent({
				active: true,
				widthLevel: nextValue,
			});
		}
		this.persistCtSetting('width level', setCombatTrackerCtWidthLevel(nextValue));
	};

	handleCardSizeLevelInput = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = this.clampLevel(input.value);
		this.cardSizeLevel = nextValue;
		if (this.isCardSizeSliderPreviewActive) {
			this.dispatchCtCardSizePreviewEvent({
				active: true,
				cardSizeLevel: nextValue,
			});
		}
		this.persistCtSetting('card size level', setCombatTrackerCtCardSizeLevel(nextValue));
	};

	handleResourceDrawerHoverChange = (event: Event): void => {
		const checkbox = event.currentTarget as HTMLInputElement;
		this.resourceDrawerHoverEnabled = checkbox.checked;
		this.persistCtSetting(
			'resource drawer hover',
			setCombatTrackerResourceDrawerHoverEnabled(checkbox.checked),
		);
	};

	handlePlayerHpBarTextModeChange = (event: Event): void => {
		const select = event.currentTarget as HTMLSelectElement;
		const nextValue = select.value as CombatTrackerPlayerHpBarTextMode;
		this.playerHpBarTextMode = nextValue;
		this.persistCtSetting(
			'player hp bar text mode',
			setCombatTrackerPlayerHpBarTextMode(nextValue),
		);
	};

	handleNonPlayerHpBarEnabledChange = (event: Event): void => {
		if (!this.canManageSharedCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		this.nonPlayerHpBarEnabled = checkbox.checked;
		this.persistCtSetting(
			'non-player hp bar',
			setCombatTrackerNonPlayerHpBarEnabled(checkbox.checked),
		);
	};

	handlePlayersCanViewExpandedMonstersChange = (event: Event): void => {
		if (!this.canManageMonsterExpansionPermission || !this.currentCombat) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		this.playersCanViewExpandedMonsters = checkbox.checked;
		this.persistCtSetting(
			'player expanded monster visibility',
			this.currentCombat.update({
				[CT_PLAYERS_CAN_VIEW_EXPANDED_MONSTERS_FLAG_PATH]: checkbox.checked,
			} as Record<string, unknown>) as Promise<void>,
		);
	};

	handleNonPlayerHpBarTextModeChange = (event: Event): void => {
		if (!this.canManageSharedCtSettings) return;
		const select = event.currentTarget as HTMLSelectElement;
		const nextValue = select.value as CombatTrackerNonPlayerHpBarTextMode;
		this.nonPlayerHpBarTextMode = nextValue;
		this.persistCtSetting(
			'non-player hp bar text mode',
			setCombatTrackerNonPlayerHpBarTextMode(nextValue),
		);
	};

	handleLeftToRightOrderingChange = (event: Event): void => {
		if (!this.canManageSharedCtSettings) return;
		const checkbox = event.currentTarget as HTMLInputElement;
		this.leftToRightOrdering = checkbox.checked;
		this.persistCtSetting(
			'left-to-right ordering',
			setCombatTrackerCtLeftToRightOrdering(checkbox.checked),
		);
	};

	applyActionColor = (color: string): void => {
		const normalizedColor = normalizeHexColor(color);
		this.actionColor = normalizedColor;
		this.persistCtSetting('action color', setCombatTrackerActionDiceColor(normalizedColor));
	};

	applyReactionColor = (color: string): void => {
		const normalizedColor = normalizeHexColor(color);
		this.reactionColor = normalizedColor;
		this.persistCtSetting('reaction color', setCombatTrackerReactionColor(normalizedColor));
	};

	mount(): void {
		this.refreshCombatPermissionState();
		this.sliderPreviewGlobalPointerUpListener = () => {
			if (this.isWidthSliderPreviewActive) {
				this.setWidthSliderPreviewActive(false);
			}
			if (this.isCardSizeSliderPreviewActive) {
				this.setCardSizeSliderPreviewActive(false);
			}
		};
		window.addEventListener('pointerup', this.sliderPreviewGlobalPointerUpListener);

		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: (...args: unknown[]) => void) => number;
			off: (hook: string, id: number) => void;
		};
		const registerCombatHook = (hook: string) => {
			this.combatHookIds.push({
				hook,
				id: hooksApi.on(hook, () => this.refreshCombatPermissionState()),
			});
		};
		registerCombatHook('createCombat');
		registerCombatHook('updateCombat');
		registerCombatHook('deleteCombat');
		registerCombatHook('canvasReady');
		registerCombatHook('updateScene');

		this.updateSettingHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCombatTrackerWidthLevelSettingKey(settingKey)) {
				this.widthLevel = getCombatTrackerCtWidthLevel();
				if (this.isWidthSliderPreviewActive) {
					this.dispatchCtWidthPreviewEvent({ active: true, widthLevel: this.widthLevel });
				}
			}
			if (isCombatTrackerCardSizeLevelSettingKey(settingKey)) {
				this.cardSizeLevel = getCombatTrackerCtCardSizeLevel();
			}
			if (isCombatTrackerResourceDrawerHoverSettingKey(settingKey)) {
				this.resourceDrawerHoverEnabled = getCombatTrackerResourceDrawerHoverEnabled();
			}
			if (isCombatTrackerPlayerHpBarTextModeSettingKey(settingKey)) {
				this.playerHpBarTextMode = getCombatTrackerPlayerHpBarTextMode();
			}
			if (isCombatTrackerNonPlayerHpBarEnabledSettingKey(settingKey)) {
				this.nonPlayerHpBarEnabled = getCombatTrackerNonPlayerHpBarEnabled();
			}
			if (isCombatTrackerNonPlayerHpBarTextModeSettingKey(settingKey)) {
				this.nonPlayerHpBarTextMode = getCombatTrackerNonPlayerHpBarTextMode();
			}
			if (isCombatTrackerActionDiceColorSettingKey(settingKey)) {
				this.actionColor = getCombatTrackerActionDiceColor();
			}
			if (isCombatTrackerReactionColorSettingKey(settingKey)) {
				this.reactionColor = getCombatTrackerReactionColor();
			}
			if (isCombatTrackerLeftToRightOrderingSettingKey(settingKey)) {
				this.leftToRightOrdering = getCombatTrackerCtLeftToRightOrdering();
			}
		});
	}

	destroy(): void {
		if (this.updateSettingHook !== undefined) Hooks.off('updateSetting', this.updateSettingHook);
		const hooksApi = Hooks as unknown as {
			off: (hook: string, id: number) => void;
		};
		for (const { hook, id } of this.combatHookIds) {
			hooksApi.off(hook, id);
		}
		if (this.sliderPreviewGlobalPointerUpListener) {
			window.removeEventListener('pointerup', this.sliderPreviewGlobalPointerUpListener);
		}
		if (this.isWidthSliderPreviewActive) {
			this.setWidthSliderPreviewActive(false);
		}
		if (this.isCardSizeSliderPreviewActive) {
			this.setCardSizeSliderPreviewActive(false);
		}
	}
}

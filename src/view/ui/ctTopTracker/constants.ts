export const PORTRAIT_FALLBACK_IMAGE = 'icons/svg/mystery-man.svg';

export const DRAG_TARGET_EXPANSION_REM = 0.85;
export const DRAG_SWITCH_UPPER_RATIO = 0.4;
export const DRAG_SWITCH_LOWER_RATIO = 0.6;

export const CT_MIN_WIDTH_LEVEL = 1;
export const CT_MAX_WIDTH_LEVEL = 10;
export const CT_MIN_CARD_SIZE_LEVEL = 1;
export const CT_MAX_CARD_SIZE_LEVEL = 10;
export const CT_MIN_SAFE_TRACK_WIDTH_PX = 420;
export const CT_FALLBACK_SIDE_RESERVED_PX = 84;
export const CT_EDGE_GUTTER_PX = 12;
export const CT_MIN_WIDTH_RATIO = 0.52;
export const CT_MAX_WIDTH_RATIO = 2;
export const CT_MIN_CARD_SCALE = 0.78;
export const CT_MAX_CARD_SCALE = 1.4;

export const CT_WIDTH_RATIO_STEP =
	(CT_MAX_WIDTH_RATIO - CT_MIN_WIDTH_RATIO) / (CT_MAX_WIDTH_LEVEL - CT_MIN_WIDTH_LEVEL);
export const CT_CARD_SCALE_STEP =
	(CT_MAX_CARD_SCALE - CT_MIN_CARD_SCALE) / (CT_MAX_CARD_SIZE_LEVEL - CT_MIN_CARD_SIZE_LEVEL);

export const CT_VIRTUALIZATION_ENTRY_THRESHOLD = 80;
export const CT_VIRTUALIZATION_OVERSCAN = 12;
export const CT_ESTIMATED_ENTRY_WIDTH_REM = 6.53;

export const CT_SETTINGS_DIALOG_UNIQUE_ID = 'nimble-ct-settings-dialog';
export const CT_WIDTH_PREVIEW_EVENT_NAME = 'nimble:ct-width-preview';
export const CT_CARD_SIZE_PREVIEW_EVENT_NAME = 'nimble:ct-card-size-preview';

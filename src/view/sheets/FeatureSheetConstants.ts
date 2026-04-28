export const LEVEL_MIN = 1;
export const LEVEL_MAX = 20;
export const MIN_SELECTION_COUNT = 1;
export const FEATURE_TYPE_CLASS = 'class';

export const FEATURE_SHEET_TAB_CONFIG = [
	{ icon: 'fa-solid fa-file-lines', tooltip: 'Description', name: 'description' },
	{ icon: 'fa-solid fa-gears', tooltip: 'Config', name: 'config' },
	{ icon: 'fa-solid fa-play', tooltip: 'Activation', name: 'activationConfig' },
	{ icon: 'fa-solid fa-bolt', tooltip: 'Rules', name: 'rules' },
	{ icon: 'fa-solid fa-terminal', tooltip: 'Macro', name: 'macro' },
] as const;

export type FeatureSheetTabName = (typeof FEATURE_SHEET_TAB_CONFIG)[number]['name'];

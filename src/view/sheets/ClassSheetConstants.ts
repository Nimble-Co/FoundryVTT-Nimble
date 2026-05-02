export const HIT_DIE_SIZES = [4, 6, 8, 10, 12] as const;

export const CLASS_SHEET_TAB_CONFIG = [
	{ icon: 'fa-solid fa-file-lines', tooltip: 'NIMBLE.classSheet.description', name: 'description' },
	{ icon: 'fa-solid fa-gears', tooltip: 'NIMBLE.classSheet.config', name: 'config' },
	{ icon: 'fa-solid fa-stairs', tooltip: 'NIMBLE.classSheet.progression', name: 'progression' },
	{ icon: 'fa-solid fa-bolt', tooltip: 'NIMBLE.classSheet.rules', name: 'rules' },
] as const;

export type ClassSheetTabName = (typeof CLASS_SHEET_TAB_CONFIG)[number]['name'];

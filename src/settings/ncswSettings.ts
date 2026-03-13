export const NCSW_SIDEBAR_VIEW_MODE_SETTING_KEY = 'ncswSidebarViewMode';

const NCSW_SIDEBAR_VIEW_MODE_VALUES = ['combatTracker', 'ncs'] as const;
export type NcswSidebarViewMode = (typeof NCSW_SIDEBAR_VIEW_MODE_VALUES)[number];
const DEFAULT_NCSW_SIDEBAR_VIEW_MODE = 'ncs';
const NCSW_SIDEBAR_VIEW_MODE_SET = new Set<NcswSidebarViewMode>(NCSW_SIDEBAR_VIEW_MODE_VALUES);

export function normalizeNcswSidebarViewMode(value: unknown): NcswSidebarViewMode {
	if (typeof value !== 'string') return DEFAULT_NCSW_SIDEBAR_VIEW_MODE;

	const normalizedValue = value.trim().toLowerCase();
	return NCSW_SIDEBAR_VIEW_MODE_SET.has(normalizedValue as NcswSidebarViewMode)
		? (normalizedValue as NcswSidebarViewMode)
		: DEFAULT_NCSW_SIDEBAR_VIEW_MODE;
}

export function registerNcswSettings(): void {
	game.settings.register(
		'nimble' as 'core',
		NCSW_SIDEBAR_VIEW_MODE_SETTING_KEY as 'rollMode',
		{
			name: 'NCSW Sidebar View Mode',
			hint: 'Persists whether the NCSW or the combat tracker is currently shown.',
			scope: 'client',
			config: false,
			type: String,
			default: DEFAULT_NCSW_SIDEBAR_VIEW_MODE,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

export function isNcswSidebarViewModeSettingRegistered(): boolean {
	const settings = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	return settings?.has(`nimble.${NCSW_SIDEBAR_VIEW_MODE_SETTING_KEY}`) ?? false;
}

export function getPersistedNcswSidebarViewMode(): NcswSidebarViewMode {
	if (!isNcswSidebarViewModeSettingRegistered()) return DEFAULT_NCSW_SIDEBAR_VIEW_MODE;

	return normalizeNcswSidebarViewMode(
		game.settings.get('nimble' as 'core', NCSW_SIDEBAR_VIEW_MODE_SETTING_KEY as 'rollMode'),
	);
}

export async function setPersistedNcswSidebarViewMode(mode: NcswSidebarViewMode): Promise<void> {
	if (!isNcswSidebarViewModeSettingRegistered()) return;

	await game.settings.set(
		'nimble' as 'core',
		NCSW_SIDEBAR_VIEW_MODE_SETTING_KEY as 'rollMode',
		normalizeNcswSidebarViewMode(mode) as never,
	);
}

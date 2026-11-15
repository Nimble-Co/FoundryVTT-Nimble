interface SettingInfo {
	key: string;
	scope: string;
	/** The localized name, or blank when the setting has none. */
	name?: string;
	default: unknown;
	value: unknown;
}

interface ChangedSetting {
	scope: string;
	key: string;
	label: string;
	value: string;
}

type Words = (key: string, data?: Record<string, string>) => string;

/** State the system writes itself. The report shows the schema and the migration on their own. */
const INTERNAL = new Set([
	'worldSchemaVersion',
	'migrationReports',
	'migrationRun',
	'gridDiagonalsKept',
	'ncswSidebarViewMode',
]);

function entriesText(count: number, words: Words): string {
	return words(count === 1 ? 'entriesOne' : 'entries', { count: String(count) });
}

function readable(value: unknown, words: Words): string {
	if (typeof value === 'boolean') return words(value ? 'on' : 'off');
	if (Array.isArray(value)) return entriesText(value.length, words);
	if (value && typeof value === 'object') {
		const written: unknown = JSON.parse(JSON.stringify(value));
		if (written === null || typeof written !== 'object') return String(written);
		return entriesText(Object.keys(value).length, words);
	}
	return String(value);
}

/** The Nimble settings that are not at their defaults, client first. */
function changedSettings(settings: SettingInfo[], words: Words): ChangedSetting[] {
	return settings
		.filter((setting) => !INTERNAL.has(setting.key))
		.filter((setting) => JSON.stringify(setting.value) !== JSON.stringify(setting.default))
		.map((setting) => ({
			scope: setting.scope,
			key: setting.key,
			label: setting.name || setting.key,
			value: readable(setting.value, words),
		}))
		.sort((a, b) => a.scope.localeCompare(b.scope) || a.key.localeCompare(b.key));
}

export { changedSettings };
export type { ChangedSetting, SettingInfo, Words };

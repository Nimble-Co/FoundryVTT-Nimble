import { SYSTEM_ID } from '#system';

export const CUSTOM_SPELL_SCHOOLS_SETTING_KEY = 'customSpellSchools';

/** A GM-defined spell school that is merged into CONFIG.NIMBLE alongside the built-in schools. */
export interface CustomSpellSchool {
	/** Stable lowercase snake_case identifier stored on `spell.system.school`. */
	key: string;
	/** Human-readable label shown in pickers and headers. */
	label: string;
	/** Image path chosen from Foundry's file picker (e.g. `icons/svg/book.svg`). */
	icon: string;
}

/** Fallback icon (a Foundry core image) for a custom school that does not specify one. */
export const DEFAULT_CUSTOM_SCHOOL_ICON = 'icons/svg/book.svg';

/**
 * Snapshots of the built-in schools, captured before any custom schools are merged in.
 * Re-merging always rebuilds from these so the operation is idempotent and removing a
 * custom school in the editor cleanly removes it from CONFIG.
 */
let builtInSpellSchools: Record<string, string> | null = null;
let builtInSpellSchoolIcons: Record<string, string> | null = null;

function captureBuiltInSpellSchools(): void {
	if (builtInSpellSchools && builtInSpellSchoolIcons) return;
	const config = CONFIG.NIMBLE as unknown as {
		spellSchools: Record<string, string>;
		spellSchoolIcons: Record<string, string>;
	};
	builtInSpellSchools = { ...config.spellSchools };
	builtInSpellSchoolIcons = { ...config.spellSchoolIcons };
}

/** The keys of the schools that ship with the system and cannot be overridden by GMs. */
export function getBuiltInSpellSchoolKeys(): string[] {
	captureBuiltInSpellSchools();
	return Object.keys(builtInSpellSchools ?? {});
}

/** Normalize a raw school key into a safe, lowercase, snake_case identifier. */
export function sanitizeSpellSchoolKey(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Read the stored custom spell schools, dropping any entries that are malformed,
 * duplicated, or collide with a built-in school key.
 */
export function getCustomSpellSchools(): CustomSpellSchool[] {
	const raw = game.settings.get(
		SYSTEM_ID as 'core',
		CUSTOM_SPELL_SCHOOLS_SETTING_KEY as 'rollMode',
	);
	if (!Array.isArray(raw)) return [];

	const builtInKeys = new Set(getBuiltInSpellSchoolKeys());
	const seen = new Set<string>();
	const schools: CustomSpellSchool[] = [];

	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue;

		const candidate = entry as Partial<CustomSpellSchool>;
		const key = sanitizeSpellSchoolKey(candidate.key);
		if (!key || builtInKeys.has(key) || seen.has(key)) continue;

		const label =
			typeof candidate.label === 'string' && candidate.label.trim()
				? candidate.label.trim()
				: key.charAt(0).toUpperCase() + key.slice(1);

		const icon =
			typeof candidate.icon === 'string' && candidate.icon.trim()
				? candidate.icon.trim()
				: DEFAULT_CUSTOM_SCHOOL_ICON;

		seen.add(key);
		schools.push({ key, label, icon });
	}

	return schools;
}

/**
 * Rebuild CONFIG.NIMBLE.spellSchools / spellSchoolIcons from the built-in snapshot plus the
 * currently stored custom schools. Safe to call repeatedly (e.g. on setting change).
 */
export function mergeCustomSpellSchoolsIntoConfig(): void {
	captureBuiltInSpellSchools();

	const schools: Record<string, string> = { ...builtInSpellSchools };
	const icons: Record<string, string> = { ...builtInSpellSchoolIcons };

	for (const { key, label, icon } of getCustomSpellSchools()) {
		schools[key] = label;
		icons[key] = icon;
	}

	const config = CONFIG.NIMBLE as unknown as {
		spellSchools: Record<string, string>;
		spellSchoolIcons: Record<string, string>;
	};

	// Mutate the existing objects in place rather than reassigning, so components that
	// captured a reference to CONFIG.NIMBLE.spellSchools / spellSchoolIcons at init reflect
	// added or removed schools live without needing to be reopened.
	for (const key of Object.keys(config.spellSchools)) delete config.spellSchools[key];
	Object.assign(config.spellSchools, schools);

	for (const key of Object.keys(config.spellSchoolIcons)) delete config.spellSchoolIcons[key];
	Object.assign(config.spellSchoolIcons, icons);
}

/** Persist a new list of custom spell schools, triggering the merge via the setting's onChange. */
export async function setCustomSpellSchools(schools: CustomSpellSchool[]): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		CUSTOM_SPELL_SCHOOLS_SETTING_KEY as 'rollMode',
		schools as never,
	);
}

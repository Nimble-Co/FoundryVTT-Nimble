import { SYSTEM_ID } from '#system';

export const CUSTOM_CONDITIONS_SETTING_KEY = 'customConditions';

/** A GM-defined condition that is merged into CONFIG.NIMBLE alongside the built-in conditions. */
export interface CustomCondition {
	/** Stable lowercase snake_case identifier stored as the status id on active effects. */
	id: string;
	/** Human-readable name shown in the token HUD, condition lists, and enrichers. */
	name: string;
	/** Rules text shown in condition tooltips. May contain HTML, and may be empty. */
	description: string;
	/** Image path chosen from Foundry's file picker (e.g. `icons/svg/aura.svg`). */
	img: string;
}

/** Fallback icon (a Foundry core image) for a custom condition that does not specify one. */
export const DEFAULT_CUSTOM_CONDITION_ICON = 'icons/svg/aura.svg';

/** The shape of the condition dictionaries this module rebuilds on CONFIG.NIMBLE. */
interface ConditionConfig {
	conditions: Record<string, string>;
	conditionDescriptions: Record<string, string>;
	conditionDefaultImages: Record<string, string>;
}

/**
 * Snapshots of the built-in conditions, captured before any custom conditions are merged in.
 * Re-merging always rebuilds from these so the operation is idempotent and removing a custom
 * condition in the editor cleanly removes it from CONFIG.
 */
let builtInConditions: ConditionConfig | null = null;

function captureBuiltInConditions(): void {
	if (builtInConditions) return;

	const config = CONFIG.NIMBLE as unknown as ConditionConfig;
	builtInConditions = {
		conditions: { ...config.conditions },
		conditionDescriptions: { ...config.conditionDescriptions },
		conditionDefaultImages: { ...config.conditionDefaultImages },
	};
}

/** The ids of the conditions that ship with the system and cannot be overridden by GMs. */
export function getBuiltInConditionIds(): string[] {
	captureBuiltInConditions();
	return Object.keys(builtInConditions?.conditions ?? {});
}

/** Normalize a raw condition id into a safe, lowercase, snake_case identifier. */
export function sanitizeConditionId(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Read the stored custom conditions, dropping any entries that are malformed, duplicated,
 * or collide with a built-in condition id.
 */
export function getCustomConditions(): CustomCondition[] {
	const raw = game.settings.get(SYSTEM_ID as 'core', CUSTOM_CONDITIONS_SETTING_KEY as 'rollMode');
	if (!Array.isArray(raw)) return [];

	const builtInIds = new Set(getBuiltInConditionIds());
	const seen = new Set<string>();
	const conditions: CustomCondition[] = [];

	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue;

		const candidate = entry as Partial<CustomCondition>;
		const id = sanitizeConditionId(candidate.id);
		if (!id || builtInIds.has(id) || seen.has(id)) continue;

		const name =
			typeof candidate.name === 'string' && candidate.name.trim()
				? candidate.name.trim()
				: id.charAt(0).toUpperCase() + id.slice(1);

		const description =
			typeof candidate.description === 'string' ? candidate.description.trim() : '';

		const img =
			typeof candidate.img === 'string' && candidate.img.trim()
				? candidate.img.trim()
				: DEFAULT_CUSTOM_CONDITION_ICON;

		seen.add(id);
		conditions.push({ id, name, description, img });
	}

	return conditions;
}

/**
 * Rebuild CONFIG.NIMBLE.conditions / conditionDescriptions / conditionDefaultImages from the
 * built-in snapshot plus the currently stored custom conditions. Safe to call repeatedly
 * (e.g. on setting change).
 */
export function mergeCustomConditionsIntoConfig(): void {
	captureBuiltInConditions();

	const conditions: Record<string, string> = { ...builtInConditions?.conditions };
	const descriptions: Record<string, string> = { ...builtInConditions?.conditionDescriptions };
	const images: Record<string, string> = { ...builtInConditions?.conditionDefaultImages };

	for (const custom of getCustomConditions()) {
		conditions[custom.id] = custom.name;
		descriptions[custom.id] = custom.description;
		images[custom.id] = custom.img;
	}

	const config = CONFIG.NIMBLE as unknown as ConditionConfig;

	// Mutate the existing objects in place rather than reassigning, so components that captured
	// a reference to one of these dictionaries at init see added or removed conditions on their
	// next render without needing the whole config object swapped out from under them.
	replaceEntries(config.conditions, conditions);
	replaceEntries(config.conditionDescriptions, descriptions);
	replaceEntries(config.conditionDefaultImages, images);
}

function replaceEntries(target: Record<string, string>, source: Record<string, string>): void {
	for (const key of Object.keys(target)) delete target[key];
	Object.assign(target, source);
}

/** Persist a new list of custom conditions, triggering the merge via the setting's onChange. */
export async function setCustomConditions(conditions: CustomCondition[]): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		CUSTOM_CONDITIONS_SETTING_KEY as 'rollMode',
		conditions as never,
	);
}

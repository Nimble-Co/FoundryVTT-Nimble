import { SYSTEM_ID, systemHookName } from '#system';

export const CUSTOM_CONDITIONS_SETTING_KEY = 'customConditions';

/** Fired after the condition dictionaries are rebuilt, so open condition lists can refresh. */
export const CONDITIONS_CHANGED_HOOK = systemHookName('conditionsChanged');

/** A GM-defined condition, merged into CONFIG.NIMBLE alongside the built-in conditions. */
export interface CustomCondition {
	/** Stored as the status id on every active effect carrying this condition, so it is permanent. */
	id: string;
	name: string;
	/** Plain text, escaped into HTML on the way into CONFIG. May be empty. */
	description: string;
	img: string;
}

export const DEFAULT_CUSTOM_CONDITION_ICON = 'icons/svg/aura.svg';

interface ConditionConfig {
	conditions: Record<string, string>;
	conditionDescriptions: Record<string, string>;
	conditionDefaultImages: Record<string, string>;
}

/** The condition dictionaries, or null when any of them is not populated yet. */
function getConditionConfig(): ConditionConfig | null {
	const config = CONFIG.NIMBLE as unknown as Partial<ConditionConfig> | undefined;
	if (!config?.conditions || !config.conditionDescriptions || !config.conditionDefaultImages) {
		return null;
	}

	return config as ConditionConfig;
}

/**
 * The ids present before any custom condition was merged in, captured on the first merge. Custom
 * ids are rejected when they collide with one of these, so built-ins can never be overwritten.
 */
let builtInConditionIds: string[] | null = null;

function captureBuiltInConditionIds(): void {
	if (builtInConditionIds) return;

	// An empty snapshot would be cached forever and every id would then read as available, so bail
	// without caching rather than capturing an unpopulated config.
	const config = getConditionConfig();
	if (!config) return;

	builtInConditionIds = Object.keys(config.conditions);
}

export function getBuiltInConditionIds(): string[] {
	captureBuiltInConditionIds();
	return builtInConditionIds ?? [];
}

/** Normalize any input into a lowercase snake_case id, or an empty string if nothing survives. */
export function sanitizeConditionId(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Ids that break `CONFIG.statusEffects`. Its V14 proxy mirrors each entry onto the backing array
 * under `array[status.id]`, so an all-digit id writes an array index (going sparse, or throwing a
 * RangeError at `length`) and an `Array.prototype` name shadows the method used to republish it.
 */
export function isUnsafeConditionId(id: string): boolean {
	return /^\d+$/.test(id) || id in Array.prototype;
}

/**
 * Escape GM text into HTML, since the tooltip and enricher both interpolate descriptions raw,
 * built-ins being trusted i18n markup. Blank lines become paragraphs, single newlines breaks.
 */
function toDescriptionHtml(description: string): string {
	if (!description) return '';

	return description
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${foundry.utils.escapeHTML(paragraph).replaceAll('\n', '<br>')}</p>`)
		.join('');
}

/** The stored conditions, with malformed, unsafe, duplicate and built-in-colliding entries dropped. */
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
		if (!id || isUnsafeConditionId(id) || builtInIds.has(id) || seen.has(id)) continue;

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

/** The custom ids written by the last merge, so a later merge knows which ones to retire. */
let mergedCustomIds: string[] = [];

/**
 * Write the stored custom conditions into the CONFIG.NIMBLE dictionaries, retiring any id the
 * previous merge added that is no longer stored. Safe to call repeatedly, so the setting's onChange
 * can just call it again.
 */
export function mergeCustomConditionsIntoConfig(): void {
	captureBuiltInConditionIds();

	const config = getConditionConfig();
	if (!config) return;

	const customConditions = getCustomConditions();
	const currentIds = new Set(customConditions.map(({ id }) => id));

	// Only ids this merge owns are removed. Deleting every key and rebuilding would also destroy
	// entries a module added after the built-ins were captured.
	for (const retiredId of mergedCustomIds) {
		if (currentIds.has(retiredId)) continue;

		delete config.conditions[retiredId];
		delete config.conditionDescriptions[retiredId];
		delete config.conditionDefaultImages[retiredId];
	}

	// Mutated in place, not reassigned: anything holding a reference to one of these dictionaries
	// from init would otherwise keep the stale copy.
	for (const custom of customConditions) {
		config.conditions[custom.id] = custom.name;
		config.conditionDescriptions[custom.id] = toDescriptionHtml(custom.description);
		config.conditionDefaultImages[custom.id] = custom.img;
	}

	mergedCustomIds = [...currentIds];
}

/** Persist the conditions. The setting's onChange is what re-merges them into CONFIG. */
export async function setCustomConditions(conditions: CustomCondition[]): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		CUSTOM_CONDITIONS_SETTING_KEY as 'rollMode',
		conditions as never,
	);
}

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

/**
 * The built-in conditions as they were before any custom ones were merged in. Every merge rebuilds
 * from this, which is what makes the merge idempotent and makes removals in the editor stick.
 */
let builtInConditions: ConditionConfig | null = null;

function captureBuiltInConditions(): void {
	if (builtInConditions) return;

	const config = CONFIG.NIMBLE as unknown as ConditionConfig | undefined;
	// An empty snapshot would be cached forever and the next merge would wipe the built-ins out
	// of CONFIG, so bail without caching rather than capturing an unpopulated config.
	if (!config?.conditions) return;

	builtInConditions = {
		conditions: { ...config.conditions },
		conditionDescriptions: { ...config.conditionDescriptions },
		conditionDefaultImages: { ...config.conditionDefaultImages },
	};
}

export function getBuiltInConditionIds(): string[] {
	captureBuiltInConditions();
	return Object.keys(builtInConditions?.conditions ?? {});
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

/**
 * Rebuild the CONFIG.NIMBLE condition dictionaries from the built-in snapshot plus the stored
 * custom conditions. Safe to call repeatedly, so the setting's onChange can just call it again.
 */
export function mergeCustomConditionsIntoConfig(): void {
	captureBuiltInConditions();
	if (!builtInConditions) return;

	const conditions: Record<string, string> = { ...builtInConditions.conditions };
	const descriptions: Record<string, string> = { ...builtInConditions.conditionDescriptions };
	const images: Record<string, string> = { ...builtInConditions.conditionDefaultImages };

	for (const custom of getCustomConditions()) {
		conditions[custom.id] = custom.name;
		descriptions[custom.id] = toDescriptionHtml(custom.description);
		images[custom.id] = custom.img;
	}

	const config = CONFIG.NIMBLE as unknown as ConditionConfig;

	// Mutated in place, not reassigned: anything holding a reference to one of these dictionaries
	// from init would otherwise keep the stale copy.
	replaceEntries(config.conditions, conditions);
	replaceEntries(config.conditionDescriptions, descriptions);
	replaceEntries(config.conditionDefaultImages, images);
}

function replaceEntries(target: Record<string, string>, source: Record<string, string>): void {
	for (const key of Object.keys(target)) delete target[key];
	Object.assign(target, source);
}

/** Persist the conditions. The setting's onChange is what re-merges them into CONFIG. */
export async function setCustomConditions(conditions: CustomCondition[]): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		CUSTOM_CONDITIONS_SETTING_KEY as 'rollMode',
		conditions as never,
	);
}

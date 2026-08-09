import { SYSTEM_ID } from '#system';

export const INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY = 'includeSpellDescriptionOnScrolls';

/**
 * One home for the default, used both by the registration below and by the
 * pre-registration fallback, so the two can never answer differently.
 */
const INCLUDE_SPELL_DESCRIPTION_DEFAULT = true;

/**
 * Registers the spell scroll settings.
 *
 * World-scope: the value is baked into created documents, so a client-scope
 * toggle would give two players scribing the same spell two different items.
 */
export function registerSpellScrollSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.includeSpellDescriptionOnScrolls.name',
			hint: 'NIMBLE.settings.includeSpellDescriptionOnScrolls.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: INCLUDE_SPELL_DESCRIPTION_DEFAULT,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

/**
 * Whether a newly created spell scroll copies the inscribed spell's own
 * description beneath the fixed scroll rules.
 *
 * Falls back to the registered default when the setting is not yet registered,
 * which keeps callers working in tests and during early init.
 */
export function shouldIncludeSpellDescriptionOnScrolls(): boolean {
	const registered = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	const key = `${SYSTEM_ID}.${INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY}`;
	if (!registered?.has(key)) return INCLUDE_SPELL_DESCRIPTION_DEFAULT;

	return Boolean(
		game.settings.get(
			SYSTEM_ID as 'core',
			INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY as 'rollMode',
		),
	);
}

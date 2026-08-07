import { SYSTEM_ID } from '#system';

export const INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY = 'includeSpellDescriptionOnScrolls';

/**
 * Whether a newly created spell scroll copies the inscribed spell's own
 * description beneath the fixed scroll rules.
 *
 * World-scope: the value is baked into created documents, so a client-scope
 * toggle would give two players scribing the same spell two different items.
 *
 * Defaults to true when the setting is not registered, which keeps callers
 * working in tests and during early init.
 */
export default function shouldIncludeSpellDescriptionOnScrolls(): boolean {
	const registered = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	const key = `${SYSTEM_ID}.${INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY}`;
	if (!registered?.has(key)) return true;

	return Boolean(
		game.settings.get(
			SYSTEM_ID as 'core',
			INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY as 'rollMode',
		),
	);
}

/**
 * The Creator Credit recorded on content imported from another site.
 *
 * The credit is a courtesy to the person who made the content. It is not a
 * licence notice, so it must never claim rights or terms.
 */

import localize from '#utils/localize.js';
import { getImportSource, type ImportSourceId } from './importSources.js';

export const IMPORT_CREDIT_FLAG = 'importCredit';

/** The creator fields we keep. Both are nullable upstream and can be blank. */
export interface ImportCreator {
	username: string;
	displayName: string;
}

export interface ImportCredit {
	source: ImportSourceId;
	creator: ImportCreator;
}

/**
 * The name to credit: the display name, else the username, else nothing.
 */
export function getCreatorName(creator?: ImportCreator): string {
	return creator?.displayName?.trim() || creator?.username?.trim() || '';
}

/**
 * Build the credit to store, or nothing when there is nobody to credit.
 */
export function buildImportCredit(
	source: ImportSourceId,
	creator?: ImportCreator,
): ImportCredit | undefined {
	if (!getCreatorName(creator) || !creator) return undefined;

	return {
		source,
		creator: { username: creator.username.trim(), displayName: creator.displayName.trim() },
	};
}

/**
 * Render the credit as a sentence, linked to the creator's profile.
 * Returns an empty string when there is nothing to show.
 */
export function buildCreditHtml(credit?: ImportCredit): string {
	const name = getCreatorName(credit?.creator);
	const source = credit ? getImportSource(credit.source) : undefined;
	if (!name || !source) return '';

	const username = credit?.creator.username.trim() ?? '';
	// Creator names are third-party text entering the sheet as HTML.
	const escapedName = foundry.utils.escapeHTML(name);
	const credited = username
		? `<a href="${source.creatorProfileUrl(username)}">${escapedName}</a>`
		: escapedName;

	return localize('NIMBLE.actorImport.creatorCredit', {
		creator: credited,
		source: foundry.utils.escapeHTML(source.label),
	});
}

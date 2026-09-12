/**
 * Builds the Creator Credit shown on content imported from Nimble Nexus.
 *
 * The credit is a courtesy to the person who made the content. It is not a
 * licence notice, so it must never claim rights or terms.
 */

import localize from '#utils/localize.js';
import { NIMBLE_NEXUS_BASE_URL } from './constants.js';
import type { NimbleNexusCreator } from './types.js';

/**
 * The name to credit: the display name, else the username, else nothing.
 * Both fields are nullable on the API and arrive as empty strings.
 */
export function getCreatorName(creator?: NimbleNexusCreator): string {
	return creator?.displayName?.trim() || creator?.username?.trim() || '';
}

function buildCreatorCreditHtml(creator?: NimbleNexusCreator): string {
	const name = getCreatorName(creator);
	if (!name) return '';

	const username = creator?.username?.trim() ?? '';
	// Creator names are third-party text entering an HTMLField.
	const escapedName = foundry.utils.escapeHTML(name);
	const credited = username
		? `<a href="${NIMBLE_NEXUS_BASE_URL}/u/${encodeURIComponent(username)}">${escapedName}</a>`
		: escapedName;

	return `<p><em>${localize('NIMBLE.actorImport.creatorCredit', { creator: credited })}</em></p>`;
}

/**
 * Put the credit above an imported description.
 * The rule is omitted when there is no description to separate it from.
 */
export function withCreatorCredit(description: string, creator?: NimbleNexusCreator): string {
	const credit = buildCreatorCreditHtml(creator);
	if (!credit) return description;
	if (!description.trim()) return credit;

	return `${credit}<hr />${description}`;
}

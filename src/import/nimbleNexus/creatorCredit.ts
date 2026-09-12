/**
 * Builds the Creator Credit shown on content imported from Nimble Nexus.
 *
 * The credit is a courtesy to the person who made the content. It is not a
 * licence notice, so it must never claim rights or terms.
 */

import { NIMBLE_NEXUS_BASE_URL } from './constants.js';
import type { NimbleNexusCreator } from './types.js';

/**
 * Escape text for inclusion in an HTMLField.
 * Creator names come from a third party, so they are never trusted.
 */
function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * The name to credit: the display name, else the username, else nothing.
 * Both fields are nullable on the API and arrive as empty strings.
 */
export function getCreatorName(creator?: NimbleNexusCreator): string {
	return creator?.displayName?.trim() || creator?.username?.trim() || '';
}

/**
 * Build the credit line, or an empty string when there is nobody to credit.
 */
export function buildCreatorCreditHtml(creator?: NimbleNexusCreator): string {
	const name = getCreatorName(creator);
	if (!name) return '';

	const username = creator?.username?.trim() ?? '';
	const escapedName = escapeHtml(name);
	const credited = username
		? `<a href="${NIMBLE_NEXUS_BASE_URL}/u/${encodeURIComponent(username)}">${escapedName}</a>`
		: escapedName;

	return `<p><em>Created by ${credited} on Nimble Nexus.</em></p>`;
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

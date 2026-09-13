import { beforeEach, describe, expect, it } from 'vitest';
import {
	buildCreditHtml,
	buildImportCredit,
	getCreatorName,
	type ImportCreator,
} from './importCredit.js';

// The shared foundry mock has no escapeHTML, so stand one in for this suite only.
beforeEach(() => {
	(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
		value: string,
	) =>
		value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
});

const creator: ImportCreator = { username: 'jao7371', displayName: '(jao)' };

describe('getCreatorName', () => {
	it('prefers the display name', () => {
		expect(getCreatorName(creator)).toBe('(jao)');
	});

	it('falls back to the username when the display name is blank', () => {
		expect(getCreatorName({ username: 'jao7371', displayName: '' })).toBe('jao7371');
	});

	it('treats a whitespace-only display name as blank', () => {
		expect(getCreatorName({ username: 'jao7371', displayName: '   ' })).toBe('jao7371');
	});

	it('returns an empty string when both names are blank', () => {
		expect(getCreatorName({ username: '', displayName: '' })).toBe('');
	});

	it('returns an empty string when there is no creator', () => {
		expect(getCreatorName(undefined)).toBe('');
	});
});

describe('buildImportCredit', () => {
	it('records the source id, never the label', () => {
		expect(buildImportCredit('nimble-nexus', creator)).toEqual({
			source: 'nimble-nexus',
			creator: { username: 'jao7371', displayName: '(jao)' },
		});
	});

	it('trims the stored names', () => {
		expect(buildImportCredit('nimble-nexus', { username: ' a ', displayName: ' B ' })).toEqual({
			source: 'nimble-nexus',
			creator: { username: 'a', displayName: 'B' },
		});
	});

	it('records nothing when there is nobody to credit', () => {
		expect(buildImportCredit('nimble-nexus', { username: '', displayName: '' })).toBeUndefined();
	});

	it('records nothing when there is no creator', () => {
		expect(buildImportCredit('nimble-nexus', undefined)).toBeUndefined();
	});
});

describe('buildCreditHtml', () => {
	it('names the source and links the creator profile', () => {
		expect(buildCreditHtml({ source: 'nimble-nexus', creator })).toBe(
			'Created by <a href="https://nimble.nexus/u/jao7371">(jao)</a> on Nimble Nexus',
		);
	});

	it('uses the username as the link text when the display name is blank', () => {
		expect(
			buildCreditHtml({
				source: 'nimble-nexus',
				creator: { username: 'antlers6109', displayName: '' },
			}),
		).toBe(
			'Created by <a href="https://nimble.nexus/u/antlers6109">antlers6109</a> on Nimble Nexus',
		);
	});

	it('drops the link when the username is blank', () => {
		expect(
			buildCreditHtml({
				source: 'nimble-nexus',
				creator: { username: '', displayName: 'Some Body' },
			}),
		).toBe('Created by Some Body on Nimble Nexus');
	});

	it('escapes HTML in the name', () => {
		expect(
			buildCreditHtml({
				source: 'nimble-nexus',
				creator: { username: '', displayName: '<img src=x onerror="alert(1)">' },
			}),
		).toBe('Created by &lt;img src=x onerror=&quot;alert(1)&quot;&gt; on Nimble Nexus');
	});

	it('url-encodes the username in the profile link', () => {
		expect(
			buildCreditHtml({
				source: 'nimble-nexus',
				creator: { username: 'a b/c', displayName: 'Name' },
			}),
		).toContain('href="https://nimble.nexus/u/a%20b%2Fc"');
	});

	it('shows nothing when there is no credit', () => {
		expect(buildCreditHtml(undefined)).toBe('');
	});

	it('shows nothing when the source is not a known import source', () => {
		expect(buildCreditHtml({ source: 'some-other-site' as 'nimble-nexus', creator })).toBe('');
	});
});

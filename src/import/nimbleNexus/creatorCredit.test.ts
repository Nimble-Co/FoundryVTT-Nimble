import { beforeEach, describe, expect, it } from 'vitest';
import { getCreatorName, withCreatorCredit } from './creatorCredit.js';
import type { NimbleNexusCreator } from './types.js';

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

const creator: NimbleNexusCreator = {
	username: 'jao7371',
	displayName: '(jao)',
};

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

describe('withCreatorCredit', () => {
	it('links the display name to the creator profile', () => {
		expect(withCreatorCredit('', creator)).toBe(
			'<p><em>Created by <a href="https://nimble.nexus/u/jao7371">(jao)</a> on Nimble Nexus.</em></p>',
		);
	});

	it('uses the username as the link text when the display name is blank', () => {
		expect(withCreatorCredit('', { username: 'antlers6109', displayName: '' })).toBe(
			'<p><em>Created by <a href="https://nimble.nexus/u/antlers6109">antlers6109</a> on Nimble Nexus.</em></p>',
		);
	});

	it('drops the link when the username is blank', () => {
		expect(withCreatorCredit('', { username: '', displayName: 'Some Body' })).toBe(
			'<p><em>Created by Some Body on Nimble Nexus.</em></p>',
		);
	});

	it('escapes HTML in the name', () => {
		expect(
			withCreatorCredit('', { username: '', displayName: '<img src=x onerror="alert(1)">' }),
		).toBe(
			'<p><em>Created by &lt;img src=x onerror=&quot;alert(1)&quot;&gt; on Nimble Nexus.</em></p>',
		);
	});

	it('escapes the name even when it is also the link text', () => {
		expect(withCreatorCredit('', { username: 'a&b', displayName: '' })).toBe(
			'<p><em>Created by <a href="https://nimble.nexus/u/a%26b">a&amp;b</a> on Nimble Nexus.</em></p>',
		);
	});

	it('url-encodes the username in the profile link', () => {
		expect(withCreatorCredit('', { username: 'a b/c', displayName: 'Name' })).toContain(
			'href="https://nimble.nexus/u/a%20b%2Fc"',
		);
	});

	it('treats a whitespace-only description as absent', () => {
		expect(withCreatorCredit('   ', creator)).toBe(withCreatorCredit('', creator));
	});

	it('puts the credit above the description and separates the two', () => {
		expect(withCreatorCredit('<p>A big lizard.</p>', creator)).toBe(
			`${withCreatorCredit('', creator)}<hr /><p>A big lizard.</p>`,
		);
	});

	it('leaves the description untouched when there is no creator', () => {
		expect(withCreatorCredit('<p>A big lizard.</p>', undefined)).toBe('<p>A big lizard.</p>');
	});

	it('leaves the description untouched when the creator has no usable name', () => {
		expect(withCreatorCredit('<p>A big lizard.</p>', { username: '', displayName: '' })).toBe(
			'<p>A big lizard.</p>',
		);
	});

	it('adds nothing at all when there is no creator and no description', () => {
		expect(withCreatorCredit('', { username: '', displayName: '' })).toBe('');
	});
});

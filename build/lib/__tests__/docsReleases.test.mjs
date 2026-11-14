import { describe, expect, it } from 'vitest';
import { chooseDocsReleases } from '../docsReleases.mjs';

const stable = (tagName) => ({ tagName, isPrerelease: false, isDraft: false });
const beta = (tagName) => ({ tagName, isPrerelease: true, isDraft: false });

describe('chooseDocsReleases', () => {
	it('chooses the newest Stable Release, and no beta when none exists', () => {
		const result = chooseDocsReleases([stable('0.9.0'), stable('0.10.0'), stable('0.8.9')]);

		expect(result.stable).toBe('0.10.0');
		expect(result.beta).toBeNull();
	});

	it('chooses the newest Beta Release when it is newer than the newest Stable Release', () => {
		const result = chooseDocsReleases([
			stable('0.10.0'),
			beta('0.11.0-beta.9'),
			beta('0.11.0-beta.10'),
			beta('0.11.0-beta.2'),
		]);

		expect(result.stable).toBe('0.10.0');
		expect(result.beta).toBe('0.11.0-beta.10');
	});

	it('chooses no beta once the Stable Release of that version ships', () => {
		const result = chooseDocsReleases([stable('0.11.0'), beta('0.11.0-beta.10')]);

		expect(result.stable).toBe('0.11.0');
		expect(result.beta).toBeNull();
	});

	it('keeps a newer beta live when a stable patch ships', () => {
		const result = chooseDocsReleases([stable('0.10.1'), stable('0.10.0'), beta('0.11.0-beta.2')]);

		expect(result.stable).toBe('0.10.1');
		expect(result.beta).toBe('0.11.0-beta.2');
	});

	it('ignores releases that are neither a Stable Release nor a Beta Release, and says why', () => {
		const result = chooseDocsReleases([
			stable('0.10.0'),
			beta('latest-dev-1'),
			beta('0.11.0-rc.1'),
			beta('0.11.0-beta'),
			beta('0.12.0'),
			stable('0.11.0-beta.3'),
			{ tagName: '0.13.0', isPrerelease: false, isDraft: true },
		]);

		expect(result).toEqual({
			stable: '0.10.0',
			beta: null,
			ignored: [
				{ tag: 'latest-dev-1', reason: 'pre-release tag is not X.Y.Z-beta.N' },
				{ tag: '0.11.0-rc.1', reason: 'pre-release tag is not X.Y.Z-beta.N' },
				{ tag: '0.11.0-beta', reason: 'pre-release tag is not X.Y.Z-beta.N' },
				{ tag: '0.12.0', reason: 'pre-release tag is not X.Y.Z-beta.N' },
				{ tag: '0.11.0-beta.3', reason: 'release tag is not X.Y.Z' },
				{ tag: '0.13.0', reason: 'draft' },
			],
		});
	});
});

const STABLE_TAG = /^(\d+)\.(\d+)\.(\d+)$/;
const BETA_TAG = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;

// A stable X.Y.Z sorts after every X.Y.Z-beta.N.
function parse(tag, pattern) {
	const match = tag.match(pattern);
	if (!match) return null;
	const [major, minor, patch, beta] = match.slice(1).map(Number);
	return beta === undefined ? [major, minor, patch, 1, 0] : [major, minor, patch, 0, beta];
}

function compare(a, b) {
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		if (diff) return diff;
	}
	return 0;
}

function classify(release) {
	if (release.isDraft) return { reason: 'draft' };
	if (release.isPrerelease) {
		const version = parse(release.tagName, BETA_TAG);
		return version ? { kind: 'beta', version } : { reason: 'pre-release tag is not X.Y.Z-beta.N' };
	}
	const version = parse(release.tagName, STABLE_TAG);
	return version ? { kind: 'stable', version } : { reason: 'release tag is not X.Y.Z' };
}

/**
 * Choose the releases the docs site is built from.
 * @param {{ tagName: string, isPrerelease: boolean, isDraft: boolean }[]} releases
 * @returns {{ stable: string | null, beta: string | null, ignored: { tag: string, reason: string }[] }}
 */
export function chooseDocsReleases(releases) {
	const newest = { stable: null, beta: null };
	const ignored = [];
	for (const release of releases) {
		const { kind, version, reason } = classify(release);
		if (!kind) {
			ignored.push({ tag: release.tagName, reason });
			continue;
		}
		const best = newest[kind];
		if (!best || compare(version, best.version) > 0)
			newest[kind] = { tag: release.tagName, version };
	}

	const { stable, beta } = newest;
	const betaIsNewer = beta && (!stable || compare(beta.version, stable.version) > 0);
	return { stable: stable?.tag ?? null, beta: betaIsNewer ? beta.tag : null, ignored };
}

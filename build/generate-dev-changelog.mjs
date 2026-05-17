/* eslint-disable no-console */
/**
 * Generates the release body for the rolling `latest-dev` release, including
 * a list of PRs merged since the previous dev build. CI-only: invoked by
 * .github/workflows/dev-release.yml.
 *
 *   - Looks up the previous dev-build SHA via `gh release view latest-dev`.
 *   - Lists PRs (and any direct commits) in the range prev..HEAD.
 *   - Writes release-body.md ready for ncipollo/release-action `bodyFile:`.
 *
 * Failure modes:
 *   - No prior `latest-dev` release → skip changelog section entirely.
 *   - Empty SHA range → skip changelog section entirely.
 *   - Prev SHA not in history (force-push) → skip changelog section.
 *   - `gh pr view` fails for a PR → include PR with title from commit subject.
 *   - More than 50 PRs → cap at 50, note "and N earlier PRs not shown".
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PREV_TAG = 'latest-dev';
const MAX_PRS = 50;

const REPO = process.env.GITHUB_REPOSITORY ?? '';
const REPO_URL = `https://github.com/${REPO}`;

function sh(cmd, args, { allowFailure = false } = {}) {
	try {
		return execFileSync(cmd, args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trimEnd();
	} catch (err) {
		if (allowFailure) return null;
		throw err;
	}
}

function getPreviousSha() {
	const json = sh('gh', ['release', 'view', PREV_TAG, '--json', 'targetCommitish'], {
		allowFailure: true,
	});
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		const sha = parsed.targetCommitish;
		if (!sha || typeof sha !== 'string') return null;
		const exists = sh('git', ['cat-file', '-e', sha], { allowFailure: true });
		if (exists === null) {
			console.log(
				`[changelog] Previous SHA ${sha} not in local history (force-push?); skipping changelog.`,
			);
			return null;
		}
		return sha;
	} catch {
		return null;
	}
}

function getCommitsInRange(prevSha, currentSha) {
	const out = sh(
		'git',
		['log', '--no-merges', '--pretty=format:%H%x09%s', `${prevSha}..${currentSha}`],
		{ allowFailure: true },
	);
	if (out === null || out === '') return [];
	return out
		.split('\n')
		.map((line) => {
			const [sha, ...rest] = line.split('\t');
			return { sha, subject: rest.join('\t') };
		})
		.filter((c) => c.sha);
}

function parsePrNumber(subject) {
	const match = subject.match(/\(#(\d+)\)\s*$/);
	return match ? Number(match[1]) : null;
}

function fetchPr(number) {
	const json = sh('gh', ['pr', 'view', String(number), '--json', 'number,title,url'], {
		allowFailure: true,
	});
	if (!json) return null;
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}

function buildEntries(commits) {
	const entries = [];
	for (const commit of commits) {
		const prNumber = parsePrNumber(commit.subject);
		if (prNumber) {
			const pr = fetchPr(prNumber);
			if (pr) {
				entries.push({ kind: 'pr', number: pr.number, title: pr.title, url: pr.url });
			} else {
				const titleOnly = commit.subject.replace(/\s*\(#\d+\)\s*$/, '');
				entries.push({
					kind: 'pr',
					number: prNumber,
					title: titleOnly,
					url: `${REPO_URL}/pull/${prNumber}`,
				});
			}
		} else {
			entries.push({
				kind: 'commit',
				sha: commit.sha,
				shortSha: commit.sha.slice(0, 7),
				title: commit.subject,
				url: `${REPO_URL}/commit/${commit.sha}`,
			});
		}
	}
	return entries;
}

function escapeLinkText(text) {
	return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function renderPrList(entries, truncatedCount) {
	const lines = ['**Changes**'];
	for (const entry of entries) {
		const safeTitle = escapeLinkText(entry.title);
		if (entry.kind === 'pr') {
			lines.push(`- ${safeTitle} ([#${entry.number}](${entry.url}))`);
		} else {
			lines.push(`- ${safeTitle} ([\`${entry.shortSha}\`](${entry.url}))`);
		}
	}
	if (truncatedCount > 0) {
		lines.push(`- _…and ${truncatedCount} earlier PR${truncatedCount === 1 ? '' : 's'} not shown_`);
	}
	return lines.join('\n');
}

function buildBody({ version, shortSha, sha, timestamp, manifestUrl, hasChanges, prListMarkdown }) {
	const header = [
		'Rolling development build from the `dev` branch. **Unstable — for testing only.**',
		'',
		`- Version: \`${version}\``,
		`- Commit: [\`${shortSha}\`](${REPO_URL}/commit/${sha})`,
		`- Built: ${timestamp}`,
		'',
	];

	const install = ['Install in Foundry via Manifest URL:', '```', manifestUrl, '```'];

	if (!hasChanges) {
		return [...header, ...install].join('\n');
	}

	return [...header, prListMarkdown, '', ...install].join('\n');
}

function readEnv(name, { required = false } = {}) {
	const value = process.env[name];
	if (required && !value) {
		console.error(`[changelog] Missing required env var: ${name}`);
		process.exit(1);
	}
	return value ?? '';
}

function run() {
	const currentSha = readEnv('GITHUB_SHA', { required: true });
	const version = readEnv('VERSION', { required: true });
	const shortSha = readEnv('SHORT_SHA', { required: true });
	const timestamp = readEnv('TIMESTAMP');
	const manifestUrl = readEnv('MANIFEST_URL', { required: true });

	const prevSha = getPreviousSha();
	let entries = [];
	let truncatedCount = 0;

	if (prevSha && prevSha !== currentSha) {
		const commits = getCommitsInRange(prevSha, currentSha);
		if (commits.length > MAX_PRS) {
			truncatedCount = commits.length - MAX_PRS;
			entries = buildEntries(commits.slice(0, MAX_PRS));
		} else {
			entries = buildEntries(commits);
		}
	}

	const hasChanges = entries.length > 0;
	const prListMarkdown = hasChanges ? renderPrList(entries, truncatedCount) : '';

	const body = buildBody({
		version,
		shortSha,
		sha: currentSha,
		timestamp,
		manifestUrl,
		hasChanges,
		prListMarkdown,
	});

	writeFileSync('release-body.md', body);
	console.log(
		`[changelog] hasChanges=${hasChanges}, entries=${entries.length}, truncated=${truncatedCount}`,
	);
}

run();

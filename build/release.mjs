import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const RELEASE_BRANCH = 'main';
const RELEASE_TAG = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

/**
 * Run a command and return its trimmed stdout
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function run(command, args) {
	return execFileSync(command, args, { cwd: rootDir, encoding: 'utf-8' }).trim();
}

/**
 * Read the release tags from origin, so a stale local tag list cannot pick the version
 * @returns {{ major: number, minor: number, patch: number, beta: number | null }[]}
 */
function readRemoteReleaseTags() {
	return run('git', ['ls-remote', '--tags', '--refs', 'origin'])
		.split('\n')
		.map((line) => line.split('refs/tags/')[1])
		.map((tag) => tag?.match(RELEASE_TAG))
		.filter(Boolean)
		.map(([, major, minor, patch, beta]) => ({
			major: Number(major),
			minor: Number(minor),
			patch: Number(patch),
			beta: beta === undefined ? null : Number(beta),
		}));
}

/**
 * @param {{ major: number, minor: number, patch: number }} a
 * @param {{ major: number, minor: number, patch: number }} b
 */
function compareVersions(a, b) {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Increment the last stable version based on release type
 * @param {{ major: number, minor: number, patch: number }} version
 * @param {'major' | 'minor' | 'patch'} releaseType
 */
function incrementVersion({ major, minor, patch }, releaseType) {
	switch (releaseType) {
		case 'major':
			return { major: major + 1, minor: 0, patch: 0 };
		case 'minor':
			return { major, minor: minor + 1, patch: 0 };
		case 'patch':
			return { major, minor, patch: patch + 1 };
	}
}

/**
 * Work out the next tag: the next stable version, or the next beta of it
 * @param {'major' | 'minor' | 'patch'} releaseType
 * @param {boolean} beta
 * @returns {string}
 */
function nextReleaseTag(releaseType, beta) {
	const tags = readRemoteReleaseTags();
	const lastStable = tags
		.filter((tag) => tag.beta === null)
		.sort(compareVersions)
		.at(-1) ?? { major: 0, minor: 0, patch: 0 };

	const next = incrementVersion(lastStable, releaseType);
	const version = `${next.major}.${next.minor}.${next.patch}`;
	if (!beta) return version;

	const lastBeta = Math.max(
		0,
		...tags
			.filter((tag) => tag.beta !== null && compareVersions(tag, next) === 0)
			.map((tag) => tag.beta),
	);
	return `${version}-beta.${lastBeta + 1}`;
}

function release() {
	const args = process.argv.slice(2);
	const production = args.includes('--prod') || args.includes('--production');
	const beta = args.includes('--beta');
	const releaseType = args.find((arg) => ['major', 'minor', 'patch'].includes(arg));
	const notesIndex = args.indexOf('--notes');

	if (!releaseType) {
		console.error('Usage: pnpm release <major|minor|patch> [--beta] [--notes <file>] [--prod]');
		console.error('Example: pnpm release minor');
		console.error('Example: pnpm release minor --beta --prod');
		process.exit(1);
	}

	const tag = nextReleaseTag(releaseType, beta);
	const notesFile = notesIndex === -1 ? `release-notes-${tag}.md` : args[notesIndex + 1];
	const notesPath = path.resolve(rootDir, notesFile ?? '');
	const target = run('git', ['ls-remote', 'origin', `refs/heads/${RELEASE_BRANCH}`]).split(/\s/)[0];

	const ghArgs = [
		'release',
		'create',
		tag,
		'--target',
		RELEASE_BRANCH,
		'--title',
		beta ? tag : `V${tag}`,
		'--notes-file',
		notesPath,
	];
	if (beta) ghArgs.push('--prerelease');

	console.log(`Release:  ${tag}${beta ? ' (pre-release, not published to Foundry)' : ''}`);
	console.log(`Target:   origin/${RELEASE_BRANCH} at ${target.slice(0, 9)}`);
	console.log(`Notes:    ${path.relative(rootDir, notesPath)}`);

	if (!fs.existsSync(notesPath) || !fs.statSync(notesPath).isFile()) {
		console.error(`\nError: ${path.relative(rootDir, notesPath)} not found.`);
		console.error(
			'Write the notes first, e.g. with /nimble-release-notes, or pass --notes <file>.',
		);
		process.exit(1);
	}

	if (!production) {
		console.log(`\n[DRY-RUN] Would execute: gh ${ghArgs.join(' ')}`);
		console.log('Add --prod to create the release.');
		return;
	}

	execFileSync('gh', ghArgs, { cwd: rootDir, stdio: 'inherit' });
	console.log('\nRelease created. CI builds it and attaches nimble.zip and system.json.');
}

release();

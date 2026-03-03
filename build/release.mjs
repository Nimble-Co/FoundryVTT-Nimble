import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PACKAGE_JSON_PATH = path.join(rootDir, 'package.json');
const SYSTEM_JSON_PATH = path.join(rootDir, 'public/system.json');
const CHANGELOG_PATH = path.join(rootDir, 'CHANGELOG.md');

/**
 * Parse a semver version string into its components
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseVersion(version) {
	const [major, minor, patch] = version.split('.').map(Number);
	return { major, minor, patch };
}

/**
 * Increment version based on release type
 * @param {string} currentVersion - Current version string
 * @param {'major' | 'minor' | 'patch'} releaseType - Type of release
 * @returns {string} New version string
 */
function incrementVersion(currentVersion, releaseType) {
	const { major, minor, patch } = parseVersion(currentVersion);

	switch (releaseType) {
		case 'major':
			return `${major + 1}.0.0`;
		case 'minor':
			return `${major}.${minor + 1}.0`;
		case 'patch':
			return `${major}.${minor}.${patch + 1}`;
		default:
			throw new Error(`Invalid release type: ${releaseType}. Use 'major', 'minor', or 'patch'.`);
	}
}

/**
 * Update the download URL with the new version
 * @param {string} downloadUrl - Current download URL
 * @param {string} newVersion - New version string
 * @returns {string} Updated download URL
 */
function updateDownloadUrl(downloadUrl, newVersion) {
	return downloadUrl.replace(/\/download\/[\d.]+\//, `/download/${newVersion}/`);
}

/**
 * Read and parse a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {object} Parsed JSON content
 */
function readJsonFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	return JSON.parse(content);
}

/**
 * Write JSON to a file with proper formatting
 * @param {string} filePath - Path to JSON file
 * @param {object} data - Data to write
 */
function writeJsonFile(filePath, data) {
	fs.writeFileSync(filePath, `${JSON.stringify(data, null, '\t')}\n`);
}

/**
 * Prompt the user for input and return their response
 * @param {string} question - The question to ask
 * @returns {Promise<string>} The user's response
 */
function prompt(question) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

/**
 * Wait for the user to confirm the changelog is ready
 * @param {string} version - The version being released
 * @returns {Promise<void>}
 */
async function waitForChangelogConfirmation(version) {
	const changelogFile = `changelog-${version}.md`;

	console.log(`\n${'='.repeat(60)}`);
	console.log('CHANGELOG UPDATE REQUIRED');
	console.log('='.repeat(60));
	console.log(`\nPlease create ${changelogFile} with the release notes.`);
	console.log('The content will be prepended to CHANGELOG.md.\n');
	console.log('When finished, confirm to continue the release.\n');

	while (true) {
		const answer = await prompt('Is the changelog ready? (y/n): ');

		if (answer === 'y' || answer === 'yes') {
			const changelogPath = path.join(rootDir, changelogFile);
			if (!fs.existsSync(changelogPath)) {
				console.log(`\nError: ${changelogFile} not found. Please create it first.`);
				continue;
			}
			return;
		} else if (answer === 'n' || answer === 'no') {
			console.log('\nWaiting for changelog... Press Ctrl+C to abort.\n');
		} else {
			console.log('Please enter y or n.');
		}
	}
}

/**
 * Prepend the changelog entry to CHANGELOG.md
 * @param {string} version - The version being released
 */
function updateChangelog(version, dryRun) {
	const changelogFile = `changelog-${version}.md`;
	const changelogEntryPath = path.join(rootDir, changelogFile);
	const changelogEntry = fs.readFileSync(changelogEntryPath, 'utf-8');

	const currentChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf-8');

	// Find the position after the header (first ---)
	const headerEndIndex = currentChangelog.indexOf('---');
	if (headerEndIndex === -1) {
		throw new Error('Could not find header separator in CHANGELOG.md');
	}

	const header = currentChangelog.slice(0, headerEndIndex + 3);
	const rest = currentChangelog.slice(headerEndIndex + 3);

	const newChangelog = `${header}\n\n${changelogEntry.trim()}\n${rest}`;
	fs.writeFileSync(CHANGELOG_PATH, newChangelog);

	console.log(`Updated CHANGELOG.md with ${changelogFile} content`);

	if (dryRun) {
		console.log(`[DRY-RUN] Would remove: ${changelogEntryPath}`);
	} else {
		// Remove the temporary changelog file
		fs.unlinkSync(changelogEntryPath);
		console.log(`Removed temporary ${changelogFile}`);
	}
}

/**
 * Execute a command or log it in dry-run mode
 * @param {string} command - The command to execute
 * @param {object} options - execSync options
 * @param {boolean} dryRun - Whether to skip execution and just log
 * @param {string} [dryRunMessage] - Optional custom message for dry-run mode
 */
function execCommand(command, options, dryRun, dryRunMessage) {
	if (dryRun) {
		console.log(`[DRY-RUN] Would execute: ${dryRunMessage || command}`);
	} else {
		execSync(command, options);
	}
}

/**
 * Main release function
 */
async function release() {
	const args = process.argv.slice(2);
	const production = args.includes('--prod') || args.includes('--production');
	const dryRun = !production;
	const releaseType = args.find((arg) => ['major', 'minor', 'patch'].includes(arg));

	if (!releaseType) {
		console.error('Usage: node build/release.mjs <major|minor|patch> [--prod]');
		console.error('Example: node build/release.mjs patch');
		console.error('Example: node build/release.mjs minor --prod');
		process.exit(1);
	}

	if (dryRun) {
		console.log(`\n${'='.repeat(60)}`);
		console.log('DRY-RUN MODE - No git operations will be performed');
		console.log('Add --prod flag to execute the release');
		console.log(`${'='.repeat(60)}\n`);
	}

	// Read current files
	const packageJson = readJsonFile(PACKAGE_JSON_PATH);
	const systemJson = readJsonFile(SYSTEM_JSON_PATH);

	// Get current version from system.json (the source of truth for releases)
	const currentVersion = systemJson.version;
	const newVersion = incrementVersion(currentVersion, releaseType);

	console.log(`Releasing: ${currentVersion} -> ${newVersion} (${releaseType})`);

	// Update package.json
	packageJson.version = newVersion;
	writeJsonFile(PACKAGE_JSON_PATH, packageJson);
	console.log(`Updated package.json version to ${newVersion}`);

	// Update pnpm-lock.yaml
	execSync('pnpm install --lockfile-only', { cwd: rootDir });
	console.log(`Updated pnpm-lock.yaml version to ${newVersion}`);

	// Update system.json
	systemJson.version = newVersion;
	systemJson.download = updateDownloadUrl(systemJson.download, newVersion);
	writeJsonFile(SYSTEM_JSON_PATH, systemJson);
	console.log(`Updated public/system.json version to ${newVersion}`);
	console.log(`Updated download URL to ${systemJson.download}`);

	// Create initial git commit
	execCommand('git add package.json pnpm-lock.yaml public/system.json', { cwd: rootDir }, dryRun);
	execCommand(`git commit -m "chore(release): v${newVersion}"`, { cwd: rootDir }, dryRun);
	console.log(
		`${dryRun ? '[DRY-RUN] Would create' : 'Created'} commit: chore(release): v${newVersion}`,
	);

	// Wait for changelog to be created
	await waitForChangelogConfirmation(newVersion);

	// Update CHANGELOG.md with the new entry
	updateChangelog(newVersion, dryRun);

	// Amend the release commit to include changelog
	execCommand('git add CHANGELOG.md', { cwd: rootDir }, dryRun);
	execCommand('git commit --amend --no-edit', { cwd: rootDir }, dryRun);
	console.log(
		`${dryRun ? '[DRY-RUN] Would amend' : 'Amended'} release commit to include CHANGELOG.md`,
	);

	// Push dev branch
	execCommand('git push origin dev', { cwd: rootDir, stdio: 'inherit' }, dryRun);
	console.log(`${dryRun ? '[DRY-RUN] Would push' : 'Pushed'} dev branch to origin`);

	// Checkout main and merge dev
	execCommand('git checkout main', { cwd: rootDir, stdio: 'inherit' }, dryRun);
	console.log(`${dryRun ? '[DRY-RUN] Would checkout' : 'Checked out'} main branch`);

	execCommand('git merge dev', { cwd: rootDir, stdio: 'inherit' }, dryRun);
	console.log(`${dryRun ? '[DRY-RUN] Would merge' : 'Merged'} dev into main`);

	// Create release tag
	execCommand(`git tag ${newVersion}`, { cwd: rootDir }, dryRun);
	console.log(`${dryRun ? '[DRY-RUN] Would create' : 'Created'} tag: ${newVersion}`);

	// Push main branch and tags
	execCommand('git push origin main --tags', { cwd: rootDir, stdio: 'inherit' }, dryRun);
	console.log(`${dryRun ? '[DRY-RUN] Would push' : 'Pushed'} main branch and tags to origin`);

	if (dryRun) {
		console.log(`\n${'='.repeat(60)}`);
		console.log('DRY-RUN COMPLETE');
		console.log('='.repeat(60));
		console.log('\nFiles have been modified locally. To reset them, run:');
		console.log('  git checkout -- package.json pnpm-lock.yaml public/system.json CHANGELOG.md');
	} else {
		console.log('\nRelease ready! Complete steps in release guide to finish.');
	}
}

release();

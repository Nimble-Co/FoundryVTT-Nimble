import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PACKAGE_JSON_PATH = path.join(rootDir, 'package.json');
const SYSTEM_JSON_PATH = path.join(rootDir, 'public/system.json');

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
	fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n');
}

/**
 * Main release function
 */
function release() {
	const args = process.argv.slice(2);
	const releaseType = args[0];

	if (!releaseType || !['major', 'minor', 'patch'].includes(releaseType)) {
		console.error('Usage: node build/release.mjs <major|minor|patch>');
		console.error('Example: node build/release.mjs patch');
		process.exit(1);
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

	// Update package-lock.json
	execSync('npm install --package-lock-only', { cwd: rootDir });
	console.log(`Updated package-lock.json version to ${newVersion}`);

	// Update system.json
	systemJson.version = newVersion;
	systemJson.download = updateDownloadUrl(systemJson.download, newVersion);
	writeJsonFile(SYSTEM_JSON_PATH, systemJson);
	console.log(`Updated public/system.json version to ${newVersion}`);
	console.log(`Updated download URL to ${systemJson.download}`);

	// Create git commit
	execSync('git add package.json package-lock.json public/system.json', { cwd: rootDir });
	execSync(`git commit -m "chore(release): v${newVersion}"`, { cwd: rootDir });
	console.log(`Created commit: chore(release): v${newVersion}`);

	// Push dev branch
	execSync('git push origin dev', { cwd: rootDir, stdio: 'inherit' });
	console.log('Pushed dev branch to origin');

	// Checkout main and merge dev
	execSync('git checkout main', { cwd: rootDir, stdio: 'inherit' });
	console.log('Checked out main branch');

	execSync('git merge dev', { cwd: rootDir, stdio: 'inherit' });
	console.log('Merged dev into main');

	// Push main branch
	execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' });
	console.log('Pushed main branch to origin');

	console.log('\nRelease complete!');
}

release();

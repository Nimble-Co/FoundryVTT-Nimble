import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const SYSTEM_NAME = 'nimble';

/**
 * Run a command and stream output to console
 * @param {string} command - Command to run
 * @param {string} description - Description of the step
 */
function runCommand(command, description) {
	console.log(`\n${'─'.repeat(40)}`);
	console.log(`${description}...`);
	console.log(`$ ${command}`);
	console.log('─'.repeat(40));

	try {
		execSync(command, { cwd: rootDir, stdio: 'inherit' });
	} catch (err) {
		console.error(`\nFailed: ${description}`);
		process.exit(1);
	}
}

/**
 * Get the FoundryVTT data path based on the operating system
 * @returns {string} Path to FoundryVTT Data directory
 */
function getFoundryDataPath() {
	const platform = os.platform();
	const homeDir = os.homedir();

	switch (platform) {
		case 'darwin':
			return path.join(homeDir, 'Library', 'Application Support', 'FoundryVTT', 'Data');
		case 'win32':
			return path.join(homeDir, 'AppData', 'Local', 'FoundryVTT', 'Data');
		case 'linux':
			return path.join(homeDir, '.local', 'share', 'FoundryVTT', 'Data');
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
}

/**
 * Check if a path is a symlink
 * @param {string} linkPath - Path to check
 * @returns {boolean}
 */
function isSymlink(linkPath) {
	try {
		return fs.lstatSync(linkPath).isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * Check if a path exists (file, directory, or symlink)
 * @param {string} targetPath - Path to check
 * @returns {boolean}
 */
function pathExists(targetPath) {
	try {
		fs.lstatSync(targetPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Setup the symlink to FoundryVTT
 */
function setupSymlink() {
	const foundryDataPath = getFoundryDataPath();
	const systemsPath = path.join(foundryDataPath, 'systems');
	const targetSymlinkPath = path.join(systemsPath, SYSTEM_NAME);

	console.log(`\n${'─'.repeat(40)}`);
	console.log('Setting up FoundryVTT symlink...');
	console.log('─'.repeat(40));
	console.log(`Source (dist):    ${distDir}`);
	console.log(`Target (symlink): ${targetSymlinkPath}`);

	// Check if dist directory exists
	if (!fs.existsSync(distDir)) {
		console.error(`\nDist directory not found at: ${distDir}`);
		console.error('Make sure the build completed successfully.');
		process.exit(1);
	}

	// Check if FoundryVTT data directory exists
	if (!fs.existsSync(foundryDataPath)) {
		console.error(`\nFoundryVTT data directory not found at: ${foundryDataPath}`);
		console.error('Make sure FoundryVTT is installed and has been run at least once.');
		process.exit(1);
	}

	// Ensure systems directory exists
	if (!fs.existsSync(systemsPath)) {
		console.log(`Creating systems directory: ${systemsPath}`);
		fs.mkdirSync(systemsPath, { recursive: true });
	}

	// Handle existing path at target location
	if (pathExists(targetSymlinkPath)) {
		if (isSymlink(targetSymlinkPath)) {
			const currentTarget = fs.readlinkSync(targetSymlinkPath);
			if (currentTarget === distDir) {
				console.log('Symlink already exists and points to this dist folder.');
				return;
			}
			console.log(`Replacing existing symlink (was: ${currentTarget})`);
			fs.unlinkSync(targetSymlinkPath);
		} else {
			console.error(`\nA file or directory already exists at: ${targetSymlinkPath}`);
			console.error('Please remove it manually before running this script.');
			process.exit(1);
		}
	}

	// Create the symlink
	try {
		fs.symlinkSync(distDir, targetSymlinkPath, 'dir');
		console.log('Symlink created successfully!');
	} catch (err) {
		console.error('Failed to create symlink:', err.message);
		process.exit(1);
	}
}

/**
 * Main setup function
 */
function setup() {
	console.log('');
	console.log('╔════════════════════════════════════════╗');
	console.log('║     Worktree Setup for FoundryVTT      ║');
	console.log('╚════════════════════════════════════════╝');

	// Step 1: Install dependencies
	runCommand('npm install', 'Installing dependencies');

	// Step 2: Build the system
	runCommand('npm run build', 'Building system and compendia');

	// Step 3: Setup symlink
	setupSymlink();

	console.log('');
	console.log('╔════════════════════════════════════════╗');
	console.log('║            Setup Complete!             ║');
	console.log('╚════════════════════════════════════════╝');
	console.log('');
	console.log('You can now start FoundryVTT and it will use this worktree.');
	console.log('For development, run: npm run dev');
	console.log('');
}

setup();

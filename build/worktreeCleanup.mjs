import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const SYSTEM_NAME = 'nimble';

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
 * Prompt user with a menu of options
 * @param {string} title - Title for the prompt box
 * @param {string[]} infoLines - Additional info lines to display
 * @param {Array<{key: string, label: string}>} options - Menu options
 * @returns {Promise<string>} - The selected option key
 */
async function promptUser(title, infoLines, options) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const maxWidth = Math.max(
		title.length,
		...infoLines.map((l) => l.length),
		...options.map((o) => `  ${o.key}. ${o.label}`.length),
	);
	const boxWidth = maxWidth + 4;

	console.log('');
	console.log(`╔${'═'.repeat(boxWidth)}╗`);
	console.log(`║  ${title.padEnd(boxWidth - 2)}║`);
	for (const line of infoLines) {
		console.log(`║  ${line.padEnd(boxWidth - 2)}║`);
	}
	console.log(`╚${'═'.repeat(boxWidth)}╝`);
	console.log('');
	console.log('What would you like to do?');
	console.log('');

	for (const option of options) {
		console.log(`  ${option.key}. ${option.label}`);
	}

	console.log('');

	return new Promise((resolve) => {
		const validKeys = options.map((o) => o.key);

		const askQuestion = () => {
			rl.question('> ', (answer) => {
				const trimmed = answer.trim();
				if (validKeys.includes(trimmed)) {
					rl.close();
					resolve(trimmed);
				} else {
					console.log(`Please enter one of: ${validKeys.join(', ')}`);
					askQuestion();
				}
			});
		};

		askQuestion();
	});
}

/**
 * Main cleanup function
 */
async function cleanup() {
	console.log('');
	console.log('╔════════════════════════════════════════╗');
	console.log('║    Worktree Cleanup for FoundryVTT     ║');
	console.log('╚════════════════════════════════════════╝');

	// Get custom path from argument if provided
	const customPath = process.argv[2];
	const foundryDataPath = customPath || getFoundryDataPath();

	if (customPath) {
		if (!fs.existsSync(customPath)) {
			console.error(`\nCustom FoundryVTT data path does not exist: ${customPath}`);
			process.exit(1);
		}
		console.log(`\nUsing custom FoundryVTT data path: ${customPath}`);
	}

	const systemsPath = path.join(foundryDataPath, 'systems');
	const nimblePath = path.join(systemsPath, SYSTEM_NAME);
	const backupPath = path.join(systemsPath, `${SYSTEM_NAME}.backup`);

	console.log(`\nChecking: ${nimblePath}`);

	// Check if the path exists
	if (!pathExists(nimblePath)) {
		console.log('\nNo nimble system found at the expected location.');
		console.log('Nothing to clean up.');
		process.exit(0);
	}

	const isLink = isSymlink(nimblePath);
	const hasBackup = pathExists(backupPath);

	// Handle regular directory (not a symlink)
	if (!isLink) {
		console.log('\nThe nimble system at this location is NOT a symlink.');
		console.log('It appears to be a regular installation.');

		if (hasBackup) {
			console.log(`  Backup found: ${backupPath}`);
		}

		const options = [
			{ key: '1', label: 'Remove system for fresh install' },
			{ key: '2', label: 'Cancel (keep current installation)' },
		];

		const choice = await promptUser(
			'Regular installation detected',
			[
				'This is not a dev symlink',
				hasBackup ? `Backup exists: ${SYSTEM_NAME}.backup` : 'No backup found',
			],
			options,
		);

		switch (choice) {
			case '1':
				console.log('\nRemoving nimble system...');
				fs.rmSync(nimblePath, { recursive: true, force: true });
				if (hasBackup) {
					console.log('Removing backup...');
					fs.rmSync(backupPath, { recursive: true, force: true });
				}
				console.log('All nimble data removed.');
				console.log('');
				console.log('You can now install a fresh copy from the FoundryVTT setup screen.');
				break;

			case '2':
				console.log('\nCleanup cancelled. Installation unchanged.');
				break;
		}
	} else {
		// It's a symlink - show info and offer options
		const currentTarget = fs.readlinkSync(nimblePath);

		console.log(`\nFound development symlink:`);
		console.log(`  Symlink: ${nimblePath}`);
		console.log(`  Points to: ${currentTarget}`);

		if (hasBackup) {
			console.log(`  Backup found: ${backupPath}`);
		}

		const options = [{ key: '1', label: 'Remove symlink only' }];

		if (hasBackup) {
			options.push({ key: '2', label: 'Remove symlink and restore backup' });
		}

		options.push(
			{ key: '3', label: 'Remove all (symlink + backup) for fresh install' },
			{ key: '4', label: 'Cancel (keep symlink)' },
		);

		const choice = await promptUser(
			'Development symlink detected',
			[
				`Points to: ${currentTarget}`,
				hasBackup ? `Backup available: ${SYSTEM_NAME}.backup` : 'No backup found',
			],
			options,
		);

		switch (choice) {
			case '1':
				console.log('\nRemoving symlink...');
				fs.unlinkSync(nimblePath);
				console.log('Symlink removed.');
				console.log('');
				console.log('To use the official Nimble system, you can:');
				console.log('  1. Install it from the FoundryVTT setup screen');
				console.log('  2. Or download it from the Nimble releases page');
				break;

			case '2':
				console.log('\nRemoving symlink...');
				fs.unlinkSync(nimblePath);
				console.log('Restoring backup...');
				fs.renameSync(backupPath, nimblePath);
				console.log('Backup restored successfully!');
				break;

			case '3':
				console.log('\nRemoving symlink...');
				fs.unlinkSync(nimblePath);
				if (hasBackup) {
					console.log('Removing backup...');
					fs.rmSync(backupPath, { recursive: true, force: true });
				}
				console.log('All nimble data removed.');
				console.log('');
				console.log('You can now install a fresh copy from the FoundryVTT setup screen.');
				break;

			case '4':
				console.log('\nCleanup cancelled. Symlink unchanged.');
				break;
		}
	}

	console.log('');
	console.log('╔════════════════════════════════════════╗');
	console.log('║           Cleanup Complete!            ║');
	console.log('╚════════════════════════════════════════╝');
	console.log('');
}

cleanup();

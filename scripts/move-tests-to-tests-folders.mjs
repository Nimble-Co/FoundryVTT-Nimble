#!/usr/bin/env node
/**
 * Moves every unit test and test harness into a `__tests__` folder next to the
 * code it tests, and rewrites relative specifiers so they still resolve.
 *
 *   pnpm tests:relocate            move and rewrite
 *   pnpm tests:relocate --dry-run  print the plan only
 *
 * Safe to run again: files already in `__tests__` are left alone. Run it after a
 * rebase that brings in tests written next to the source.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'build'];
const MOVABLE = /\.(test|spec)\.(ts|js|mjs|svelte\.ts)$|\.testHarness\.svelte$/;
const REWRITABLE = /\.(ts|js|mjs|svelte)$/;
const DRY_RUN = process.argv.includes('--dry-run');

// `from '...'`, `import '...'`, `import('...')`, `vi.mock('...')`, `vi.importActual('...')` and friends.
const SPECIFIER =
	/(\bfrom\s*|\bimport\s*\(?\s*|\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\s*(?:<[^>]*>)?\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files', '-z', '--', ...ROOTS], { encoding: 'utf8' })
	.split('\0')
	.filter(Boolean)
	.filter((file) => existsSync(file));

const moves = new Map();
for (const file of tracked) {
	if (!MOVABLE.test(file)) continue;
	const dir = path.dirname(file);
	if (dir.split('/').includes('__tests__')) continue;
	moves.set(path.resolve(root, file), path.resolve(root, dir, '__tests__', path.basename(file)));
}

if (moves.size === 0) {
	console.log('Nothing to move. Every test is in a __tests__ folder.');
	process.exit(0);
}

const EXTENSIONS = ['', '.ts', '.js', '.mjs', '.svelte', '.svelte.ts', '/index.ts', '/index.js'];

/** The moved file a specifier points at, or undefined. */
function movedTarget(absSpecifier) {
	const bare = absSpecifier.replace(/\.js$/, '');
	for (const candidate of [absSpecifier, ...EXTENSIONS.map((ext) => bare + ext)]) {
		if (moves.has(candidate)) return candidate;
	}
	return undefined;
}

function toSpecifier(fromDir, absTarget) {
	const rel = path.relative(fromDir, absTarget).split(path.sep).join('/');
	return rel.startsWith('.') ? rel : `./${rel}`;
}

function rewrite(source, oldDir, newDir) {
	return source.replace(SPECIFIER, (match, lead, quote, specifier) => {
		const [pathPart, query = ''] = specifier.split(/(?=\?)/);
		const absOld = path.resolve(oldDir, pathPart);
		const target = movedTarget(absOld);
		const absNew = target
			? path.join(path.dirname(moves.get(target)), path.basename(absOld))
			: absOld;
		const next = toSpecifier(newDir, absNew) + query;
		return next === specifier ? match : `${lead}${quote}${next}${quote}`;
	});
}

let rewritten = 0;
for (const file of tracked) {
	if (!REWRITABLE.test(file)) continue;
	const abs = path.resolve(root, file);
	const destination = moves.get(abs) ?? abs;
	const source = readFileSync(abs, 'utf8');
	const next = rewrite(source, path.dirname(abs), path.dirname(destination));
	if (destination === abs) {
		if (next === source) continue;
		rewritten += 1;
		if (DRY_RUN) console.log(`rewrite ${file}`);
		else writeFileSync(abs, next);
		continue;
	}
	if (DRY_RUN) {
		console.log(`move    ${file} -> ${path.relative(root, destination)}`);
		continue;
	}
	mkdirSync(path.dirname(destination), { recursive: true });
	execFileSync('git', ['mv', file, path.relative(root, destination)]);
	writeFileSync(destination, next);
}

console.log(
	`${DRY_RUN ? 'Would move' : 'Moved'} ${moves.size} files${rewritten ? `, rewrote ${rewritten} other files` : ''}.`,
);

// Text outside the code that still names an old path (docs, review config, agent files).
const oldPaths = [...moves.keys()].map((abs) => path.relative(root, abs));
const textFiles = execFileSync(
	'git',
	['ls-files', '-z', '--', '*.md', '*.yaml', '*.yml', '*.json', '*.cjs'],
	{
		encoding: 'utf8',
	},
)
	.split('\0')
	.filter(Boolean)
	.filter((file) => existsSync(file) && !file.startsWith('packs/'));
const stale = [];
for (const file of textFiles) {
	const text = readFileSync(file, 'utf8');
	for (const old of oldPaths) if (text.includes(old)) stale.push(`${file}: ${old}`);
}
if (stale.length > 0) {
	console.log('\nThese files still name an old test path. Update them by hand:');
	for (const line of stale) console.log(`  ${line}`);
}

// svelte-check follows imports into the old sheet code, which does not pass it (and where it and tsc
// disagree). This check reports and fails only on the files of the new actor sheets and Storybook.
import { spawnSync } from 'node:child_process';

const SCOPE = /^"(src\/view\/actorSheets\/|storybook\/)/;

const run = spawnSync(
	'svelte-check',
	['--tsconfig', './tsconfig.actorSheets.json', '--output', 'machine', '--fail-on-warnings'],
	{ encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 },
);
if (run.error) throw run.error;

const lines = `${run.stdout}${run.stderr}`.split('\n');
const found = lines
	.map((line) => line.split(' '))
	.filter(([, level, file]) => (level === 'ERROR' || level === 'WARNING') && SCOPE.test(file ?? ''))
	.map((parts) => parts.slice(1).join(' '));

if (!lines.some((line) => line.includes(' COMPLETED '))) {
	console.error(`${run.stdout}${run.stderr}`);
	console.error('svelte-check did not complete.');
	process.exit(1);
}
for (const diagnostic of found) console.error(diagnostic);
console.log(`svelte-check: ${found.length} problems in src/view/actorSheets and storybook.`);
process.exit(found.length ? 1 : 0);

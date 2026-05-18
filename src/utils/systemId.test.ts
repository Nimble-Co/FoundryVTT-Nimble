import { readFileSync } from 'node:fs';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';

/**
 * Foundry namespaces flags, settings, sheet registration, and pack UUIDs by the
 * system's installed id. The stable build installs as `nimble`; the dev rolling
 * release installs as `nimble-dev`. Hardcoded `'nimble'` literals in source
 * silently break under the dev id.
 *
 * Every system-id usage MUST go through SYSTEM_ID / SYSTEM_PATH (imported from
 * `#system`), so the value is baked from `public/system.json` at build time and
 * `dev-rebrand.mjs`'s manifest mutation flows through automatically.
 *
 * This test scans production source for the forbidden forms. Test files are
 * exempt because SYSTEM_ID === 'nimble' in the test environment.
 */

interface ForbiddenPattern {
	readonly id: string;
	readonly re: RegExp;
	readonly hint: string;
}

const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
	{
		id: 'flag-api-quoted-scope',
		re: /\b(?:setFlag|getFlag|unsetFlag)\s*\(\s*['"]nimble['"]/,
		hint: "Use SYSTEM_ID — `actor.setFlag(SYSTEM_ID, ...)`. Import from '#system'.",
	},
	{
		id: 'settings-quoted-scope',
		re: /game\.(?:settings|keybindings)[\s\S]*?\(\s*['"]nimble['"]/,
		hint: "Use SYSTEM_ID — `game.settings.get(SYSTEM_ID as 'core', ...)`. Import from '#system'.",
	},
	{
		id: 'register-sheet-quoted-scope',
		re: /\.(?:registerSheet|unregisterSheet)\s*\(\s*['"]nimble['"]/,
		hint: 'Use SYSTEM_ID for sheet registration.',
	},
	{
		id: 'nimble-as-core-cast',
		re: /['"]nimble['"]\s+as\s+['"]core['"]/,
		hint: "Use `SYSTEM_ID as 'core'` instead of `'nimble' as 'core'`.",
	},
	{
		id: 'flags-nimble-string-path',
		re: /['"`]flags\.nimble\./,
		hint: 'Use a template literal `flags.{SYSTEM_ID}.X` (or the relevant *RuleConfig.flagPath constant).',
	},
	{
		id: 'flags-nimble-property-access',
		re: /\.flags\.nimble(?=[\s.?[)\];,}]|$)/,
		hint: 'Use `flags[SYSTEM_ID]` for property access instead of `flags.nimble`.',
	},
];

const SOURCE_GLOB = 'src/**/*.{ts,svelte,svelte.ts}';
const EXCLUDE_GLOBS: readonly string[] = [
	'src/**/*.test.ts',
	'src/**/*.test.svelte.ts',
	'src/**/*.spec.ts',
	// systemId.ts is the source of truth for the value.
	'src/utils/systemId.ts',
];

const SELF_PATH_FRAGMENT = 'src/utils/systemId.test.ts';

function findOffenders(file: string, source: string): string[] {
	const offenders: string[] = [];
	const lines = source.split(/\r?\n/);
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		// Allow inline opt-out for any genuinely correct usage that happens to
		// match a pattern (vanishingly rare; reviewers should be skeptical).
		if (line.includes('// allow-hardcoded-system-id')) continue;

		for (const { id, re, hint } of FORBIDDEN_PATTERNS) {
			if (re.test(line)) {
				offenders.push(`${file}:${i + 1}  [${id}]\n    ${line.trim()}\n    → ${hint}`);
			}
		}
	}
	return offenders;
}

describe('SYSTEM_ID enforcement', () => {
	it('no hardcoded "nimble" literal targets the runtime system id in production source', async () => {
		const files = await glob(SOURCE_GLOB, { ignore: [...EXCLUDE_GLOBS], posix: true });
		const offenders: string[] = [];

		for (const file of files) {
			if (file.endsWith(SELF_PATH_FRAGMENT)) continue;
			const source = readFileSync(file, 'utf8');
			offenders.push(...findOffenders(file, source));
		}

		expect(
			offenders,
			`Hardcoded system id found. Import SYSTEM_ID from '#system' and use it instead. ` +
				`See AGENTS.md → "Never hardcode 'nimble' as the system id". Offenders:\n\n${offenders.join('\n\n')}`,
		).toEqual([]);
	});
});

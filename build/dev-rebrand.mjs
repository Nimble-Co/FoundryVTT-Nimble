/* eslint-disable no-console */
/**
 * Rebrands the system from `nimble` to `nimble-dev` so the rolling dev release
 * can be installed in Foundry side-by-side with the stable `nimble` system.
 * CI-only: invoked by .github/workflows/dev-release.yml *before* `pnpm build`,
 * so the LevelDB compendia produced by the build already contain the rewritten
 * references. The script mutates tracked files in-place — it must NEVER run
 * against a working tree whose changes you intend to keep.
 *
 * What gets rewritten:
 *
 *   1. public/system.json
 *      - `id`           → "nimble-dev"   (Foundry installs to Data/systems/<id>/)
 *      - `title`        → "Nimble (Dev)" (so the dev install is visually
 *                                         distinguishable in Foundry's UI)
 *      - `packs[*].system` → "nimble-dev" (Foundry rejects packs whose
 *                                          `system` field doesn't match the
 *                                          system id)
 *      - `background`      path prefix `systems/nimble/` → `systems/nimble-dev/`
 *                          (so the splash image resolves under the dev install)
 *
 *   2. packs/**\/*.json (compendium document sources)
 *      - `Compendium.nimble.<pack>.<docId>` → `Compendium.nimble-dev.<pack>.<docId>`
 *        Foundry resolves compendium UUIDs by system id; without this rewrite,
 *        cross-pack references (class progressions linking to spells, etc.)
 *        would dangle under the dev install.
 *      - `systems/nimble/<asset>` → `systems/nimble-dev/<asset>`
 *        Document `img`/`src` fields point at class images, monster portraits,
 *        and other system assets. Without this rewrite, every Foundry document
 *        loaded from a compendium would 404 on its image under the dev install.
 *
 * SCSS namespacing (`.system-#{system-id()}`) is handled by a sass function
 * registered in `vite.config.mts` — no rebrand work needed here.
 *
 * Idempotent: every regex requires a non-`-` boundary immediately after
 * `nimble`, so they don't match the already-rewritten `nimble-dev` form.
 * Running the script twice is a no-op on the second pass.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'glob';

const STABLE_ID = 'nimble';
const DEV_ID = 'nimble-dev';
const DEV_TITLE = 'Nimble (Dev)';

const manifestPath = 'public/system.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.id = DEV_ID;
manifest.title = DEV_TITLE;
for (const pack of manifest.packs) {
	if (pack.system === STABLE_ID) pack.system = DEV_ID;
}
if (typeof manifest.background === 'string') {
	manifest.background = manifest.background.replace(`systems/${STABLE_ID}/`, `systems/${DEV_ID}/`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`[rebrand] Updated ${manifestPath} (id=${DEV_ID}, title="${DEV_TITLE}")`);

async function rewriteFiles(globPattern, replacements, label) {
	const files = await glob(globPattern);
	let touched = 0;
	for (const file of files) {
		const original = readFileSync(file, 'utf8');
		let updated = original;
		for (const [pattern, replacement] of replacements) {
			updated = updated.replace(pattern, replacement);
		}
		if (updated === original) continue;
		writeFileSync(file, updated);
		touched++;
	}
	console.log(`[rebrand] Rewrote ${touched} ${label}`);
}

await rewriteFiles(
	'packs/**/*.json',
	[
		[/Compendium\.nimble\./g, `Compendium.${DEV_ID}.`],
		[/systems\/nimble\//g, `systems/${DEV_ID}/`],
	],
	'pack files (Compendium UUIDs + asset paths)',
);

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
 *
 * Idempotent: the regex `Compendium\.nimble\.` requires a literal dot after
 * `nimble`, so it does not match the already-rewritten `Compendium.nimble-dev.`.
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

const packFiles = await glob('packs/**/*.json');
const uuidPattern = /Compendium\.nimble\./g;
let touched = 0;
for (const file of packFiles) {
	const original = readFileSync(file, 'utf8');
	if (!uuidPattern.test(original)) continue;
	const updated = original.replace(uuidPattern, `Compendium.${DEV_ID}.`);
	writeFileSync(file, updated);
	touched++;
}
console.log(`[rebrand] Rewrote Compendium UUIDs in ${touched} pack files`);
